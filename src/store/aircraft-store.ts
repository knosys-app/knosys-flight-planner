import { v4 as uuid } from 'uuid';
import type { AircraftProfile } from '../types';
import { AIRCRAFT_PRESETS, STORAGE_KEYS } from '../constants';
import { AircraftProfileSchema } from '../schemas/aircraft-schema';
import { migrateAircraft } from '../schemas/migrations';
import { deleteValue, getValue, setValue } from './storage';

export async function listAircraftIds(): Promise<string[]> {
  return (await getValue<string[]>(STORAGE_KEYS.aircraftIndex)) ?? [];
}

export async function getAircraft(id: string): Promise<AircraftProfile | null> {
  const raw = await getValue<unknown>(STORAGE_KEYS.aircraft(id));
  if (!raw) return null;
  const migrated = migrateAircraft(raw);
  const parsed = AircraftProfileSchema.safeParse(migrated);
  if (!parsed.success) return null;
  return healWBFromPreset(parsed.data);
}

/**
 * Back-fill missing W&B fields from the matching preset (matched by the
 * aircraft `type` string). Never overwrites existing values — only fills
 * in the gaps so an aircraft saved before v0.5.1 can display a useful
 * W&B panel without manual editing.
 */
function healWBFromPreset(a: AircraftProfile): AircraftProfile {
  const preset = AIRCRAFT_PRESETS.find((p) => p.type === a.type);
  if (!preset) return a;
  const healed: AircraftProfile = { ...a };
  if (healed.emptyCgIn == null && preset.emptyCgIn != null) {
    healed.emptyCgIn = preset.emptyCgIn;
  }
  if (healed.emptyWeightLb == null && preset.emptyWeightLb != null) {
    healed.emptyWeightLb = preset.emptyWeightLb;
  }
  if (healed.maxGrossWeightLb == null && preset.maxGrossWeightLb != null) {
    healed.maxGrossWeightLb = preset.maxGrossWeightLb;
  }
  if (healed.maxBaggageWeightLb == null && preset.maxBaggageWeightLb != null) {
    healed.maxBaggageWeightLb = preset.maxBaggageWeightLb;
  }
  if (
    (healed.weightStations == null || healed.weightStations.length === 0) &&
    preset.weightStations &&
    preset.weightStations.length > 0
  ) {
    healed.weightStations = preset.weightStations;
  }
  if (
    (healed.fuelStations == null || healed.fuelStations.length === 0) &&
    preset.fuelStations &&
    preset.fuelStations.length > 0
  ) {
    healed.fuelStations = preset.fuelStations;
  }
  if (
    (healed.envelopeCorners == null || healed.envelopeCorners.length === 0) &&
    preset.envelopeCorners &&
    preset.envelopeCorners.length > 0
  ) {
    healed.envelopeCorners = preset.envelopeCorners;
  }
  return healed;
}

export async function listAircraft(): Promise<AircraftProfile[]> {
  const ids = await listAircraftIds();
  const list = await Promise.all(ids.map(getAircraft));
  return list.filter((a): a is AircraftProfile => a !== null);
}

export async function saveAircraft(aircraft: AircraftProfile): Promise<AircraftProfile> {
  const validated = AircraftProfileSchema.parse(aircraft);
  const ids = await listAircraftIds();
  if (!ids.includes(validated.id)) {
    await setValue(STORAGE_KEYS.aircraftIndex, [...ids, validated.id]);
  }
  await setValue(STORAGE_KEYS.aircraft(validated.id), validated);
  return validated;
}

export async function deleteAircraft(id: string): Promise<void> {
  const ids = await listAircraftIds();
  await setValue(STORAGE_KEYS.aircraftIndex, ids.filter((i) => i !== id));
  await deleteValue(STORAGE_KEYS.aircraft(id));
}

/**
 * On first run, seed the aircraft list with the built-in GA presets so
 * users have something immediately selectable. Idempotent: skips if any
 * aircraft already exists.
 */
export async function seedPresetsIfEmpty(): Promise<AircraftProfile[]> {
  const existing = await listAircraft();
  if (existing.length > 0) return existing;
  const created: AircraftProfile[] = [];
  for (const preset of AIRCRAFT_PRESETS) {
    const aircraft = { ...preset, id: uuid() };
    const saved = await saveAircraft(aircraft);
    created.push(saved);
  }
  return created;
}
