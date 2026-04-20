// Pure-function aviation math. No Shared / PluginAPI dependencies.
// All angles in degrees at the boundary (radians internally). All internal
// units are knots / nautical miles / feet / gallons. Convert at the UI.

import LatLon from 'geodesy/latlon-spherical.js';
import geomagnetism from 'geomagnetism';
import type { LatLon as LatLonLiteral, WindsEntryRow } from '../types';

const METERS_PER_NM = 1852;

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

export function normalizeDeg(deg: number): number {
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}

export interface WindTriangleResult {
  wcaDeg: number;
  thDeg: number;
  gsKt: number;
}

/**
 * Classic wind triangle.
 *   wca = asin((windKt / tasKt) * sin(windDir - tc))
 *   gs  = tas * cos(wca) - windKt * cos(windDir - tc)
 * Returns WCA in [-90, +90] and th in [0, 360).
 * If the wind speed exceeds TAS and crosswind component is extreme,
 * returns a NaN-safe fallback (gs=0) so navlog UI shows "unflyable".
 */
export function windTriangle(
  tcDeg: number,
  tasKt: number,
  windDirDeg: number,
  windKt: number,
): WindTriangleResult {
  if (tasKt <= 0) return { wcaDeg: 0, thDeg: normalizeDeg(tcDeg), gsKt: 0 };
  const windAngle = toRad(windDirDeg - tcDeg);
  const ratio = (windKt * Math.sin(windAngle)) / tasKt;
  if (Math.abs(ratio) >= 1) {
    return { wcaDeg: Number.NaN, thDeg: Number.NaN, gsKt: 0 };
  }
  const wcaRad = Math.asin(ratio);
  const gsKt = tasKt * Math.cos(wcaRad) - windKt * Math.cos(windAngle);
  return {
    wcaDeg: toDeg(wcaRad),
    thDeg: normalizeDeg(tcDeg + toDeg(wcaRad)),
    gsKt,
  };
}

/**
 * Magnetic variation (declination) in degrees, positive east.
 * Uses WMM coefficients embedded in `geomagnetism`. Valid 2020-2025 range
 * for the 2020 model; newer WMM-2025 package release bumps this automatically.
 */
export function magneticVariation(lat: number, lon: number, date: Date = new Date()): number {
  const result = geomagnetism.model(date).point([lat, lon]);
  return result.decl;
}

/**
 * Convert true heading to magnetic heading at a location & date.
 * Convention: "East is least, West is best" — magnetic = true - eastDeclination.
 */
export function magneticHeading(
  trueHeadingDeg: number,
  lat: number,
  lon: number,
  date: Date = new Date(),
): number {
  const decl = magneticVariation(lat, lon, date);
  return normalizeDeg(trueHeadingDeg - decl);
}

export function greatCircleDistanceNm(from: LatLonLiteral, to: LatLonLiteral): number {
  const p1 = new LatLon(from.lat, from.lon);
  const p2 = new LatLon(to.lat, to.lon);
  const meters = p1.distanceTo(p2);
  return meters / METERS_PER_NM;
}

export function greatCircleInitialBearingDeg(
  from: LatLonLiteral,
  to: LatLonLiteral,
): number {
  const p1 = new LatLon(from.lat, from.lon);
  const p2 = new LatLon(to.lat, to.lon);
  return normalizeDeg(p1.initialBearingTo(p2));
}

export function eteMinutes(distanceNm: number, gsKt: number): number {
  if (gsKt <= 0) return Number.POSITIVE_INFINITY;
  return (distanceNm / gsKt) * 60;
}

export function fuelBurnGal(timeMin: number, gph: number): number {
  return (gph * timeMin) / 60;
}

export interface ClimbProfileInput {
  fromAltFt: number;
  toAltFt: number;
  climbFpm: number;
  climbTasKt: number;
}

export function climbProfile(input: ClimbProfileInput): { timeMin: number; distanceNm: number } {
  const gainFt = input.toAltFt - input.fromAltFt;
  if (gainFt <= 0 || input.climbFpm <= 0) return { timeMin: 0, distanceNm: 0 };
  const timeMin = gainFt / input.climbFpm;
  const distanceNm = (input.climbTasKt * timeMin) / 60;
  return { timeMin, distanceNm };
}

export interface DescentProfileInput {
  fromAltFt: number;
  toAltFt: number;
  /** Descent rate, positive feet per minute. */
  descentFpm: number;
  /** True airspeed during descent, knots. */
  descentTasKt: number;
}

/**
 * Mirror of `climbProfile` for descents. Returns time/distance required to
 * descend from `fromAltFt` to `toAltFt` at `descentFpm` while tracking at
 * `descentTasKt`. Returns zeros when the altitude delta is not descending.
 */
export function descentProfile(
  input: DescentProfileInput,
): { timeMin: number; distanceNm: number } {
  const dropFt = input.fromAltFt - input.toAltFt;
  if (dropFt <= 0 || input.descentFpm <= 0) return { timeMin: 0, distanceNm: 0 };
  const timeMin = dropFt / input.descentFpm;
  const distanceNm = (input.descentTasKt * timeMin) / 60;
  return { timeMin, distanceNm };
}

/**
 * Heuristic used by the terrain-aware altitude selector: a route segment is
 * considered "mountainous" when any sample exceeds 8000 ft MSL. This matches
 * the informal VFR norm of padding 2000 ft above terrain in mountainous
 * areas rather than the standard 1000 ft.
 */
export function isMountainousSegment(maxTerrainFt: number): boolean {
  return maxTerrainFt > 8000;
}

/**
 * Linear interpolation over a sorted winds-aloft table keyed by altitude.
 * Direction wraps at 360° (shortest-arc interpolation).
 */
export function interpolateWinds(
  table: WindsEntryRow[],
  altFt: number,
): { dirTrueDeg: number; speedKt: number } {
  if (table.length === 0) return { dirTrueDeg: 0, speedKt: 0 };
  const sorted = [...table].sort((a, b) => a.altFt - b.altFt);
  if (altFt <= sorted[0].altFt) {
    return { dirTrueDeg: sorted[0].dirTrueDeg, speedKt: sorted[0].speedKt };
  }
  const last = sorted[sorted.length - 1];
  if (altFt >= last.altFt) {
    return { dirTrueDeg: last.dirTrueDeg, speedKt: last.speedKt };
  }
  let lo = sorted[0];
  let hi = sorted[1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (altFt >= sorted[i].altFt && altFt <= sorted[i + 1].altFt) {
      lo = sorted[i];
      hi = sorted[i + 1];
      break;
    }
  }
  const t = (altFt - lo.altFt) / (hi.altFt - lo.altFt);
  const speedKt = lo.speedKt + (hi.speedKt - lo.speedKt) * t;
  // Shortest-arc direction interpolation
  let d = hi.dirTrueDeg - lo.dirTrueDeg;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  const dirTrueDeg = normalizeDeg(lo.dirTrueDeg + d * t);
  return { dirTrueDeg, speedKt };
}

export function reserveOk(
  totalFuelBurnGal: number,
  fuelCapacityGal: number,
  reserveMinutes: number,
  gph: number,
): boolean {
  const reserveNeeded = (reserveMinutes / 60) * gph;
  const remaining = fuelCapacityGal - totalFuelBurnGal;
  return remaining >= reserveNeeded;
}
