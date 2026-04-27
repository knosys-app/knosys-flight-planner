import { readFileBytes, writeStream, deleteFile } from './opfs';

/**
 * Per-airport cache for OSM Overpass responses.
 *
 * Each cache entry is one JSON file at `osm/<ICAO>.json` in OPFS, wrapping
 * the raw Overpass payload with a `fetchedAt` ISO timestamp. Reads are
 * always served from the cache when present; entries past the TTL are
 * refreshed in the background on next view ("stale-while-revalidate").
 *
 * No size cap — per the v0.10 plan. Each entry is ~5–500 KB depending on
 * airport size. Users who want manual cleanup can delete the OPFS dir.
 */

const OSM_DIR = 'osm';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface CachedOsmResponse {
  fetchedAt: string;
  /** Overpass JSON payload as returned by `out:json` queries. */
  payload: unknown;
}

function cachePath(icao: string): string[] {
  return [OSM_DIR, `${icao.toUpperCase()}.json`];
}

export async function readOsmCache(icao: string): Promise<CachedOsmResponse | null> {
  try {
    const bytes = await readFileBytes(cachePath(icao));
    if (!bytes) return null;
    const text = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(text) as CachedOsmResponse;
    if (typeof parsed?.fetchedAt !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeOsmCache(
  icao: string,
  payload: unknown,
): Promise<void> {
  const wrapped: CachedOsmResponse = {
    fetchedAt: new Date().toISOString(),
    payload,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(wrapped));
  // writeStream takes a ReadableStream — wrap our bytes in one.
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  await writeStream(cachePath(icao), stream);
}

export async function deleteOsmCache(icao: string): Promise<void> {
  await deleteFile(cachePath(icao));
}

export function isStale(entry: CachedOsmResponse, now = Date.now()): boolean {
  const fetched = new Date(entry.fetchedAt).getTime();
  if (!Number.isFinite(fetched)) return true;
  return now - fetched > TTL_MS;
}
