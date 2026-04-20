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
import { createUseRouteProfile } from '../hooks/use-route-profile';
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
import { createBlockTimeCard } from './block-time-card';
import { createVerticalProfileModal } from './vertical-profile-modal';

export function createFlightPlannerPage(Shared: SharedDependencies) {
  const { useState, useEffect, useMemo, useRef, Separator } = Shared;
  const { Provider, useFlightPlannerStore } = createFlightPlannerProvider(Shared);
  const {
    Provider: SelectedAirportProvider,
    useSelectedAirport,
  } = createSelectedAirportProvider(Shared);
  const useRouteProfile = createUseRouteProfile(Shared);

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
  const BlockTimeCard = createBlockTimeCard(Shared);
  const VerticalProfileModal = createVerticalProfileModal(Shared);

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
    const [profileOpen, setProfileOpen] = useState(false);
    const [airportElevations, setAirportElevations] = useState<Record<string, number>>({});
    const lastAppliedAutoAltsRef = useRef<string>('');

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

    // Resolve departure/arrival elevations from the aero DB so phase model
    // can reason about climb-from and descent-to altitudes.
    useEffect(() => {
      if (!plan) return;
      const first = plan.waypoints[0];
      const last = plan.waypoints[plan.waypoints.length - 1];
      const needs: string[] = [];
      if (first && first.kind === 'airport' && airportElevations[first.ref] === undefined) {
        needs.push(first.ref);
      }
      if (
        last &&
        last.kind === 'airport' &&
        last.ref !== first?.ref &&
        airportElevations[last.ref] === undefined
      ) {
        needs.push(last.ref);
      }
      if (needs.length === 0) return;
      let cancelled = false;
      (async () => {
        const ds = getAeroDataSource();
        const updates: Record<string, number> = {};
        for (const icao of needs) {
          try {
            const a = await ds.findAirportByIcao(icao);
            if (a && Number.isFinite(a.elevationFt)) {
              updates[icao] = a.elevationFt;
            }
          } catch {
            /* ignore */
          }
        }
        if (!cancelled && Object.keys(updates).length > 0) {
          setAirportElevations((prev) => ({ ...prev, ...updates }));
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [plan?.waypoints]);

    const routeProfile = useRouteProfile({ plan, aircraft: selectedAircraft, settings });

    // Auto-bump: when a leg has altAutoPicked === true AND the profile hook
    // has produced a safer altitude, write it back to the plan. Fingerprint
    // the applied values so we don't loop.
    useEffect(() => {
      if (!plan || routeProfile.perLegAltitudes.length !== plan.legs.length) return;
      const fingerprint = plan.legs
        .map((l, i) => `${i}:${l.altAutoPicked ? routeProfile.perLegAltitudes[i] : 'x'}`)
        .join('|');
      if (fingerprint === lastAppliedAutoAltsRef.current) return;

      let changed = false;
      const nextLegs = plan.legs.map((leg, i) => {
        if (!leg.altAutoPicked) return leg;
        const newAlt = routeProfile.perLegAltitudes[i];
        if (newAlt === undefined || newAlt === leg.altFt) return leg;
        changed = true;
        return { ...leg, altFt: newAlt };
      });
      if (changed) {
        lastAppliedAutoAltsRef.current = fingerprint;
        setPlan({ ...plan, legs: nextLegs });
      } else {
        lastAppliedAutoAltsRef.current = fingerprint;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeProfile.perLegAltitudes, plan?.legs]);

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

    const depElev = (() => {
      const first = plan?.waypoints[0];
      if (first && first.kind === 'airport') return airportElevations[first.ref] ?? 0;
      return 0;
    })();
    const arrElev = (() => {
      const last = plan?.waypoints[(plan?.waypoints.length ?? 1) - 1];
      if (last && last.kind === 'airport') return airportElevations[last.ref] ?? 0;
      return 0;
    })();

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
          blockTotals: {
            taxiMin: 0,
            climbMin: 0,
            cruiseMin: 0,
            descentMin: 0,
            patternMin: 0,
            blockMin: 0,
            taxiFuelGal: 0,
            climbFuelGal: 0,
            cruiseFuelGal: 0,
            descentFuelGal: 0,
            patternFuelGal: 0,
            blockFuelGal: 0,
            blockDistanceNm: 0,
          },
        };
      }
      return computeNavlog({
        plan,
        aircraft: selectedAircraft,
        winds,
        legWarnings: routeProfile.perLegWarnings,
        departureElevFt: depElev,
        arrivalElevFt: arrElev,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plan, selectedAircraft, winds, routeProfile.perLegWarnings, depElev, arrElev]);

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
      const prevByKey = new Map(
        plan.legs.map((l) => [`${l.fromId}:${l.toId}`, l]),
      );
      const nextLegs = [];
      for (let i = 0; i < nextWaypoints.length - 1; i++) {
        const fromId = nextWaypoints[i].id;
        const toId = nextWaypoints[i + 1].id;
        const existing = prevByKey.get(`${fromId}:${toId}`);
        if (existing) {
          nextLegs.push({ ...existing, fromId, toId });
        } else {
          nextLegs.push({
            fromId,
            toId,
            altFt: nextWaypoints[i + 1].altFt ?? settings.defaultCruiseAltFt,
            altAutoPicked: true,
          });
        }
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

    const rowsForDisplay = hydratedRows.length > 0 ? hydratedRows : navlog.rows;
    const anyAutoPicked = plan.legs.some((l) => l.altAutoPicked);

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
              <BlockTimeCard
                totals={navlog.blockTotals}
                rows={rowsForDisplay}
                loading={routeProfile.loading}
                error={routeProfile.error}
                onShowProfile={() => setProfileOpen(true)}
                anyAutoPicked={anyAutoPicked}
              />

              <Separator />

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
                <Navlog rows={rowsForDisplay} />
              </div>

              <Separator />

              <ExportBar
                plan={plan}
                aircraft={selectedAircraft}
                navlog={rowsForDisplay}
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

        <VerticalProfileModal
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          plan={plan}
          aircraft={selectedAircraft}
          rows={rowsForDisplay}
          samples={routeProfile.samples}
          obstacles={routeProfile.obstacles}
          departureElevFt={depElev}
          arrivalElevFt={arrElev}
        />
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
