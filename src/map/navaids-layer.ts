import type { GeoJSONSource, Map as MaplibreMap, MapMouseEvent } from 'maplibre-gl';
import type { Navaid } from '../types';
import type { MapLayer } from './map-layer';
import { getAeroDataSource } from '../hooks/use-aero-data';

const SOURCE_ID = 'navaids-source';
const HALO_LAYER = 'navaids-halo';
const MARK_LAYER = 'navaids-mark';
const LABEL_LAYER = 'navaids-label';

const DEBOUNCE_MS = 250;
const MAX_RESULTS = 200;

function typesForZoom(z: number): 'vor-only' | 'all' | 'none' {
  if (z >= 9) return 'all';
  if (z >= 7) return 'vor-only';
  return 'none';
}

function navaidsToGeoJson(navaids: Navaid[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: navaids.map((n) => ({
      type: 'Feature',
      id: n.id,
      geometry: { type: 'Point', coordinates: [n.lon, n.lat] },
      properties: {
        id: n.id,
        name: n.name,
        type: n.type,
        freq: n.freq ?? null,
      },
    })),
  };
}

/**
 * Apple-Maps-style navaid glyphs on top of the basemap. VORTACs and VORs
 * are the eye-catching ones (hex vs. circle); NDBs get a faint dotted
 * presence. Labels appear at higher zoom to avoid clutter.
 */
export class NavaidsLayer implements MapLayer {
  readonly id = 'navaids';
  private boundOnMoveEnd: (() => void) | null = null;
  private boundOnClick: ((e: MapMouseEvent) => void) | null = null;
  private debounceHandle: ReturnType<typeof setTimeout> | null = null;
  private queryToken = 0;
  private visible = true;

  constructor(private readonly onSelect: (id: string) => void) {}

  render(map: MaplibreMap): void {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    // Soft halo — signals it's interactive.
    if (!map.getLayer(HALO_LAYER)) {
      map.addLayer({
        id: HALO_LAYER,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 8,
          'circle-color': '#A855F7',
          'circle-opacity': 0.16,
        },
      });
    }

    // Main glyph — circle for all types. Color varies by type so a pilot
    // can distinguish VORs vs NDBs at a glance.
    if (!map.getLayer(MARK_LAYER)) {
      map.addLayer({
        id: MARK_LAYER,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': [
            'match',
            ['get', 'type'],
            'VORTAC', 5.5,
            'VOR-DME', 5,
            'VOR', 5,
            'NDB', 3,
            'DME', 4,
            'TACAN', 5,
            /* default */ 4,
          ],
          'circle-color': [
            'match',
            ['get', 'type'],
            'VORTAC', '#A855F7',
            'VOR-DME', '#A855F7',
            'VOR', '#A855F7',
            'NDB', '#8E8E93',
            /* default */ '#A855F7',
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.4,
          'circle-opacity': 0.96,
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
          'text-field': ['get', 'id'],
          'text-size': 10,
          'text-offset': [0.9, 0],
          'text-anchor': 'left',
          'text-font': ['Noto Sans Medium'],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#5b21b6',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.6,
          'text-halo-blur': 0.5,
        },
      });
    }

    this.boundOnMoveEnd = () => this.scheduleRefresh(map);
    this.boundOnClick = (e: MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, { layers: [MARK_LAYER] });
      if (feats.length === 0) return;
      const id = feats[0].properties?.id as string | undefined;
      if (id) this.onSelect(id);
    };
    map.on('moveend', this.boundOnMoveEnd);
    map.on('click', MARK_LAYER, this.boundOnClick);
    map.on('mouseenter', MARK_LAYER, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', MARK_LAYER, () => {
      map.getCanvas().style.cursor = '';
    });

    this.scheduleRefresh(map);
  }

  update(map: MaplibreMap): void {
    this.scheduleRefresh(map);
  }

  private scheduleRefresh(map: MaplibreMap): void {
    if (!this.visible) return;
    if (this.debounceHandle) clearTimeout(this.debounceHandle);
    this.debounceHandle = setTimeout(() => void this.doRefresh(map), DEBOUNCE_MS);
  }

  private async doRefresh(map: MaplibreMap): Promise<void> {
    const token = ++this.queryToken;
    const zoom = map.getZoom();
    const bucket = typesForZoom(zoom);
    if (bucket === 'none') {
      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (src) src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const bounds = map.getBounds();
    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ];

    try {
      const ds = getAeroDataSource();
      let navaids = await ds.navaidsInBbox(bbox, MAX_RESULTS);
      if (bucket === 'vor-only') {
        navaids = navaids.filter((n) => n.type !== 'NDB' && n.type !== 'DME');
      }
      if (token !== this.queryToken) return;
      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (src) src.setData(navaidsToGeoJson(navaids));
    } catch {
      /* aero DB not ready */
    }
  }

  remove(map: MaplibreMap): void {
    if (this.debounceHandle) clearTimeout(this.debounceHandle);
    if (this.boundOnMoveEnd) map.off('moveend', this.boundOnMoveEnd);
    if (this.boundOnClick) map.off('click', MARK_LAYER, this.boundOnClick);
    if (map.getLayer(LABEL_LAYER)) map.removeLayer(LABEL_LAYER);
    if (map.getLayer(MARK_LAYER)) map.removeLayer(MARK_LAYER);
    if (map.getLayer(HALO_LAYER)) map.removeLayer(HALO_LAYER);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    this.boundOnMoveEnd = null;
    this.boundOnClick = null;
  }

  setVisible(map: MaplibreMap, visible: boolean): void {
    this.visible = visible;
    const vis = visible ? 'visible' : 'none';
    if (map.getLayer(HALO_LAYER)) map.setLayoutProperty(HALO_LAYER, 'visibility', vis);
    if (map.getLayer(MARK_LAYER)) map.setLayoutProperty(MARK_LAYER, 'visibility', vis);
    if (map.getLayer(LABEL_LAYER)) map.setLayoutProperty(LABEL_LAYER, 'visibility', vis);
    if (visible) this.scheduleRefresh(map);
  }
}
