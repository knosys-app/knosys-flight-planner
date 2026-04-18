import {
  eteMinutes,
  fuelBurnGal,
  greatCircleDistanceNm,
  greatCircleInitialBearingDeg,
  interpolateWinds,
  magneticHeading,
  magneticVariation,
  reserveOk as reserveOkFn,
  windTriangle,
} from '../math/aviation-math';
import type {
  AircraftProfile,
  Leg,
  NavlogRow,
  Plan,
  Waypoint,
  WindsEntryRow,
} from '../types';

export interface NavlogInputs {
  plan: Plan;
  aircraft: AircraftProfile;
  winds: WindsEntryRow[];
  departureTimeUtc?: Date;
}

/**
 * Derives the navlog from a plan + aircraft + winds table. Pure function \u2014 no
 * side effects, safe to memoize. Handles wind interpolation per leg using
 * the leg's cruise altitude. Assumes TAS is aircraft cruise TAS.
 */
export function computeNavlog(input: NavlogInputs): {
  rows: NavlogRow[];
  totals: {
    distanceNm: number;
    eteMinutes: number;
    fuelBurnedGal: number;
    fuelRemainingGal: number;
    reserveOk: boolean;
  };
} {
  const { plan, aircraft, winds, departureTimeUtc } = input;
  const wayIndex = new Map<string, Waypoint>(plan.waypoints.map((w) => [w.id, w]));
  const rows: NavlogRow[] = [];
  const date = departureTimeUtc ?? new Date();

  let currentFuelGal = aircraft.fuelCapacityGal;
  let totalDist = 0;
  let totalEte = 0;
  let totalFuel = 0;
  let etaCursor: Date | undefined = departureTimeUtc ? new Date(departureTimeUtc) : undefined;

  plan.legs.forEach((leg: Leg, i: number) => {
    const from = wayIndex.get(leg.fromId);
    const to = wayIndex.get(leg.toId);
    if (!from || !to) return;

    const distanceNm = greatCircleDistanceNm(from, to);
    const trueCourseDeg = greatCircleInitialBearingDeg(from, to);

    const legWind = legWindInput(leg, winds);
    const tasKt = leg.tasKt ?? aircraft.tasKt;
    const { wcaDeg, thDeg, gsKt } = windTriangle(
      trueCourseDeg,
      tasKt,
      legWind.dirTrueDeg,
      legWind.speedKt,
    );

    const midLat = (from.lat + to.lat) / 2;
    const midLon = (from.lon + to.lon) / 2;
    const magVarDeg = magneticVariation(midLat, midLon, date);
    const magneticHeadingDeg = magneticHeading(thDeg, midLat, midLon, date);

    const ete = eteMinutes(distanceNm, gsKt);
    const fuelBurned = fuelBurnGal(ete, aircraft.fuelBurnGph);
    currentFuelGal = Math.max(0, currentFuelGal - fuelBurned);

    let etaIso: string | undefined;
    if (etaCursor && Number.isFinite(ete)) {
      etaCursor = new Date(etaCursor.getTime() + ete * 60_000);
      etaIso = etaCursor.toISOString();
    }

    const reserveOk = reserveOkFn(
      totalFuel + fuelBurned,
      aircraft.fuelCapacityGal,
      plan.reserveMinutesOverride ?? aircraft.reserveMinutes,
      aircraft.fuelBurnGph,
    );

    rows.push({
      legIndex: i,
      fromRef: from.ref,
      fromName: from.name,
      toRef: to.ref,
      toName: to.name,
      altFt: leg.altFt,
      distanceNm,
      trueCourseDeg,
      windCorrectionAngleDeg: wcaDeg,
      trueHeadingDeg: thDeg,
      magVarDeg,
      magneticHeadingDeg,
      tasKt,
      groundSpeedKt: gsKt,
      eteMinutes: ete,
      etaIso,
      fuelBurnedGal: fuelBurned,
      fuelRemainingGal: currentFuelGal,
      reserveOk,
    });

    totalDist += distanceNm;
    totalEte += ete;
    totalFuel += fuelBurned;
  });

  return {
    rows,
    totals: {
      distanceNm: totalDist,
      eteMinutes: totalEte,
      fuelBurnedGal: totalFuel,
      fuelRemainingGal: currentFuelGal,
      reserveOk: reserveOkFn(
        totalFuel,
        aircraft.fuelCapacityGal,
        plan.reserveMinutesOverride ?? aircraft.reserveMinutes,
        aircraft.fuelBurnGph,
      ),
    },
  };
}

function legWindInput(
  leg: Leg,
  winds: WindsEntryRow[],
): { dirTrueDeg: number; speedKt: number } {
  if (leg.windDir !== undefined && leg.windKt !== undefined) {
    return { dirTrueDeg: leg.windDir, speedKt: leg.windKt };
  }
  return interpolateWinds(winds, leg.altFt);
}
