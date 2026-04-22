// NOAA Aviation Weather Center TAF client.
// Same CORS-proxy + plugin-storage-cache pattern as metar-client.

import { pluginFetch } from '../map/plugin-fetch';
import { getApi } from '../store/storage';
import { ceilingFromClouds, deriveFlightCategory } from './flight-category';
import type {
  CloudCoverage,
  CloudLayer,
  TafChangeKind,
  TafForecast,
  TafForecastPeriod,
} from './types';

const TAF_URL = 'https://aviationweather.gov/api/data/taf';
const FETCH_TIMEOUT_MS = 12_000;
const DEFAULT_TTL_MIN = 60; // TAFs update every 6 hrs; 1 hr cache is fine
const CACHE_KEY_PREFIX = 'weather:taf:';

export interface GetTafOptions {
  maxAgeMin?: number;
}

interface NoaaTafJson {
  icaoId?: string;
  rawTAF?: string;
  issueTime?: string;
  validTimeFrom?: string;
  validTimeTo?: string;
  fcsts?: NoaaTafPeriodJson[];
  forecasts?: NoaaTafPeriodJson[]; // some endpoints use this spelling
}

interface NoaaTafPeriodJson {
  timeFrom?: string;
  timeTo?: string;
  fcstChange?: string | null;
  change?: string | null;
  probability?: number | null;
  wdir?: number | null;
  wspd?: number | null;
  wgst?: number | null;
  visib?: number | string | null;
  wxString?: string | null;
  clouds?: Array<{ cover?: string; base?: number | null }>;
}

export async function fetchTafs(icaos: string[]): Promise<Record<string, TafForecast>> {
  const ids = icaos
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .join(',');
  if (!ids) return {};

  const url = `${TAF_URL}?ids=${encodeURIComponent(ids)}&format=json&hours=0`;
  const res = await pluginFetch(url, { method: 'GET', timeoutMs: FETCH_TIMEOUT_MS });
  if (res.status !== 200) {
    throw new Error(`TAF fetch ${res.status} ${res.statusText}`);
  }
  const text = new TextDecoder('utf-8').decode(res.body);
  let rows: NoaaTafJson[];
  try {
    rows = JSON.parse(text);
  } catch (err) {
    throw new Error(`TAF parse failed: ${(err as Error).message}`);
  }
  if (!Array.isArray(rows)) return {};

  const now = new Date().toISOString();
  const out: Record<string, TafForecast> = {};
  for (const row of rows) {
    const parsed = parseTafRow(row, now);
    if (parsed) out[parsed.icao] = parsed;
  }
  return out;
}

export async function getTafs(
  icaos: string[],
  options: GetTafOptions = {},
): Promise<Record<string, TafForecast>> {
  const unique = Array.from(new Set(icaos.map((s) => s.trim().toUpperCase()).filter(Boolean)));
  const ttlMin = options.maxAgeMin ?? DEFAULT_TTL_MIN;

  const result: Record<string, TafForecast> = {};
  const toFetch: string[] = [];
  for (const id of unique) {
    const cached = await readCache(id);
    if (cached) result[id] = cached;
    if (!cached || !isFresh(cached, ttlMin)) toFetch.push(id);
  }

  if (toFetch.length > 0) {
    try {
      const fresh = await fetchTafs(toFetch);
      const returned = Object.keys(fresh);
      const missing = toFetch.filter((id) => !returned.includes(id));
      console.log(
        `[flight-planner] TAF fetch: ${returned.length}/${toFetch.length} stations have forecasts`,
        { returned, missing },
      );
      for (const id of returned) {
        result[id] = fresh[id];
        await writeCache(id, fresh[id]);
      }
    } catch (err) {
      console.warn('[flight-planner] TAF batch fetch failed:', err);
    }
  }
  return result;
}

// ---------- parsing ----------

