// Pure slippy-map tile math. Tests cover the edge cases.

export type BBox = [west: number, south: number, east: number, north: number];

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

/**
 * Convert a longitude in degrees to the X tile index at zoom Z.
 * Matches the OSM/WebMercator slippy-map convention.
 */
export function lon2tile(lon: number, z: number): number {
  const scale = 2 ** z;
  const normalized = ((lon + 180) % 360 + 360) % 360;
  return Math.min(scale - 1, Math.floor((normalized / 360) * scale));
}

/**
 * Convert a latitude in degrees to the Y tile index at zoom Z.
 * Web Mercator clamps latitudes beyond ±85.0511° (the projection edge).
 */
export function lat2tile(lat: number, z: number): number {
  const scale = 2 ** z;
  const clamped = Math.max(-85.0511, Math.min(85.0511, lat));
  const rad = (clamped * Math.PI) / 180;
  const raw = Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale,
  );
  return Math.max(0, Math.min(scale - 1, raw));
}

/**
 * Return all tiles inside a bbox across a closed zoom range. Order is
 * outer (z) → inner (x, y). Antimeridian-crossing bboxes are not
 * supported (caller should split).
 */
export function bboxToTileList(bbox: BBox, zMin: number, zMax: number): TileCoord[] {
  const [w, s, e, n] = bbox;
  if (w > e) {
    throw new Error('Antimeridian-crossing bboxes are not supported');
  }
  if (zMin > zMax) return [];

  const tiles: TileCoord[] = [];
  for (let z = zMin; z <= zMax; z++) {
    const x0 = lon2tile(w, z);
    const x1 = lon2tile(e, z);
    // In slippy coords, Y increases southward, so bbox north = minY.
    const yMin = lat2tile(n, z);
    const yMax = lat2tile(s, z);
    for (let x = x0; x <= x1; x++) {
      for (let y = yMin; y <= yMax; y++) {
        tiles.push({ z, x, y });
      }
    }
  }
  return tiles;
}

export function estimateTileCount(bbox: BBox, zMin: number, zMax: number): number {
  const [w, s, e, n] = bbox;
  if (w > e || zMin > zMax) return 0;
  let total = 0;
  for (let z = zMin; z <= zMax; z++) {
    const x0 = lon2tile(w, z);
    const x1 = lon2tile(e, z);
    const yMin = lat2tile(n, z);
    const yMax = lat2tile(s, z);
    total += Math.max(0, x1 - x0 + 1) * Math.max(0, yMax - yMin + 1);
  }
  return total;
}

/** Rough byte estimate: Protomaps tiles average ~18 KB across z0–12. */
export function estimateBytes(tileCount: number, avgTileBytes = 18 * 1024): number {
  return tileCount * avgTileBytes;
}
