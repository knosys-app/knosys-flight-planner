import type { FC } from 'react';
import { v4 as uuid } from 'uuid';
import type {
  Airport,
  AircraftProfile,
  NavlogRow,
  SharedDependencies,
  Waypoint,
} from '../types';
import { deletePlan, duplicatePlan } from '../store/plan-store';
import { saveAircraft } from '../store/aircraft-store';
import { computeNavlog, hydrateNavlogFrequencies } from '../hooks/use-navlog';
import { createFlightPlannerProvider } from '../hooks/use-flight-planner-store';
import { createUseRouteProfile } from '../hooks/use-route-profile';
import { createUseMetars } from '../hooks/use-metars';
import { createUseTafs } from '../hooks/use-tafs';
import { createUseAutoWinds } from '../hooks/use-auto-winds';
import { createUseAlternates } from '../hooks/use-alternates';
import { isAirportsDbInstalled } from '../data/first-run-download';
import { getAeroDataSource } from '../hooks/use-aero-data';
import { createSelectedAirportProvider } from '../hooks/use-selected-airport';

import { createAircraftPicker } from './aircraft-picker';
import { createAircraftEditorDialog } from './aircraft-editor-dialog';
import { createRouteBuilder } from './route-builder';
import { createNavlog } from './navlog';
import { createExportBar } from './export-bar';
import { createPlansList } from './plans-list';
import { createFirstRunModal } from './first-run-modal';
import { createAirportDetailSheet } from './airport-detail-sheet';
import { createMapViewer } from '../map/map-viewer';

import { FlightShell } from './shell/flight-shell';
import { createPlanPill } from './shell/plan-pill';
import { createLayersButton } from './shell/layers-button';
import { createPlanRail } from './rail/plan-rail';
import { createBriefingCard } from './rail/briefing-card';
import { createWindsOverrideDialog } from './rail/winds-override-dialog';
import {
  createFlightSheet,
  type SheetDetent,
  type SheetTab,
} from './sheet/flight-sheet';
import { createBlockPanel } from './sheet/block-panel';
import { createProfileRibbon } from './profile/profile-ribbon';
import { createPluginErrorBoundary } from './plugin-error-boundary';

