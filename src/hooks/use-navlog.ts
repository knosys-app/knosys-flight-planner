import {
  magneticHeading,
  magneticVariation,
  reserveOk as reserveOkFn,
} from '../math/aviation-math';
import { computePhaseLeg } from '../math/phase-navlog';
import type {
  AircraftProfile,
  BlockTotals,
  NavlogRow,
  NavlogWarning,
  Plan,
  Waypoint,
  WindsEntryRow,
} from '../types';
import { waypointFrequency } from '../data/frequency-picker';
import type { AeroDataSource } from '../data/aero-data-source';

export interface NavlogInputs {
  plan: Plan;
  aircraft: AircraftProfile;
  winds: WindsEntryRow[];
  departureTimeUtc?: Date;
  /** Per-leg external warnings (e.g., terrain pierces altitude). */
  legWarnings?: NavlogWarning[][];
  /** Departure airport elevation in ft (used for first-leg climb-out). */
  departureElevFt?: number;
  /** Arrival airport elevation in ft (used for last-leg descent-in). */
  arrivalElevFt?: number;
}

export interface NavlogOutput {
  rows: NavlogRow[];
  totals: {
    distanceNm: number;
    eteMinutes: number;
    fuelBurnedGal: number;
    fuelRemainingGal: number;
    reserveOk: boolean;
  };
  blockTotals: BlockTotals;
}

/**
 * Derives the navlog from a plan + aircraft + winds table using the phase
 * model (climb / cruise / descent per leg) plus taxi + pattern allowances.
 * Pure function — safe to memoize; side-effect-free.
 */
export function computeNavlog(input: NavlogInputs): NavlogOutput {
  const { plan, aircraft, winds, departureTimeUtc, legWarnings } = input;
  const wayIndex = new Map<string, Waypoint>(plan.waypoints.map((w) => [w.id, w]));
  const rows: NavlogRow[] = [];
  const date = departureTimeUtc ?? new Date();

  const firstLegFromElev = input.departureElevFt ?? 0;
  const lastLegToElev = input.arrivalElevFt ?? 0;

  let currentFuelGal = aircraft.fuelCapacityGal;
  let totalDist = 0;
  let totalEte = 0;
  let totalFuel = 0;
  let climbMin = 0;
  let cruiseMin = 0;
  let descentMin = 0;
  let climbFuel = 0;
  let cruiseFuel = 0;
  let descentFuel = 0;
  let etaCursor: Date | undefined = departureTimeUtc ? new Date(departureTimeUtc) : undefined;

  // Taxi phase (one per trip, subtracted from initial fuel before first leg).
  const taxiMinutes = aircraft.taxiMinutes ?? 10;
  const taxiGph = aircraft.taxiGph ?? aircraft.fuelBurnGph * 0.3;
  const taxiFuelGal = (taxiMinutes / 60) * taxiGph;
  currentFuelGal = Math.max(0, currentFuelGal - taxiFuelGal);

  plan.legs.forEach((leg, i) => {
    const from = wayIndex.get(leg.fromId);
    const to = wayIndex.get(leg.toId);
    if (!from || !to) return;

    const prevLeg = i > 0 ? plan.legs[i - 1] : null;
    const nextLeg = i < plan.legs.length - 1 ? plan.legs[i + 1] : null;
    const prevCruiseAlt = prevLeg ? prevLeg.altFt : null;
    const nextCruiseAlt = nextLeg ? nextLeg.altFt : null;

    const phase = computePhaseLeg({
      leg,
      fromWp: from,
      toWp: to,
      prevCruiseAlt,
      nextCruiseAlt,
      departureElevFt: i === 0 ? firstLegFromElev : 0,
      arrivalElevFt: i === plan.legs.length - 1 ? lastLegToElev : 0,
      aircraft,
      winds,
    });

    const midLat = (from.lat + to.lat) / 2;
    const midLon = (from.lon + to.lon) / 2;
    const magVarDeg = magneticVariation(midLat, midLon, date);
    const magneticHeadingDeg = magneticHeading(phase.trueHeadingDeg, midLat, midLon, date);

    const ete = phase.totalTimeMin;
    const fuelBurned = phase.totalFuelGal;
    currentFuelGal = Math.max(0, currentFuelGal - fuelBurned);

    let etaIso: string | undefined;
    if (etaCursor && Number.isFinite(ete)) {
      etaCursor = new Date(etaCursor.getTime() + ete * 60_000);
      etaIso = etaCursor.toISOString();
    }

    const legRsvOk = reserveOkFn(
      totalFuel + fuelBurned + taxiFuelGal,
      aircraft.fuelCapacityGal,
      plan.reserveMinutesOverride ?? aircraft.reserveMinutes,
      aircraft.fuelBurnGph,
    );

    const externalWarnings = legWarnings?.[i] ?? [];
    const warnings = [...phase.warnings, ...externalWarnings];
    if (!legRsvOk) {
      warnings.push({ kind: 'belowReserve', message: 'Below required reserve fuel' });
    }

    rows.push({
      legIndex: i,
      fromRef: from.ref,
      fromName: from.name,
      toRef: to.ref,
      toName: to.name,
      altFt: leg.altFt,
      altAutoPicked: leg.altAutoPicked,
      distanceNm: phase.distanceNm,
      trueCourseDeg: phase.trueCourseDeg,
      windCorrectionAngleDeg: phase.windCorrectionAngleDeg,
      trueHeadingDeg: phase.trueHeadingDeg,
      magVarDeg,
      magneticHeadingDeg,
      tasKt: phase.cruiseTasKt,
      groundSpeedKt: phase.groundSpeedKt,
      eteMinutes: ete,
      etaIso,
      fuelBurnedGal: fuelBurned,
      fuelRemainingGal: currentFuelGal,
      reserveOk: legRsvOk,
      phases: {
        climb: phase.climb,
        cruise: phase.cruise,
        descent: phase.descent,
      },
      warnings,
    });

    totalDist += phase.distanceNm;
    totalEte += ete;
    totalFuel += fuelBurned;
    climbMin += phase.climb?.timeMin ?? 0;
    cruiseMin += phase.cruise.timeMin;
    descentMin += phase.descent?.timeMin ?? 0;
    climbFuel += phase.climb?.fuelGal ?? 0;
    cruiseFuel += phase.cruise.fuelGal;
    descentFuel += phase.descent?.fuelGal ?? 0;
  });

  // Pattern phase (one per trip, at destination before landing).
  const patternMinutes = aircraft.patternMinutes ?? 5;
  const patternFuelGal = (patternMinutes / 60) * aircraft.fuelBurnGph;
  currentFuelGal = Math.max(0, currentFuelGal - patternFuelGal);

  const blockMin = taxiMinutes + climbMin + cruiseMin + descentMin + patternMinutes;
  const blockFuelGal =
    taxiFuelGal + climbFuel + cruiseFuel + descentFuel + patternFuelGal;

  return {
    rows,
    totals: {
      distanceNm: totalDist,
      eteMinutes: totalEte,
      fuelBurnedGal: totalFuel,
      fuelRemainingGal: currentFuelGal,
      reserveOk: reserveOkFn(
        totalFuel + taxiFuelGal + patternFuelGal,
        aircraft.fuelCapacityGal,
        plan.reserveMinutesOverride ?? aircraft.reserveMinutes,
        aircraft.fuelBurnGph,
      ),
    },
    blockTotals: {
      taxiMin: taxiMinutes,
      climbMin,
      cruiseMin,
      descentMin,
      patternMin: patternMinutes,
      blockMin,
      taxiFuelGal,
      climbFuelGal: climbFuel,
      cruiseFuelGal: cruiseFuel,
      descentFuelGal: descentFuel,
      patternFuelGal,
      blockFuelGal,
      blockDistanceNm: totalDist,
    },
  };
}

