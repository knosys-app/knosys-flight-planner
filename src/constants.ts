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

// Default PMTiles region manifest. URLs point at Protomaps' daily-updated
// regional extracts (ODbL). Sizes are approximate.
export const PMTILES_REGIONS = [
  {
    id: 'na',
    name: 'North America',
    url: 'https://build.protomaps.com/20240101.pmtiles',
    sizeMb: 1400,
    note: 'US + Canada + Mexico vector tiles',
  },
  {
    id: 'eu',
    name: 'Europe',
    url: 'https://build.protomaps.com/eu-20240101.pmtiles',
    sizeMb: 1100,
    note: 'All European countries',
  },
  {
    id: 'sa',
    name: 'South America',
    url: 'https://build.protomaps.com/sa-20240101.pmtiles',
    sizeMb: 700,
    note: 'All South American countries',
  },
  {
    id: 'as',
    name: 'Asia',
    url: 'https://build.protomaps.com/as-20240101.pmtiles',
    sizeMb: 1800,
    note: 'All Asian countries',
  },
  {
    id: 'af',
    name: 'Africa',
    url: 'https://build.protomaps.com/af-20240101.pmtiles',
    sizeMb: 800,
    note: 'All African countries',
  },
  {
    id: 'oc',
    name: 'Oceania',
    url: 'https://build.protomaps.com/oc-20240101.pmtiles',
    sizeMb: 400,
    note: 'Australia, NZ, Pacific islands',
  },
  {
    id: 'world-low',
    name: 'Global (low zoom, ~150 MB)',
    url: 'https://build.protomaps.com/world-low-20240101.pmtiles',
    sizeMb: 150,
    note: 'Global coverage, zoom 0\u20137 only',
  },
] as const;

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
