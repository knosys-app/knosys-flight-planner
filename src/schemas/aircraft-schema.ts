import { z } from 'zod';

export const PerfEntrySchema = z.object({
  altFt: z.number().int(),
  tasKt: z.number().positive(),
  fuelBurnGph: z.number().positive(),
});

export const AircraftProfileSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  name: z.string().min(1),
  type: z.string().min(1),
  tasKt: z.number().positive(),
  fuelBurnGph: z.number().positive(),
  fuelCapacityGal: z.number().positive(),
  fuelType: z.enum(['100LL', 'Jet-A', 'MoGas']),
  reserveMinutes: z.number().int().nonnegative().default(45),
  climbFpm: z.number().positive().optional(),
  climbTasKt: z.number().positive().optional(),
  descentFpm: z.number().positive().optional(),
  emptyWeightLb: z.number().positive().optional(),
  performanceTable: z.array(PerfEntrySchema).optional(),
  isPreset: z.boolean().optional(),
});

export type PerfEntry = z.infer<typeof PerfEntrySchema>;
export type AircraftProfile = z.infer<typeof AircraftProfileSchema>;
