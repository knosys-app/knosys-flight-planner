import type { FC } from 'react';
import maplibregl, { type Map as MaplibreMap } from 'maplibre-gl';
import type { Plan, SharedDependencies } from '../types';
import { ensureMaplibreWorker } from './maplibre-worker-setup';
import { attachRegion } from './pmtiles-protocol';
import { buildStyle } from './map-style';
import { RouteMapLayer } from './route-map-layer';
import { listInstalledRegions } from '../store/settings-store';

export function createMapViewer(Shared: SharedDependencies) {
  const { useEffect, useRef, useState } = Shared;

  const MapViewer: FC<{ plan: Plan | null }> = ({ plan }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MaplibreMap | null>(null);
    const routeLayerRef = useRef<RouteMapLayer>(new RouteMapLayer());
    const [error, setError] = useState<string | null>(null);
    const [empty, setEmpty] = useState(false);

    useEffect(() => {
      let cancelled = false;
      ensureMaplibreWorker();
      (async () => {
        const regions = await listInstalledRegions();
        if (cancelled) return;
        if (regions.length === 0) {
          setEmpty(true);
          return;
        }
        const attachResults = await Promise.all(regions.map((r) => attachRegion(r.id)));
        const attachedIds = regions.filter((_, i) => attachResults[i]).map((r) => r.id);
        if (cancelled || !containerRef.current) return;
        try {
          const map = new maplibregl.Map({
            container: containerRef.current,
            style: buildStyle(attachedIds),
            center: [-98, 39.5],
            zoom: 3,
            attributionControl: false,
          });
          map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
          map.addControl(new maplibregl.ScaleControl({ unit: 'nautical' }), 'bottom-left');
          map.on('load', () => {
            routeLayerRef.current.setPlan(plan);
            routeLayerRef.current.render(map);
          });
          mapRef.current = map;
        } catch (err) {
          setError(String((err as Error).message ?? err));
        }
      })();
      return () => {
        cancelled = true;
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    }, []);

    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      routeLayerRef.current.setPlan(plan);
      if (map.loaded()) {
        routeLayerRef.current.update(map);
        if (plan && plan.waypoints.length > 1) {
          const coords = plan.waypoints.map((w) => [w.lon, w.lat]) as [number, number][];
          const bounds = coords.reduce(
            (b, c) => b.extend(c as any),
            new maplibregl.LngLatBounds(coords[0] as any, coords[0] as any),
          );
          map.fitBounds(bounds, { padding: 80, duration: 500, maxZoom: 9 });
        }
      } else {
        map.once('load', () => routeLayerRef.current.update(map));
      }
    }, [plan]);

    if (empty) {
      return (
        <div className="h-full w-full flex items-center justify-center bg-muted text-sm p-4 text-center">
          <div>
            <div className="font-medium mb-1">No map region installed</div>
            <div className="text-muted-foreground">
              Open Settings \u2192 Flight Planner \u2192 Regions and download a region to enable the map.
            </div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="h-full w-full flex items-center justify-center bg-destructive/10 text-sm p-4">
          <div>
            <div className="font-medium mb-1">Map failed to load</div>
            <div className="text-muted-foreground">{error}</div>
          </div>
        </div>
      );
    }

    return <div ref={containerRef} className="h-full w-full" style={{ minHeight: 400 }} />;
  };

  return MapViewer;
}
