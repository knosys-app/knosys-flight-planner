import type { GeoJSONSource, Map as MaplibreMap, MapMouseEvent } from 'maplibre-gl';
import type { Airport, AirportType } from '../types';
import type { MapLayer } from './map-layer';
import { getAeroDataSource } from '../hooks/use-aero-data';
import type { AirportQueryOptions } from '../data/aero-data-source';

const SOURCE_ID = 'airport-markers-source';
const CIRCLE_LAYER = 'airport-markers-circles';
const LABEL_LAYER = 'airport-markers-labels';

const DEBOUNCE_MS = 250;
const MAX_RESULTS = 400;

function typesForZoom(z: number): AirportType[] {
  if (z >= 10) return ['large_airport', 'medium_airport', 'small_airport', 'seaplane_base'];
  if (z >= 7) return ['large_airport', 'medium_airport'];
  return ['large_airport'];
}

function airportsToGeoJson(airports: Airport[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: airports.map((a) => ({
      type: 'Feature',
      id: a.icao,
      geometry: { type: 'Point', coordinates: [a.lon, a.lat] },
      properties: {
        icao: a.icao,
        name: a.name,
        type: a.type,
      },
    })),
  };
}

export class AirportMarkersLayer implements MapLayer {
  readonly id = 'airport-markers';
  private boundOnMoveEnd: (() => void) | null = null;
  private boundOnClick: ((e: MapMouseEvent) => void) | null = null;
  private debounceHandle: ReturnType<typeof setTimeout> | null = null;
  private queryToken = 0;
  private lastZoomBucket: string | null = null;

  constructor(
    private readonly onSelectIcao: (icao: string) => void,
  ) {}

  render(map: MaplibreMap): void {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    if (!map.getLayer(CIRCLE_LAYER)) {
      map.addLayer({
        id: CIRCLE_LAYER,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': [
            'match',
            ['get', 'type'],
            'large_airport', 7,
            'medium_airport', 5,
            'small_airport', 3,
            'seaplane_base', 3,
            /* default */ 3,
          ],
          'circle-color': [
            'match',
            ['get', 'type'],
            'large_airport', '#1e40af',
            'medium_airport', '#2563eb',
            'small_airport', '#64748b',
            'seaplane_base', '#0d9488',
            /* default */ '#64748b',
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.2,
          'circle-opacity': 0.9,
        },
      });
    }

    if (!map.getLayer(LABEL_LAYER)) {
      map.addLayer({
        id: LABEL_LAYER,
        type: 'symbol',
        source: SOURCE_ID,
        minzoom: 9,
        layout: {
          'text-field': ['get', 'icao'],
          'text-size': 11,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#1e3a8a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.2,
        },
      });
    }

    this.boundOnMoveEnd = () => this.scheduleRefresh(map);
    this.boundOnClick = (e: MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, { layers: [CIRCLE_LAYER] });
      if (feats.length === 0) return;
      const icao = feats[0].properties?.icao as string | undefined;
      if (icao) this.onSelectIcao(icao);
    };
    map.on('moveend', this.boundOnMoveEnd);
    map.on('click', CIRCLE_LAYER, this.boundOnClick);
    map.on('mouseenter', CIRCLE_LAYER, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', CIRCLE_LAYER, () => {
      map.getCanvas().style.cursor = '';
    });

    // Initial query
    this.scheduleRefresh(map);
  }

  update(map: MaplibreMap): void {
    this.scheduleRefresh(map);
  }

  private scheduleRefresh(map: MaplibreMap): void {
    if (this.debounceHandle) clearTimeout(this.debounceHandle);
    this.debounceHandle = setTimeout(() => void this.doRefresh(map), DEBOUNCE_MS);
  }

  private async doRefresh(map: MaplibreMap): Promise<void> {
    const token = ++this.queryToken;
    const zoom = map.getZoom();
    const types = typesForZoom(zoom);
    const zoomBucket = types.join(',');
    this.lastZoomBucket = zoomBucket;

    const bounds = map.getBounds();
    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ];

    const opts: AirportQueryOptions = { types, limit: MAX_RESULTS };
    try {
      const ds = getAeroDataSource();
      const airports = await ds.airportsInBboxLite(bbox, opts);
      if (token !== this.queryToken) return; // superseded by a newer request
      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (src) src.setData(airportsToGeoJson(airports));
    } catch {
      // Likely the aero DB isn't ready yet; ignore, the next moveend will retry.
    }
  }

  remove(map: MaplibreMap): void {
    if (this.debounceHandle) clearTimeout(this.debounceHandle);
    if (this.boundOnMoveEnd) map.off('moveend', this.boundOnMoveEnd);
    if (this.boundOnClick) map.off('click', CIRCLE_LAYER, this.boundOnClick);
    if (map.getLayer(LABEL_LAYER)) map.removeLayer(LABEL_LAYER);
    if (map.getLayer(CIRCLE_LAYER)) map.removeLayer(CIRCLE_LAYER);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    this.boundOnMoveEnd = null;
    this.boundOnClick = null;
  }

  setVisible(map: MaplibreMap, visible: boolean): void {
    const vis = visible ? 'visible' : 'none';
    if (map.getLayer(CIRCLE_LAYER)) map.setLayoutProperty(CIRCLE_LAYER, 'visibility', vis);
    if (map.getLayer(LABEL_LAYER)) map.setLayoutProperty(LABEL_LAYER, 'visibility', vis);
  }
}
