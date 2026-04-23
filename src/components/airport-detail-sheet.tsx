import type { FC } from 'react';
import type {
  Airport,
  Frequency,
  Navaid,
  Runway,
  SharedDependencies,
  Waypoint,
} from '../types';
import type { SelectedAirportStore } from '../hooks/use-selected-airport';
import { getAeroDataSource } from '../hooks/use-aero-data';
import { RunwayDiagram } from './place-card/runway-diagram';

// Reuse the same ordering used by the navlog picker for grouping.
const FREQ_GROUP_ORDER = [
  'CTAF',
  'TWR',
  'GND',
  'CLD',
  'A/D',
  'APP',
  'DEP',
  'CNTR',
  'ATIS',
  'AWOS',
  'ASOS',
  'UNIC',
  'UNICOM',
  'MULTICOM',
  'INFO',
  'AFIS',
  'FSS',
] as const;

function groupFrequencies(freqs: Frequency[]): Array<{ type: string; items: Frequency[] }> {
  const map = new Map<string, Frequency[]>();
  for (const f of freqs) {
    const key = (f.type ?? 'OTHER').toUpperCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }
  const ordered: Array<{ type: string; items: Frequency[] }> = [];
  for (const key of FREQ_GROUP_ORDER) {
    const items = map.get(key);
    if (items) {
      ordered.push({ type: key, items });
      map.delete(key);
    }
  }
  for (const [key, items] of map) {
    ordered.push({ type: key, items });
  }
  return ordered;
}

function formatHeading(deg: number | undefined): string {
  if (!Number.isFinite(deg)) return '—';
  const v = ((Math.round(deg!) % 360) + 360) % 360;
  return v.toString().padStart(3, '0') + '°';
}

function surfaceLabel(raw: string): string {
  const s = (raw ?? '').toUpperCase();
  if (s === 'CON' || s === 'CONC') return 'Concrete';
  if (s === 'ASPH' || s === 'ASP') return 'Asphalt';
  if (s === 'TURF' || s === 'GRS' || s === 'GRASS') return 'Turf';
  if (s === 'DIRT' || s === 'GRVL' || s === 'GRAVEL') return 'Gravel';
  if (s === 'WATER') return 'Water';
  if (s === 'SNOW' || s === 'ICE') return 'Snow/Ice';
  return raw || 'Unknown';
}

function longestRunway(airport: Airport): Runway | null {
  let best: Runway | null = null;
  for (const r of airport.runways) {
    if (!r.lengthFt) continue;
    if (!best || r.lengthFt > best.lengthFt) best = r;
  }
  return best;
}

function bboxAround(lat: number, lon: number, nm: number): [number, number, number, number] {
  const latDeg = nm / 60;
  const lonDeg = nm / (60 * Math.cos((lat * Math.PI) / 180));
  return [lon - lonDeg, lat - latDeg, lon + lonDeg, lat + latDeg];
}

