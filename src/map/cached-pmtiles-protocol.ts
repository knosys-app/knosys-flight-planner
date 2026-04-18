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
 *   2. pmtiles library + NetworkSource → api.network.fetch range read
 *
 * Idempotent: calling twice with different URLs swaps the active archive.
 */
export async function installCachedPmtilesProtocol(planetUrl: string): Promise<Header> {
  // Swap the archive if the URL changed (e.g., Protomaps rotated builds).
  const nextSource = new NetworkSource(planetUrl);
  const nextArchive = new PMTiles(nextSource);

  if (!activeProtocol) {
    activeProtocol = new Protocol();
    maplibregl.addProtocol('pmtiles', (request) => {
      return handleRequest(request);
    });
  }

  // Keep pmtiles' internal map in sync so its own tile() helper works for
  // metadata fetches (e.g. TileJSON resolution on source init).
  activeProtocol.add(nextArchive);
  activeArchive = nextArchive;
  registered = true;

  return activeArchive.getHeader();
}

export function isCachedPmtilesProtocolInstalled(): boolean {
  return registered;
}

function parseTileUrl(url: string): { z: number; x: number; y: number } | null {
  // MapLibre builds URLs like `pmtiles://<planet-url>/{z}/{x}/{y}`.
  const match = url.match(/\/(\d+)\/(\d+)\/(\d+)(?:\.[a-z]+)?$/i);
  if (!match) return null;
  const z = Number.parseInt(match[1], 10);
  const x = Number.parseInt(match[2], 10);
  const y = Number.parseInt(match[3], 10);
  if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return { z, x, y };
}

async function handleRequest(request: {
  url: string;
  type?: string;
}): Promise<{ data: ArrayBuffer | null }> {
  if (!activeArchive) {
    throw new Error('pmtiles protocol not initialized');
  }

  const tileCoords = parseTileUrl(request.url);

  // Non-tile requests (TileJSON, etc.) — delegate straight to the library.
  if (!tileCoords) {
    const header = await activeArchive.getHeader();
    if (request.type === 'json') {
      // Return MapLibre-compatible TileJSON derived from PMTiles header.
      const tileJson = {
        tilejson: '2.2.0',
        tiles: [`${request.url}/{z}/{x}/{y}`],
        bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat],
        minzoom: header.minZoom,
        maxzoom: header.maxZoom,
      };
      const bytes = new TextEncoder().encode(JSON.stringify(tileJson)).buffer;
      return { data: bytes as ArrayBuffer };
    }
    return { data: null };
  }

  const { z, x, y } = tileCoords;

  // 1. OPFS cache hit
  if (await hasTile(z, x, y)) {
    const cached = await readTile(z, x, y);
    if (cached) return { data: cached };
  }

  // 2. Miss — fetch via PMTiles library (which uses NetworkSource → plugin fetch)
  const { data } = await activeArchive.getZxy(z, x, y) ?? {};
  if (!data) {
    return { data: null };
  }
  // Cache for next time
  try {
    await writeTile(z, x, y, data);
  } catch {
    /* non-fatal: disk pressure etc. */
  }
  return { data };
}

/**
 * Expose the active archive so region-download can fetch tiles through the
 * same pipeline (library range reads + OPFS cache).
 */
export function getActiveArchive(): PMTiles {
  if (!activeArchive) {
    throw new Error(
      'installCachedPmtilesProtocol must be called before using the archive',
    );
  }
  return activeArchive;
}
