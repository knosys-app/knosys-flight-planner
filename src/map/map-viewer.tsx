import type { FC } from 'react';
import maplibregl, { type Map as MaplibreMap } from 'maplibre-gl';
import type { Plan, SharedDependencies } from '../types';
import { ensureMaplibreWorker } from './maplibre-worker-setup';
import { RouteMapLayer } from './route-map-layer';
import { MAP_ATTRIBUTION, MAP_STYLE_URL } from '../constants';

export function createMapViewer(Shared: SharedDependencies) {
  const { useEffect, useRef, useState } = Shared;

  const MapViewer: FC<{ plan: Plan | null }> = ({ plan }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MaplibreMap | null>(null);
    const routeLayerRef = useRef<RouteMapLayer>(new RouteMapLayer());
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      ensureMaplibreWorker();
      if (!containerRef.current) return;

      try {
        const map = new maplibregl.Map({
          container: containerRef.current,
          style: MAP_STYLE_URL,
          center: [-98, 39.5],
          zoom: 3,
          attributionControl: false,
        });
        map.addControl(
          new maplibregl.AttributionControl({
            customAttribution: MAP_ATTRIBUTION,
            compact: true,
          }),
          'bottom-right',
        );
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.addControl(new maplibregl.ScaleControl({ unit: 'nautical' }), 'bottom-left');
        map.on('load', () => {
          routeLayerRef.current.setPlan(plan);
          routeLayerRef.current.render(map);
        });
        map.on('error', (e) => {
          // eslint-disable-next-line no-console
          console.warn('[flight-planner] MapLibre error:', e);
        });
        mapRef.current = map;
      } catch (err) {
        setError(String((err as Error).message ?? err));
      }

      return () => {
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
      const render = () => {
        routeLayerRef.current.update(map);
        if (plan && plan.waypoints.length > 1) {
          const coords = plan.waypoints.map((w) => [w.lon, w.lat]) as [number, number][];
          const bounds = coords.reduce(
            (b, c) => b.extend(c as any),
            new maplibregl.LngLatBounds(coords[0] as any, coords[0] as any),
          );
          map.fitBounds(bounds, { padding: 80, duration: 500, maxZoom: 9 });
        }
      };
      if (map.isStyleLoaded()) {
        render();
      } else {
        map.once('load', render);
      }
    }, [plan]);

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
