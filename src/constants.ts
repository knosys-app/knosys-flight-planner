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
  schemaVersion: 'schema-version',
  firstRunComplete: 'first-run-complete',
} as const;

export const OPFS_ROOT_DIR = 'flight-planner';
export const OPFS_AIRPORTS_DB = 'airports.sqlite';
export const OPFS_REGIONS_DIR = 'regions';

// v1 uses OpenFreeMap's hosted vector-tile basemap — CORS-enabled, no API
// key, unlimited free use, ODbL license. MapLibre loads the style JSON
// which in turn references their tile endpoints. Attribution is required
// and handled by MapLibre's AttributionControl (see map-viewer.tsx).
//
// EXTENSIBILITY: true offline maps are planned for v1.1 via PMTiles region
// downloads to OPFS. The pmtiles-protocol / pmtiles-storage / region-picker
// modules are scaffolded but not wired into v1.
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Airport database URL. Served from raw.githubusercontent.com because
// github.com/releases/download/* doesn't send CORS headers and Electron's
// renderer (where the plugin runs) enforces CORS. raw.githubusercontent.com
// returns `access-control-allow-origin: *`. The file is ~18 MB and lives
// at data/airports.sqlite on the repo's main branch \u2014 refresh the data by
// rebuilding locally (`npm run build:db`) and committing a new sqlite.
export const AIRPORTS_DB_URL =
  'https://raw.githubusercontent.com/knosys-app/knosys-flight-planner/main/data/airports.sqlite';

export const DEFAULT_SETTINGS = {
  schemaVersion: 1 as const,
  units: 'us' as const,
  defaultReserveMinutes: 45,
  defaultCruiseAltFt: 5500,
  weatherProviderId: 'manual',
};

// Common GA aircraft presets. These seed the aircraft list on first run so
// the user has something usable immediately. All numbers are approximate
// cruise values at typical altitudes \u2014 users can edit or replace.
export const AIRCRAFT_PRESETS: Omit<AircraftProfile, 'id'>[] = [
  {
    schemaVersion: 1,
    name: 'Cessna 172S',
    type: 'C172S',
    tasKt: 120,
    fuelBurnGph: 8.5,
    fuelCapacityGal: 53,
    fuelType: '100LL',
    reserveMinutes: 45,
    climbFpm: 700,
    climbTasKt: 75,
    descentFpm: 500,
    emptyWeightLb: 1680,
    isPreset: true,
  },
  {
    schemaVersion: 1,
    name: 'Cessna 182T',
    type: 'C182T',
    tasKt: 140,
    fuelBurnGph: 13,
    fuelCapacityGal: 87,
    fuelType: '100LL',
    reserveMinutes: 45,
    climbFpm: 900,
    climbTasKt: 80,
    descentFpm: 500,
    emptyWeightLb: 1970,
    isPreset: true,
  },
  {
    schemaVersion: 1,
    name: 'Piper PA-28-181 Archer',
    type: 'PA28-181',
    tasKt: 125,
    fuelBurnGph: 10,
    fuelCapacityGal: 48,
    fuelType: '100LL',
    reserveMinutes: 45,
    climbFpm: 700,
    climbTasKt: 75,
    descentFpm: 500,
    emptyWeightLb: 1650,
    isPreset: true,
  },
  {
    schemaVersion: 1,
    name: 'Cirrus SR22',
    type: 'SR22',
    tasKt: 180,
    fuelBurnGph: 16,
    fuelCapacityGal: 92,
    fuelType: '100LL',
    reserveMinutes: 45,
    climbFpm: 1200,
    climbTasKt: 110,
    descentFpm: 500,
    emptyWeightLb: 2250,
    isPreset: true,
  },
  {
    schemaVersion: 1,
    name: 'Beechcraft Bonanza A36',
    type: 'BE36',
    tasKt: 175,
    fuelBurnGph: 15,
    fuelCapacityGal: 74,
    fuelType: '100LL',
    reserveMinutes: 45,
    climbFpm: 1100,
    climbTasKt: 100,
    descentFpm: 500,
    emptyWeightLb: 2250,
    isPreset: true,
  },
  {
    schemaVersion: 1,
    name: 'Diamond DA40',
    type: 'DA40',
    tasKt: 140,
    fuelBurnGph: 8.5,
    fuelCapacityGal: 50,
    fuelType: '100LL',
    reserveMinutes: 45,
    climbFpm: 1000,
    climbTasKt: 80,
    descentFpm: 500,
    emptyWeightLb: 1750,
    isPreset: true,
  },
  {
    schemaVersion: 1,
    name: 'Van\u2019s RV-7',
    type: 'RV-7',
    tasKt: 170,
    fuelBurnGph: 8,
    fuelCapacityGal: 42,
    fuelType: '100LL',
    reserveMinutes: 45,
    climbFpm: 1500,
    climbTasKt: 90,
    descentFpm: 500,
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
