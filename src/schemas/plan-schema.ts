import { z } from 'zod';

export const WaypointSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['airport', 'navaid', 'userPoint']),
  ref: z.string(),
  name: z.string(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  altFt: z.number().int().optional(),
});

export const LegSchema = z.object({
  fromId: z.string().uuid(),
  toId: z.string().uuid(),
  altFt: z.number().int(),
  tasKt: z.number().positive().optional(),
  windDir: z.number().min(0).max(360).optional(),
  windKt: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export const PlanSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  departureIcao: z.string(),
  destinationIcao: z.string(),
  alternateIcao: z.string().optional(),
  waypoints: z.array(WaypointSchema),
  legs: z.array(LegSchema),
  aircraftProfileId: z.string().uuid(),
  departureTimeUtc: z.string().datetime().optional(),
  reserveMinutesOverride: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

export type Waypoint = z.infer<typeof WaypointSchema>;
export type Leg = z.infer<typeof LegSchema>;
export type Plan = z.infer<typeof PlanSchema>;
