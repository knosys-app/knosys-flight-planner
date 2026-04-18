import { z } from 'zod';

export const MapRegionSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  name: z.string(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  zoomMin: z.number().int().nonnegative(),
  zoomMax: z.number().int().nonnegative(),
  totalTiles: z.number().int().nonnegative(),
  downloadedTiles: z.number().int().nonnegative(),
  sizeBytes: z.number().int().nonnegative(),
  installedAt: z.string().datetime(),
  status: z.enum(['pending', 'downloading', 'complete', 'error']),
  lastError: z.string().optional(),
});

export type MapRegion = z.infer<typeof MapRegionSchema>;
