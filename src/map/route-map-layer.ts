import type { Map as MaplibreMap, GeoJSONSource } from 'maplibre-gl';
import type { Plan, RouteProfile } from '../types';
import type { MapLayer } from './map-layer';

const SOURCE_ID = 'route-line-source';
const GLOW_LAYER = 'route-line-glow';
const LINE_LAYER = 'route-line';
const POINT_HALO_LAYER = 'route-points-halo';
const POINT_LAYER = 'route-points';
const LABEL_LAYER = 'route-labels';

/** SF system blue in sRGB — works over both light + dark basemaps. */
const ROUTE_COLOR = '#0A84FF';

/** Terrain-clearance palette for the route-line gradient. */
const CLEARANCE_COLORS = {
  comfortable: '#30D158', // > 2000 ft AGL (SF green)
  ok: '#0A84FF', // 1000–2000
  thin: '#FFD60A', // 500–1000
  warn: '#FF9F0A', // 200–500
  danger: '#FF453A', // < 200
};

function clearanceColor(clearanceFt: number): string {
  if (clearanceFt < 200) return CLEARANCE_COLORS.danger;
  if (clearanceFt < 500) return CLEARANCE_COLORS.warn;
  if (clearanceFt < 1000) return CLEARANCE_COLORS.thin;
  if (clearanceFt < 2000) return CLEARANCE_COLORS.ok;
  return CLEARANCE_COLORS.comfortable;
}

function planToWaypointGeoJson(plan: Plan): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: plan.waypoints.map((w, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [w.lon, w.lat] },
      properties: { index: i + 1, ref: w.ref, name: w.name },
    })),
  };
}

/**
 * Build the route LineString. When a profile is available, the line is
 * densified from terrain samples so a line-gradient can paint per-sample
 * clearance colors. Otherwise we fall back to the raw waypoint polyline.
 *
 * Also returns gradient stops (progress + color) when profile data is
 * present; empty otherwise.
 */
function buildRouteLine(
  plan: Plan,
  profile: RouteProfile | null,
): {
  feature: GeoJSON.Feature<GeoJSON.LineString>;
  gradientStops: Array<{ progress: number; color: string }>;
} {
  const samples = profile?.samples ?? [];
  if (samples.length < 2 || plan.waypoints.length < 2) {
    const coords = plan.waypoints.map((w) => [w.lon, w.lat]);
    return {
      feature: {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: { name: plan.name },
      },
      gradientStops: [],
    };
  }

  const total = samples[samples.length - 1].alongTrackNm;
  if (!(total > 0)) {
    const coords = plan.waypoints.map((w) => [w.lon, w.lat]);
    return {
      feature: {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: { name: plan.name },
      },
      gradientStops: [],
    };
  }

  // Walk legs to get per-sample planned altitude. alongTrackNm is cumulative
  // across the whole route — leg boundaries fall where each leg's length
  // accumulates.
  const coords: number[][] = [];
  const legLengths: number[] = [];
  for (let i = 0; i < plan.waypoints.length - 1; i++) {
    const a = plan.waypoints[i];
    const b = plan.waypoints[i + 1];
    const nm = haversineNm(a.lat, a.lon, b.lat, b.lon);
    legLengths.push(nm);
  }
  const legBounds: number[] = [];
  let acc = 0;
  for (const len of legLengths) {
    acc += len;
    legBounds.push(acc);
  }

  const stops: Array<{ progress: number; color: string }> = [];
  for (const s of samples) {
    coords.push([s.lon, s.lat]);
    // Locate the leg containing this sample by its along-track distance.
    let legIdx = legBounds.findIndex((b) => s.alongTrackNm <= b + 1e-6);
    if (legIdx < 0) legIdx = plan.legs.length - 1;
    const altFt = plan.legs[legIdx]?.altFt ?? 0;
    const clearance = altFt - s.terrainElevFt;
    const progress = Math.max(0, Math.min(1, s.alongTrackNm / total));
    stops.push({ progress, color: clearanceColor(clearance) });
  }

  return {
    feature: {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: { name: plan.name },
    },
    gradientStops: stops,
  };
}

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // nautical miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function gradientExpression(
  stops: Array<{ progress: number; color: string }>,
): any | null {
  if (stops.length < 2) return null;
  // Use `interpolate` (with exponential=1 for constant steps) rather than
  // `step` so there are no hard-edge transitions between clearance bands.
  const expr: any[] = ['interpolate', ['linear'], ['line-progress']];
  // Stops must be in strictly ascending order; dedupe exact ties.
  let last = -1;
  for (const s of stops) {
    let p = s.progress;
    if (p <= last) p = last + 1e-6;
    last = p;
    expr.push(p, s.color);
  }
  return expr;
}

export class RouteMapLayer implements MapLayer {
  readonly id = 'route';
  private currentPlan: Plan | null = null;
  private currentProfile: RouteProfile | null = null;

  setPlan(plan: Plan | null): void {
    this.currentPlan = plan;
  }

  setProfile(profile: RouteProfile | null): void {
    this.currentProfile = profile;
  }

  render(map: MaplibreMap): void {
    const plan = this.currentPlan;
    if (!plan) return;
    const { feature, gradientStops } = buildRouteLine(plan, this.currentProfile);
    const points = planToWaypointGeoJson(plan);

    if (map.getSource(SOURCE_ID)) {
      (map.getSource(SOURCE_ID) as GeoJSONSource).setData(feature);
    } else {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: feature,
        lineMetrics: true,
      });
    }
    if (map.getSource(`${SOURCE_ID}-pts`)) {
      (map.getSource(`${SOURCE_ID}-pts`) as GeoJSONSource).setData(points);
    } else {
      map.addSource(`${SOURCE_ID}-pts`, { type: 'geojson', data: points });
    }

    const gradient = gradientExpression(gradientStops);

    // Glow (wider + blurred) underneath, drawn first. Always route blue so
    // the glow reads as one cohesive halo regardless of clearance banding.
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
    // Paint per-sample clearance color when we have a profile; otherwise
    // reset to a flat route blue.
    if (gradient) {
      map.setPaintProperty(LINE_LAYER, 'line-gradient', gradient);
    } else {
      // `line-gradient` can't be unset once assigned; write a trivial single
      // color so the line reads as blue.
      map.setPaintProperty(LINE_LAYER, 'line-gradient', [
        'interpolate',
        ['linear'],
        ['line-progress'],
        0, ROUTE_COLOR,
        1, ROUTE_COLOR,
      ]);
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
