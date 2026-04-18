import maplibregl from 'maplibre-gl';
import { FileSource, PMTiles, Protocol } from 'pmtiles';
import { regionFile } from './pmtiles-storage';

let protocol: Protocol | null = null;
const attached = new Map<string, PMTiles>();

function ensureProtocol(): Protocol {
  if (!protocol) {
    protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
  }
  return protocol;
}

export async function attachRegion(id: string): Promise<PMTiles | null> {
  if (attached.has(id)) return attached.get(id)!;
  const file = await regionFile(id);
  if (!file) return null;
  const p = ensureProtocol();
  const pm = new PMTiles(new FileSource(file));
  p.add(pm);
  attached.set(id, pm);
  return pm;
}

export function detachRegion(id: string): void {
  attached.delete(id);
}

export function pmtilesSourceUrl(regionId: string): string {
  // MapLibre will pass this through the registered 'pmtiles://' handler.
  return `pmtiles://${regionId}`;
}
