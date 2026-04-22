import type { FC } from 'react';
import maplibregl, { type Map as MaplibreMap } from 'maplibre-gl';
import type { Plan, SharedDependencies } from '../types';
import { ensureMaplibreWorker } from './maplibre-worker-setup';
import { RouteMapLayer } from './route-map-layer';
import { AirportMarkersLayer } from './airport-markers-layer';
import { RunwayOverlayLayer } from './runway-overlay-layer';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  MAP_ATTRIBUTION,
} from '../constants';
import { resolvePlanetUrl } from './planet-url';
import { installCachedPmtilesProtocol } from './cached-pmtiles-protocol';
import { buildPlanetStyle, currentMapTheme } from './style-config';
import { loadMapViewport, saveMapViewport } from '../store/viewport-store';
import { getAeroDataSource } from '../hooks/use-aero-data';
import type { SelectedAirportStore } from '../hooks/use-selected-airport';

export function createMapViewer(Shared: SharedDependencies) {
  const { useEffect, useRef, useState } = Shared;

  const MapViewer: FC<{
    plan: Plan | null;
    selectedAirport: SelectedAirportStore;
  }> = ({ plan, selectedAirport }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MaplibreMap | null>(null);
    const routeLayerRef = useRef<RouteMapLayer>(new RouteMapLayer());
    const runwayLayerRef = useRef<RunwayOverlayLayer>(new RunwayOverlayLayer());
    const markersLayerRef = useRef<AirportMarkersLayer | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Hold a stable reference to the selected-airport store so marker click
    // handlers always see the latest setter.
    const selectedStoreRef = useRef(selectedAirport);
    useEffect(() => {
      selectedStoreRef.current = selectedAirport;
    }, [selectedAirport]);

    useEffect(() => {
      let cancelled = false;
      let map: MaplibreMap | null = null;
      ensureMaplibreWorker();

      (async () => {
        try {
          const [planetUrl, savedViewport] = await Promise.all([
            resolvePlanetUrl(),
            loadMapViewport(),
          ]);
          if (cancelled) return;
          await installCachedPmtilesProtocol(planetUrl);
          if (cancelled || !containerRef.current) return;
          const style = buildPlanetStyle(planetUrl, currentMapTheme());

          map = new maplibregl.Map({
            container: containerRef.current,
            style,
            center: savedViewport?.center ?? DEFAULT_MAP_CENTER,
            zoom: savedViewport?.zoom ?? DEFAULT_MAP_ZOOM,
            bearing: savedViewport?.bearing ?? 0,
            pitch: savedViewport?.pitch ?? 0,
            attributionControl: false,
          });
          map.addControl(
            new maplibregl.AttributionControl({
              customAttribution: MAP_ATTRIBUTION,
              compact: true,
            }),
            'bottom-right',
          );
          map.addControl(
            new maplibregl.NavigationControl({ showCompass: false }),
            'top-right',
          );
          map.addControl(
            new maplibregl.ScaleControl({ unit: 'nautical' }),
            'bottom-left',
          );

          const markersLayer = new AirportMarkersLayer(async (icao: string) => {
            try {
              const ds = getAeroDataSource();
              const full = await ds.findAirportByIcao(icao);
              if (full) selectedStoreRef.current.setAirport(full);
            } catch {
              /* ignore */
            }
          });
          markersLayerRef.current = markersLayer;

          map.on('load', () => {
            if (cancelled || !map) return;
            // Draw order: runways (bottom) -> airport markers -> route line on top.
            runwayLayerRef.current.render(map);
            markersLayer.render(map);
            routeLayerRef.current.setPlan(plan);
            routeLayerRef.current.render(map);
          });
          map.on('moveend', () => {
            if (!map) return;
            const c = map.getCenter();
            void saveMapViewport({
              center: [c.lng, c.lat],
              zoom: map.getZoom(),
              bearing: map.getBearing(),
              pitch: map.getPitch(),
            });
          });
          map.on('error', (e) => {
            // eslint-disable-next-line no-console
            console.warn('[flight-planner] MapLibre error:', e);
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

    // Swap the basemap style when the effective theme changes — either
    // because the OS color scheme flipped (matchMedia) or because Knosys
    // changed its own theme class on <html> (MutationObserver). Saved
    // viewport persists; custom layers re-attach on styledata.
    useEffect(() => {
      let lastTheme = currentMapTheme();
      const media =
        typeof window !== 'undefined' && window.matchMedia
          ? window.matchMedia('(prefers-color-scheme: dark)')
          : null;

      const apply = async () => {
        const next = currentMapTheme();
        if (next === lastTheme) return;
        lastTheme = next;
        const map = mapRef.current;
        if (!map) return;
        try {
          const planetUrl = await resolvePlanetUrl();
          const style = buildPlanetStyle(planetUrl, next);
          map.setStyle(style as any, { diff: false });
          map.once('styledata', () => {
            runwayLayerRef.current.render(map);
            markersLayerRef.current?.render(map);
            routeLayerRef.current.render(map);
          });
        } catch {
          /* keep current style on failure */
        }
      };

      const mo = new MutationObserver(() => void apply());
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-theme'],
      });
      media?.addEventListener('change', apply);

      return () => {
        mo.disconnect();
        media?.removeEventListener('change', apply);
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

    // Reflect selected airport on the runway overlay layer.
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      const airport =
        selectedAirport.selected?.kind === 'airport'
          ? selectedAirport.selected.airport
          : null;
      runwayLayerRef.current.setAirport(airport);
      const apply = () => runwayLayerRef.current.update(map);
      if (map.isStyleLoaded()) apply();
      else map.once('load', apply);
    }, [selectedAirport.selected]);

    // Fly-to requests from the detail sheet etc.
    useEffect(() => {
      const map = mapRef.current;
      const req = selectedAirport.flyToRequest;
      if (!map || !req) return;
      map.flyTo({
        center: [req.lng, req.lat],
        zoom: req.zoom ?? Math.max(map.getZoom(), 9),
        duration: 700,
      });
    }, [selectedAirport.flyToRequest]);

    if (error) {
      return (
        <div
          className="h-full w-full flex items-center justify-center text-sm p-4"
          style={{ backgroundColor: 'hsl(var(--destructive) / 0.1)' }}
        >
          <div>
            <div className="font-medium mb-1">Map failed to load</div>
            <div className="text-muted-foreground">{error}</div>
            <div className="text-xs text-muted-foreground mt-2">
              The flight planner needs network access to the Protomaps CDN on first
              launch (and then for any tiles not yet cached). Offline region downloads
              are configured in Settings → Flight Planner.
            </div>
          </div>
        </div>
      );
    }

    return <div ref={containerRef} className="h-full w-full" style={{ minHeight: 400 }} />;
  };

  return MapViewer;
}
