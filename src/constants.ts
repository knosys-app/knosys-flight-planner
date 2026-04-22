import type { AircraftProfile } from './types';

export const PLUGIN_ID = 'knosys-flight-planner';
export const ROUTE_PATH = '/flight-planner';
export const SIDEBAR_ORDER = 60;

export const STORAGE_KEYS = {
  plansIndex: 'plans-index',
  plan: (id: string) => `plan:${id}`,
  aircraftIndex: 'aircraft-index',
  aircraft: (id: string) => `aircraft:${id}`,
  settings: 'settings',
  mapRegionsInstalled: 'map-regions-installed',
  mapRegionsIndex: 'map-regions-index',
  mapRegion: (id: string) => `map-region:${id}`,
  mapSource: 'map-source',
  mapViewport: 'map-viewport',
  schemaVersion: 'schema-version',
  firstRunComplete: 'first-run-complete',
} as const;

export const DEFAULT_MAP_CENTER: [number, number] = [-98, 39.5];
export const DEFAULT_MAP_ZOOM = 3;

export const OPFS_ROOT_DIR = 'flight-planner';
export const OPFS_AIRPORTS_DB = 'airports.sqlite';
export const OPFS_REGIONS_DIR = 'regions';

// v1.1 maps: range-read Protomaps daily planet PMTile via api.network.fetch
// (bypasses CORS) with OPFS tile cache. Style JSON + sprites + glyphs come
// from protomaps.github.io (CORS-enabled). Only the PMTile URL needs the
// main-process proxy.
export const PROTOMAPS_URL_PATTERN = 'https://build.protomaps.com/{date}.pmtiles';
export const MAP_ATTRIBUTION =
  '<a href="https://protomaps.com">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
export const MAP_CACHE_DIR = 'map-cache';
export const MAP_TILES_SUBDIR = 'tiles';

// Preset bboxes exposed in the region picker. [west, south, east, north]
// in degrees. Values chosen for practical GA planning areas.
export const PRESET_REGIONS: Array<{
  id: string;
  name: string;
  bbox: [number, number, number, number];
}> = [
  { id: 'us', name: 'Continental US', bbox: [-125, 24, -66, 50] },
  { id: 'na', name: 'North America',  bbox: [-170, 14, -50, 72] },
  { id: 'eu', name: 'Europe',         bbox: [-10, 35, 40, 71] },
  { id: 'sa', name: 'South America',  bbox: [-82, -55, -35, 13] },
  { id: 'as', name: 'Asia',           bbox: [60, 5, 150, 55] },
  { id: 'af', name: 'Africa',         bbox: [-18, -35, 52, 38] },
  { id: 'oc', name: 'Oceania',        bbox: [110, -47, 180, 0] },
];

export const ZOOM_PRESETS = {
  low:    { min: 0, max: 8,  label: 'Low — continent + en-route' },
  medium: { min: 0, max: 10, label: 'Medium — adds airport areas' },
  high:   { min: 0, max: 12, label: 'High — adds airport detail' },
} as const;

export type ZoomPresetKey = keyof typeof ZOOM_PRESETS;

// Airport database URL. Served from raw.githubusercontent.com because
// github.com/releases/download/* doesn't send CORS headers and Electron's
// renderer (where the plugin runs) enforces CORS. raw.githubusercontent.com
// returns `access-control-allow-origin: *`. The file is ~18 MB and lives
// at data/airports.sqlite on the repo's main branch \u2014 refresh the data by
// rebuilding locally (`npm run build:db`) and committing a new sqlite.
export const AIRPORTS_DB_URL =
  'https://raw.githubusercontent.com/knosys-app/knosys-flight-planner/main/data/airports.sqlite';

// Obstacle database (FAA DOF-derived SQLite). Committed to the repo so the
// raw.githubusercontent.com CDN can serve it with permissive CORS. Opt-in:
// users must enable "Avoid obstacles" in settings to download this file.
export const OBSTACLES_DB_URL =
  'https://raw.githubusercontent.com/knosys-app/knosys-flight-planner/main/data/obstacles.sqlite';
export const OPFS_OBSTACLES_DB = 'obstacles.sqlite';

// AWS Terrarium elevation tiles. PNG-encoded RGB elevation raster, CC-BY.
// Accessed through pluginFetch (main-process proxy) so CORS is bypassed,
// even though S3 generally does send CORS headers.
export const TERRARIUM_URL_PATTERN =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const TERRAIN_CACHE_DIR = 'terrain-cache';
export const TERRAIN_TILE_ZOOM = 10;
export const TERRAIN_SAMPLE_STEP_NM = 0.5;

// Corridor width (nm) used for obstacle lookups along a leg.
export const OBSTACLE_CORRIDOR_NM = 4;

// Block-time defaults applied via the v1→v2 migration when aircraft lacks
// explicit values.
export const DEFAULT_TAXI_MINUTES = 10;
export const DEFAULT_PATTERN_MINUTES = 5;
export const DEFAULT_SERVICE_CEILING_FT = 14000;

export const DEFAULT_SETTINGS = {
  schemaVersion: 1 as const,
  units: 'us' as const,
  defaultReserveMinutes: 45,
  defaultCruiseAltFt: 5500,
  weatherProviderId: 'manual',
  obstaclesEnabled: false,
};

