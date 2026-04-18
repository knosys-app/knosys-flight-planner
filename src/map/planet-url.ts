import { PROTOMAPS_URL_PATTERN, STORAGE_KEYS } from '../constants';
import { getValue, setValue } from '../store/storage';
import { pluginHead } from './plugin-fetch';

interface CachedSource {
  url: string;
  resolvedAt: string;
}

const REPROBE_AFTER_MS = 12 * 60 * 60 * 1000; // 12 h
const LOOKBACK_DAYS = 5;

function formatDate(d: Date): string {
  const year = d.getUTCFullYear().toString();
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

function urlForDate(date: Date): string {
  return PROTOMAPS_URL_PATTERN.replace('{date}', formatDate(date));
}

async function probe(url: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await pluginHead(url);
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
  // signal intentionally unused — pluginHead is short-lived and the helper
  // enforces its own timeout.
  void signal;
}

/**
 * Resolve the current Protomaps daily build URL. Probes today (UTC) then
 * walks back up to 5 days to tolerate propagation + weekend gaps. Result
 * is cached in api.storage for 12 h to avoid repeating HEADs on every
 * launch.
 */
export async function resolvePlanetUrl(force = false): Promise<string> {
  if (!force) {
    const cached = await getValue<CachedSource>(STORAGE_KEYS.mapSource);
    if (cached?.url) {
      const age = Date.now() - new Date(cached.resolvedAt).getTime();
      if (Number.isFinite(age) && age >= 0 && age < REPROBE_AFTER_MS) {
        return cached.url;
      }
    }
  }

  const today = new Date();
  for (let offset = 0; offset <= LOOKBACK_DAYS; offset++) {
    const candidate = new Date(today);
    candidate.setUTCDate(today.getUTCDate() - offset);
    const url = urlForDate(candidate);
    if (await probe(url)) {
      await setValue<CachedSource>(STORAGE_KEYS.mapSource, {
        url,
        resolvedAt: new Date().toISOString(),
      });
      return url;
    }
  }

  throw new Error(
    `Could not find a recent Protomaps build (tried ${LOOKBACK_DAYS + 1} days back).`,
  );
}

export async function clearCachedPlanetUrl(): Promise<void> {
  await setValue<CachedSource | null>(STORAGE_KEYS.mapSource, null);
}
