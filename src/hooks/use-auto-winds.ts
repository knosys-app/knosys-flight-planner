// Derives a WindsEntryRow[] from winds-aloft forecast for the plan's route
// midpoint, one row per unique cruise altitude in the plan. Feeds use-navlog
// when the user hasn't entered manual overrides.

import type { Plan, SharedDependencies, WindsEntryRow } from '../types';
import { getWindsAloft, interpolateWindAt } from '../weather/winds-aloft-client';
import type { WindsAloft } from '../weather/winds-aloft-client';

export interface UseAutoWindsResult {
  winds: WindsEntryRow[];
  loading: boolean;
  error: string | null;
  /** The column we sampled from (for debugging / attribution). */
  source: WindsAloft | null;
}

const REFRESH_MINUTES = 30;

function routeMidpoint(plan: Plan | null): { lat: number; lon: number } | null {
  if (!plan || plan.waypoints.length === 0) return null;
  const latSum = plan.waypoints.reduce((s, w) => s + w.lat, 0);
  const lonSum = plan.waypoints.reduce((s, w) => s + w.lon, 0);
  return {
    lat: latSum / plan.waypoints.length,
    lon: lonSum / plan.waypoints.length,
  };
}

function uniqueAltitudes(plan: Plan | null): number[] {
  if (!plan) return [];
  const set = new Set<number>();
  for (const leg of plan.legs) {
    if (Number.isFinite(leg.altFt)) set.add(Math.round(leg.altFt));
  }
  return Array.from(set).sort((a, b) => a - b);
}

export function createUseAutoWinds(Shared: SharedDependencies) {
  const { useEffect, useMemo, useState } = Shared;

  return function useAutoWinds(plan: Plan | null): UseAutoWindsResult {
    const [source, setSource] = useState<WindsAloft | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const midpoint = routeMidpoint(plan);
    // Key the fetch effect on a coarse lat/lon so small route-edit deltas
    // don't re-trigger constantly.
    const fetchKey = midpoint
      ? `${midpoint.lat.toFixed(1)}_${midpoint.lon.toFixed(1)}`
      : '';

    useEffect(() => {
      if (!fetchKey || !midpoint) {
        setSource(null);
        setLoading(false);
        setError(null);
        return;
      }
      let cancelled = false;
      const run = async () => {
        setLoading(true);
        setError(null);
        try {
          const col = await getWindsAloft(midpoint.lat, midpoint.lon);
          if (!cancelled) setSource(col);
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      void run();
      const interval = window.setInterval(() => void run(), REFRESH_MINUTES * 60_000);
      return () => {
        cancelled = true;
        window.clearInterval(interval);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchKey]);

    const winds = useMemo<WindsEntryRow[]>(() => {
      if (!source) return [];
      const alts = uniqueAltitudes(plan);
      const rows: WindsEntryRow[] = [];
      for (const alt of alts) {
        const w = interpolateWindAt(source, alt);
        if (!w) continue;
        rows.push({
          altFt: alt,
          dirTrueDeg: w.dirTrueDeg,
          speedKt: w.speedKt,
          tempC: w.tempC ?? undefined,
        });
      }
      return rows;
    }, [source, plan]);

    return { winds, loading, error, source };
  };
}
