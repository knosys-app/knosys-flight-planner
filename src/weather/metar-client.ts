// NOAA Aviation Weather Center METAR client.
// Uses pluginFetch (main-process proxy) to bypass renderer CORS.
// Caches parsed observations in plugin storage with a 30-minute TTL.

import { pluginFetch } from '../map/plugin-fetch';
import { getApi } from '../store/storage';
import { ceilingFromClouds, deriveFlightCategory } from './flight-category';
import type { CloudCoverage, CloudLayer, MetarObservation } from './types';

const METAR_URL = 'https://aviationweather.gov/api/data/metar';
const FETCH_TIMEOUT_MS = 12_000;
const DEFAULT_TTL_MIN = 30;
const CACHE_KEY_PREFIX = 'weather:metar:';

export interface GetMetarOptions {
  /** Return cached value if less than `maxAgeMin` old without hitting the network. */
  maxAgeMin?: number;
}

/** Parsed shape of a NOAA AWC JSON row. Tolerant to missing fields. */
interface NoaaMetarJson {
  icaoId?: string;
  rawOb?: string;
  reportTime?: string; // "2024-01-15 20:53:00" UTC
  temp?: number | null;
  dewp?: number | null;
  wdir?: number | string | null;
  wspd?: number | null;
  wgst?: number | null;
  visib?: number | string | null;
  altim?: number | null;
  wxString?: string | null;
  clouds?: Array<{ cover?: string; base?: number | null }>;
}

/**
 * Fetch (and parse) METARs for a list of ICAOs in a single call. Returns a
 * map keyed by uppercase ICAO. Missing stations are omitted.
 */
export async function fetchMetars(
  icaos: string[],
): Promise<Record<string, MetarObservation>> {
  const ids = icaos
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .join(',');
  if (!ids) return {};

  const url = `${METAR_URL}?ids=${encodeURIComponent(ids)}&format=json&hours=0`;
  const res = await pluginFetch(url, { method: 'GET', timeoutMs: FETCH_TIMEOUT_MS });
  if (res.status !== 200) {
    throw new Error(`METAR fetch ${res.status} ${res.statusText}`);
  }
  const text = new TextDecoder('utf-8').decode(res.body);
  let rows: NoaaMetarJson[];
  try {
    rows = JSON.parse(text);
  } catch (err) {
    throw new Error(`METAR parse failed: ${(err as Error).message}`);
  }
  if (!Array.isArray(rows)) return {};

  const now = new Date().toISOString();
  const out: Record<string, MetarObservation> = {};
  for (const row of rows) {
    const parsed = parseMetarRow(row, now);
    if (parsed) out[parsed.icao] = parsed;
  }
  return out;
}

/**
 * Retrieve a single METAR with cache-first behavior. If a cached entry is
 * younger than `maxAgeMin`, it's returned immediately. Otherwise we fetch
 * and refresh the cache. Network failures fall back to whatever is cached
 * (even if stale) so the UI can still show data offline.
 */
export async function getMetar(
  icao: string,
  options: GetMetarOptions = {},
): Promise<MetarObservation | null> {
  const id = icao.trim().toUpperCase();
  if (!id) return null;
  const ttlMin = options.maxAgeMin ?? DEFAULT_TTL_MIN;

  const cached = await readCache(id);
  if (cached && isFresh(cached, ttlMin)) return cached;

  try {
    const result = await fetchMetars([id]);
    const obs = result[id];
    if (obs) {
      await writeCache(id, obs);
      return obs;
    }
  } catch (err) {
    console.warn(`[flight-planner] METAR fetch for ${id} failed:`, err);
  }
  return cached;
}

/**
 * Batch variant: populates the cache with what it can, returns whatever is
 * available (cached or freshly-fetched) keyed by ICAO.
 */
