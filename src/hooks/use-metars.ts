// Fetch METARs for a list of ICAOs (departure, destination, alternates).
// Returns the current map + a loading + error flag. Uses the metar-client
// cache, so repeat calls with the same ICAOs within the TTL are instant.

import type { SharedDependencies } from '../types';
import { getMetars } from '../weather/metar-client';
import type { MetarObservation } from '../weather/types';

const REFRESH_MINUTES = 20;

export interface UseMetarsResult {
  byIcao: Record<string, MetarObservation>;
  loading: boolean;
  error: string | null;
  /** When the last successful fetch completed, or null. */
  lastFetchedAtIso: string | null;
}

export function createUseMetars(Shared: SharedDependencies) {
  const { useEffect, useState } = Shared;

  return function useMetars(icaos: string[]): UseMetarsResult {
    const [byIcao, setByIcao] = useState<Record<string, MetarObservation>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastFetchedAtIso, setLastFetchedAtIso] = useState<string | null>(null);

    // Sort + dedupe into a stable string so effect deps don't cycle on each render.
    const key = Array.from(new Set(icaos.map((s) => s.trim().toUpperCase()).filter(Boolean)))
      .sort()
      .join(',');

    useEffect(() => {
      if (!key) {
        setByIcao({});
        setLoading(false);
        setError(null);
        return;
      }
      let cancelled = false;
      const ids = key.split(',');

      const run = async () => {
        setLoading(true);
        setError(null);
        try {
          const next = await getMetars(ids);
          if (cancelled) return;
          setByIcao(next);
          if (Object.keys(next).length > 0) {
            setLastFetchedAtIso(new Date().toISOString());
          }
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      void run();

      // Periodic refresh so data doesn't go stale while a plan is open.
      const interval = window.setInterval(() => void run(), REFRESH_MINUTES * 60_000);
      return () => {
        cancelled = true;
        window.clearInterval(interval);
      };
    }, [key]);

    return { byIcao, loading, error, lastFetchedAtIso };
  };
}
