// Plugin-scoped React state: current plan draft, aircraft list, settings,
// winds table, and loading/first-run flags. Uses the React APIs passed in
// via `Shared` so the hook is usable inside the plugin sandbox.

import type { FC, ReactNode } from 'react';
import type {
  AircraftProfile,
  Plan,
  PluginSettings,
  SharedDependencies,
  WindsEntryRow,
} from '../types';
import { v4 as uuid } from 'uuid';
import { createEmptyPlan, listPlans, savePlan } from '../store/plan-store';
import { listAircraft, seedPresetsIfEmpty } from '../store/aircraft-store';
import { getSettings, saveSettings } from '../store/settings-store';
import { DEFAULT_SETTINGS } from '../constants';

export interface FlightPlannerState {
  plan: Plan | null;
  plans: Plan[];
  aircraft: AircraftProfile[];
  selectedAircraft: AircraftProfile | null;
  winds: WindsEntryRow[];
  settings: PluginSettings;
  loading: boolean;
}

export interface FlightPlannerActions {
  setPlan(plan: Plan): void;
  setPlanName(name: string): void;
  setSelectedAircraft(id: string): Promise<void>;
  setWinds(winds: WindsEntryRow[]): void;
  addWindsRow(row: WindsEntryRow): void;
  saveCurrentPlan(): Promise<void>;
  newPlan(): void;
  openPlan(id: string): void;
  refresh(): Promise<void>;
  updateSettings(patch: Partial<PluginSettings>): Promise<void>;
}

export type FlightPlannerStore = FlightPlannerState & FlightPlannerActions;

export function createFlightPlannerProvider(Shared: SharedDependencies) {
  const { React, useState, useEffect, useCallback, useMemo } = Shared;
  const StoreContext = React.createContext<FlightPlannerStore | null>(null);

  const Provider: FC<{ children: ReactNode }> = ({ children }) => {
    const [plan, setPlanState] = useState<Plan | null>(null);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [aircraft, setAircraft] = useState<AircraftProfile[]>([]);
    const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
    const [winds, setWinds] = useState<WindsEntryRow[]>([]);
    const [settings, setSettings] = useState<PluginSettings>(
      DEFAULT_SETTINGS as PluginSettings,
    );
    const [loading, setLoading] = useState(true);

    const selectedAircraft = useMemo(
      () => aircraft.find((a) => a.id === selectedAircraftId) ?? null,
      [aircraft, selectedAircraftId],
    );

    const refresh = useCallback(async () => {
      const [seededAircraft, allPlans, loadedSettings] = await Promise.all([
        seedPresetsIfEmpty(),
        listPlans(),
        getSettings(),
      ]);
      const allAircraft = await listAircraft();
      setAircraft(allAircraft.length ? allAircraft : seededAircraft);
      setPlans(allPlans);
      setSettings(loadedSettings);
      setSelectedAircraftId((prev) => {
        if (prev && allAircraft.some((a) => a.id === prev)) return prev;
        if (loadedSettings.defaultAircraftProfileId) {
          return loadedSettings.defaultAircraftProfileId;
        }
        return allAircraft[0]?.id ?? seededAircraft[0]?.id ?? null;
      });
      setLoading(false);
    }, []);

    useEffect(() => {
      void refresh();
    }, [refresh]);

    const setPlan = useCallback((next: Plan) => setPlanState(next), []);

    const setPlanName = useCallback(
      (name: string) => setPlanState((p) => (p ? { ...p, name } : p)),
      [],
    );

    const setSelectedAircraft = useCallback(
      async (id: string) => {
        setSelectedAircraftId(id);
        await saveSettings({ defaultAircraftProfileId: id });
      },
      [],
    );

    const addWindsRow = useCallback((row: WindsEntryRow) => {
      setWinds((rows) => [...rows, row].sort((a, b) => a.altFt - b.altFt));
    }, []);

    const saveCurrentPlan = useCallback(async () => {
      if (!plan) return;
      const saved = await savePlan(plan);
      setPlanState(saved);
      setPlans(await listPlans());
    }, [plan]);

    const newPlan = useCallback(() => {
      if (!selectedAircraftId) {
        const fallbackId = aircraft[0]?.id ?? uuid();
        setPlanState(createEmptyPlan(fallbackId));
      } else {
        setPlanState(createEmptyPlan(selectedAircraftId));
      }
    }, [aircraft, selectedAircraftId]);

    const openPlan = useCallback(
      (id: string) => {
        const p = plans.find((x) => x.id === id);
        if (p) setPlanState(p);
      },
      [plans],
    );

    const updateSettings = useCallback(async (patch: Partial<PluginSettings>) => {
      const next = await saveSettings(patch);
      setSettings(next);
    }, []);

    const store: FlightPlannerStore = {
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
      addWindsRow,
      saveCurrentPlan,
      newPlan,
      openPlan,
      refresh,
      updateSettings,
    };

    return React.createElement(StoreContext.Provider, { value: store }, children);
  };

  function useFlightPlannerStore(): FlightPlannerStore {
    const ctx = React.useContext(StoreContext);
    if (!ctx) throw new Error('useFlightPlannerStore must be used inside <Provider>');
    return ctx;
  }

  return { Provider, useFlightPlannerStore };
}
