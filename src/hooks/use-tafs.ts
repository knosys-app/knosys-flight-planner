import type { SharedDependencies } from '../types';
import { getTafs } from '../weather/taf-client';
import type { TafForecast } from '../weather/types';

const REFRESH_MINUTES = 30;

export interface UseTafsResult {
  byIcao: Record<string, TafForecast>;
  loading: boolean;
  error: string | null;
}

export function createUseTafs(Shared: SharedDependencies) {
  const { useEffect, useState } = Shared;

  return function useTafs(icaos: string[]): UseTafsResult {
    const [byIcao, setByIcao] = useState<Record<string, TafForecast>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
          const next = await getTafs(ids);
          if (!cancelled) setByIcao(next);
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
    }, [key]);

    return { byIcao, loading, error };
  };
}
