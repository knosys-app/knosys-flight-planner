import type { FC } from 'react';
import maplibregl, { type Map as MaplibreMap } from 'maplibre-gl';
import type { Plan, RouteProfile, SharedDependencies } from '../types';
import { ensureMaplibreWorker } from './maplibre-worker-setup';
import { RouteMapLayer } from './route-map-layer';
import { AirportMarkersLayer } from './airport-markers-layer';
import { AirspaceLayer } from './airspace-layer';
import { NavaidsLayer } from './navaids-layer';
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

export interface LayerVisibilityProp {
  airports: boolean;
  navaids: boolean;
  airspace: boolean;
}

export function createMapViewer(Shared: SharedDependencies) {
  const { useEffect, useRef, useState } = Shared;

  const MapViewer: FC<{
    plan: Plan | null;
    routeProfile?: RouteProfile | null;
    selectedAirport: SelectedAirportStore;
    layerVisibility: LayerVisibilityProp;
    /**
     * Along-track scrub position (nm) shared with timeline + profile. When
     * set, a translucent cursor marker slides along the route. `null`
     * hides the cursor.
     */
    scrubAlongNm?: number | null;
    /**
     * Current detent of the bottom sheet — used to pad fitBounds so the
     * route doesn't tuck behind the sheet when auto-fitting.
     */
    sheetDetent?: 'peek' | 'half' | 'full';
  }> = ({
    plan,
    routeProfile,
    selectedAirport,
    layerVisibility,
    scrubAlongNm,
    sheetDetent,
  }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MaplibreMap | null>(null);
    const routeLayerRef = useRef<RouteMapLayer>(new RouteMapLayer());
    const runwayLayerRef = useRef<RunwayOverlayLayer>(new RunwayOverlayLayer());
    const markersLayerRef = useRef<AirportMarkersLayer | null>(null);
    const airspaceLayerRef = useRef<AirspaceLayer>(new AirspaceLayer());
    const navaidsLayerRef = useRef<NavaidsLayer | null>(null);
    const lastWaypointCountRef = useRef<number>(-1);
    const lastWaypointIdRef = useRef<string | null>(null);
    const pinMarkerRef = useRef<maplibregl.Marker | null>(null);
    const scrubMarkerRef = useRef<maplibregl.Marker | null>(null);
    // Latest visibility — read inside the theme-swap handler so a style
    // swap doesn't need to re-subscribe MutationObserver on every toggle.
    const visibilityRef = useRef(layerVisibility);
    visibilityRef.current = layerVisibility;
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

          const navaidsLayer = new NavaidsLayer(async (id: string) => {
            try {
              const ds = getAeroDataSource();
              const nv = await ds.findNavaid(id);
              if (nv) selectedStoreRef.current.setNavaid(nv);
            } catch {
              /* ignore */
            }
          });
          navaidsLayerRef.current = navaidsLayer;

          map.on('load', () => {
            if (cancelled || !map) return;
            // Draw order: airspace → runways → navaids → airport markers → route line.
            airspaceLayerRef.current.render(map);
            airspaceLayerRef.current.setVisible(map, layerVisibility.airspace);
            runwayLayerRef.current.render(map);
            navaidsLayer.render(map);
            navaidsLayer.setVisible(map, layerVisibility.navaids);
            markersLayer.render(map);
            markersLayer.setVisible(map, layerVisibility.airports);
            routeLayerRef.current.setPlan(plan);
            routeLayerRef.current.setProfile(routeProfile ?? null);
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
        if (pinMarkerRef.current) {
          pinMarkerRef.current.remove();
          pinMarkerRef.current = null;
        }
        if (scrubMarkerRef.current) {
          scrubMarkerRef.current.remove();
          scrubMarkerRef.current = null;
        }
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
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
            const vis = visibilityRef.current;
            airspaceLayerRef.current.render(map);
            airspaceLayerRef.current.setVisible(map, vis.airspace);
            runwayLayerRef.current.render(map);
            navaidsLayerRef.current?.render(map);
            if (navaidsLayerRef.current) {
              navaidsLayerRef.current.setVisible(map, vis.navaids);
            }
            markersLayerRef.current?.render(map);
            if (markersLayerRef.current) {
              markersLayerRef.current.setVisible(map, vis.airports);
            }
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

    // Respond to layer toggles.
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      if (map.getLayer('airspace-fill') || !layerVisibility.airspace) {
        airspaceLayerRef.current.setVisible(map, layerVisibility.airspace);
      }
      if (markersLayerRef.current) {
        markersLayerRef.current.setVisible(map, layerVisibility.airports);
      }
      if (navaidsLayerRef.current) {
        navaidsLayerRef.current.setVisible(map, layerVisibility.navaids);
      }
    }, [layerVisibility.airspace, layerVisibility.airports, layerVisibility.navaids]);

    // Route layer + gradient updates (no auto-fit here — that would re-
    // center the map every time the profile resamples).
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      routeLayerRef.current.setPlan(plan);
      routeLayerRef.current.setProfile(routeProfile ?? null);
      const render = () => routeLayerRef.current.update(map);
      if (map.isStyleLoaded()) render();
      else map.once('load', render);
    }, [plan, routeProfile]);

    // Fit bounds only when the waypoint list itself changes (identity or
    // order). Scrubbing, toggling layers, or profile re-samples must not
    // retrigger this or the map yanks around under the user's cursor.
    const waypointsSig = plan?.waypoints.map((w) => w.id).join(',') ?? '';
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !plan || plan.waypoints.length < 2) return;
      const coords = plan.waypoints.map((w) => [w.lon, w.lat]) as [number, number][];
      const bounds = coords.reduce(
        (b, c) => b.extend(c as any),
        new maplibregl.LngLatBounds(coords[0] as any, coords[0] as any),
      );
      const fit = () => {
        // Rail: 16 px offset + 340 px width + 16 px gap ≈ 372. Round down
        // a touch so the route line isn't jammed against the rail edge.
        const left = 360;
        const right = 80;
        const top = 96;
        // Bottom padding reflects the sheet detent so the route doesn't
        // disappear under the sheet when it's open.
        const vh = window.innerHeight;
        const bottom =
          sheetDetent === 'full'
            ? Math.round(vh * 0.9) + 12
            : sheetDetent === 'half'
              ? Math.round(vh * 0.45) + 12
              : 56; // peek handle only
        map.fitBounds(bounds, {
          padding: { top, right, bottom, left },
          duration: 500,
          maxZoom: 9,
        });
      };
      if (map.isStyleLoaded()) fit();
      else map.once('load', fit);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [waypointsSig, sheetDetent]);

    // Pin-drop animation on waypoint append. Fires only when the plan
    // grew by one waypoint — not on removal, replacement, or first mount.
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !plan || plan.waypoints.length === 0) return;
      const count = plan.waypoints.length;
      const last = plan.waypoints[count - 1];
      const prevCount = lastWaypointCountRef.current;
      const prevId = lastWaypointIdRef.current;
      lastWaypointCountRef.current = count;
      lastWaypointIdRef.current = last.id;

      const isAppend = prevCount >= 0 && count === prevCount + 1 && prevId !== last.id;
      if (!isAppend) return;

      const el = document.createElement('div');
      el.className = 'kfp-pin-drop';
      if (pinMarkerRef.current) pinMarkerRef.current.remove();
      pinMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([last.lon, last.lat])
        .addTo(map);
      const timer = setTimeout(() => {
        if (pinMarkerRef.current) {
          pinMarkerRef.current.remove();
          pinMarkerRef.current = null;
        }
      }, 1200);
      return () => clearTimeout(timer);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plan?.waypoints.length, plan?.waypoints[plan.waypoints.length - 1]?.id]);

    // Scrub cursor — slides a translucent marker along the route as the
    // user scrubs the timeline or hovers the profile ribbon. Position is
    // interpolated from routeProfile samples (lat/lon + alongTrackNm).
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      const samples = routeProfile?.samples ?? [];
      if (scrubAlongNm == null || samples.length < 2) {
        if (scrubMarkerRef.current) {
          scrubMarkerRef.current.remove();
          scrubMarkerRef.current = null;
        }
        return;
      }
      const total = samples[samples.length - 1].alongTrackNm;
      const target = Math.max(0, Math.min(total, scrubAlongNm));
      let lo = 0;
      let hi = samples.length - 1;
      // Linear scan — samples are small enough (< a few hundred).
      for (let i = 0; i < samples.length - 1; i++) {
        if (samples[i].alongTrackNm <= target && samples[i + 1].alongTrackNm >= target) {
          lo = i;
          hi = i + 1;
          break;
        }
      }
      const a = samples[lo];
      const b = samples[hi];
      const span = b.alongTrackNm - a.alongTrackNm;
      const t = span > 0 ? (target - a.alongTrackNm) / span : 0;
      const lat = a.lat + (b.lat - a.lat) * t;
      const lon = a.lon + (b.lon - a.lon) * t;

      if (!scrubMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'kfp-scrub-cursor';
        scrubMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lon, lat])
          .addTo(map);
      } else {
        scrubMarkerRef.current.setLngLat([lon, lat]);
      }
    }, [scrubAlongNm, routeProfile]);

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
