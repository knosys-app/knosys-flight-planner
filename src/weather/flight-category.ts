import type { CloudLayer, FlightCategory } from './types';

/**
 * Derive FAA flight category from ceiling (lowest BKN/OVC/VV layer, in ft
 * AGL) and prevailing visibility (statute miles). Matches NOAA AWC rules:
 *   - LIFR: ceiling < 500  OR vis < 1
 *   - IFR:  ceiling < 1000 OR vis < 3
 *   - MVFR: ceiling < 3000 OR vis < 5
 *   - VFR:  everything else
 */
export function deriveFlightCategory(
  ceilingFtAgl: number | null,
  visibilitySm: number | null,
): FlightCategory {
  if (ceilingFtAgl == null && visibilitySm == null) return 'UNKNOWN';
  const c = ceilingFtAgl ?? Number.POSITIVE_INFINITY;
  const v = visibilitySm ?? Number.POSITIVE_INFINITY;
  if (c < 500 || v < 1) return 'LIFR';
  if (c < 1000 || v < 3) return 'IFR';
  if (c < 3000 || v < 5) return 'MVFR';
  return 'VFR';
}

/**
 * Lowest ceiling layer (BKN / OVC / VV). Returns null if none of those
 * layers are present (sky clear or only FEW/SCT).
 */
export function ceilingFromClouds(clouds: CloudLayer[]): number | null {
  let lowest: number | null = null;
  for (const layer of clouds) {
    if (layer.coverage !== 'BKN' && layer.coverage !== 'OVC' && layer.coverage !== 'VV') {
      continue;
    }
    if (layer.baseFtAgl == null) continue;
    if (lowest == null || layer.baseFtAgl < lowest) lowest = layer.baseFtAgl;
  }
  return lowest;
}