export function createFlightPlannerPage(Shared: SharedDependencies) {
  const { useState, useEffect, useMemo, useRef } = Shared;
  const { Provider, useFlightPlannerStore } = createFlightPlannerProvider(Shared);
  const {
    Provider: SelectedAirportProvider,
    useSelectedAirport,
  } = createSelectedAirportProvider(Shared);
  const useRouteProfile = createUseRouteProfile(Shared);
  const useMetars = createUseMetars(Shared);
  const useTafs = createUseTafs(Shared);
  const useAutoWinds = createUseAutoWinds(Shared);
  const useAlternates = createUseAlternates(Shared);

  const PlanPill = createPlanPill(Shared);
  const LayersButton = createLayersButton(Shared);
  const { PlanRail, RailSection } = createPlanRail(Shared);
  const BriefingCard = createBriefingCard(Shared);
  const WindsOverrideDialog = createWindsOverrideDialog(Shared);
  const FlightSheet = createFlightSheet(Shared);
  const BlockPanel = createBlockPanel(Shared);
  const ProfileRibbon = createProfileRibbon(Shared);

  const PluginErrorBoundary = createPluginErrorBoundary(Shared);

  const AircraftPicker = createAircraftPicker(Shared);
  const AircraftEditorDialog = createAircraftEditorDialog(Shared);
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
      setPlanName,
      setSelectedAircraft,
      setWinds,
      saveCurrentPlan,
      newPlan,
      openPlan,
      refresh,
      updateSettings,
    } = store;

    const [editorOpen, setEditorOpen] = useState(false);
    const [editingAircraft, setEditingAircraft] = useState<AircraftProfile | null>(null);
    const [firstRunOpen, setFirstRunOpen] = useState(false);
    const [windsOverrideOpen, setWindsOverrideOpen] = useState(false);
    const [hydratedRows, setHydratedRows] = useState<NavlogRow[]>([]);
    const [airportElevations, setAirportElevations] = useState<Record<string, number>>({});
    const [destinationAirport, setDestinationAirport] = useState<Airport | null>(null);
    const [sheetDetent, setSheetDetent] = useState<SheetDetent>('peek');
    const [sheetTab, setSheetTab] = useState<SheetTab>('profile');
    const lastAppliedAutoAltsRef = useRef<string>('');

    const alternatesResult = useAlternates(destinationAirport);
    const alternateIcaos = alternatesResult.alternates.map((a) => a.airport.icao);
    const metars = useMetars(
      [plan?.departureIcao ?? '', plan?.destinationIcao ?? '', ...alternateIcaos].filter(
        Boolean,
      ),
    );
    const tafs = useTafs(
      plan?.destinationIcao ? [plan.destinationIcao] : [],
    );
    const autoWinds = useAutoWinds(plan);
    // Manual winds win when the user has entered any row; otherwise we use
    // the auto-populated column.
    const effectiveWinds = winds.length > 0 ? winds : autoWinds.winds;

    // Look up the destination Airport object (needed for alternates bbox).
    useEffect(() => {
      const icao = plan?.destinationIcao;
      if (!icao) {
        setDestinationAirport(null);
        return;
      }
      if (destinationAirport?.icao === icao) return;
      let cancelled = false;
      (async () => {
        try {
          const ds = getAeroDataSource();
          const a = await ds.findAirportByIcao(icao);
          if (!cancelled) setDestinationAirport(a);
        } catch {
          if (!cancelled) setDestinationAirport(null);
        }
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plan?.destinationIcao]);

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
    // has produced a safer altitude, write it back to the plan.
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
        winds: effectiveWinds,
        legWarnings: routeProfile.perLegWarnings,
        departureElevFt: depElev,
        arrivalElevFt: arrElev,
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plan, selectedAircraft, effectiveWinds, routeProfile.perLegWarnings, depElev, arrElev]);

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
      return (
        <div
          style={{
            padding: 32,
            color: '#666',
            fontFamily: '-apple-system, system-ui, sans-serif',
          }}
        >
          Loading flight planner…
        </div>
      );
    }

    if (!plan || !selectedAircraft) {
      return (
        <div
          style={{
            padding: 32,
            color: '#666',
            fontFamily: '-apple-system, system-ui, sans-serif',
          }}
        >
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

    const openBlock = () => {
      setSheetTab('block');
      if (sheetDetent === 'peek') setSheetDetent('half');
    };

    return (
      <FlightShell map={<MapViewer plan={plan} selectedAirport={selectedAirport} />}>
        <PlanPill
          plan={plan}
          onRename={setPlanName}
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

        <LayersButton settings={settings} onSettingsChange={updateSettings} />

        <PlanRail>
          <BriefingCard
            plan={plan}
            totals={navlog.blockTotals}
            rows={rowsForDisplay}
            anyAutoPicked={anyAutoPicked}
            loading={routeProfile.loading}
            onOpenBlock={openBlock}
            onOpenWindsOverride={() => setWindsOverrideOpen(true)}
            metars={metars.byIcao}
            metarsLoading={metars.loading}
            metarsError={metars.error}
            windsOverrideActive={winds.length > 0}
            autoWindsActive={winds.length === 0 && autoWinds.winds.length > 0}
            alternates={alternatesResult.alternates.map((a) => ({
              icao: a.airport.icao,
              name: a.airport.name,
              distanceNm: a.distanceNm,
            }))}
          />

          <RailSection title="Route">
            <RouteBuilder
              plan={plan}
              defaultCruiseAltFt={settings.defaultCruiseAltFt}
              onChange={setPlan}
            />
          </RailSection>

          <RailSection title="Aircraft">
            <AircraftPicker
              aircraft={aircraft}
              selectedId={selectedAircraft.id}
              onSelect={(id: string) => void setSelectedAircraft(id)}
              onEdit={() => {
                setEditingAircraft(selectedAircraft);
                setEditorOpen(true);
              }}
            />
          </RailSection>

          <RailSection title="Saved plans">
            <PlansList plans={plans} currentId={plan.id} onOpen={openPlan} />
          </RailSection>

          <RailSection title="Export" defaultOpen={false}>
            <ExportBar plan={plan} aircraft={selectedAircraft} navlog={rowsForDisplay} />
          </RailSection>
        </PlanRail>

        <FlightSheet
          detent={sheetDetent}
          onDetentChange={setSheetDetent}
          tab={sheetTab}
          onTabChange={setSheetTab}
          block={
            <BlockPanel
              totals={navlog.blockTotals}
              rows={rowsForDisplay}
              loading={routeProfile.loading}
              error={routeProfile.error}
              anyAutoPicked={anyAutoPicked}
              destinationIcao={plan.destinationIcao || undefined}
              destinationTaf={
                plan.destinationIcao
                  ? (tafs.byIcao[plan.destinationIcao.toUpperCase()] ?? null)
                  : null
              }
              tafLoading={tafs.loading}
              tafError={tafs.error}
            />
          }
          navlog={<Navlog rows={rowsForDisplay} />}
          profile={
            <ProfileRibbon
              plan={plan}
              aircraft={selectedAircraft}
              rows={rowsForDisplay}
              samples={routeProfile.samples}
              obstacles={routeProfile.obstacles}
              winds={effectiveWinds}
              departureElevFt={depElev}
              arrivalElevFt={arrElev}
            />
          }
        />

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

        <WindsOverrideDialog
          open={windsOverrideOpen}
          onClose={() => setWindsOverrideOpen(false)}
          winds={winds}
          onChange={setWinds}
        />

        <AirportDetailSheet store={selectedAirport} onAddToRoute={appendWaypoint} />
      </FlightShell>
    );
  };

  const FlightPlannerPage: FC = () => (
    <PluginErrorBoundary label="root">
      <Provider>
        <SelectedAirportProvider>
          <PluginErrorBoundary label="inner">
            <Inner />
          </PluginErrorBoundary>
        </SelectedAirportProvider>
      </Provider>
    </PluginErrorBoundary>
  );

  return FlightPlannerPage;
}