export async function getMetars(
  icaos: string[],
  options: GetMetarOptions = {},
): Promise<Record<string, MetarObservation>> {
  const unique = Array.from(new Set(icaos.map((s) => s.trim().toUpperCase()).filter(Boolean)));
  const ttlMin = options.maxAgeMin ?? DEFAULT_TTL_MIN;

  const result: Record<string, MetarObservation> = {};
  const toFetch: string[] = [];

  for (const id of unique) {
    const cached = await readCache(id);
    if (cached) result[id] = cached;
    if (!cached || !isFresh(cached, ttlMin)) toFetch.push(id);
  }

  if (toFetch.length > 0) {
    try {
      const fresh = await fetchMetars(toFetch);
      for (const id of Object.keys(fresh)) {
        result[id] = fresh[id];
        await writeCache(id, fresh[id]);
      }
    } catch (err) {
      console.warn('[flight-planner] METAR batch fetch failed:', err);
    }
  }

  return result;
}

// ---------------- parsing ----------------

export function parseMetarRow(
  row: NoaaMetarJson,
  fetchedAtIso: string,
): MetarObservation | null {
  const icao = (row.icaoId ?? '').toUpperCase();
  if (!icao) return null;

  const observedAtIso = noaaTimeToIso(row.reportTime) ?? fetchedAtIso;
  const wdir = typeof row.wdir === 'number' ? row.wdir : null;
  const visibilitySm = parseVisibility(row.visib);

  const clouds: CloudLayer[] = Array.isArray(row.clouds)
    ? row.clouds.map((c) => ({
        coverage: normalizeCoverage(c?.cover),
        baseFtAgl: typeof c?.base === 'number' ? c.base : null,
      }))
    : [];

  const ceilingFtAgl = ceilingFromClouds(clouds);
  const flightCategory = deriveFlightCategory(ceilingFtAgl, visibilitySm);

  return {
    icao,
    observedAtIso,
    fetchedAtIso,
    rawText: (row.rawOb ?? '').trim(),
    tempC: typeof row.temp === 'number' ? row.temp : null,
    dewpointC: typeof row.dewp === 'number' ? row.dewp : null,
    windDirDeg: wdir,
    windSpeedKt: typeof row.wspd === 'number' ? row.wspd : null,
    windGustKt: typeof row.wgst === 'number' ? row.wgst : null,
    visibilitySm,
    altimeterInHg: typeof row.altim === 'number' ? inHgFrom(row.altim) : null,
    clouds,
    ceilingFtAgl,
    flightCategory,
    wxString: typeof row.wxString === 'string' && row.wxString ? row.wxString : null,
  };
}

function normalizeCoverage(raw: unknown): CloudCoverage {
  const s = String(raw ?? '').toUpperCase();
  if (s === 'CLR' || s === 'SKC' || s === 'FEW' || s === 'SCT' || s === 'BKN' || s === 'OVC' || s === 'VV') {
    return s;
  }
  return 'SKC';
}

function parseVisibility(raw: unknown): number | null {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t === '') return null;
    // "10+" means >10 sm; treat as Infinity for category logic.
    if (t.endsWith('+')) return Number.POSITIVE_INFINITY;
    const n = Number.parseFloat(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * NOAA sometimes returns altimeter in hPa (like 1013.2) rather than inHg
 * (like 29.92). We normalize to inHg because that's what US pilots use.
 */
function inHgFrom(value: number): number {
  return value > 100 ? value * 0.029529983071445 : value;
}

function noaaTimeToIso(s: string | undefined): string | null {
  if (!s) return null;
  // NOAA format: "2024-01-15 20:53:00" UTC — coerce to ISO.
  const parts = s.trim().replace(' ', 'T');
  const withZ = parts.endsWith('Z') ? parts : `${parts}Z`;
  const d = new Date(withZ);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ---------------- cache ----------------

function cacheKey(icao: string): string {
  return `${CACHE_KEY_PREFIX}${icao}`;
}

function isFresh(obs: MetarObservation, ttlMin: number): boolean {
  const fetched = new Date(obs.fetchedAtIso).getTime();
  if (!Number.isFinite(fetched)) return false;
  return Date.now() - fetched < ttlMin * 60_000;
}

async function readCache(icao: string): Promise<MetarObservation | null> {
  try {
    const api = getApi();
    const raw = await api.storage.get<MetarObservation>(cacheKey(icao));
    return raw ?? null;
  } catch {
    return null;
  }
}

async function writeCache(icao: string, obs: MetarObservation): Promise<void> {
  try {
    const api = getApi();
    await api.storage.set(cacheKey(icao), obs);
  } catch {
    /* non-fatal — we'll just re-fetch next time */
  }
}