function distanceNm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3440.065;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function createAirportDetailSheet(Shared: SharedDependencies) {
  const { Sheet, SheetContent, useState, useEffect, lucideIcons } = Shared;
  const { Plus, Navigation, Copy, Plane } = lucideIcons as Record<string, any>;

  const AirportDetailSheet: FC<{
    store: SelectedAirportStore;
    onAddToRoute?: (waypoint: {
      kind: 'airport' | 'navaid';
      ref: string;
      name: string;
      lat: number;
      lon: number;
    }) => void;
  }> = ({ store, onAddToRoute }) => {
    const open = store.selected !== null;
    const close = () => store.clear();

    const addCurrent = () => {
      if (!onAddToRoute || !store.selected) return;
      if (store.selected.kind === 'airport') {
        const a = store.selected.airport;
        onAddToRoute({
          kind: 'airport',
          ref: a.icao,
          name: a.name,
          lat: a.lat,
          lon: a.lon,
        });
      } else {
        const n = store.selected.navaid;
        onAddToRoute({
          kind: 'navaid',
          ref: n.id,
          name: n.name,
          lat: n.lat,
          lon: n.lon,
        });
      }
    };

    const center = () => {
      if (!store.selected) return;
      const p =
        store.selected.kind === 'airport'
          ? store.selected.airport
          : store.selected.navaid;
      store.requestFlyTo(p.lon, p.lat, 10);
    };

    return (
      <Sheet open={open} onOpenChange={(v: boolean) => !v && close()}>
        <SheetContent
          side="right"
          className="kfp-scope kfp-place-card-shell"
          style={{
            width: 440,
            maxWidth: 440,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {store.selected?.kind === 'airport' ? (
            <AirportPlaceCard
              airport={store.selected.airport}
              onAddToRoute={addCurrent}
              onCenter={center}
              onSelectIcao={async (icao) => {
                try {
                  const ds = getAeroDataSource();
                  const full = await ds.findAirportByIcao(icao);
                  if (full) store.setAirport(full);
                } catch {
                  /* ignore */
                }
              }}
            />
          ) : store.selected?.kind === 'navaid' ? (
            <NavaidPlaceCard
              navaid={store.selected.navaid}
              onAddToRoute={addCurrent}
              onCenter={center}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    );
  };

  // ------------------------------------------------------------------

  const AirportPlaceCard: FC<{
    airport: Airport;
    onAddToRoute: () => void;
    onCenter: () => void;
    onSelectIcao: (icao: string) => void;
  }> = ({ airport, onAddToRoute, onCenter, onSelectIcao }) => {
    const grouped = groupFrequencies(airport.frequencies ?? []);
    const longest = longestRunway(airport);
    const typeLabel = airport.type
      .replace(/_/g, ' ')
      .replace(/airport/i, '')
      .trim() || 'airport';
    const [copiedMhz, setCopiedMhz] = useState<number | null>(null);
    const [nearby, setNearby] = useState<
      Array<{ icao: string; name: string; distNm: number; type: string }>
    >([]);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const ds = getAeroDataSource();
          const nearbyRaw = await ds.airportsInBboxLite(
            bboxAround(airport.lat, airport.lon, 30),
            { types: ['large_airport', 'medium_airport', 'small_airport'], limit: 40 },
          );
          const list = nearbyRaw
            .filter((a) => a.icao !== airport.icao)
            .map((a) => ({
              icao: a.icao,
              name: a.name,
              type: a.type,
              distNm: distanceNm(airport.lat, airport.lon, a.lat, a.lon),
            }))
            .sort((a, b) => a.distNm - b.distNm)
            .slice(0, 6);
          if (!cancelled) setNearby(list);
        } catch {
          if (!cancelled) setNearby([]);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [airport.icao]);

    const copyFreq = async (mhz: number) => {
      try {
        await navigator.clipboard?.writeText(mhz.toFixed(3));
        setCopiedMhz(mhz);
        setTimeout(() => setCopiedMhz((m) => (m === mhz ? null : m)), 1200);
      } catch {
        /* clipboard unavailable */
      }
    };

    return (
      <>
        <div className="kfp-place-hero">
          <RunwayDiagram airport={airport} size={200} />
        </div>

        <div className="kfp-place-titlebar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <div className="kfp-place-icao">
              {airport.icao}
              {airport.iata && (
                <span className="kfp-place-iata">{airport.iata}</span>
              )}
            </div>
            <div className="kfp-place-subtitle">{airport.name}</div>
            <div className="kfp-place-meta">
              {typeLabel}
              {airport.municipality ? ` · ${airport.municipality}` : ''}
              {airport.country ? `, ${airport.country}` : ''}
            </div>
          </div>

          <button
            type="button"
            className="kfp-place-add"
            onClick={onAddToRoute}
            title="Add this airport to the current route"
          >
            {Plus && <Plus className="w-4 h-4" />}
            <span>Add</span>
          </button>
        </div>

        <div className="kfp-place-stats">
          <Stat label="Elev" value={`${airport.elevationFt.toLocaleString()} ft`} />
          {longest && (
            <Stat
              label="Longest rwy"
              value={`${longest.lengthFt.toLocaleString()} ft`}
              sub={`${longest.leIdent ?? ''}${longest.heIdent ? `/${longest.heIdent}` : ''}`}
            />
          )}
          <Stat
            label="Position"
            value={`${airport.lat.toFixed(3)}, ${airport.lon.toFixed(3)}`}
            mono
          />
        </div>

        <div className="kfp-place-body">
          <section>
            <SectionLabel>Runways</SectionLabel>
            {airport.runways.length === 0 ? (
              <div className="kfp-place-empty">No runway data</div>
            ) : (
              <div className="kfp-place-runways">
                {airport.runways.map((r: Runway) => (
                  <div key={r.id} className="kfp-place-runway-row">
                    <span className="kfp-place-runway-id">
                      {r.leIdent ?? r.id}
                      {r.heIdent ? `/${r.heIdent}` : ''}
                    </span>
                    <span>
                      {r.lengthFt ? `${r.lengthFt.toLocaleString()} ft` : '—'}
                      {r.widthFt ? ` · ${r.widthFt} ft` : ''}
                    </span>
                    <span className="kfp-place-runway-surface">
                      {surfaceLabel(r.surface)}
                    </span>
                    <span className="kfp-place-runway-hdg">
                      {formatHeading(r.headingTrue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionLabel>Frequencies</SectionLabel>
            {grouped.length === 0 ? (
              <div className="kfp-place-empty">No frequency data</div>
            ) : (
              <div className="kfp-place-freqs">
                {grouped.map(({ type, items }) => (
                  <div key={type} className="kfp-place-freq-group">
                    <div className="kfp-place-freq-type">{type}</div>
                    <div className="kfp-place-freq-list">
                      {items.map((f, i) => (
                        <button
                          key={`${f.mhz}-${i}`}
                          type="button"
                          className="kfp-place-freq-pill"
                          onClick={() => copyFreq(f.mhz)}
                          title={`${f.description || type} — click to copy`}
                        >
                          <span className="kfp-place-freq-mhz">
                            {f.mhz.toFixed(3)}
                          </span>
                          {f.description && (
                            <span className="kfp-place-freq-desc">
                              {f.description}
                            </span>
                          )}
                          {copiedMhz === f.mhz ? (
                            <span className="kfp-place-freq-copied">Copied</span>
                          ) : (
                            Copy && (
                              <Copy
                                className="w-3 h-3 kfp-place-freq-copy-icon"
                                aria-hidden
                              />
                            )
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionLabel>Nearby airports</SectionLabel>
            {nearby.length === 0 ? (
              <div className="kfp-place-empty">Nothing within 30 nm</div>
            ) : (
              <div className="kfp-place-nearby">
                {nearby.map((n) => (
                  <button
                    key={n.icao}
                    type="button"
                    className="kfp-place-nearby-row"
                    onClick={() => onSelectIcao(n.icao)}
                  >
                    {Plane && <Plane className="w-3.5 h-3.5" aria-hidden />}
                    <span className="kfp-place-nearby-icao">{n.icao}</span>
                    <span className="kfp-place-nearby-name">{n.name}</span>
                    <span className="kfp-place-nearby-dist">
                      {Math.round(n.distNm)} nm
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="kfp-place-actions">
          <button
            type="button"
            className="kfp-place-action-secondary"
            onClick={onCenter}
          >
            {Navigation && <Navigation className="w-4 h-4" />}
            Center on map
          </button>
        </div>
      </>
    );
  };

  // ------------------------------------------------------------------

  const NavaidPlaceCard: FC<{
    navaid: Navaid;
    onAddToRoute: () => void;
    onCenter: () => void;
  }> = ({ navaid, onAddToRoute, onCenter }) => {
    const { lucideIcons: icons } = Shared;
    const { Plus, Navigation } = icons as Record<string, any>;
    return (
      <>
        <div className="kfp-place-hero" style={{ paddingTop: 24 }}>
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'var(--kfp-font-display)',
              fontWeight: 600,
              fontSize: 42,
              letterSpacing: '-0.02em',
              color: 'rgb(var(--kfp-accent))',
              height: 160,
            }}
          >
            {navaid.type}
          </div>
        </div>

        <div className="kfp-place-titlebar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <div className="kfp-place-icao">{navaid.id}</div>
            <div className="kfp-place-subtitle">{navaid.name}</div>
            <div className="kfp-place-meta">Navaid</div>
          </div>
          <button
            type="button"
            className="kfp-place-add"
            onClick={onAddToRoute}
            title="Add this navaid to the current route"
          >
            {Plus && <Plus className="w-4 h-4" />}
            <span>Add</span>
          </button>
        </div>

        <div className="kfp-place-stats">
          <Stat label="Type" value={navaid.type} />
          {navaid.freq !== undefined && (
            <Stat label="Frequency" value={`${navaid.freq.toFixed(3)} MHz`} mono />
          )}
          <Stat
            label="Position"
            value={`${navaid.lat.toFixed(3)}, ${navaid.lon.toFixed(3)}`}
            mono
          />
        </div>

        <div className="kfp-place-body">
          <div className="kfp-place-empty" style={{ fontSize: 13, padding: 12 }}>
            Navaid metadata is limited to identifier, type, frequency, and
            coordinates. Add it to a route as a GPS waypoint; tune the radio
            when you're there.
          </div>
        </div>

        <div className="kfp-place-actions">
          <button
            type="button"
            className="kfp-place-action-secondary"
            onClick={onCenter}
          >
            {Navigation && <Navigation className="w-4 h-4" />}
            Center on map
          </button>
        </div>
      </>
    );
  };

  return AirportDetailSheet;
}

const Stat: FC<{
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
}> = ({ label, value, sub, mono }) => (
  <div className="kfp-place-stat">
    <div className="kfp-place-stat-label">{label}</div>
    <div
      className="kfp-place-stat-value"
      style={{ fontFamily: mono ? 'var(--kfp-font-mono)' : undefined }}
    >
      {value}
    </div>
    {sub && <div className="kfp-place-stat-sub">{sub}</div>}
  </div>
);

const SectionLabel: FC<{ children: string }> = ({ children }) => (
  <div className="kfp-place-section-label">{children}</div>
);

export type { Waypoint };
