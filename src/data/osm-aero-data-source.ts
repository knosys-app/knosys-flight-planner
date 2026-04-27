import type {
  AeroDataSource,
  AirportQueryOptions,
  BoundingBox,
} from './aero-data-source';
import type { Airport, AirportType, Frequency, Navaid, Runway } from '../types';
import { pluginFetch } from '../map/plugin-fetch';
import { getAeroDataSource } from '../hooks/use-aero-data';
import {
  OVERPASS_ENDPOINT,
  OVERPASS_USER_AGENT,
  bboxAroundAirport,
  buildOverpassQuery,
} from './osm-overpass-query';
import {
  isStale,
  readOsmCache,
  writeOsmCache,
  type CachedOsmResponse,
} from './osm-cache';

/**
 * `AeroDataSource` backed by OpenStreetMap via Overpass API.
 *
 * Lookup flow:
 *   1. The OurAirports DB (the singleton primary source) seeds the airport's
 *      lat/lon and basic name fields. We need this seed to bound the
 *      Overpass query — ICAO alone could match anywhere on the planet.
 *   2. Build a bbox padded ~2.5 nm around the field, ask Overpass for the
 *      aerodrome + every aeroway way within the bbox.
 *   3. Cache the raw payload to OPFS. Subsequent opens hit the cache; entries
 *      older than 30 days refresh in the background and the stale view
 *      renders immediately.
 *
 * This source is "place-card only" — it does NOT power navlog, route
 * planning, search, or map markers. Those continue to use the offline
 * primary source.
 */

