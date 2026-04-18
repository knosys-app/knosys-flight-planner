import { STORAGE_KEYS } from '../constants';
import { MapRegionSchema, type MapRegion } from '../schemas/region-schema';
import { deleteValue, getValue, setValue } from './storage';

export async function listRegionIds(): Promise<string[]> {
  return (await getValue<string[]>(STORAGE_KEYS.mapRegionsIndex)) ?? [];
}

export async function getRegion(id: string): Promise<MapRegion | null> {
  const raw = await getValue<unknown>(STORAGE_KEYS.mapRegion(id));
  if (!raw) return null;
  const parsed = MapRegionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function listRegions(): Promise<MapRegion[]> {
  const ids = await listRegionIds();
  const regions = await Promise.all(ids.map(getRegion));
  return regions.filter((r): r is MapRegion => r !== null);
}

export async function saveRegion(region: MapRegion): Promise<MapRegion> {
  const validated = MapRegionSchema.parse(region);
  const ids = await listRegionIds();
  if (!ids.includes(validated.id)) {
    await setValue(STORAGE_KEYS.mapRegionsIndex, [...ids, validated.id]);
  }
  await setValue(STORAGE_KEYS.mapRegion(validated.id), validated);
  return validated;
}

export async function deleteRegion(id: string): Promise<void> {
  const ids = await listRegionIds();
  await setValue(STORAGE_KEYS.mapRegionsIndex, ids.filter((x) => x !== id));
  await deleteValue(STORAGE_KEYS.mapRegion(id));
}
