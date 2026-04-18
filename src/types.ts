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
  showToast: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
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
}

export type FuelType = '100LL' | 'Jet-A' | 'MoGas';

export interface PerfEntry {
  altFt: number;
  tasKt: number;
  fuelBurnGph: number;
}

export interface AircraftProfile {
  schemaVersion: 1;
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
  descentFpm?: number;
  emptyWeightLb?: number;
  performanceTable?: PerfEntry[];
  isPreset?: boolean;
}

export interface Plan {
  schemaVersion: 1;
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

export interface NavlogRow {
  legIndex: number;
  fromRef: string;
  fromName: string;
  toRef: string;
  toName: string;
  altFt: number;
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
}

export interface InstalledMapRegion {
  id: string;
  name: string;
  url: string;
  sizeBytes: number;
  installedAt: string;
}
