import type { Airport, Runway } from '../types';

const EARTH_RADIUS_M = 6371008.8;
const FT_PER_M = 3.28084;

interface LngLat {
  lng: number;
  lat: number;
}

/** Destination point given start, bearing (deg true), and distance (m). */
function destinationClean(from: LngLat, bearingDeg: number, distanceMeters: number): LngLat {
  const bearing = (bearingDeg * Math.PI) / 180;
  const angularDist = distanceMeters / EARTH_RADIUS_M;
  const lat1 = (from.lat * Math.PI) / 180;
  const lon1 = (from.lng * Math.PI) / 180;

  const sinLat2 =
    Math.sin(lat1) * Math.cos(angularDist) +
    Math.cos(lat1) * Math.sin(angularDist) * Math.cos(bearing);
  const lat2 = Math.asin(sinLat2);
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDist) * Math.cos(lat1),
      Math.cos(angularDist) - Math.sin(lat1) * sinLat2,
    );

  let lngDeg = (lon2 * 180) / Math.PI;
  lngDeg = ((lngDeg + 540) % 360) - 180;
  return { lng: lngDeg, lat: (lat2 * 180) / Math.PI };
}

/**
 * Given an airport (for lat/lon) and a runway, return a rectangle polygon
 * representing the paved surface (length × width), oriented by the le
 * heading. Output is a ring of [lng, lat] pairs, closed.
 *
 * When the runway carries true endpoint coordinates (airport DB v2+),
 * the rectangle is built around those endpoints — so parallel runways
 * at the same airport land in their real-world positions. Otherwise
 * falls back to centering at the airport reference point, which
 * collapses parallels onto the same axis.
 *
 * Returns null if length or heading data is missing.
 */
export function runwayPolygon(
  airport: Pick<Airport, 'lat' | 'lon'>,
  runway: Runway,
): [number, number][] | null {
  if (!runway.lengthFt) return null;
  const heading = runway.headingTrue;
  if (!Number.isFinite(heading)) return null;

  const halfWidM = Math.max(runway.widthFt || 0, 30) / FT_PER_M / 2;
  // Use max(widthFt, 30) so we always have some visible width; many small
  // runways have bogus width=0 in the source data.
  const perpHdg = (heading + 90) % 360;

  // Preferred path: use real endpoint coordinates if the DB provides them.
  const hasEndpoints =
    Number.isFinite(runway.leLat) &&
    Number.isFinite(runway.leLon) &&
    Number.isFinite(runway.heLat) &&
    Number.isFinite(runway.heLon);

  let tip: LngLat;
  let tail: LngLat;
  if (hasEndpoints) {
    tail = { lat: runway.leLat!, lng: runway.leLon! };
    tip = { lat: runway.heLat!, lng: runway.heLon! };
  } else {
    const halfLenM = (runway.lengthFt / FT_PER_M) / 2;
    const center: LngLat = { lng: airport.lon, lat: airport.lat };
    tip = destinationClean(center, heading, halfLenM);
    tail = destinationClean(center, heading + 180, halfLenM);
  }

  // Offset each end perpendicular to the runway axis to get the four corners.
  const tipRight = destinationClean(tip, perpHdg, halfWidM);
  const tipLeft = destinationClean(tip, perpHdg + 180, halfWidM);
  const tailRight = destinationClean(tail, perpHdg, halfWidM);
  const tailLeft = destinationClean(tail, perpHdg + 180, halfWidM);

  return [
    [tipLeft.lng, tipLeft.lat],
    [tipRight.lng, tipRight.lat],
    [tailRight.lng, tailRight.lat],
    [tailLeft.lng, tailLeft.lat],
    [tipLeft.lng, tipLeft.lat],
  ];
}