export function parseTafRow(row: NoaaTafJson, fetchedAtIso: string): TafForecast | null {
  const icao = (row.icaoId ?? '').toUpperCase();
  if (!icao) return null;

  const issuedAtIso = noaaTimeToIso(row.issueTime) ?? fetchedAtIso;
  const validFromIso = noaaTimeToIso(row.validTimeFrom) ?? issuedAtIso;
  const validToIso =
    noaaTimeToIso(row.validTimeTo) ?? addHours(validFromIso, 24);

  const rawPeriods = (row.fcsts ?? row.forecasts ?? []).map((p) =>
    parsePeriod(p, validFromIso, validToIso),
  );
  // Filter null periods (parse failure).
  const periods = rawPeriods.filter((p): p is TafForecastPeriod => p !== null);
  // Ensure periods are in ascending start order.
  periods.sort((a, b) => a.startIso.localeCompare(b.startIso));

  return {
    icao,
    issuedAtIso,
    validFromIso,
    validToIso,
    rawText: (row.rawTAF ?? '').trim(),
    periods,
    fetchedAtIso,
  };
}

function parsePeriod(
  p: NoaaTafPeriodJson,
  windowFromIso: string,
  windowToIso: string,
): TafForecastPeriod | null {
  const startIso = noaaTimeToIso(p.timeFrom) ?? windowFromIso;
  const endIso = noaaTimeToIso(p.timeTo) ?? windowToIso;
  const changeKind = toChangeKind(p.fcstChange ?? p.change);
  const probability = typeof p.probability === 'number' ? p.probability : null;

  const clouds: CloudLayer[] = Array.isArray(p.clouds)
    ? p.clouds.map((c) => ({
        coverage: normalizeCoverage(c?.cover),
        baseFtAgl: typeof c?.base === 'number' ? c.base : null,
      }))
    : [];

  const visibilitySm = parseVisibility(p.visib);
  const ceilingFtAgl = ceilingFromClouds(clouds);

  return {
    startIso,
    endIso,
    change: changeKind,
    probability,
    windDirDeg: typeof p.wdir === 'number' ? p.wdir : null,
    windSpeedKt: typeof p.wspd === 'number' ? p.wspd : null,
    windGustKt: typeof p.wgst === 'number' ? p.wgst : null,
    visibilitySm,
    clouds,
    ceilingFtAgl,
    flightCategory: deriveFlightCategory(ceilingFtAgl, visibilitySm),
    wxString: typeof p.wxString === 'string' && p.wxString ? p.wxString : null,
  };
}

function toChangeKind(raw: string | null | undefined): TafChangeKind {
  if (!raw) return 'BASE';
  const u = raw.toUpperCase();
  if (u.startsWith('FM')) return 'FM';
  if (u === 'BECMG') return 'BECMG';
  if (u === 'TEMPO') return 'TEMPO';
  if (u.startsWith('PROB')) return 'PROB';
  return 'BASE';
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
    // TAFs use "P6SM" = "plus 6 sm" = >6; treat as infinity.
    if (/^P\d/i.test(t)) return Number.POSITIVE_INFINITY;
    if (t.endsWith('+')) return Number.POSITIVE_INFINITY;
    // Strip "SM" suffix if present ("6SM" → 6).
    const m = t.match(/^([\d.]+)/);
    if (m) {
      const n = Number.parseFloat(m[1]);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

function noaaTimeToIso(s: string | undefined | null): string | null {
  if (!s) return null;
  const parts = s.trim().replace(' ', 'T');
  const withZ = parts.endsWith('Z') ? parts : `${parts}Z`;
  const d = new Date(withZ);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function addHours(iso: string, hours: number): string {
  const d = new Date(iso);
  d.setUTCHours(d.getUTCHours() + hours);
  return d.toISOString();
}

// ---------- cache ----------

function cacheKey(icao: string): string {
  return `${CACHE_KEY_PREFIX}${icao}`;
}

function isFresh(taf: TafForecast, ttlMin: number): boolean {
  const fetched = new Date(taf.fetchedAtIso).getTime();
  if (!Number.isFinite(fetched)) return false;
  return Date.now() - fetched < ttlMin * 60_000;
}

async function readCache(icao: string): Promise<TafForecast | null> {
  try {
    const api = getApi();
    return (await api.storage.get<TafForecast>(cacheKey(icao))) ?? null;
  } catch {
    return null;
  }
}

async function writeCache(icao: string, taf: TafForecast): Promise<void> {
  try {
    const api = getApi();
    await api.storage.set(cacheKey(icao), taf);
  } catch {
    /* non-fatal */
  }
}
