import type { Frequency, Navaid, Waypoint } from '../types';

/**
 * Priority order for picking the most useful radio frequency at a
 * destination airport. Case-insensitive match against `Frequency.type`.
 * Order mirrors what a pilot typically tunes first: CTAF before tower
 * (uncontrolled fields are more common in GA than controlled), then the
 * fallbacks.
 */
const FREQ_PRIORITY = [
  'CTAF',
  'TWR',
  'TOWER',
  'UNIC',
  'UNICOM',
  'MULTICOM',
  'A/D',
  'APP',
  'AWOS',
  'ASOS',
  'ATIS',
] as const;

export function pickPrimaryFrequency(
  frequencies: Frequency[] | undefined,
): Frequency | null {
  if (!frequencies || frequencies.length === 0) return null;
  const normalized = frequencies.map((f) => ({ f, key: (f.type ?? '').trim().toUpperCase() }));
  for (const target of FREQ_PRIORITY) {
    const hit = normalized.find((n) => n.key === target);
    if (hit) return hit.f;
  }
  return null;
}

/**
 * For navlog rendering. Given a waypoint + optional hydrated airport or
 * navaid, produce a `{label, mhz}` pair or null. Handles three cases:
 *   - airport waypoint: pick primary freq from frequencies[]
 *   - navaid waypoint: use navaid.freq
 *   - user point: no freq
 */
export function waypointFrequency(
  waypoint: Waypoint,
  airportFreqs?: Frequency[],
  navaid?: Navaid | null,
): { type: string; mhz: number } | null {
  if (waypoint.kind === 'airport') {
    const f = pickPrimaryFrequency(airportFreqs);
    return f ? { type: f.type, mhz: f.mhz } : null;
  }
  if (waypoint.kind === 'navaid' && navaid?.freq) {
    return { type: navaid.type, mhz: navaid.freq };
  }
  return null;
}
