// Derives the terrain profile + auto-picked per-leg altitudes for a plan.
// Implemented as a factory so it can use the Shared React hooks without
// importing the React runtime directly (plugin sandbox constraint).

import type {
  AircraftProfile,
  NavlogWarning,
  Obstacle,
  Plan,
  PluginSettings,
  ProfileSample,
  RouteProfile,
  SharedDependencies,
  Waypoint,
} from '../types';
import { getTerrainProvider } from '../terrain/use-terrain-provider';
import { getObstacleProvider } from '../obstacles/use-obstacle-provider';
import { isObstaclesDbInstalled } from '../obstacles/obstacle-download';
import { selectCruiseAltitude } from '../math/altitude-selection';
import { greatCircleInitialBearingDeg, magneticHeading } from '../math/aviation-math';
import { OBSTACLE_CORRIDOR_NM, TERRAIN_SAMPLE_STEP_NM } from '../constants';

export interface UseRouteProfileInput {
  plan: Plan | null;
  aircraft: AircraftProfile | null;
  settings: PluginSettings;
}

export interface UseRouteProfileResult extends RouteProfile {
  /** True while a profile computation is in flight. */
  loading: boolean;
  /** Last error message from terrain or obstacle providers, if any. */
  error: string | null;
}

const EMPTY_PROFILE: RouteProfile = {
  samples: [],
  obstacles: [],
  perLegAltitudes: [],
  perLegWarnings: [],
};

export function createUseRouteProfile(Shared: SharedDependencies) {
  const { useState, useEffect } = Shared;

  return function useRouteProfile(input: UseRouteProfileInput): UseRouteProfileResult {
    const [profile, setProfile] = useState<RouteProfile>(EMPTY_PROFILE);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { plan, aircraft, settings } = input;

    // Use a string key to stabilize the effect dependency — the effect only
    // re-runs when legs or aircraft identity change, not on every parent
    // re-render.
    const key = buildKey(plan, aircraft);

    useEffect(() => {
      if (!plan || !aircraft || plan.legs.length === 0) {
        setProfile(EMPTY_PROFILE);
        setLoading(false);
        setError(null);
        return;
      }

      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        timer = null;
        void run();
      }, 300);

      const run = async (): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
          const terrain = getTerrainProvider();
          const wpIndex = new Map<string, Waypoint>(
            plan.waypoints.map((w) => [w.id, w]),
          );

          // Sample each leg, chaining along-track distance across legs.
          const legSamples: ProfileSample[][] = [];
          let along = 0;
          for (const leg of plan.legs) {
            const from = wpIndex.get(leg.fromId);
            const to = wpIndex.get(leg.toId);
            if (!from || !to) {
              legSamples.push([]);
              continue;
            }
            const samples = await terrain.sampleAlongRoute(
              from,
              to,
              TERRAIN_SAMPLE_STEP_NM,
              along,
            );
            if (cancelled) return;
            legSamples.push(samples);
            if (samples.length > 0) {
              along = samples[samples.length - 1].alongTrackNm;
            }
          }

          const flatSamples = legSamples.flat();

          // Obstacles: only if enabled AND db installed.
          let obstaclesWithAlong: Array<Obstacle & { alongTrackNm: number }> = [];
          let perLegObstacles: Obstacle[][] = plan.legs.map(() => []);
          if (settings.obstaclesEnabled && (await isObstaclesDbInstalled())) {
            try {
              const obstacles = getObstacleProvider();
              await obstacles.ready();
              for (let i = 0; i < plan.legs.length; i++) {
                const samples = legSamples[i];
                if (samples.length === 0) continue;
                const found = await obstacles.obstaclesAlongRoute(
                  samples,
                  OBSTACLE_CORRIDOR_NM,
                );
                if (cancelled) return;
                perLegObstacles[i] = found;
                for (const o of found) {
                  const nearest = nearestAlongTrack(samples, o.lat, o.lon);
                  obstaclesWithAlong.push({ ...o, alongTrackNm: nearest });
                }
              }
            } catch (err) {
              // Obstacle lookup failure is non-fatal — we still show terrain.
              console.warn('[flight-planner] obstacle lookup failed', err);
            }
          }

          // Auto-altitudes per leg.
          const perLegAltitudes: Array<number | undefined> = [];
          const perLegWarnings: NavlogWarning[][] = [];
          for (let i = 0; i < plan.legs.length; i++) {
            const leg = plan.legs[i];
            const from = wpIndex.get(leg.fromId);
            const to = wpIndex.get(leg.toId);
            const samples = legSamples[i];
            if (!from || !to || samples.length === 0) {
              perLegAltitudes.push(undefined);
              perLegWarnings.push([]);
              continue;
            }
            const tc = greatCircleInitialBearingDeg(from, to);
            const midLat = (from.lat + to.lat) / 2;
            const midLon = (from.lon + to.lon) / 2;
            const mh = magneticHeading(tc, midLat, midLon, new Date());
            const result = selectCruiseAltitude({
              samples,
              obstacles: perLegObstacles[i],
              magneticCourseDeg: mh,
              departureElevFt: legSamples[0][0]?.terrainElevFt ?? 0,
              aircraft,
              obstaclesEnabled: settings.obstaclesEnabled ?? false,
            });
            perLegAltitudes.push(result.altFt);
            perLegWarnings.push(result.warnings);
          }

          if (cancelled) return;
          setProfile({
            samples: flatSamples,
            obstacles: obstaclesWithAlong,
            perLegAltitudes,
            perLegWarnings,
          });
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : String(err));
            setProfile(EMPTY_PROFILE);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      };

      return () => {
        cancelled = true;
        if (timer !== null) clearTimeout(timer);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, settings.obstaclesEnabled]);

    return { ...profile, loading, error };
  };
}

function buildKey(plan: Plan | null, aircraft: AircraftProfile | null): string {
  if (!plan || !aircraft) return 'empty';
  const legs = plan.legs.map((l) => `${l.fromId}:${l.toId}:${l.altFt}:${l.altAutoPicked ? 1 : 0}`).join('|');
  const wps = plan.waypoints.map((w) => `${w.id}@${w.lat.toFixed(4)},${w.lon.toFixed(4)}`).join('|');
  return `${aircraft.id}::${legs}::${wps}`;
}

function nearestAlongTrack(
  samples: Array<{ alongTrackNm: number; lat: number; lon: number }>,
  lat: number,
  lon: number,
): number {
  let best = samples[0]?.alongTrackNm ?? 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const s of samples) {
    const dx = s.lat - lat;
    const dy = s.lon - lon;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDist) {
      bestDist = d2;
      best = s.alongTrackNm;
    }
  }
  return best;
}
