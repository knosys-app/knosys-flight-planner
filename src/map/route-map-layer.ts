import type { Map as MaplibreMap, GeoJSONSource } from 'maplibre-gl';
import type { Plan } from '../types';
import type { MapLayer } from './map-layer';

const SOURCE_ID = 'route-line-source';
const LINE_LAYER = 'route-line';
const POINT_LAYER = 'route-points';
const LABEL_LAYER = 'route-labels';

function planToGeoJson(plan: Plan): {
  line: GeoJSON.Feature;
  points: GeoJSON.FeatureCollection;
} {
  const coords = plan.waypoints.map((w) => [w.lon, w.lat]);
  return {
    line: {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: { name: plan.name },
    },
    points: {
      type: 'FeatureCollection',
      features: plan.waypoints.map((w, i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [w.lon, w.lat] },
        properties: { index: i + 1, ref: w.ref, name: w.name },
      })),
    },
  };
}

export class RouteMapLayer implements MapLayer {
  readonly id = 'route';
  private currentPlan: Plan | null = null;

  setPlan(plan: Plan | null): void {
    this.currentPlan = plan;
  }

  render(map: MaplibreMap): void {
    const plan = this.currentPlan;
    if (!plan) return;
    const { line, points } = planToGeoJson(plan);
    if (map.getSource(SOURCE_ID)) {
      (map.getSource(SOURCE_ID) as GeoJSONSource).setData(line);
    } else {
      map.addSource(SOURCE_ID, { type: 'geojson', data: line });
    }
    if (map.getSource(`${SOURCE_ID}-pts`)) {
      (map.getSource(`${SOURCE_ID}-pts`) as GeoJSONSource).setData(points);
    } else {
      map.addSource(`${SOURCE_ID}-pts`, { type: 'geojson', data: points });
    }
    if (!map.getLayer(LINE_LAYER)) {
      map.addLayer({
        id: LINE_LAYER,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': '#C2410C',
          'line-width': 3,
          'line-opacity': 0.9,
        },
      });
    }
    if (!map.getLayer(POINT_LAYER)) {
      map.addLayer({
        id: POINT_LAYER,
        type: 'circle',
        source: `${SOURCE_ID}-pts`,
        paint: {
          'circle-radius': 5,
          'circle-color': '#7C2D12',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });
    }
    if (!map.getLayer(LABEL_LAYER)) {
      map.addLayer({
        id: LABEL_LAYER,
        type: 'symbol',
        source: `${SOURCE_ID}-pts`,
        layout: {
          'text-field': ['get', 'ref'],
          'text-size': 12,
          'text-offset': [0, -1.2],
          'text-anchor': 'bottom',
        },
        paint: {
          'text-color': '#1F2937',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 1.5,
        },
      });
    }
  }

  update(map: MaplibreMap): void {
    this.render(map);
  }

  remove(map: MaplibreMap): void {
    for (const id of [LABEL_LAYER, POINT_LAYER, LINE_LAYER]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.getSource(`${SOURCE_ID}-pts`)) map.removeSource(`${SOURCE_ID}-pts`);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  }

  setVisible(map: MaplibreMap, visible: boolean): void {
    for (const id of [LINE_LAYER, POINT_LAYER, LABEL_LAYER]) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
      }
    }
  }
}
