import type {
  PluginAPI,
  SharedDependencies,
  HostPluginAPI,
  HostSharedDependencies,
} from './types';
import { initStore } from './store/storage';
import { seedPresetsIfEmpty } from './store/aircraft-store';
import { createFlightPlannerPage } from './components/flight-planner-page';
import { createSettingsPanel } from './components/settings-panel';
import { createDashboardWidgets } from './components/dashboard-widget';
import { ROUTE_PATH, SIDEBAR_ORDER } from './constants';

/**
 * Knosys API v2 hands us a namespaced Shared object — primitives live
 * under `Shared.shadcn.*`. Plugin internals here still consume a flat
 * Shared (e.g. `const { Button } = Shared`), so we collapse the v2
 * shape back to flat at the activation boundary. No internal code
 * changes; the plugin's distinctive shadcn-based look is preserved
 * exactly because we keep using the same shadcn primitives.
 */
function flattenShared(host: HostSharedDependencies): SharedDependencies {
  return {
    ...host.shadcn,
    React: host.React,
    dateFns: host.dateFns,
    recharts: host.recharts,
    ChartContainer: host.ChartContainer,
    ChartTooltip: host.ChartTooltip,
    ChartTooltipContent: host.ChartTooltipContent,
    ChartLegend: host.ChartLegend,
    ChartLegendContent: host.ChartLegendContent,
    useAppData: host.hooks.useAppData,
    useNavigate: host.useNavigate,
    useState: host.useState,
    useEffect: host.useEffect,
    useCallback: host.useCallback,
    useMemo: host.useMemo,
    useRef: host.useRef,
    cn: host.cn,
    lucideIcons: host.lucideIcons,
  };
}

/**
 * v2 dropped `api.ui.showToast(message, type)` in favor of typed
 * `api.ui.toast({...})`. Wrap the v2 host so internal call sites can
 * keep using the shorter signature.
 */
function adaptApi(host: HostPluginAPI): PluginAPI {
  return {
    pluginId: host.pluginId,
    permissions: host.permissions,
    hasPermission: host.hasPermission,
    storage: host.storage,
    core: host.core,
    network: host.network,
    ui: {
      registerRoute: host.ui.registerRoute,
      registerSidebarItem: host.ui.registerSidebarItem,
      registerWidget: host.ui.registerWidget,
      registerSettingsPanel: host.ui.registerSettingsPanel,
      showToast: (message, type) => host.ui.toast({ message, type }),
    },
  };
}

export function activate(hostApi: HostPluginAPI, hostShared: HostSharedDependencies) {
  const api = adaptApi(hostApi);
  const Shared = flattenShared(hostShared);
  initStore(api);
  void seedPresetsIfEmpty();

  let FlightPlannerPage: ReturnType<typeof createFlightPlannerPage>;
  try {
    FlightPlannerPage = createFlightPlannerPage(Shared);
  } catch (err) {
    console.error('[flight-planner] createFlightPlannerPage THREW:', err);
    // Register a visible error component instead of letting activation fail
    // silently.
    FlightPlannerPage = (() => (
      <div
        style={{
          padding: 24,
          background: '#fff6f5',
          color: '#641e1e',
          border: '2px solid #c33',
          fontFamily: '-apple-system, system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          Flight planner failed to initialize
        </div>
        <pre
          style={{
            fontSize: 12,
            fontFamily: 'ui-monospace, Menlo, monospace',
            marginTop: 8,
            whiteSpace: 'pre-wrap',
          }}
        >
          {err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : String(err)}
        </pre>
      </div>
    )) as ReturnType<typeof createFlightPlannerPage>;
  }
  const SettingsPanel = createSettingsPanel(Shared);
  const { RecentPlansWidget, NextFlightWidget } = createDashboardWidgets(Shared);

  api.ui.registerRoute({
    path: ROUTE_PATH,
    component: FlightPlannerPage,
  });

  api.ui.registerSidebarItem({
    id: 'flight-planner',
    title: 'Flight Planner',
    icon: 'Plane',
    route: ROUTE_PATH,
    order: SIDEBAR_ORDER,
  });

  api.ui.registerSettingsPanel({
    id: 'flight-planner-settings',
    component: SettingsPanel,
    order: SIDEBAR_ORDER,
  });

  api.ui.registerWidget({
    id: 'fp-recent-plans',
    title: 'Recent Flight Plans',
    component: RecentPlansWidget,
    defaultSize: 'small',
  });

  api.ui.registerWidget({
    id: 'fp-next-flight',
    title: 'Next Flight',
    component: NextFlightWidget,
    defaultSize: 'small',
  });
}

export function deactivate(): void {
  // Nothing to clean up. All state is persisted by the host.
}
