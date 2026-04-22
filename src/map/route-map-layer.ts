import type { Map as MaplibreMap, GeoJSONSource } from 'maplibre-gl';
import type { Plan } from '../types';
import type { MapLayer } from './map-layer';

const SOURCE_ID = 'route-line-source';
const GLOW_LAYER = 'route-line-glow';
const LINE_LAYER = 'route-line';
const POINT_HALO_LAYER = 'route-points-halo';
const POINT_LAYER = 'route-points';
const LABEL_LAYER = 'route-labels';

/** SF system blue in sRGB — works over both light + dark basemaps. */
const ROUTE_COLOR = '#0A84FF';

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

    // Glow (wider + blurred) underneath, drawn first.
    if (!map.getLayer(GLOW_LAYER)) {
      map.addLayer({
        id: GLOW_LAYER,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': ROUTE_COLOR,
          'line-width': 10,
          'line-opacity': 0.25,
          'line-blur': 6,
        },
      });
    }
    if (!map.getLayer(LINE_LAYER)) {
      map.addLayer({
        id: LINE_LAYER,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': ROUTE_COLOR,
          'line-width': 3,
          'line-opacity': 0.95,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      });
    }
    // Waypoint markers — outer translucent halo + inner solid dot.
    if (!map.getLayer(POINT_HALO_LAYER)) {
      map.addLayer({
        id: POINT_HALO_LAYER,
        type: 'circle',
        source: `${SOURCE_ID}-pts`,
        paint: {
          'circle-radius': 11,
          'circle-color': ROUTE_COLOR,
          'circle-opacity': 0.22,
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
          'circle-color': ROUTE_COLOR,
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
          'text-offset': [0, -1.3],
          'text-anchor': 'bottom',
          'text-font': ['Noto Sans Medium'],
        },
        paint: {
          'text-color': '#111318',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 2,
          'text-halo-blur': 0.5,
        },
      });
    }
  }

  update(map: MaplibreMap): void {
    this.render(map);
  }

  remove(map: MaplibreMap): void {
    for (const id of [LABEL_LAYER, POINT_LAYER, POINT_HALO_LAYER, LINE_LAYER, GLOW_LAYER]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.getSource(`${SOURCE_ID}-pts`)) map.removeSource(`${SOURCE_ID}-pts`);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  }

  setVisible(map: MaplibreMap, visible: boolean): void {
    for (const id of [GLOW_LAYER, LINE_LAYER, POINT_HALO_LAYER, POINT_LAYER, LABEL_LAYER]) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
      }
    }
  }
}
