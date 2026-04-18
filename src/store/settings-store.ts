import type { InstalledMapRegion, PluginSettings } from '../types';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../constants';
import {
  InstalledMapRegionSchema,
  PluginSettingsSchema,
} from '../schemas/settings-schema';
import { migrateSettings } from '../schemas/migrations';
import { getValue, setValue } from './storage';

export async function getSettings(): Promise<PluginSettings> {
  const raw = await getValue<unknown>(STORAGE_KEYS.settings);
  if (!raw) return DEFAULT_SETTINGS as PluginSettings;
  const migrated = migrateSettings(raw);
  const parsed = PluginSettingsSchema.safeParse(migrated);
  return parsed.success ? parsed.data : (DEFAULT_SETTINGS as PluginSettings);
}

export async function saveSettings(patch: Partial<PluginSettings>): Promise<PluginSettings> {
  const current = await getSettings();
  const next = PluginSettingsSchema.parse({ ...current, ...patch });
  await setValue(STORAGE_KEYS.settings, next);
  return next;
}

export async function listInstalledRegions(): Promise<InstalledMapRegion[]> {
  const raw = await getValue<unknown>(STORAGE_KEYS.mapRegionsInstalled);
  if (!Array.isArray(raw)) return [];
  const out: InstalledMapRegion[] = [];
  for (const r of raw) {
    const parsed = InstalledMapRegionSchema.safeParse(r);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export async function addInstalledRegion(region: InstalledMapRegion): Promise<void> {
  const validated = InstalledMapRegionSchema.parse(region);
  const current = await listInstalledRegions();
  const next = [...current.filter((r) => r.id !== validated.id), validated];
  await setValue(STORAGE_KEYS.mapRegionsInstalled, next);
}

export async function removeInstalledRegion(id: string): Promise<void> {
  const current = await listInstalledRegions();
  await setValue(
    STORAGE_KEYS.mapRegionsInstalled,
    current.filter((r) => r.id !== id),
  );
}
