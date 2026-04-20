// OPFS cache for raw Terrarium PNG tiles. The in-memory decoded raster
// cache lives in terrarium-provider.ts; this module only deals with byte
// storage so cold starts can skip the network.

import { TERRAIN_CACHE_DIR } from '../constants';
import { deleteFile, resolveFile, rootDir } from '../data/opfs';

function tilePath(z: number, x: number, y: number): string[] {
  return [TERRAIN_CACHE_DIR, String(z), String(x), `${y}.png`];
}

export async function readTerrainTile(
  z: number,
  x: number,
  y: number,
): Promise<ArrayBuffer | null> {
  const handle = await resolveFile(tilePath(z, x, y), false);
  if (!handle) return null;
  const file = await handle.getFile();
  return file.arrayBuffer();
}

export async function writeTerrainTile(
  z: number,
  x: number,
  y: number,
  bytes: ArrayBuffer,
): Promise<void> {
  const handle = await resolveFile(tilePath(z, x, y), true);
  if (!handle) throw new Error(`Could not open terrain tile handle for ${z}/${x}/${y}`);
  const writable = await handle.createWritable();
  await writable.write(bytes);
  await writable.close();
}

export async function deleteTerrainTile(z: number, x: number, y: number): Promise<void> {
  await deleteFile(tilePath(z, x, y));
}

export async function clearTerrainCache(): Promise<void> {
  try {
    const root = await rootDir();
    await root.removeEntry(TERRAIN_CACHE_DIR, { recursive: true });
  } catch {
    // already gone
  }
}

export async function terrainCacheStats(): Promise<{ count: number; bytes: number }> {
  let count = 0;
  let bytes = 0;
  try {
    const root = await rootDir();
    const cacheDir = await root.getDirectoryHandle(TERRAIN_CACHE_DIR);
    for await (const [, zEntry] of cacheDir as any) {
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
    // cache dir doesn't exist yet
  }
  return { count, bytes };
}
