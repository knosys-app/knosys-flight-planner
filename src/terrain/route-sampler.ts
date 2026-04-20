// Great-circle route sampling. Given two waypoints and a step in nautical
// miles, produces evenly spaced intermediate points. Uses geodesy's
// LatLon spherical math for consistency with the rest of aviation-math.

import LatLon from 'geodesy/latlon-spherical.js';
import { greatCircleDistanceNm } from '../math/aviation-math';
import type { LatLon as LatLonLiteral } from '../types';

export interface SampledPoint {
  alongTrackNm: number;
  lat: number;
  lon: number;
}

/**
 * Sample `from → to` at `stepNm` intervals. Always emits endpoints exactly.
 * `startAlongTrackNm` offsets the along-track axis so multi-leg routes can
 * be concatenated into a continuous profile.
 */
export function sampleRoute(
  from: LatLonLiteral,
  to: LatLonLiteral,
  stepNm: number,
  startAlongTrackNm = 0,
): SampledPoint[] {
  const distNm = greatCircleDistanceNm(from, to);
  if (distNm <= 0) {
    return [{ alongTrackNm: startAlongTrackNm, lat: from.lat, lon: from.lon }];
  }
  const steps = Math.max(1, Math.ceil(distNm / stepNm));
  const p1 = new LatLon(from.lat, from.lon);
  const p2 = new LatLon(to.lat, to.lon);
  const out: SampledPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const fraction = i / steps;
    let lat: number;
    let lon: number;
    if (fraction === 0) {
      lat = from.lat;
      lon = from.lon;
    } else if (fraction === 1) {
      lat = to.lat;
      lon = to.lon;
    } else {
      // Intermediate point on great-circle path.
      const interp = p1.intermediatePointTo(p2, fraction);
      lat = interp.lat;
      lon = interp.lon;
    }
    out.push({
      alongTrackNm: startAlongTrackNm + fraction * distNm,
      lat,
      lon,
    });
  }
  return out;
}
