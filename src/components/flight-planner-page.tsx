import type { FC } from 'react';
import { v4 as uuid } from 'uuid';
import type {
  AircraftProfile,
  NavlogRow,
  Plan,
  SharedDependencies,
  Waypoint,
} from '../types';
import { createEmptyPlan, deletePlan, duplicatePlan, savePlan } from '../store/plan-store';
import { saveAircraft } from '../store/aircraft-store';
import { computeNavlog, hydrateNavlogFrequencies } from '../hooks/use-navlog';
import {
  createFlightPlannerProvider,
  type FlightPlannerStore,
} from '../hooks/use-flight-planner-store';
import { isAirportsDbInstalled } from '../data/first-run-download';
import { getAeroDataSource } from '../hooks/use-aero-data';
import { createSelectedAirportProvider } from '../hooks/use-selected-airport';

import { createPlanHeader } from './plan-header';
import { createAircraftPicker } from './aircraft-picker';
import { createAircraftEditorDialog } from './aircraft-editor-dialog';
import { createRouteBuilder } from './route-builder';
import { createWindsEntry } from './winds-entry';
import { createNavlog } from './navlog';
import { createExportBar } from './export-bar';
import { createPlansList } from './plans-list';
import { createFirstRunModal } from './first-run-modal';
import { createAirportDetailSheet } from './airport-detail-sheet';
import { createMapViewer } from '../map/map-viewer';

