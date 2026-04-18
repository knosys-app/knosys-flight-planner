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

  const FlightPlannerPage = createFlightPlannerPage(Shared);
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
