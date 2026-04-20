// Per-leg climb/cruise/descent phase modeling. Pure math, no React or
// provider deps — safe to call from tests and from the navlog hook.

import {
  climbProfile,
  descentProfile,
  eteMinutes,
  greatCircleDistanceNm,
  greatCircleInitialBearingDeg,
  interpolateWinds,
  windTriangle,
} from './aviation-math';
import type {
  AircraftProfile,
  Leg,
  NavlogWarning,
  PhaseSegment,
  Waypoint,
  WindsEntryRow,
} from '../types';

export interface PhaseLegInput {
  leg: Leg;
  fromWp: Waypoint;
  toWp: Waypoint;
  /** Cruise altitude from the prior leg, or null if this is the first leg. */
  prevCruiseAlt: number | null;
  /** Cruise altitude of the next leg, or null if this is the final leg. */
  nextCruiseAlt: number | null;
  /** Departure airport elevation (used when this is the first leg). */
  departureElevFt: number;
  /** Arrival airport elevation (used when this is the final leg). */
  arrivalElevFt: number;
  aircraft: AircraftProfile;
  winds: WindsEntryRow[];
}

export interface PhaseLegResult {
  distanceNm: number;
  trueCourseDeg: number;
  windCorrectionAngleDeg: number;
  trueHeadingDeg: number;
  groundSpeedKt: number;
  cruiseTasKt: number;
  climb: PhaseSegment | null;
  cruise: PhaseSegment;
  descent: PhaseSegment | null;
  totalTimeMin: number;
  totalFuelGal: number;
  warnings: NavlogWarning[];
}

const TAKEOFF_MARGIN_FT = 50;
const PATTERN_ENTRY_AGL_FT = 1000;

function legWind(leg: Leg, winds: WindsEntryRow[]) {
  if (leg.windDir !== undefined && leg.windKt !== undefined) {
    return { dirTrueDeg: leg.windDir, speedKt: leg.windKt };
  }
  return interpolateWinds(winds, leg.altFt);
}

/**
 * Compute a single leg split into climb/cruise/descent phases. The climb
 * phase is included when the incoming altitude (prior leg's cruise, or
 * departure elevation + small margin on leg 1) is below this leg's cruise
 * altitude. The descent phase is included when the outgoing altitude (next
 * leg's cruise, or arrival elevation + pattern entry AGL on final leg) is
 * below this leg's cruise altitude. Cruise fills the remaining distance.
 */
export function computePhaseLeg(input: PhaseLegInput): PhaseLegResult {
  const {
    leg,
    fromWp,
    toWp,
    prevCruiseAlt,
    nextCruiseAlt,
    departureElevFt,
    arrivalElevFt,
    aircraft,
    winds,
  } = input;

  const warnings: NavlogWarning[] = [];

  const distanceNm = greatCircleDistanceNm(fromWp, toWp);
  const trueCourseDeg = greatCircleInitialBearingDeg(fromWp, toWp);

  const cruiseTasKt = leg.tasKt ?? aircraft.tasKt;
  const wind = legWind(leg, winds);
  const { wcaDeg, thDeg, gsKt } = windTriangle(
    trueCourseDeg,
    cruiseTasKt,
    wind.dirTrueDeg,
    wind.speedKt,
  );

  const climbFromAlt = prevCruiseAlt ?? departureElevFt + TAKEOFF_MARGIN_FT;
  const descentToAlt = nextCruiseAlt ?? arrivalElevFt + PATTERN_ENTRY_AGL_FT;

  const climbFpm = aircraft.climbFpm ?? 700;
  const climbTasKt = aircraft.climbTasKt ?? Math.max(60, cruiseTasKt - 40);
  const climbGph = aircraft.climbGph ?? aircraft.fuelBurnGph * 1.15;

  const descentFpm = aircraft.descentFpm ?? 500;
  const descentTasKt = aircraft.descentTasKt ?? cruiseTasKt;
  const descentGph = aircraft.descentGph ?? aircraft.fuelBurnGph * 0.6;

  let climbSeg: PhaseSegment | null = null;
  if (leg.altFt > climbFromAlt) {
    const c = climbProfile({
      fromAltFt: climbFromAlt,
      toAltFt: leg.altFt,
      climbFpm,
      climbTasKt,
    });
    climbSeg = { timeMin: c.timeMin, distanceNm: c.distanceNm, fuelGal: (c.timeMin / 60) * climbGph };
  }

  let descentSeg: PhaseSegment | null = null;
  if (leg.altFt > descentToAlt) {
    const d = descentProfile({
      fromAltFt: leg.altFt,
      toAltFt: descentToAlt,
      descentFpm,
      descentTasKt,
    });
    descentSeg = {
      timeMin: d.timeMin,
      distanceNm: d.distanceNm,
      fuelGal: (d.timeMin / 60) * descentGph,
    };
  }

  let climbDist = climbSeg?.distanceNm ?? 0;
  let descentDist = descentSeg?.distanceNm ?? 0;

  // If the leg is too short to contain climb + descent fully, clamp both
  // proportionally and emit a warning so the UI can flag it.
  if (climbDist + descentDist > distanceNm && distanceNm > 0) {
    warnings.push({
      kind: 'legTooShortForClimb',
      message: 'Leg is shorter than the climb + descent distance; timings clamped.',
    });
    const scale = distanceNm / (climbDist + descentDist);
    if (climbSeg) {
      climbSeg = {
        timeMin: climbSeg.timeMin * scale,
        distanceNm: climbSeg.distanceNm * scale,
        fuelGal: climbSeg.fuelGal * scale,
      };
      climbDist = climbSeg.distanceNm;
    }
    if (descentSeg) {
      descentSeg = {
        timeMin: descentSeg.timeMin * scale,
        distanceNm: descentSeg.distanceNm * scale,
        fuelGal: descentSeg.fuelGal * scale,
      };
      descentDist = descentSeg.distanceNm;
    }
  }

  const cruiseNm = Math.max(0, distanceNm - climbDist - descentDist);
  const cruiseTimeMin = eteMinutes(cruiseNm, gsKt);
  const cruiseFinite = Number.isFinite(cruiseTimeMin) ? cruiseTimeMin : 0;
  const cruiseSeg: PhaseSegment = {
    timeMin: cruiseFinite,
    distanceNm: cruiseNm,
    fuelGal: (cruiseFinite / 60) * aircraft.fuelBurnGph,
  };

  const totalTimeMin = (climbSeg?.timeMin ?? 0) + cruiseSeg.timeMin + (descentSeg?.timeMin ?? 0);
  const totalFuelGal =
    (climbSeg?.fuelGal ?? 0) + cruiseSeg.fuelGal + (descentSeg?.fuelGal ?? 0);

  return {
    distanceNm,
    trueCourseDeg,
    windCorrectionAngleDeg: wcaDeg,
    trueHeadingDeg: thDeg,
    groundSpeedKt: gsKt,
    cruiseTasKt,
    climb: climbSeg,
    cruise: cruiseSeg,
    descent: descentSeg,
    totalTimeMin,
    totalFuelGal,
    warnings,
  };
}
