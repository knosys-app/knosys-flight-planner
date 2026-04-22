// Auto-picks up to N alternate airports near the destination. Used to
// enrich the briefing card with fallback options.

import type { Airport, AirportType, SharedDependencies } from '../types';
import { getAeroDataSource } from './use-aero-data';
import { greatCircleDistanceNm } from '../math/aviation-math';

const NM_PER_DEG_LAT = 60;
/** Default accept types: fixed-wing field, NOT helipads or seaplane bases. */
const DEFAULT_ACCEPT: AirportType[] = ['large_airport', 'medium_airport', 'small_airport'];

export interface AlternateOptions {
  /** Search radius around the destination (nautical miles). */
  radiusNm?: number;
  /** Max number of alternates to return (sorted by distance ascending). */
  limit?: number;
}

export interface Alternate {
  airport: Airport;
  distanceNm: number;
}

export interface UseAlternatesResult {
  alternates: Alternate[];
  loading: boolean;
  error: string | null;
}

export function createUseAlternates(Shared: SharedDependencies) {
  const { useEffect, useState } = Shared;

  return function useAlternates(
    destination: Airport | null,
    options: AlternateOptions = {},
  ): UseAlternatesResult {
    const [alternates, setAlternates] = useState<Alternate[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const radiusNm = options.radiusNm ?? 50;
    const limit = options.limit ?? 3;
    const destIcao = destination?.icao ?? '';

    useEffect(() => {
      if (!destination) {
        setAlternates([]);
        setLoading(false);
        setError(null);
        return;
      }

      let cancelled = false;
      const run = async () => {
        setLoading(true);
        setError(null);
        try {
          const ds = getAeroDataSource();
          const dLat = radiusNm / NM_PER_DEG_LAT;
          const dLon =
            radiusNm /
            (NM_PER_DEG_LAT * Math.max(0.01, Math.cos((destination.lat * Math.PI) / 180)));
          const bbox: [number, number, number, number] = [
            destination.lon - dLon,
            destination.lat - dLat,
            destination.lon + dLon,
            destination.lat + dLat,
          ];
          const nearby = await ds.airportsInBbox(bbox, { types: DEFAULT_ACCEPT, limit: 50 });
          if (cancelled) return;

          const ranked: Alternate[] = nearby
            .filter((a) => a.icao !== destination.icao && a.icao)
            .map((a) => ({
              airport: a,
              distanceNm: greatCircleDistanceNm(destination, a),
            }))
            .filter((a) => a.distanceNm <= radiusNm)
            .sort((a, b) => a.distanceNm - b.distanceNm)
            .slice(0, limit);

          setAlternates(ranked);
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : String(err));
            setAlternates([]);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      };

      void run();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [destIcao, radiusNm, limit]);

    return { alternates, loading, error };
  };
}