// Common GA aircraft presets. These seed the aircraft list on first run so
// the user has something usable immediately. All numbers are approximate
// cruise values at typical altitudes \u2014 users can edit or replace.
export const AIRCRAFT_PRESETS: Omit<AircraftProfile, 'id'>[] = [
  {
    schemaVersion: 3,
    name: 'Cessna 172S',
    type: 'C172S',
    tasKt: 120,
    fuelBurnGph: 8.5,
    fuelCapacityGal: 53,
    fuelType: '100LL',
    reserveMinutes: 45,
    climbFpm: 700,
    climbTasKt: 75,
    climbGph: 10,
    descentFpm: 500,
    descentTasKt: 110,
    descentGph: 6,
    taxiMinutes: 10,
    taxiGph: 2.5,
    patternMinutes: 5,
    serviceCeilingFt: 14000,
    emptyWeightLb: 1680,
    emptyCgIn: 39.9,
    maxGrossWeightLb: 2550,
    maxBaggageWeightLb: 120,
    weightStations: [
      { id: 'front', name: 'Front seats', armIn: 37, maxWeightLb: 450, defaultWeightLb: 170 },
      { id: 'rear', name: 'Rear seats', armIn: 73, maxWeightLb: 450 },
      { id: 'bagA', name: 'Baggage A', armIn: 95, maxWeightLb: 120 },
      { id: 'bagB', name: 'Baggage B', armIn: 123, maxWeightLb: 50 },
    ],
    fuelStations: [{ id: 'main', name: 'Main tanks', armIn: 48, capacityGal: 53 }],
    envelopeCorners: [
      { weightLb: 1500, cgIn: 35.0 },
      { weightLb: 1950, cgIn: 35.0 },
      { weightLb: 2550, cgIn: 41.0 },
      { weightLb: 2550, cgIn: 47.3 },
      { weightLb: 1500, cgIn: 47.3 },
    ],
    isPreset: true,
  },
  {
    schemaVersion: 3,
    name: 'Cessna 182T',
    type: 'C182T',
    tasKt: 140,
    fuelBurnGph: 13,
    fuelCapacityGal: 87,
    fuelType: '100LL',
    reserveMinutes: 45,
    climbFpm: 900,
    climbTasKt: 80,
    climbGph: 15,
    descentFpm: 500,
    descentTasKt: 130,
    descentGph: 9,
    taxiMinutes: 10,
    taxiGph: 4,
    patternMinutes: 5,
    serviceCeilingFt: 18100,
    emptyWeightLb: 1970,
    isPreset: true,
  },
  {
    schemaVersion: 3,
    name: 'Piper PA-28-181 Archer',
    type: 'PA28-181',
    tasKt: 125,
    fuelBurnGph: 10,
    fuelCapacityGal: 48,
    fuelType: '100LL',
    reserveMinutes: 45,
    climbFpm: 700,
    climbTasKt: 75,
    climbGph: 12,
    descentFpm: 500,
    descentTasKt: 115,
    descentGph: 7,
    taxiMinutes: 10,
    taxiGph: 3,
    patternMinutes: 5,
    serviceCeilingFt: 14000,
    emptyWeightLb: 1650,
    isPreset: true,
  },
  {
    schemaVersion: 3,
    name: 'Cirrus SR22',
    type: 'SR22',
    tasKt: 180,
    fuelBurnGph: 16,
    fuelCapacityGal: 92,
    fuelType: '100LL',
    reserveMinutes: 45,
    climbFpm: 1200,
    climbTasKt: 110,
    climbGph: 20,
    descentFpm: 500,
    descentTasKt: 170,
    descentGph: 12,
    taxiMinutes: 10,
    taxiGph: 5,
    patternMinutes: 5,
    serviceCeilingFt: 17500,
    emptyWeightLb: 2250,
    isPreset: true,
  },
  {
    schemaVersion: 3,
    name: 'Beechcraft Bonanza A36',
    type: 'BE36',
    tasKt: 175,
    fuelBurnGph: 15,
    fuelCapacityGal: 74,
    fuelType: '100LL',
    reserveMinutes: 45,
    climbFpm: 1100,
    climbTasKt: 100,
    climbGph: 18,
    descentFpm: 500,
    descentTasKt: 165,
    descentGph: 10,
    taxiMinutes: 10,
    taxiGph: 4.5,
    patternMinutes: 5,
    serviceCeilingFt: 18500,
    emptyWeightLb: 2250,
    isPreset: true,
  },
  {
    schemaVersion: 3,
    name: 'Diamond DA40',
    type: 'DA40',
    tasKt: 140,
    fuelBurnGph: 8.5,
    fuelCapacityGal: 50,
    fuelType: '100LL',
    reserveMinutes: 45,
    climbFpm: 1000,
    climbTasKt: 80,
    climbGph: 10,
    descentFpm: 500,
    descentTasKt: 130,
    descentGph: 6,
    taxiMinutes: 10,
    taxiGph: 2.5,
    patternMinutes: 5,
    serviceCeilingFt: 16400,
    emptyWeightLb: 1750,
    isPreset: true,
  },
  {
    schemaVersion: 3,
    name: 'Van\u2019s RV-7',
    type: 'RV-7',
    tasKt: 170,
    fuelBurnGph: 8,
    fuelCapacityGal: 42,
    fuelType: '100LL',
    reserveMinutes: 45,
    climbFpm: 1500,
    climbTasKt: 90,
    climbGph: 10,
    descentFpm: 500,
    descentTasKt: 160,
    descentGph: 5,
    taxiMinutes: 10,
    taxiGph: 2,
    patternMinutes: 5,
    serviceCeilingFt: 18000,
    isPreset: true,
  },
];

export const UNIT_LABELS = {
  us: {
    distance: 'NM',
    speed: 'kt',
    altitude: 'ft',
    fuel: 'gal',
    temperature: '\u00B0F',
    weight: 'lb',
  },
  metric: {
    distance: 'km',
    speed: 'km/h',
    altitude: 'm',
    fuel: 'L',
    temperature: '\u00B0C',
    weight: 'kg',
  },
} as const;
