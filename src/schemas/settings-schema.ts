import { z } from 'zod';

export const PluginSettingsSchema = z.object({
  schemaVersion: z.literal(1),
  units: z.enum(['us', 'metric']).default('us'),
  defaultAircraftProfileId: z.string().uuid().optional(),
  defaultReserveMinutes: z.number().int().nonnegative().default(45),
  defaultCruiseAltFt: z.number().int().default(5500),
  airportsDbVersion: z.string().optional(),
  airportsDbInstalledAt: z.string().datetime().optional(),
  weatherProviderId: z.string().default('manual'),
  obstaclesEnabled: z.boolean().default(false).optional(),
  obstaclesDbVersion: z.string().optional(),
  obstaclesDbInstalledAt: z.string().datetime().optional(),
});

export const InstalledMapRegionSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  sizeBytes: z.number().nonnegative(),
  installedAt: z.string().datetime(),
});

export type PluginSettings = z.infer<typeof PluginSettingsSchema>;
export type InstalledMapRegion = z.infer<typeof InstalledMapRegionSchema>;
