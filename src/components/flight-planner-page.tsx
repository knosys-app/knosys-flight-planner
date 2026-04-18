import type { FC } from 'react';
import { v4 as uuid } from 'uuid';
import type { AircraftProfile, Plan, SharedDependencies } from '../types';
import { createEmptyPlan, deletePlan, duplicatePlan, savePlan } from '../store/plan-store';
import { saveAircraft } from '../store/aircraft-store';
import { computeNavlog } from '../hooks/use-navlog';
import {
  createFlightPlannerProvider,
  type FlightPlannerStore,
} from '../hooks/use-flight-planner-store';
import { isAirportsDbInstalled } from '../data/first-run-download';
import { listInstalledRegions } from '../store/settings-store';

import { createPlanHeader } from './plan-header';
import { createAircraftPicker } from './aircraft-picker';
import { createAircraftEditorDialog } from './aircraft-editor-dialog';
import { createRouteBuilder } from './route-builder';
import { createWindsEntry } from './winds-entry';
import { createNavlog } from './navlog';
import { createExportBar } from './export-bar';
import { createPlansList } from './plans-list';
import { createFirstRunModal } from './first-run-modal';
import { createRegionPicker } from './region-picker';
import { createMapViewer } from '../map/map-viewer';

export function createFlightPlannerPage(Shared: SharedDependencies) {
  const { useState, useEffect, useMemo, Card, CardHeader, CardContent, Separator } = Shared;
  const { Provider, useFlightPlannerStore } = createFlightPlannerProvider(Shared);

  const PlanHeader = createPlanHeader(Shared);
  const AircraftPicker = createAircraftPicker(Shared);
  const AircraftEditorDialog = createAircraftEditorDialog(Shared);
  const RouteBuilder = createRouteBuilder(Shared);
  const WindsEntry = createWindsEntry(Shared);
  const Navlog = createNavlog(Shared);
  const ExportBar = createExportBar(Shared);
  const PlansList = createPlansList(Shared);
  const FirstRunModal = createFirstRunModal(Shared);
  const RegionPicker = createRegionPicker(Shared);
  const MapViewer = createMapViewer(Shared);

  const Inner: FC = () => {
    const store = useFlightPlannerStore();
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
    const [regionPickerOpen, setRegionPickerOpen] = useState(false);

    useEffect(() => {
      (async () => {
        const [dbInstalled, regions] = await Promise.all([
          isAirportsDbInstalled(),
          listInstalledRegions(),
        ]);
        if (!dbInstalled) {
          setFirstRunOpen(true);
        } else if (regions.length === 0) {
          setRegionPickerOpen(true);
        }
      })();
    }, []);

    useEffect(() => {
      if (!loading && !plan && selectedAircraft) {
        newPlan();
      }
    }, [loading, plan, selectedAircraft, newPlan]);

    const navlog = useMemo(() => {
      if (!plan || !selectedAircraft) {
        return { rows: [], totals: { distanceNm: 0, eteMinutes: 0, fuelBurnedGal: 0, fuelRemainingGal: 0, reserveOk: true } };
      }
      return computeNavlog({ plan, aircraft: selectedAircraft, winds });
    }, [plan, selectedAircraft, winds]);

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
                <Navlog rows={navlog.rows} />
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

              <ExportBar plan={plan} aircraft={selectedAircraft} navlog={navlog.rows} />

              <Separator />

              <div>
                <div className="font-medium text-sm mb-2">Saved plans</div>
                <PlansList plans={plans} currentId={plan.id} onOpen={openPlan} />
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 relative">
            <MapViewer plan={plan} />
            <div className="absolute top-2 right-2">
              <button
                className="text-xs bg-background border rounded px-2 py-1 shadow hover:bg-accent"
                onClick={() => setRegionPickerOpen(true)}
              >
                Map regions
              </button>
            </div>
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
          onClose={() => {
            setFirstRunOpen(false);
            void (async () => {
              const regions = await listInstalledRegions();
              if (regions.length === 0) setRegionPickerOpen(true);
            })();
          }}
        />

        <RegionPicker
          open={regionPickerOpen}
          onClose={() => setRegionPickerOpen(false)}
        />
      </div>
    );
  };

  const FlightPlannerPage: FC = () => (
    <Provider>
      <Inner />
    </Provider>
  );

  return FlightPlannerPage;
}
