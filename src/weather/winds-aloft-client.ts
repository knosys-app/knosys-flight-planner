// Winds aloft via Open-Meteo. Returns wind direction/speed/temperature at a
// list of pressure levels for a single (lat, lon) point. We convert pressure
// levels to approximate altitudes using the ISA model so the caller can
// interpolate to a specific cruise altitude.
//
// Open-Meteo is free + CORS-friendly (no API key) and returns JSON. It is
// NOT the FAA-certified FD product; pilots who need that should check the
// raw FD tables. Good enough as a sensible default for VFR planning.

import { pluginFetch } from '../map/plugin-fetch';
import { getApi } from '../store/storage';

const URL_BASE = 'https://api.open-meteo.com/v1/forecast';
const FETCH_TIMEOUT_MS = 12_000;
const DEFAULT_TTL_MIN = 60;
const CACHE_KEY_PREFIX = 'weather:wind:';

/** Pressure levels Open-Meteo supports, in hPa. */
const PRESSURE_LEVELS_HPA = [1000, 925, 850, 700, 500, 400, 300, 250, 200] as const;

export interface WindLevel {
  pressureHpa: number;
  /** Approx ISA altitude for this pressure, in feet. */
  altFt: number;
  dirTrueDeg: number | null;
  speedKt: number | null;
  tempC: number | null;
}

export interface WindsAloft {
  lat: number;
  lon: number;
  /** Hour (ISO) this column was forecast for. */
  forecastTimeIso: string;
  fetchedAtIso: string;
  levels: WindLevel[];
}

export interface GetWindsOptions {
  /** Forecast time in the future, rounded to the nearest hour. Defaults to +3h. */
  forecastHoursAhead?: number;
  maxAgeMin?: number;
}

export async function fetchWindsAloft(
  lat: number,
  lon: number,
  options: GetWindsOptions = {},
): Promise<WindsAloft | null> {
  const hoursAhead = options.forecastHoursAhead ?? 3;
  const hourly = PRESSURE_LEVELS_HPA.flatMap((hpa) => [
    `wind_speed_${hpa}hPa`,
    `wind_direction_${hpa}hPa`,
    `temperature_${hpa}hPa`,
  ]).join(',');

  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly,
    forecast_days: '2',
    timezone: 'UTC',
    wind_speed_unit: 'kn',
  });
  const url = `${URL_BASE}?${params.toString()}`;

  const res = await pluginFetch(url, { method: 'GET', timeoutMs: FETCH_TIMEOUT_MS });
  if (res.status !== 200) {
    throw new Error(`Winds-aloft fetch ${res.status} ${res.statusText}`);
  }

  const text = new TextDecoder('utf-8').decode(res.body);
  const json = JSON.parse(text) as {
    hourly?: Record<string, (number | null)[]> & { time?: string[] };
  };
  const hourlyData = json.hourly;
  if (!hourlyData || !Array.isArray(hourlyData.time) || hourlyData.time.length === 0) {
    return null;
  }

  // Pick the forecast hour closest to `now + hoursAhead`.
  const targetMs = Date.now() + hoursAhead * 3600_000;
  let bestIdx = 0;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let i = 0; i < hourlyData.time.length; i++) {
    const ts = new Date(`${hourlyData.time[i]}Z`).getTime();
    const diff = Math.abs(ts - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }

  const levels: WindLevel[] = PRESSURE_LEVELS_HPA.map((hpa) => ({
    pressureHpa: hpa,
    altFt: pressureHpaToFeet(hpa),
    dirTrueDeg: readAt(hourlyData[`wind_direction_${hpa}hPa`], bestIdx),
    speedKt: readAt(hourlyData[`wind_speed_${hpa}hPa`], bestIdx),
    tempC: readAt(hourlyData[`temperature_${hpa}hPa`], bestIdx),
  }));

  return {
    lat,
    lon,
    forecastTimeIso: new Date(`${hourlyData.time[bestIdx]}Z`).toISOString(),
    fetchedAtIso: new Date().toISOString(),
    levels,
  };
}

