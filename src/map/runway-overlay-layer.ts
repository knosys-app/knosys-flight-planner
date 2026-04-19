import type { GeoJSONSource, Map as MaplibreMap } from 'maplibre-gl';
import type { Airport } from '../types';
import type { MapLayer } from './map-layer';
import { runwayPolygon } from './runway-geometry';

const SOURCE_ID = 'runway-overlay-source';
const FILL_LAYER = 'runway-overlay-fill';
const OUTLINE_LAYER = 'runway-overlay-outline';

export class RunwayOverlayLayer implements MapLayer {
  readonly id = 'runway-overlay';
  private airport: Airport | null = null;

  setAirport(airport: Airport | null): void {
    this.airport = airport;
  }

  private featureCollection(): GeoJSON.FeatureCollection {
    if (!this.airport) {
      return { type: 'FeatureCollection', features: [] };
    }
    const features: GeoJSON.Feature[] = [];
    for (const rwy of this.airport.runways) {
      const poly = runwayPolygon(this.airport, rwy);
      if (!poly) continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [poly] },
        properties: {
          id: rwy.id,
          leIdent: rwy.leIdent ?? '',
          heIdent: rwy.heIdent ?? '',
        },
      });
    }
    return { type: 'FeatureCollection', features };
  }

  render(map: MaplibreMap): void {
    const data = this.featureCollection();
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: 'geojson', data });
    } else {
      (map.getSource(SOURCE_ID) as GeoJSONSource).setData(data);
    }
    if (!map.getLayer(FILL_LAYER)) {
      map.addLayer({
        id: FILL_LAYER,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': '#f8fafc',
          'fill-opacity': 0.85,
        },
      });
    }
    if (!map.getLayer(OUTLINE_LAYER)) {
      map.addLayer({
        id: OUTLINE_LAYER,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': '#475569',
          'line-width': 1,
        },
      });
    }
  }

  update(map: MaplibreMap): void {
    const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (src) src.setData(this.featureCollection());
  }

  remove(map: MaplibreMap): void {
    if (map.getLayer(OUTLINE_LAYER)) map.removeLayer(OUTLINE_LAYER);
    if (map.getLayer(FILL_LAYER)) map.removeLayer(FILL_LAYER);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  }

  setVisible(map: MaplibreMap, visible: boolean): void {
    const vis = visible ? 'visible' : 'none';
    if (map.getLayer(FILL_LAYER)) map.setLayoutProperty(FILL_LAYER, 'visibility', vis);
    if (map.getLayer(OUTLINE_LAYER))
      map.setLayoutProperty(OUTLINE_LAYER, 'visibility', vis);
  }
}
