// FAR 91.159 VFR cruising altitude rule (above 3000 AGL):
//   Magnetic course 0°–179° → odd thousand + 500 (3500, 5500, 7500, …)
//   Magnetic course 180°–359° → even thousand + 500 (4500, 6500, 8500, …)
//
// Helper rounds a required minimum altitude UP to the next valid VFR cruise
// altitude for the given course. Below 3000 AGL the rule doesn't apply, and
// we return the floored minimum unchanged.

import { normalizeDeg } from './aviation-math';

export function isEastbound(courseDeg: number): boolean {
  const c = normalizeDeg(courseDeg);
  return c < 180;
}

/**
 * Round `minAltFt` up to the next valid VFR cruising altitude for `courseDeg`.
 * The rule only applies above 3000 AGL — callers are responsible for checking
 * that condition. Inputs that already land on a valid altitude are returned
 * unchanged.
 */
export function vfrCruiseAltitude(courseDeg: number, minAltFt: number): number {
  const eastbound = isEastbound(courseDeg);
  // Eastbound magnetic 0°–179°: odd thousand + 500 (1500, 3500, 5500, …).
  // Westbound 180°–359°:       even thousand + 500 (2500, 4500, 6500, …).
  // Both spaced every 2000 ft; we round UP to the next valid altitude.
  const offset = eastbound ? 1500 : 2500;
  const above = minAltFt - offset;
  if (above <= 0) return offset;
  const steps = Math.ceil(above / 2000);
  return offset + steps * 2000;
}