export function createFlightPlannerPage(Shared: SharedDependencies) {
  const { useState, useEffect, useMemo, Separator } = Shared;
  const { Provider, useFlightPlannerStore } = createFlightPlannerProvider(Shared);
  const {
    Provider: SelectedAirportProvider,
    useSelectedAirport,
  } = createSelectedAirportProvider(Shared);

  const PlanHeader = createPlanHeader(Shared);
  const AircraftPicker = createAircraftPicker(Shared);
  const AircraftEditorDialog = createAircraftEditorDialog(Shared);
  const WindsEntry = createWindsEntry(Shared);
  const Navlog = createNavlog(Shared);
  const ExportBar = createExportBar(Shared);
  const PlansList = createPlansList(Shared);
  const FirstRunModal = createFirstRunModal(Shared);
  const AirportDetailSheet = createAirportDetailSheet(Shared);
  const MapViewer = createMapViewer(Shared);

  const Inner: FC = () => {
    const store = useFlightPlannerStore();
    const selectedAirport = useSelectedAirport();
    const {
      plan,
      plans,
      aircraft,
      selectedAircraft,
      winds,
      settings,
      loading,
      setPlan,
      setSelectedAircraft,
      setWinds,
      saveCurrentPlan,
      newPlan,
      openPlan,
      refresh,
    } = store;

    const [editorOpen, setEditorOpen] = useState(false);
    const [editingAircraft, setEditingAircraft] = useState<AircraftProfile | null>(null);
    const [firstRunOpen, setFirstRunOpen] = useState(false);
    const [hydratedRows, setHydratedRows] = useState<NavlogRow[]>([]);

    useEffect(() => {
      (async () => {
        const dbInstalled = await isAirportsDbInstalled();
        if (!dbInstalled) setFirstRunOpen(true);
      })();
    }, []);

    useEffect(() => {
      if (!loading && !plan && selectedAircraft) {
        newPlan();
      }
    }, [loading, plan, selectedAircraft, newPlan]);

    const RouteBuilder = useMemo(
      () =>
        createRouteBuilder(Shared, {
          onWaypointClick: async (wp: Waypoint) => {
            try {
              const ds = getAeroDataSource();
              if (wp.kind === 'airport') {
                const a = await ds.findAirportByIcao(wp.ref);
                if (a) selectedAirport.setAirport(a);
              } else if (wp.kind === 'navaid') {
                const n = await ds.findNavaid(wp.ref);
                if (n) selectedAirport.setNavaid(n);
              }
            } catch {
              /* non-fatal */
            }
          },
        }),
      [selectedAirport],
    );

    const navlog = useMemo(() => {
      if (!plan || !selectedAircraft) {
        return {
          rows: [] as NavlogRow[],
          totals: {
            distanceNm: 0,
            eteMinutes: 0,
            fuelBurnedGal: 0,
            fuelRemainingGal: 0,
            reserveOk: true,
          },
        };
      }
      return computeNavlog({ plan, aircraft: selectedAircraft, winds });
    }, [plan, selectedAircraft, winds]);

    useEffect(() => {
      let cancelled = false;
      if (!plan || navlog.rows.length === 0) {
        setHydratedRows(navlog.rows);
        return;
      }
      (async () => {
        try {
          const ds = getAeroDataSource();
          const hydrated = await hydrateNavlogFrequencies(navlog.rows, plan, ds);
          if (!cancelled) setHydratedRows(hydrated);
        } catch {
          if (!cancelled) setHydratedRows(navlog.rows);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [plan, navlog.rows]);

    if (loading) {
      return <div className="p-8 text-muted-foreground">Loading flight planner…</div>;
    }

    if (!plan || !selectedAircraft) {
      return (
        <div className="p-8 text-muted-foreground">
          No aircraft profile available. Check plugin settings.
        </div>
      );
    }

    const appendWaypoint = (wp: {
      kind: 'airport' | 'navaid';
      ref: string;
      name: string;
      lat: number;
      lon: number;
    }) => {
      const newWp: Waypoint = {
        id: uuid(),
        kind: wp.kind,
        ref: wp.ref,
        name: wp.name,
        lat: wp.lat,
        lon: wp.lon,
        altFt: settings.defaultCruiseAltFt,
      };
      const nextWaypoints = [...plan.waypoints, newWp];
      const nextLegs = [];
      for (let i = 0; i < nextWaypoints.length - 1; i++) {
        nextLegs.push({
          fromId: nextWaypoints[i].id,
          toId: nextWaypoints[i + 1].id,
          altFt: nextWaypoints[i + 1].altFt ?? settings.defaultCruiseAltFt,
        });
      }
      setPlan({
        ...plan,
        waypoints: nextWaypoints,
        legs: nextLegs,
        departureIcao: nextWaypoints[0]?.ref ?? plan.departureIcao,
        destinationIcao:
          nextWaypoints[nextWaypoints.length - 1]?.ref ?? plan.destinationIcao,
      });
    };

    return (
      <div className="flex h-full flex-col">
        <PlanHeader
          store={store}
          onSave={() => void saveCurrentPlan()}
          onNew={newPlan}
          onDuplicate={async () => {
            const copy = await duplicatePlan(plan);
            setPlan(copy);
            await refresh();
          }}
          onDelete={async () => {
            if (!window.confirm(`Delete "${plan.name}"?`)) return;
            await deletePlan(plan.id);
            await refresh();
            newPlan();
          }}
        />

        <div className="flex flex-1 min-h-0">
          <div className="w-[420px] border-r overflow-auto flex flex-col">
            <div className="p-3 space-y-4">
              <AircraftPicker
                aircraft={aircraft}
                selectedId={selectedAircraft.id}
                onSelect={(id: string) => void setSelectedAircraft(id)}
                onEdit={() => {
                  setEditingAircraft(selectedAircraft);
                  setEditorOpen(true);
                }}
              />

              <Separator />

              <RouteBuilder
                plan={plan}
                defaultCruiseAltFt={settings.defaultCruiseAltFt}
                onChange={setPlan}
              />

              <Separator />

              <WindsEntry winds={winds} onChange={setWinds} />

              <Separator />

              <div>
                <div className="font-medium text-sm mb-1">Navlog</div>
                <Navlog rows={hydratedRows.length > 0 ? hydratedRows : navlog.rows} />
                {navlog.rows.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Total: {navlog.totals.distanceNm.toFixed(0)} nm ·{' '}
                    {navlog.totals.eteMinutes.toFixed(0)} min ·{' '}
                    {navlog.totals.fuelBurnedGal.toFixed(1)} gal
                    {!navlog.totals.reserveOk && (
                      <span className="ml-2 text-red-600 font-medium">
                        ⚠ Below reserve fuel
                      </span>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              <ExportBar
                plan={plan}
                aircraft={selectedAircraft}
                navlog={hydratedRows.length > 0 ? hydratedRows : navlog.rows}
              />

              <Separator />

              <div>
                <div className="font-medium text-sm mb-2">Saved plans</div>
                <PlansList plans={plans} currentId={plan.id} onOpen={openPlan} />
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 relative">
            <MapViewer plan={plan} selectedAirport={selectedAirport} />
          </div>
        </div>

        <AircraftEditorDialog
          open={editorOpen}
          aircraft={editingAircraft}
          onClose={() => setEditorOpen(false)}
          onSave={async (a) => {
            const saved = await saveAircraft(a);
            await refresh();
            await setSelectedAircraft(saved.id);
          }}
        />

        <FirstRunModal
          open={firstRunOpen}
          onClose={() => setFirstRunOpen(false)}
        />

        <AirportDetailSheet store={selectedAirport} onAddToRoute={appendWaypoint} />
      </div>
    );
  };

  const FlightPlannerPage: FC = () => (
    <Provider>
      <SelectedAirportProvider>
        <Inner />
      </SelectedAirportProvider>
    </Provider>
  );

  return FlightPlannerPage;
}
