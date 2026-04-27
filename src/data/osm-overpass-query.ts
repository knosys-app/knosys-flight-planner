/**
 * Build an Overpass-QL query that asks for the aerodrome with a given
 * ICAO ident plus all `aeroway=runway|taxiway|apron|helipad` ways/areas
 * inside a bbox padded around it.
 *
 * The bbox is supplied because OurAirports already gave us the aerodrome's
 * lat/lon — pre-bounding the query keeps Overpass quotas reasonable and
 * avoids fetching half a country when an `icao` tag happens to match
 * elsewhere.
 *
 * Output format: JSON (Overpass `out:json`) — single round trip, no XML
 * parsing needed. Geometry is included via `out geom;` so we get raw
 * lat/lon for every node along each way without a second query.
 */
export interface OverpassBbox {
  /** [south, west, north, east] — Overpass argument order. */
  s: number;
  w: number;
  n: number;
  e: number;
}

export function bboxAroundAirport(
  lat: number,
  lon: number,
  paddingNm = 2.5,
): OverpassBbox {
  const dLat = paddingNm / 60;
  const dLon = paddingNm / (60 * Math.cos((lat * Math.PI) / 180));
  return {
    s: lat - dLat,
    w: lon - dLon,
    n: lat + dLat,
    e: lon + dLon,
  };
}

export function buildOverpassQuery(icao: string, bbox: OverpassBbox): string {
  const upper = icao.toUpperCase();
  const { s, w, n, e } = bbox;
  const box = `${s},${w},${n},${e}`;
  return `
[out:json][timeout:25];
(
  node["aeroway"="aerodrome"]["icao"="${upper}"](${box});
  way["aeroway"="aerodrome"]["icao"="${upper}"](${box});
  relation["aeroway"="aerodrome"]["icao"="${upper}"](${box});
  way["aeroway"="runway"](${box});
  way["aeroway"="taxiway"](${box});
  way["aeroway"="apron"](${box});
  way["aeroway"="helipad"](${box});
  way["aeroway"="taxilane"](${box});
);
out geom;
`.trim();
}

/** Endpoint we hit. Public Overpass API instance. */
export const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

/** UA must identify us per OSM's tile/Overpass usage policy. */
export const OVERPASS_USER_AGENT = 'knosys-flight-planner/0.10 (+knosys-app)';
