// AWS Terrarium terrain tile provider. Fetches z10 PNG tiles through
// pluginFetch (main-process proxy), decodes via createImageBitmap +
// OffscreenCanvas into a Float32Array elevation raster (feet MSL), caches
// both raw PNGs (OPFS) and decoded rasters (in-memory LRU).

import { pluginFetch } from '../map/plugin-fetch';
import { readTerrainTile, writeTerrainTile } from './terrain-cache';
import { sampleRoute } from './route-sampler';
import { decodeTerrariumTileFeet } from './tile-elevation-decoder';
import { TERRAIN_TILE_ZOOM, TERRARIUM_URL_PATTERN } from '../constants';
import type { LatLon, ProfileSample } from '../types';
import type { TerrainProvider } from './terrain-provider';

const TILE_SIZE = 256;

function lonToTileX(lon: number, z: number): number {
  return ((lon + 180) / 360) * Math.pow(2, z);
}

function latToTileY(lat: number, z: number): number {
  const latRad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    Math.pow(2, z)
  );
}

interface DecodedTile {
  elevations: Float32Array;
  width: number;
  height: number;
}

class LruCache<V> {
  private map = new Map<string, V>();
  constructor(private limit: number) {}
  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }
  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.limit) {
      const first = this.map.keys().next().value;
      if (first === undefined) break;
      this.map.delete(first);
    }
  }
}

export class TerrariumTerrainProvider implements TerrainProvider {
  private memoryCache = new LruCache<DecodedTile>(50);
  private inFlight = new Map<string, Promise<DecodedTile>>();

  constructor(private readonly z = TERRAIN_TILE_ZOOM) {}

  async elevationAt(lat: number, lon: number): Promise<number> {
    const tx = Math.floor(lonToTileX(lon, this.z));
    const ty = Math.floor(latToTileY(lat, this.z));
    const tile = await this.loadTile(tx, ty);
    const fx = lonToTileX(lon, this.z) - tx;
    const fy = latToTileY(lat, this.z) - ty;
    const px = Math.max(0, Math.min(tile.width - 1, Math.floor(fx * tile.width)));
    const py = Math.max(0, Math.min(tile.height - 1, Math.floor(fy * tile.height)));
    return tile.elevations[py * tile.width + px];
  }

  async sampleAlongRoute(
    from: LatLon,
    to: LatLon,
    stepNm: number,
    startAlongTrackNm = 0,
  ): Promise<ProfileSample[]> {
    const points = sampleRoute(from, to, stepNm, startAlongTrackNm);
    const uniqueTiles = new Set<string>();
    for (const p of points) {
      const tx = Math.floor(lonToTileX(p.lon, this.z));
      const ty = Math.floor(latToTileY(p.lat, this.z));
      uniqueTiles.add(`${tx}/${ty}`);
    }
    console.warn(
      `[flight-planner] terrain: sampling ${points.length} points across ${uniqueTiles.size} tiles (z=${this.z})`,
    );
    const tileResults = await Promise.all(
      Array.from(uniqueTiles).map(async (key) => {
        const [tx, ty] = key.split('/').map(Number);
        try {
          await this.loadTile(tx, ty);
          return { key, ok: true as const };
        } catch (err) {
          console.warn(
            `[flight-planner] terrain: tile ${this.z}/${tx}/${ty} failed:`,
            err instanceof Error ? err.message : err,
          );
          return { key, ok: false as const, err };
        }
      }),
    );
    const failures = tileResults.filter((r) => !r.ok).length;
    if (failures > 0) {
      console.warn(
        `[flight-planner] terrain: ${failures}/${tileResults.length} tiles failed to load`,
      );
    }

    const out: ProfileSample[] = [];
    let zeroCount = 0;
    for (const p of points) {
      let elev = 0;
      try {
        elev = await this.elevationAt(p.lat, p.lon);
      } catch (err) {
        console.warn(
          `[flight-planner] terrain: elevationAt(${p.lat.toFixed(3)},${p.lon.toFixed(3)}) failed:`,
          err instanceof Error ? err.message : err,
        );
        elev = 0;
      }
      if (elev === 0) zeroCount++;
      out.push({
        alongTrackNm: p.alongTrackNm,
        lat: p.lat,
        lon: p.lon,
        terrainElevFt: Number.isFinite(elev) ? elev : 0,
      });
    }
    const maxElev = Math.max(...out.map((s) => s.terrainElevFt));
    console.warn(
      `[flight-planner] terrain: done. maxElev=${Math.round(maxElev)} ft, zeroSamples=${zeroCount}/${out.length}`,
    );
    return out;
  }

  private async loadTile(tx: number, ty: number): Promise<DecodedTile> {
    const key = `${this.z}/${tx}/${ty}`;
    const mem = this.memoryCache.get(key);
    if (mem) return mem;
    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const task = (async () => {
      let bytes = await readTerrainTile(this.z, tx, ty);
      if (!bytes) {
        const url = TERRARIUM_URL_PATTERN.replace('{z}', String(this.z))
          .replace('{x}', String(tx))
          .replace('{y}', String(ty));
        const res = await pluginFetch(url, { method: 'GET', timeoutMs: 15000 });
        if (res.status !== 200) {
          throw new Error(
            `Terrain fetch ${res.status} ${res.statusText} for ${url} (body=${res.body.byteLength}B)`,
          );
        }
        bytes = res.body;
        console.log(
          `[flight-planner] terrain: fetched ${this.z}/${tx}/${ty} (${bytes.byteLength}B) ${url}`,
        );
        writeTerrainTile(this.z, tx, ty, bytes).catch((err) =>
          console.warn('[flight-planner] terrain: OPFS write failed', err),
        );
      }
      try {
        const decoded = await decodeTileBytes(bytes);
        this.memoryCache.set(key, decoded);
        return decoded;
      } catch (err) {
        throw new Error(
          `Decode failed for ${this.z}/${tx}/${ty}: ${err instanceof Error ? err.message : err}`,
        );
      }
    })();

    this.inFlight.set(key, task);
    try {
      return await task;
    } finally {
      this.inFlight.delete(key);
    }
  }
}

async function decodeTileBytes(bytes: ArrayBuffer): Promise<DecodedTile> {
  const blob = new Blob([bytes], { type: 'image/png' });
  const bitmap = await createImageBitmap(blob);
  const width = bitmap.width;
  const height = bitmap.height;
  // OffscreenCanvas is available in Electron renderer + modern browsers.
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable');
  ctx.drawImage(bitmap, 0, 0);
  const img = ctx.getImageData(0, 0, width, height);
  const elevations = decodeTerrariumTileFeet(img.data, width, height);
  bitmap.close?.();
  return { elevations, width, height };
}

// Exposed for tests / diagnostics.
export const __tileIndex = { lonToTileX, latToTileY, TILE_SIZE };
