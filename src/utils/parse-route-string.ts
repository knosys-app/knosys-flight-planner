/**
 * Tokenizes a route string like "KLAX KPMD DAG KLAS" or "KLAX,KPMD,KLAS"
 * into identifiers, trimming whitespace and filtering empties. Does not
 * resolve against the airport DB — the caller should do that.
 */
export function tokenizeRouteString(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\s,]+/g)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Recognizes an explicit lat/lon waypoint: "34.5,-118.2" or "34.5N 118.2W".
 * Returns coordinates or null if the token isn't a coordinate.
 */
export function parseCoordinateToken(token: string): { lat: number; lon: number } | null {
  const m = token.match(/^(-?\d+(?:\.\d+)?)[,/](-?\d+(?:\.\d+)?)$/);
  if (m) {
    const lat = Number.parseFloat(m[1]);
    const lon = Number.parseFloat(m[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }
  return null;
}