interface OverpassNode {
  type: 'node';
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

interface OverpassWay {
  type: 'way';
  id: number;
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
}

interface OverpassRelation {
  type: 'relation';
  id: number;
  tags?: Record<string, string>;
}

type OverpassElement = OverpassNode | OverpassWay | OverpassRelation;

interface OverpassPayload {
  elements?: OverpassElement[];
}

export interface OsmRunwayDetail {
  feature: 'runway' | 'taxiway' | 'apron' | 'helipad' | 'taxilane';
  geometry: Array<[number, number]>; // [lon, lat] pairs
  ref?: string;
  surface?: string;
}

export interface OsmAirportDetail {
  taxiways: OsmRunwayDetail[];
  aprons: OsmRunwayDetail[];
  helipads: OsmRunwayDetail[];
}

/**
 * Sidecar payload accompanying each Airport returned by this source.
 * The place card pulls this out separately to render taxiway / apron
 * polygons in the runway diagram hero. Airport itself holds runway
 * data so it conforms to the existing AeroDataSource shape.
 */
const detailRegistry = new WeakMap<Airport, OsmAirportDetail>();

export function getOsmDetail(airport: Airport): OsmAirportDetail | null {
  return detailRegistry.get(airport) ?? null;
}

/** Hard-coded type mapping — OSM doesn't classify airports by size. */
function osmTypeForAirport(seedType: AirportType | undefined): AirportType {
  return seedType ?? 'small_airport';
}

function findAerodromeElement(
  payload: OverpassPayload,
  icao: string,
): OverpassElement | null {
  const upper = icao.toUpperCase();
  const matches = (e: OverpassElement) =>
    e.tags?.aeroway === 'aerodrome' &&
    (e.tags.icao?.toUpperCase() === upper || e.tags.iata?.toUpperCase() === upper);
  for (const e of payload.elements ?? []) {
    if (matches(e)) return e;
  }
  return null;
}

function geometryToCoords(
  way: OverpassWay,
): Array<[number, number]> {
  return (way.geometry ?? []).map(({ lat, lon }) => [lon, lat]);
}

function endpoint(geom: Array<[number, number]>, end: 0 | -1): [number, number] | null {
  if (geom.length === 0) return null;
  return end === 0 ? geom[0] : geom[geom.length - 1];
}

function distanceMeters(a: [number, number], b: [number, number]): number {
  const [aLon, aLat] = a;
  const [bLon, bLat] = b;
  const latRad = (aLat * Math.PI) / 180;
  const dx = (bLon - aLon) * 111320 * Math.cos(latRad);
  const dy = (bLat - aLat) * 111320;
  return Math.hypot(dx, dy);
}

function bearingDeg(a: [number, number], b: [number, number]): number {
  const [aLon, aLat] = a;
  const [bLon, bLat] = b;
  const φ1 = (aLat * Math.PI) / 180;
  const φ2 = (bLat * Math.PI) / 180;
  const Δλ = ((bLon - aLon) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function parseRunways(payload: OverpassPayload): Runway[] {
  const out: Runway[] = [];
  for (const e of payload.elements ?? []) {
    if (e.type !== 'way') continue;
    if (e.tags?.aeroway !== 'runway') continue;
    const geom = geometryToCoords(e);
    if (geom.length < 2) continue;
    const le = endpoint(geom, 0)!;
    const he = endpoint(geom, -1)!;
    const lengthM = distanceMeters(le, he);
    const lengthFt = Math.round(lengthM * 3.28084);
    const heading = bearingDeg(le, he);
    const ref = e.tags.ref ?? '';
    const [leIdent, heIdent] = ref.includes('/')
      ? ref.split('/').map((s) => s.trim())
      : [ref, ''];
    const widthM = Number.parseFloat(e.tags.width ?? '0') || 0;
    out.push({
      id: ref || `osm-${e.id}`,
      lengthFt,
      widthFt: Math.round(widthM * 3.28084),
      surface: e.tags.surface ?? 'unknown',
      headingTrue: heading,
      leIdent: leIdent || undefined,
      heIdent: heIdent || undefined,
      leLat: le[1],
      leLon: le[0],
      heLat: he[1],
      heLon: he[0],
    });
  }
  return out;
}

function parseDetail(payload: OverpassPayload): OsmAirportDetail {
  const taxiways: OsmRunwayDetail[] = [];
  const aprons: OsmRunwayDetail[] = [];
  const helipads: OsmRunwayDetail[] = [];
  for (const e of payload.elements ?? []) {
    if (e.type !== 'way') continue;
    const aeroway = e.tags?.aeroway;
    const geom = geometryToCoords(e);
    if (geom.length < 2) continue;
    if (aeroway === 'taxiway' || aeroway === 'taxilane') {
      taxiways.push({
        feature: 'taxiway',
        geometry: geom,
        ref: e.tags?.ref,
        surface: e.tags?.surface,
      });
    } else if (aeroway === 'apron') {
      aprons.push({
        feature: 'apron',
        geometry: geom,
        surface: e.tags?.surface,
      });
    } else if (aeroway === 'helipad') {
      helipads.push({
        feature: 'helipad',
        geometry: geom,
      });
    }
  }
  return { taxiways, aprons, helipads };
}

export class OsmAeroDataSource implements AeroDataSource {
  ready(): Promise<void> {
    return Promise.resolve();
  }

  async findAirportByIcao(icao: string): Promise<Airport | null> {
    const seed = await getAeroDataSource().findAirportByIcao(icao);
    if (!seed) return null;
    let payload: OverpassPayload | null = null;
    let cached: CachedOsmResponse | null = await readOsmCache(icao);
    if (cached) {
      payload = cached.payload as OverpassPayload;
      // Stale-while-revalidate: serve cache immediately, kick off a refresh.
      if (isStale(cached)) {
        void this.refreshInBackground(icao, seed.lat, seed.lon);
      }
    } else {
      try {
        payload = await fetchOverpass(icao, seed.lat, seed.lon);
        await writeOsmCache(icao, payload);
      } catch (err) {
        // Live fetch failed and we have nothing cached. Surface a null so
        // the source-tab UI can render an explicit empty state.
        return null;
      }
    }
    if (!payload) return null;
    return hydrateAirport(payload, seed, icao);
  }

  private async refreshInBackground(
    icao: string,
    lat: number,
    lon: number,
  ): Promise<void> {
    try {
      const fresh = await fetchOverpass(icao, lat, lon);
      await writeOsmCache(icao, fresh);
    } catch {
      // Background failure is silent — the stale entry stays usable.
    }
  }

  // The remaining AeroDataSource methods aren't meaningful for an OSM-only
  // place-card surface. They throw if used so misroutes surface as bugs.

  async searchAirports(_q: string, _limit?: number): Promise<Airport[]> {
    throw new Error('OsmAeroDataSource.searchAirports is not implemented');
  }
  async findNavaid(_id: string): Promise<Navaid | null> {
    return null;
  }
  async searchNavaids(_q: string, _limit?: number): Promise<Navaid[]> {
    return [];
  }
  async airportsInBbox(_b: BoundingBox, _o?: AirportQueryOptions): Promise<Airport[]> {
    throw new Error('OsmAeroDataSource.airportsInBbox is not implemented');
  }
  async airportsInBboxLite(_b: BoundingBox, _o?: AirportQueryOptions): Promise<Airport[]> {
    throw new Error('OsmAeroDataSource.airportsInBboxLite is not implemented');
  }
  async navaidsInBbox(_b: BoundingBox, _l?: number): Promise<Navaid[]> {
    return [];
  }
}

async function fetchOverpass(
  icao: string,
  lat: number,
  lon: number,
): Promise<OverpassPayload> {
  const bbox = bboxAroundAirport(lat, lon);
  const ql = buildOverpassQuery(icao, bbox);
  const body = `data=${encodeURIComponent(ql)}`;
  const res = await pluginFetch(OVERPASS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': OVERPASS_USER_AGENT,
    },
    body,
    timeoutMs: 30_000,
  });
  if (res.status !== 200) {
    throw new Error(`Overpass HTTP ${res.status}`);
  }
  const text = new TextDecoder().decode(res.body);
  return JSON.parse(text) as OverpassPayload;
}

function hydrateAirport(
  payload: OverpassPayload,
  seed: Airport,
  icao: string,
): Airport | null {
  const aerodrome = findAerodromeElement(payload, icao);
  // We allow a missing aerodrome element when at least one runway/taxiway
  // is in the bbox — many uncharted strips lack the aerodrome tag.
  const runways = parseRunways(payload);
  const detail = parseDetail(payload);
  const hasAnything = runways.length > 0 || aerodrome != null;
  if (!hasAnything) return null;

  const tags = aerodrome?.tags ?? {};
  const elev = Number.parseFloat(tags.ele ?? '');
  const airport: Airport = {
    icao,
    iata: tags.iata?.toUpperCase(),
    name: tags.name ?? seed.name,
    lat: seed.lat,
    lon: seed.lon,
    elevationFt: Number.isFinite(elev) ? Math.round(elev * 3.28084) : seed.elevationFt,
    country: seed.country,
    region: seed.region,
    municipality: tags['addr:city'] ?? seed.municipality,
    type: osmTypeForAirport(seed.type),
    runways,
    // OSM aeroway data doesn't provide radio frequencies — leave blank
    // so the place card frequency section shows the empty state.
    frequencies: [] as Frequency[],
  };
  detailRegistry.set(airport, detail);
  return airport;
}
