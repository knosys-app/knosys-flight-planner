import { STORAGE_KEYS } from '../constants';
import { getValue, setValue } from './storage';

export interface MapViewport {
  center: [number, number];   // [lng, lat]
  zoom: number;
  bearing?: number;
  pitch?: number;
  updatedAt: string;
}

export async function loadMapViewport(): Promise<MapViewport | null> {
  const raw = await getValue<MapViewport>(STORAGE_KEYS.mapViewport);
  if (!raw || !Array.isArray(raw.center) || raw.center.length !== 2) {
    return null;
  }
  const [lng, lat] = raw.center;
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || !Number.isFinite(raw.zoom)) {
    return null;
  }
  return raw;
}

export async function saveMapViewport(v: Omit<MapViewport, 'updatedAt'>): Promise<void> {
  await setValue<MapViewport>(STORAGE_KEYS.mapViewport, {
    ...v,
    updatedAt: new Date().toISOString(),
  });
}
