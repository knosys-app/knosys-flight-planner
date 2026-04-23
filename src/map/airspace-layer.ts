import type { GeoJSONSource, Map as MaplibreMap } from 'maplibre-gl';
import type { Airport } from '../types';
import type { MapLayer } from './map-layer';
import { getAeroDataSource } from '../hooks/use-aero-data';

/**
 * Derived airspace rings, classified by airport type:
 *   - `large_airport`  → Class B (blue, inner 10 nm + outer 30 nm)
 *   - `medium_airport` → Class C (magenta, inner 5 nm + outer 10 nm)
 *
 * Real Class B/C/D perimeters are irregular; these are visual approximations
 * only. A disclosure in the layers menu makes the distinction explicit. A
 * future update can swap this for bundled FAA airspace GeoJSON.
 *
 * Rendered under airport markers and the route line, above the basemap.
 */

const SOURCE_ID = 'airspace-source';
const FILL_LAYER = 'airspace-fill';
const LINE_LAYER = 'airspace-line';

const DEBOUNCE_MS = 300;

const NM_TO_METERS = 1852;
const CIRCLE_POINTS = 64;

type AirspaceClass = 'B' | 'C';

function circlePolygon(
  center: [number, number],
  radiusNm: number,
  points = CIRCLE_POINTS,
): GeoJSON.Polygon {
  const [lon, lat] = center;
  const radiusM = radiusNm * NM_TO_METERS;
  // Equirectangular approximation — fine for airspace-sized circles at
  // any latitude we care about.
  const latRad = (lat * Math.PI) / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLon = 111320 * Math.cos(latRad);
  const ring: Array<[number, number]> = [];
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * Math.PI * 2;
    const dx = (Math.cos(t) * radiusM) / metersPerDegLon;
    const dy = (Math.sin(t) * radiusM) / metersPerDegLat;
    ring.push([lon + dx, lat + dy]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}

function classFor(airport: Airport): AirspaceClass | null {
  if (airport.type === 'large_airport') return 'B';
  if (airport.type === 'medium_airport') return 'C';
  return null;
}

function ringsFor(airport: Airport): Array<{ radiusNm: number; tier: 'inner' | 'outer' }> {
  if (airport.type === 'large_airport') {
    return [
      { radiusNm: 30, tier: 'outer' },
      { radiusNm: 10, tier: 'inner' },
    ];
  }
  if (airport.type === 'medium_airport') {
    return [
      { radiusNm: 10, tier: 'outer' },
      { radiusNm: 5, tier: 'inner' },
    ];
  }
  return [];
}

function airportsToAirspaceFeatures(airports: Airport[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const a of airports) {
    const cls = classFor(a);
    if (!cls) continue;
    for (const r of ringsFor(a)) {
      features.push({
        type: 'Feature',
        geometry: circlePolygon([a.lon, a.lat], r.radiusNm),
        properties: {
          icao: a.icao,
          class: cls,
          tier: r.tier,
        },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

export class AirspaceLayer implements MapLayer {
  readonly id = 'airspace';
  private boundOnMoveEnd: (() => void) | null = null;
  private debounceHandle: ReturnType<typeof setTimeout> | null = null;
  private queryToken = 0;
  private visible = true;

  render(map: MaplibreMap): void {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    if (!map.getLayer(FILL_LAYER)) {
      map.addLayer({
        id: FILL_LAYER,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': [
            'match',
            ['get', 'class'],
            'B', '#0A84FF',
            'C', '#FF2D55',
            /* default */ '#8E8E93',
          ],
          // Outer ring a faint wash; inner ring a touch darker.
          'fill-opacity': [
            'match',
            ['get', 'tier'],
            'inner', 0.1,
            'outer', 0.05,
            /* default */ 0.05,
          ],
        },
      });
    }

    if (!map.getLayer(LINE_LAYER)) {
      map.addLayer({
        id: LINE_LAYER,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': [
            'match',
            ['get', 'class'],
            'B', '#0A84FF',
            'C', '#FF2D55',
            /* default */ '#8E8E93',
          ],
          'line-width': [
            'match',
            ['get', 'tier'],
            'inner', 1.4,
            'outer', 1,
            /* default */ 1,
          ],
          'line-opacity': 0.55,
          'line-dasharray': [2, 2],
        },
      });
    }

    this.boundOnMoveEnd = () => this.scheduleRefresh(map);
    map.on('moveend', this.boundOnMoveEnd);
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
    // Airspace is low-context — only show it when the user has zoomed in
    // enough that the rings are meaningful.
    if (zoom < 6) {
      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (src) src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const bounds = map.getBounds();
    // Pad the bbox so airports just off-screen still produce visible rings.
    const padLon = (bounds.getEast() - bounds.getWest()) * 0.5;
    const padLat = (bounds.getNorth() - bounds.getSouth()) * 0.5;
    const bbox: [number, number, number, number] = [
      bounds.getWest() - padLon,
      bounds.getSouth() - padLat,
      bounds.getEast() + padLon,
      bounds.getNorth() + padLat,
    ];

    try {
      const ds = getAeroDataSource();
      const airports = await ds.airportsInBboxLite(bbox, {
        types: ['large_airport', 'medium_airport'],
        limit: 120,
      });
      if (token !== this.queryToken) return;
      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (src) src.setData(airportsToAirspaceFeatures(airports));
    } catch {
      /* aero DB not ready; next moveend will retry */
    }
  }

  remove(map: MaplibreMap): void {
    if (this.debounceHandle) clearTimeout(this.debounceHandle);
    if (this.boundOnMoveEnd) map.off('moveend', this.boundOnMoveEnd);
    if (map.getLayer(LINE_LAYER)) map.removeLayer(LINE_LAYER);
    if (map.getLayer(FILL_LAYER)) map.removeLayer(FILL_LAYER);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    this.boundOnMoveEnd = null;
  }

  setVisible(map: MaplibreMap, visible: boolean): void {
    this.visible = visible;
    const vis = visible ? 'visible' : 'none';
    if (map.getLayer(FILL_LAYER)) map.setLayoutProperty(FILL_LAYER, 'visibility', vis);
    if (map.getLayer(LINE_LAYER)) map.setLayoutProperty(LINE_LAYER, 'visibility', vis);
    if (visible) this.scheduleRefresh(map);
  }
}