export async function getWindsAloft(
  lat: number,
  lon: number,
  options: GetWindsOptions = {},
): Promise<WindsAloft | null> {
  const ttlMin = options.maxAgeMin ?? DEFAULT_TTL_MIN;
  const cacheKey = `${CACHE_KEY_PREFIX}${lat.toFixed(1)}_${lon.toFixed(1)}_${options.forecastHoursAhead ?? 3}`;

  const cached = await readCache(cacheKey);
  if (cached && isFresh(cached, ttlMin)) return cached;

  try {
    const fresh = await fetchWindsAloft(lat, lon, options);
    if (fresh) {
      await writeCache(cacheKey, fresh);
      return fresh;
    }
  } catch (err) {
    console.warn('[flight-planner] winds-aloft fetch failed:', err);
  }
  return cached;
}

/**
 * Interpolate the resolved wind + temperature at a specific altitude from a
 * fetched pressure-level column. Returns null when we have no bracketing
 * levels with data.
 */
export function interpolateWindAt(
  col: WindsAloft,
  altFt: number,
): { dirTrueDeg: number; speedKt: number; tempC: number | null } | null {
  const lvls = col.levels
    .filter((l) => l.dirTrueDeg != null && l.speedKt != null)
    .sort((a, b) => a.altFt - b.altFt);
  if (lvls.length === 0) return null;

  if (altFt <= lvls[0].altFt) {
    return {
      dirTrueDeg: lvls[0].dirTrueDeg!,
      speedKt: lvls[0].speedKt!,
      tempC: lvls[0].tempC,
    };
  }
  if (altFt >= lvls[lvls.length - 1].altFt) {
    const top = lvls[lvls.length - 1];
    return {
      dirTrueDeg: top.dirTrueDeg!,
      speedKt: top.speedKt!,
      tempC: top.tempC,
    };
  }

  for (let i = 0; i < lvls.length - 1; i++) {
    const a = lvls[i];
    const b = lvls[i + 1];
    if (altFt >= a.altFt && altFt <= b.altFt) {
      const t = (altFt - a.altFt) / (b.altFt - a.altFt);
      const dir = interpAngle(a.dirTrueDeg!, b.dirTrueDeg!, t);
      const speed = a.speedKt! + (b.speedKt! - a.speedKt!) * t;
      const temp =
        a.tempC != null && b.tempC != null ? a.tempC + (b.tempC - a.tempC) * t : null;
      return {
        dirTrueDeg: Math.round(dir),
        speedKt: Math.round(speed),
        tempC: temp != null ? Math.round(temp * 10) / 10 : null,
      };
    }
  }
  return null;
}

// ---------- helpers ----------

function readAt(
  arr: (number | null)[] | undefined,
  idx: number,
): number | null {
  if (!Array.isArray(arr)) return null;
  const v = arr[idx];
  return typeof v === 'number' ? v : null;
}

/**
 * ISA standard-atmosphere pressure → altitude (feet).
 * h = 145366.45 * (1 - (P / 1013.25) ^ 0.190284)
 */
export function pressureHpaToFeet(hpa: number): number {
  return Math.round(145366.45 * (1 - Math.pow(hpa / 1013.25, 0.190284)));
}

/**
 * Shortest-path angular interpolation (0–360). t is 0..1.
 */
export function interpAngle(a: number, b: number, t: number): number {
  const diff = ((b - a + 540) % 360) - 180; // in (-180, 180]
  const raw = a + diff * t;
  return ((raw % 360) + 360) % 360;
}

function isFresh(w: WindsAloft, ttlMin: number): boolean {
  const f = new Date(w.fetchedAtIso).getTime();
  if (!Number.isFinite(f)) return false;
  return Date.now() - f < ttlMin * 60_000;
}

async function readCache(key: string): Promise<WindsAloft | null> {
  try {
    const api = getApi();
    return (await api.storage.get<WindsAloft>(key)) ?? null;
  } catch {
    return null;
  }
}

async function writeCache(key: string, w: WindsAloft): Promise<void> {
  try {
    const api = getApi();
    await api.storage.set(key, w);
  } catch {
    /* non-fatal */
  }
}