/**
 * Hydrate each navlog row's `primaryFreq` by looking up the destination
 * waypoint in the airport/navaid database. Pure helper (no React) so it
 * can be driven from any caller. Preserves row order + base fields.
 */
export async function hydrateNavlogFrequencies(
  rows: NavlogRow[],
  plan: Plan,
  dataSource: AeroDataSource,
): Promise<NavlogRow[]> {
  if (rows.length === 0) return rows;
  const wpIndex = new Map<string, Waypoint>(plan.waypoints.map((w) => [w.id, w]));
  const byRef = new Map<string, Waypoint>();
  for (const w of plan.waypoints) byRef.set(w.ref, w);

  const airportCache = new Map<string, Awaited<ReturnType<AeroDataSource['findAirportByIcao']>>>();
  const navaidCache = new Map<string, Awaited<ReturnType<AeroDataSource['findNavaid']>>>();

  const hydrated = await Promise.all(
    rows.map(async (r) => {
      const leg = plan.legs[r.legIndex];
      const toWp = leg ? wpIndex.get(leg.toId) : byRef.get(r.toRef);
      if (!toWp) return r;

      let freq: { type: string; mhz: number } | null = null;
      if (toWp.kind === 'airport') {
        if (!airportCache.has(toWp.ref)) {
          airportCache.set(toWp.ref, await dataSource.findAirportByIcao(toWp.ref));
        }
        const airport = airportCache.get(toWp.ref) ?? null;
        freq = waypointFrequency(toWp, airport?.frequencies);
      } else if (toWp.kind === 'navaid') {
        if (!navaidCache.has(toWp.ref)) {
          navaidCache.set(toWp.ref, await dataSource.findNavaid(toWp.ref));
        }
        const navaid = navaidCache.get(toWp.ref) ?? null;
        freq = waypointFrequency(toWp, undefined, navaid);
      }

      return freq ? { ...r, primaryFreq: freq } : r;
    }),
  );

  return hydrated;
}
