import type { FC, ReactNode } from 'react';
import type { Airport, Navaid, SharedDependencies } from '../types';

export type SelectedItem =
  | { kind: 'airport'; airport: Airport }
  | { kind: 'navaid'; navaid: Navaid }
  | null;

export interface FlyToRequest {
  lng: number;
  lat: number;
  zoom?: number;
  /** Monotonically-increasing id so repeated identical requests re-trigger. */
  nonce: number;
}

export interface SelectedAirportStore {
  selected: SelectedItem;
  setAirport(airport: Airport | null): void;
  setNavaid(navaid: Navaid | null): void;
  clear(): void;
  flyToRequest: FlyToRequest | null;
  requestFlyTo(lng: number, lat: number, zoom?: number): void;
}

export function createSelectedAirportProvider(Shared: SharedDependencies) {
  const { React, useState, useCallback, useMemo, useRef } = Shared;
  const Context = React.createContext<SelectedAirportStore | null>(null);

  const Provider: FC<{ children: ReactNode }> = ({ children }) => {
    const [selected, setSelected] = useState<SelectedItem>(null);
    const [flyToRequest, setFlyToRequest] = useState<FlyToRequest | null>(null);
    const nonceRef = useRef(0);

    const setAirport = useCallback((airport: Airport | null) => {
      setSelected(airport ? { kind: 'airport', airport } : null);
    }, []);

    const setNavaid = useCallback((navaid: Navaid | null) => {
      setSelected(navaid ? { kind: 'navaid', navaid } : null);
    }, []);

    const clear = useCallback(() => setSelected(null), []);

    const requestFlyTo = useCallback((lng: number, lat: number, zoom?: number) => {
      nonceRef.current += 1;
      setFlyToRequest({ lng, lat, zoom, nonce: nonceRef.current });
    }, []);

    const store = useMemo<SelectedAirportStore>(
      () => ({ selected, setAirport, setNavaid, clear, flyToRequest, requestFlyTo }),
      [selected, setAirport, setNavaid, clear, flyToRequest, requestFlyTo],
    );

    return React.createElement(Context.Provider, { value: store }, children);
  };

  function useSelectedAirport(): SelectedAirportStore {
    const ctx = React.useContext(Context);
    if (!ctx) {
      throw new Error('useSelectedAirport must be used inside <SelectedAirportProvider>');
    }
    return ctx;
  }

  return { Provider, useSelectedAirport };
}
