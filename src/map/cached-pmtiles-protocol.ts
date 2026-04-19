import maplibregl from 'maplibre-gl';
import { PMTiles, Protocol, type Header } from 'pmtiles';
import { NetworkSource } from './network-source';
import { hasTile, readTile, writeTile } from './tile-cache';

let registered = false;
let activeProtocol: Protocol | null = null;
let activeArchive: PMTiles | null = null;

/**
 * Install a MapLibre `pmtiles://` protocol handler backed by:
 *   1. OPFS tile cache (fast hit for pre-downloaded or previously-viewed tiles)
 *   2. pmtiles library's Protocol.tile \u2014 which in turn uses our NetworkSource
 *      to issue HTTP range reads via `api.network.fetch`.
 *
 * All non-tile resources (TileJSON source init, metadata) fall straight
 * through to pmtiles' own Protocol handler so the MapLibre plumbing gets
 * correctly-shaped responses.
 *
 * Idempotent: calling twice with different URLs swaps the active archive.
 */
export async function installCachedPmtilesProtocol(planetUrl: string): Promise<Header> {
  const source = new NetworkSource(planetUrl);
  const archive = new PMTiles(source);

  if (!activeProtocol) {
    activeProtocol = new Protocol();
    maplibregl.addProtocol('pmtiles', handleRequest);
  }

  activeProtocol.add(archive);
  activeArchive = archive;
  registered = true;

  return archive.getHeader();
}

export function isCachedPmtilesProtocolInstalled(): boolean {
  return registered;
}

function parseTileUrl(
  url: string,
): { z: number; x: number; y: number } | null {
  // MapLibre-built tile URLs look like `pmtiles://<archive>/{z}/{x}/{y}`
  // with an optional extension (`.mvt` / `.pbf`). JSON source init URLs
  // have no /z/x/y suffix.
  const match = url.match(/\/(\d+)\/(\d+)\/(\d+)(?:\.[a-z0-9]+)?$/i);
  if (!match) return null;
  const z = Number.parseInt(match[1], 10);
  const x = Number.parseInt(match[2], 10);
  const y = Number.parseInt(match[3], 10);
  if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return { z, x, y };
}

type RequestParams = { url: string; type?: string; [k: string]: unknown };

async function handleRequest(
  params: RequestParams,
  abortController: AbortController,
): Promise<any> {
  if (!activeProtocol || !activeArchive) {
    throw new Error('pmtiles protocol not initialized');
  }

  const tileCoords = parseTileUrl(params.url);

  // Non-tile (TileJSON / metadata) \u2014 let pmtiles build the canonical
  // response for MapLibre.
  if (!tileCoords) {
    return activeProtocol.tile(params as any, abortController as any);
  }

  const { z, x, y } = tileCoords;

  // 1. OPFS cache hit
  try {
    if (await hasTile(z, x, y)) {
      const cached = await readTile(z, x, y);
      if (cached && cached.byteLength > 0) {
        return { data: new Uint8Array(cached) };
      }
    }
  } catch {
    /* fall through to network */
  }

  // 2. Miss \u2014 delegate to pmtiles (range reads via NetworkSource), then cache.
  const result = (await activeProtocol.tile(params as any, abortController as any)) as {
    data: Uint8Array | null;
    cacheControl?: string;
    expires?: string;
  };
  if (result?.data && result.data.byteLength > 0) {
    try {
      // Copy into a fresh ArrayBuffer so the writer gets a concrete
      // (non-SharedArrayBuffer) buffer typing.
      const copy = new Uint8Array(result.data.byteLength);
      copy.set(result.data);
      await writeTile(z, x, y, copy.buffer);
    } catch {
      /* non-fatal: disk pressure etc. */
    }
  }
  return result;
}

export function getActiveArchive(): PMTiles {
  if (!activeArchive) {
    throw new Error(
      'installCachedPmtilesProtocol must be called before using the archive',
    );
  }
  return activeArchive;
}
