import { MAP_CACHE_DIR, MAP_TILES_SUBDIR } from '../constants';
import { deleteFile, getFile, resolveFile, rootDir, writeStream } from '../data/opfs';

/** OPFS path segments for a tile. */
function tilePath(z: number, x: number, y: number): string[] {
  return [MAP_CACHE_DIR, MAP_TILES_SUBDIR, String(z), String(x), `${y}.pbf`];
}

export async function hasTile(z: number, x: number, y: number): Promise<boolean> {
  const handle = await resolveFile(tilePath(z, x, y), false);
  return handle !== null;
}

export async function readTile(
  z: number,
  x: number,
  y: number,
): Promise<ArrayBuffer | null> {
  const handle = await resolveFile(tilePath(z, x, y), false);
  if (!handle) return null;
  const file = await handle.getFile();
  return file.arrayBuffer();
}

export async function writeTile(
  z: number,
  x: number,
  y: number,
  bytes: ArrayBuffer,
): Promise<void> {
  const handle = await resolveFile(tilePath(z, x, y), true);
  if (!handle) throw new Error(`Could not open tile handle for ${z}/${x}/${y}`);
  const writable = await handle.createWritable();
  await writable.write(bytes);
  await writable.close();
}

export async function deleteTile(z: number, x: number, y: number): Promise<void> {
  await deleteFile(tilePath(z, x, y));
}

/**
 * Remove everything under the map cache. Used by the Settings "Clear map
 * cache" action.
 */
export async function clearMapCache(): Promise<void> {
  try {
    const root = await rootDir();
    await root.removeEntry(MAP_CACHE_DIR, { recursive: true });
  } catch {
    // already gone
  }
}

/**
 * Count tiles on disk + total bytes. Iterates the tile tree so it's O(N)
 * in cached tiles. Reasonable for showing usage in Settings — not hot-path.
 */
export async function getCacheStats(): Promise<{ count: number; bytes: number }> {
  let count = 0;
  let bytes = 0;
  try {
    const root = await rootDir();
    const cacheDir = await root.getDirectoryHandle(MAP_CACHE_DIR);
    const tilesDir = await cacheDir.getDirectoryHandle(MAP_TILES_SUBDIR);
    for await (const [, zEntry] of tilesDir as any) {
      if (zEntry.kind !== 'directory') continue;
      for await (const [, xEntry] of zEntry as any) {
        if (xEntry.kind !== 'directory') continue;
        for await (const [, fileEntry] of xEntry as any) {
          if (fileEntry.kind !== 'file') continue;
          try {
            const file = await fileEntry.getFile();
            count += 1;
            bytes += file.size;
          } catch {
            /* skip */
          }
        }
      }
    }
  } catch {
    // Cache dir doesn't exist yet — stats are zero.
  }
  return { count, bytes };
}

/** Convenience for tests + diagnostics. */
export const tilePathSegments = tilePath;
export { getFile, writeStream };
