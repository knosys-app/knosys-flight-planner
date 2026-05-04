import type { ComponentType } from 'react';

// ============================================================
// Plugin System Types (mirrors Knosys plugin API)
// ============================================================

export interface PluginStorageAPI {
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T) => Promise<void>;
  delete: (key: string) => Promise<void>;
  clear: () => Promise<void>;
  keys: () => Promise<string[]>;
}

export interface PluginCoreAPI {
  getLocations: () => Promise<any[]>;
  getVaultPath: () => Promise<string>;
  getApiKey: (keyId: string) => Promise<string | null>;
}

export interface PluginUIAPI {
  registerRoute: (route: { path: string; component: ComponentType<any>; children?: any[] }) => void;
  registerSidebarItem: (item: { id: string; title: string; icon: string; route: string; order: number }) => void;
  registerWidget: (widget: { id: string; title: string; component: ComponentType<any>; defaultSize: 'small' | 'medium' | 'large' }) => void;
  registerSettingsPanel: (panel: { id: string; component: ComponentType<any>; order?: number }) => void;
  /**
   * Plugin-internal flat shape — every component in this plugin still
   * calls `api.ui.showToast(msg, type)`. The adapter in `index.tsx`
   * shims this onto the v2 host's `api.ui.toast({...})` so we don't
   * have to rewrite call sites.
   */
  showToast: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

/**
 * Knosys API v2 host shape (mirrors `apps/desktop/src/types/plugins.ts`).
 * The plugin runtime hands us this; `adaptApi()` in `index.tsx` flattens
 * it into the v1-style `PluginAPI` shape that the rest of this plugin
 * consumes. Only the `activate()` boundary changes.
 */
export interface HostPluginToast {
  message: string;
  type?: 'info' | 'success' | 'error' | 'warning';
  duration?: number;
  action?: { label: string; onClick: () => void };
  icon?: string;
}

export interface HostPluginUIAPI {
  registerRoute: (route: { path: string; component: ComponentType<any>; children?: any[] }) => void;
  registerSidebarItem: (item: { id: string; title: string; icon: string; route: string; order: number }) => void;
  registerWidget: (widget: { id: string; title: string; component: ComponentType<any>; defaultSize: 'small' | 'medium' | 'large' }) => void;
  registerSettingsPanel: (panel: { id: string; component: ComponentType<any>; order?: number }) => void;
  toast: (toast: HostPluginToast) => void;
}

export interface HostPluginAPI {
  pluginId: string;
  pluginVersion: string;
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  storage: PluginStorageAPI;
  core: PluginCoreAPI;
  ui: HostPluginUIAPI;
  network: PluginNetworkAPI;
  theme: {
    readonly mode: 'light' | 'dark';
    readonly accent: string;
    subscribe(listener: (state: { mode: 'light' | 'dark'; accent: string }) => void): () => void;
  };
  log: {
    debug(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
  };
  on: (event: string, listener: () => void) => () => void;
}

export interface PluginNetworkFetchInit {
  method?: 'GET' | 'POST' | 'HEAD';
  headers?: Record<string, string>;
  body?: ArrayBuffer | string;
  timeoutMs?: number;
}

export interface PluginNetworkFetchResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: ArrayBuffer;
}

export interface PluginNetworkAPI {
  fetch: (url: string, init?: PluginNetworkFetchInit) => Promise<PluginNetworkFetchResponse>;
}

export interface PluginAPI {
  pluginId: string;
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  storage: PluginStorageAPI;
  core: PluginCoreAPI;
  ui: PluginUIAPI;
  network: PluginNetworkAPI;
}

export interface SharedDependencies {
  React: typeof import('react');
  Badge: ComponentType<any>;
  Button: ComponentType<any>;
  Calendar: ComponentType<any>;
  Card: ComponentType<any>;
  CardContent: ComponentType<any>;
  CardDescription: ComponentType<any>;
  CardFooter: ComponentType<any>;
  CardHeader: ComponentType<any>;
  CardTitle: ComponentType<any>;
  Checkbox: ComponentType<any>;
  Dialog: ComponentType<any>;
  DialogContent: ComponentType<any>;
  DialogDescription: ComponentType<any>;
  DialogFooter: ComponentType<any>;
  DialogHeader: ComponentType<any>;
  DialogTitle: ComponentType<any>;
  DialogTrigger: ComponentType<any>;
  DropdownMenu: ComponentType<any>;
  DropdownMenuContent: ComponentType<any>;
  DropdownMenuItem: ComponentType<any>;
  DropdownMenuLabel: ComponentType<any>;
  DropdownMenuSeparator: ComponentType<any>;
  DropdownMenuTrigger: ComponentType<any>;
  Input: ComponentType<any>;
  Label: ComponentType<any>;
  Popover: ComponentType<any>;
  PopoverContent: ComponentType<any>;
  PopoverTrigger: ComponentType<any>;
  Progress: ComponentType<any>;
  ScrollArea: ComponentType<any>;
  ScrollBar: ComponentType<any>;
  Select: ComponentType<any>;
  SelectContent: ComponentType<any>;
  SelectItem: ComponentType<any>;
  SelectTrigger: ComponentType<any>;
  SelectValue: ComponentType<any>;
  Separator: ComponentType<any>;
  Sheet: ComponentType<any>;
  SheetContent: ComponentType<any>;
  SheetDescription: ComponentType<any>;
  SheetFooter: ComponentType<any>;
  SheetHeader: ComponentType<any>;
  SheetTitle: ComponentType<any>;
  SheetTrigger: ComponentType<any>;
  Skeleton: ComponentType<any>;
  Slider: ComponentType<any>;
  Switch: ComponentType<any>;
  Tabs: ComponentType<any>;
  TabsContent: ComponentType<any>;
  TabsList: ComponentType<any>;
  TabsTrigger: ComponentType<any>;
  Textarea: ComponentType<any>;
  Tooltip: ComponentType<any>;
  TooltipContent: ComponentType<any>;
  TooltipProvider: ComponentType<any>;
  TooltipTrigger: ComponentType<any>;
  dateFns: {
    format: (...args: any[]) => string;
    addDays: (date: Date, amount: number) => Date;
    subDays: (date: Date, amount: number) => Date;
    startOfWeek: (date: Date) => Date;
    endOfWeek: (date: Date) => Date;
    startOfMonth: (date: Date) => Date;
    endOfMonth: (date: Date) => Date;
    isToday: (date: Date) => boolean;
    isSameDay: (a: Date, b: Date) => boolean;
    differenceInDays: (a: Date, b: Date) => number;
    parseISO: (str: string) => Date;
  };
  recharts: any;
  ChartContainer: ComponentType<any>;
  ChartTooltip: ComponentType<any>;
  ChartTooltipContent: ComponentType<any>;
  ChartLegend: ComponentType<any>;
  ChartLegendContent: ComponentType<any>;
  useAppData: () => any;
  useNavigate: () => any;
  useState: typeof import('react').useState;
  useEffect: typeof import('react').useEffect;
  useCallback: typeof import('react').useCallback;
  useMemo: typeof import('react').useMemo;
  useRef: typeof import('react').useRef;
  cn: (...args: any[]) => string;
  lucideIcons: Record<string, ComponentType<any>>;
}

/**
 * Knosys API v2 host shared shape. Primitives are namespaced under
 * `kdl` and `shadcn`; the rest is the same as v1. `flatten()` in
 * `index.tsx` collapses this into the flat `SharedDependencies` above
 * so plugin internals can keep doing `const { Button } = Shared`.
 */
export interface HostSharedDependencies {
  React: typeof import('react');
  useNavigate: () => any;
  hooks: { useAppData: () => any };
  kdl: Record<string, ComponentType<any>>;
  shadcn: {
    Badge: ComponentType<any>;
    Button: ComponentType<any>;
    Calendar: ComponentType<any>;
    Card: ComponentType<any>;
    CardContent: ComponentType<any>;
    CardDescription: ComponentType<any>;
    CardFooter: ComponentType<any>;
    CardHeader: ComponentType<any>;
    CardTitle: ComponentType<any>;
    Checkbox: ComponentType<any>;
    Dialog: ComponentType<any>;
    DialogContent: ComponentType<any>;
    DialogDescription: ComponentType<any>;
    DialogFooter: ComponentType<any>;
    DialogHeader: ComponentType<any>;
    DialogTitle: ComponentType<any>;
    DialogTrigger: ComponentType<any>;
    DropdownMenu: ComponentType<any>;
    DropdownMenuContent: ComponentType<any>;
    DropdownMenuItem: ComponentType<any>;
    DropdownMenuLabel: ComponentType<any>;
    DropdownMenuSeparator: ComponentType<any>;
    DropdownMenuTrigger: ComponentType<any>;
    Input: ComponentType<any>;
    Label: ComponentType<any>;
    Popover: ComponentType<any>;
    PopoverContent: ComponentType<any>;
    PopoverTrigger: ComponentType<any>;
    Progress: ComponentType<any>;
    ScrollArea: ComponentType<any>;
    ScrollBar: ComponentType<any>;
    Select: ComponentType<any>;
    SelectContent: ComponentType<any>;
    SelectItem: ComponentType<any>;
    SelectTrigger: ComponentType<any>;
    SelectValue: ComponentType<any>;
    Separator: ComponentType<any>;
    Sheet: ComponentType<any>;
    SheetContent: ComponentType<any>;
    SheetDescription: ComponentType<any>;
    SheetFooter: ComponentType<any>;
    SheetHeader: ComponentType<any>;
    SheetTitle: ComponentType<any>;
    SheetTrigger: ComponentType<any>;
    Skeleton: ComponentType<any>;
    Slider: ComponentType<any>;
    Switch: ComponentType<any>;
    Tabs: ComponentType<any>;
    TabsContent: ComponentType<any>;
    TabsList: ComponentType<any>;
    TabsTrigger: ComponentType<any>;
    Textarea: ComponentType<any>;
    Tooltip: ComponentType<any>;
    TooltipContent: ComponentType<any>;
    TooltipProvider: ComponentType<any>;
    TooltipTrigger: ComponentType<any>;
  };
  dateFns: SharedDependencies['dateFns'];
  recharts: any;
  ChartContainer: ComponentType<any>;
  ChartTooltip: ComponentType<any>;
  ChartTooltipContent: ComponentType<any>;
  ChartLegend: ComponentType<any>;
  ChartLegendContent: ComponentType<any>;
  lucideIcons: Record<string, ComponentType<any>>;
  useState: typeof import('react').useState;
  useEffect: typeof import('react').useEffect;
  useCallback: typeof import('react').useCallback;
  useMemo: typeof import('react').useMemo;
  useRef: typeof import('react').useRef;
  cn: (...args: any[]) => string;
}

// ============================================================
// Aviation Domain Types
// ============================================================

export type LatLon = { lat: number; lon: number };

export type AirportType =
  | 'large_airport'
  | 'medium_airport'
  | 'small_airport'
  | 'heliport'
  | 'seaplane_base'
  | 'closed';

export interface Runway {
  id: string;
  lengthFt: number;
  widthFt: number;
  surface: string;
  headingTrue: number;
  leIdent?: string;
  heIdent?: string;
  /**
   * True-position endpoints from OurAirports. Present in airport DB v2+.
   * Absent on legacy DBs — in that case the place-card diagram falls back
   * to a schematic parallel-runway spread.
   */
  leLat?: number;
  leLon?: number;
  heLat?: number;
  heLon?: number;
}

export interface Frequency {
  type: string;
  description: string;
  mhz: number;
}

export interface Airport {
  icao: string;
  iata?: string;
  localCode?: string;
  name: string;
  lat: number;
  lon: number;
  elevationFt: number;
  country: string;
  region?: string;
  municipality?: string;
  type: AirportType;
  runways: Runway[];
  frequencies: Frequency[];
}

export type NavaidType = 'VOR' | 'VOR-DME' | 'NDB' | 'DME' | 'VORTAC' | 'TACAN';

export interface Navaid {
  id: string;
  name: string;
  type: NavaidType;
  lat: number;
  lon: number;
  elevationFt?: number;
  freq?: number;
}

export type WaypointKind = 'airport' | 'navaid' | 'userPoint';

export interface Waypoint {
  id: string;
  kind: WaypointKind;
  ref: string;
  name: string;
  lat: number;
  lon: number;
  altFt?: number;
}

export interface Leg {
  fromId: string;
  toId: string;
  altFt: number;
  tasKt?: number;
  windDir?: number;
  windKt?: number;
  notes?: string;
  /**
   * True when `altFt` was auto-selected by the terrain-aware planner. Manual
   * edits flip this to false so the auto-bump effect respects pilot intent.
   */
  altAutoPicked?: boolean;
}

export type FuelType = '100LL' | 'Jet-A' | 'MoGas';

export interface PerfEntry {
  altFt: number;
  tasKt: number;
  fuelBurnGph: number;
}

/** A single weight-loading station on the aircraft (seat, baggage, etc.). */
export interface WeightStation {
  id: string;
  name: string;
  /** Longitudinal arm from datum, in inches. */
  armIn: number;
  /** Optional max loading for this station, in pounds. */
  maxWeightLb?: number;
  /** Default loading to show in the editor, in pounds. */
  defaultWeightLb?: number;
}

/** A fuel tank location. */
export interface FuelStation {
  id: string;
  name: string;
  armIn: number;
  capacityGal: number;
}

/** One corner of the CG envelope polygon. Ordered to form a closed shape. */
export interface EnvelopeCorner {
  weightLb: number;
  cgIn: number;
}

export interface AircraftProfile {
  schemaVersion: 1 | 2 | 3;
  id: string;
  name: string;
  type: string;
  tasKt: number;
  fuelBurnGph: number;
  fuelCapacityGal: number;
  fuelType: FuelType;
  reserveMinutes: number;
  climbFpm?: number;
  climbTasKt?: number;
  climbGph?: number;
  descentFpm?: number;
  descentTasKt?: number;
  descentGph?: number;
  taxiMinutes?: number;
  taxiGph?: number;
  patternMinutes?: number;
  serviceCeilingFt?: number;
  emptyWeightLb?: number;
  /** Empty-aircraft CG arm, in inches. Needed for W&B computation. */
  emptyCgIn?: number;
  /** Max takeoff weight, pounds. Envelope ceiling. */
  maxGrossWeightLb?: number;
  /** Max baggage weight, pounds. Sum of baggage-tagged stations must not exceed. */
  maxBaggageWeightLb?: number;
  weightStations?: WeightStation[];
  fuelStations?: FuelStation[];
  /** Polygon of acceptable CG + weight combinations. */
  envelopeCorners?: EnvelopeCorner[];
  performanceTable?: PerfEntry[];
  isPreset?: boolean;
}

export interface Plan {
  schemaVersion: 1 | 2;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  departureIcao: string;
  destinationIcao: string;
  alternateIcao?: string;
  waypoints: Waypoint[];
  legs: Leg[];
  aircraftProfileId: string;
  departureTimeUtc?: string;
  reserveMinutesOverride?: number;
  notes?: string;
}

export interface WindsEntryRow {
  altFt: number;
  dirTrueDeg: number;
  speedKt: number;
  tempC?: number;
}

export interface NavlogPrimaryFreq {
  type: string;
  mhz: number;
}

export interface PhaseSegment {
  timeMin: number;
  distanceNm: number;
  fuelGal: number;
}

export type NavlogWarningKind =
  | 'terrainPierces'
  | 'obstacleClose'
  | 'serviceCeilingExceeded'
  | 'legTooShortForClimb'
  | 'belowReserve';

export interface NavlogWarning {
  kind: NavlogWarningKind;
  message: string;
}

export interface NavlogRow {
  legIndex: number;
  fromRef: string;
  fromName: string;
  toRef: string;
  toName: string;
  altFt: number;
  altAutoPicked?: boolean;
  distanceNm: number;
  trueCourseDeg: number;
  windCorrectionAngleDeg: number;
  trueHeadingDeg: number;
  magVarDeg: number;
  magneticHeadingDeg: number;
  tasKt: number;
  groundSpeedKt: number;
  eteMinutes: number;
  etaIso?: string;
  fuelBurnedGal: number;
  fuelRemainingGal: number;
  reserveOk: boolean;
  /** Per-leg phase breakdown. Climb/descent null when that phase doesn't apply. */
  phases?: {
    climb: PhaseSegment | null;
    cruise: PhaseSegment;
    descent: PhaseSegment | null;
  };
  warnings?: NavlogWarning[];
  /** Populated asynchronously after computeNavlog by hydrateNavlogFrequencies. */
  primaryFreq?: NavlogPrimaryFreq;
}

export interface BlockTotals {
  taxiMin: number;
  climbMin: number;
  cruiseMin: number;
  descentMin: number;
  patternMin: number;
  blockMin: number;
  taxiFuelGal: number;
  climbFuelGal: number;
  cruiseFuelGal: number;
  descentFuelGal: number;
  patternFuelGal: number;
  blockFuelGal: number;
  blockDistanceNm: number;
}

export interface ProfileSample {
  alongTrackNm: number;
  lat: number;
  lon: number;
  terrainElevFt: number;
}

export type ObstacleType =
  | 'tower'
  | 'antenna'
  | 'building'
  | 'stack'
  | 'crane'
  | 'pole'
  | 'tree'
  | 'other';

export interface Obstacle {
  id: string;
  lat: number;
  lon: number;
  heightAgl: number;
  heightMsl: number;
  type: ObstacleType;
  lighted?: boolean;
  marked?: boolean;
  name?: string;
}

export interface RouteProfile {
  /** Samples spanning the full route, one continuous along-track axis. */
  samples: ProfileSample[];
  /** Obstacles within the route corridor, with alongTrack nm resolved. */
  obstacles: Array<Obstacle & { alongTrackNm: number }>;
  /** Per-leg auto-picked altitude suggestion (undefined when provider failed). */
  perLegAltitudes: Array<number | undefined>;
  /** Per-leg warnings generated during altitude selection. */
  perLegWarnings: NavlogWarning[][];
}

/** Per-layer visibility on the map. Undefined keys fall back to defaults. */
export interface LayerVisibility {
  airports?: boolean;
  navaids?: boolean;
  airspace?: boolean;
}

export interface PluginSettings {
  schemaVersion: 1;
  units: 'us' | 'metric';
  defaultAircraftProfileId?: string;
  defaultReserveMinutes: number;
  defaultCruiseAltFt: number;
  airportsDbVersion?: string;
  airportsDbInstalledAt?: string;
  weatherProviderId: string;
  /** When true, the terrain-aware altitude selector also considers obstacles. */
  obstaclesEnabled?: boolean;
  /** When set, plugin has downloaded the FAA DOF-derived obstacles.sqlite. */
  obstaclesDbVersion?: string;
  obstaclesDbInstalledAt?: string;
  /** Per-layer visibility toggles (map layers menu). */
  layers?: LayerVisibility;
}

export interface InstalledMapRegion {
  id: string;
  name: string;
  url: string;
  sizeBytes: number;
  installedAt: string;
}
