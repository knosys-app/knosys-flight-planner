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
import { waypointFrequency } from '../data/frequency-picker';
import type { AeroDataSource } from '../data/aero-data-source';

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

  // Cache lookups per ref so we don't hit the same airport twice.
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
