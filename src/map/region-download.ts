import { bboxToTileList, type BBox, type TileCoord } from './offline-tile-math';
import { getActiveArchive } from './cached-pmtiles-protocol';
import { hasTile, writeTile } from './tile-cache';

const CONCURRENCY = 6;
const PROGRESS_BATCH = 20;

export interface DownloadProgress {
  total: number;
  loaded: number;
  skipped: number;
  errors: number;
  bytes: number;
}

export interface DownloadHandle {
  total: number;
  promise: Promise<DownloadProgress>;
  cancel(): void;
}

/**
 * Drive a bbox × zoom range through the cache/fetch pipeline. Tiles
 * already present in OPFS are skipped. Missing tiles are fetched through
 * the active PMTiles archive (range read via plugin-fetch) and written to
 * OPFS.
 */
export function startRegionDownload(
  bbox: BBox,
  zMin: number,
  zMax: number,
  onProgress?: (p: DownloadProgress) => void,
): DownloadHandle {
  const tiles = bboxToTileList(bbox, zMin, zMax);
  const state: DownloadProgress = {
    total: tiles.length,
    loaded: 0,
    skipped: 0,
    errors: 0,
    bytes: 0,
  };
  let cursor = 0;
  let cancelled = false;

  function snapshot(): DownloadProgress {
    return { ...state };
  }

  async function worker(): Promise<void> {
    const archive = getActiveArchive();
    while (!cancelled) {
      const i = cursor++;
      if (i >= tiles.length) return;
      const tile: TileCoord = tiles[i];
      try {
        if (await hasTile(tile.z, tile.x, tile.y)) {
          state.skipped += 1;
        } else {
          const result = await archive.getZxy(tile.z, tile.x, tile.y);
          if (result?.data) {
            await writeTile(tile.z, tile.x, tile.y, result.data);
            state.loaded += 1;
            state.bytes += result.data.byteLength;
          } else {
            // No tile at this coord (ocean / out-of-archive) — count as skip.
            state.skipped += 1;
          }
        }
      } catch {
        state.errors += 1;
      }

      const done = state.loaded + state.skipped + state.errors;
      if (done % PROGRESS_BATCH === 0 || done === tiles.length) {
        onProgress?.(snapshot());
      }
    }
  }

  const promise = (async () => {
    const workers: Promise<void>[] = [];
    for (let i = 0; i < CONCURRENCY; i++) workers.push(worker());
    await Promise.all(workers);
    onProgress?.(snapshot());
    return snapshot();
  })();

  return {
    total: tiles.length,
    promise,
    cancel() {
      cancelled = true;
    },
  };
}
