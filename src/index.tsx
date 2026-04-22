import type { PluginAPI, SharedDependencies } from './types';
import { initStore } from './store/storage';
import { seedPresetsIfEmpty } from './store/aircraft-store';
import { createFlightPlannerPage } from './components/flight-planner-page';
import { createSettingsPanel } from './components/settings-panel';
import { createDashboardWidgets } from './components/dashboard-widget';
import { ROUTE_PATH, SIDEBAR_ORDER } from './constants';

export function activate(api: PluginAPI, Shared: SharedDependencies) {
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
