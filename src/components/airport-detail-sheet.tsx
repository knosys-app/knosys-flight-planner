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
  // Whatever remains gets appended in insertion order
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

export function createAirportDetailSheet(Shared: SharedDependencies) {
  const {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    Button,
    Badge,
    Separator,
    ScrollArea,
  } = Shared;

  const AirportDetailSheet: FC<{
    store: SelectedAirportStore;
    onAddToRoute?: (waypoint: { kind: 'airport' | 'navaid'; ref: string; name: string; lat: number; lon: number }) => void;
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
      const p = store.selected.kind === 'airport' ? store.selected.airport : store.selected.navaid;
      store.requestFlyTo(p.lon, p.lat, 10);
    };

    return (
      <Sheet open={open} onOpenChange={(v: boolean) => !v && close()}>
        <SheetContent
          side="right"
          className="!w-[420px] !max-w-[420px] flex flex-col p-0"
        >
          {store.selected?.kind === 'airport' ? (
            <AirportView airport={store.selected.airport} Shared={Shared} />
          ) : store.selected?.kind === 'navaid' ? (
            <NavaidView navaid={store.selected.navaid} Shared={Shared} />
          ) : null}

          {store.selected && (
            <div className="border-t p-3 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={center}>
                Center on map
              </Button>
              {onAddToRoute && (
                <Button size="sm" className="flex-1" onClick={addCurrent}>
                  Add to route
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    );
  };

  const AirportView: FC<{ airport: Airport; Shared: SharedDependencies }> = ({
    airport,
    Shared: S,
  }) => {
    const {
      SheetHeader: SH,
      SheetTitle: ST,
      SheetDescription: SD,
      Badge: B,
      Separator: Sep,
      ScrollArea: Scroll,
    } = S;
    const typeLabel = airport.type.replace(/_/g, ' ').replace(/airport/i, '').trim()
      || 'airport';

    const grouped = groupFrequencies(airport.frequencies ?? []);

    return (
      <>
        <SH className="px-4 pt-4 pb-3">
          <ST className="text-2xl font-semibold tracking-tight">
            {airport.icao}{' '}
            {airport.iata && (
              <span className="text-sm text-muted-foreground font-normal">· {airport.iata}</span>
            )}
          </ST>
          <SD className="text-sm">
            {airport.name}
            {airport.municipality ? ` · ${airport.municipality}` : ''}
            {airport.country ? `, ${airport.country}` : ''}
          </SD>
          <div className="flex items-center gap-2 text-xs pt-1">
            <B variant="secondary">{typeLabel}</B>
            {Number.isFinite(airport.elevationFt) && (
              <span className="text-muted-foreground">
                Elev {airport.elevationFt} ft
              </span>
            )}
            <span className="text-muted-foreground">
              {airport.lat.toFixed(4)}, {airport.lon.toFixed(4)}
            </span>
          </div>
        </SH>

        <Sep />

        <Scroll className="flex-1 min-h-0">
          <div className="p-4 space-y-5">
            <section>
              <h3 className="text-sm font-medium mb-2">
                Runways ({airport.runways.length})
              </h3>
              {airport.runways.length === 0 ? (
                <div className="text-xs text-muted-foreground">No runway data</div>
              ) : (
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left px-2 py-1">ID</th>
                        <th className="text-right px-2 py-1">Length</th>
                        <th className="text-right px-2 py-1">Width</th>
                        <th className="text-left px-2 py-1">Surface</th>
                        <th className="text-right px-2 py-1">Hdg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {airport.runways.map((r: Runway) => (
                        <tr key={r.id} className="border-t">
                          <td className="px-2 py-1 font-mono">
                            {r.leIdent ?? r.id}
                            {r.heIdent ? `/${r.heIdent}` : ''}
                          </td>
                          <td className="px-2 py-1 text-right">
                            {r.lengthFt ? `${r.lengthFt.toLocaleString()} ft` : '—'}
                          </td>
                          <td className="px-2 py-1 text-right">
                            {r.widthFt ? `${r.widthFt} ft` : '—'}
                          </td>
                          <td className="px-2 py-1">{surfaceLabel(r.surface)}</td>
                          <td className="px-2 py-1 text-right">
                            {formatHeading(r.headingTrue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-medium mb-2">
                Frequencies ({airport.frequencies.length})
              </h3>
              {grouped.length === 0 ? (
                <div className="text-xs text-muted-foreground">No frequency data</div>
              ) : (
                <div className="space-y-2">
                  {grouped.map(({ type, items }) => (
                    <div key={type}>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                        {type}
                      </div>
                      <div className="border rounded divide-y">
                        {items.map((f, i) => (
                          <div
                            key={`${f.mhz}-${i}`}
                            className="flex items-center justify-between px-2 py-1 text-xs"
                          >
                            <span className="font-mono">{f.mhz.toFixed(3)}</span>
                            <span className="text-muted-foreground truncate ml-2">
                              {f.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </Scroll>
      </>
    );
  };

  const NavaidView: FC<{ navaid: Navaid; Shared: SharedDependencies }> = ({
    navaid,
    Shared: S,
  }) => {
    const {
      SheetHeader: SH,
      SheetTitle: ST,
      SheetDescription: SD,
      Badge: B,
      Separator: Sep,
    } = S;
    return (
      <>
        <SH className="px-4 pt-4 pb-3">
          <ST className="text-2xl font-semibold tracking-tight">{navaid.id}</ST>
          <SD className="text-sm">{navaid.name}</SD>
          <div className="flex items-center gap-2 text-xs pt-1">
            <B variant="secondary">{navaid.type}</B>
            {navaid.freq !== undefined && (
              <span className="font-mono">{navaid.freq.toFixed(3)} MHz</span>
            )}
            <span className="text-muted-foreground">
              {navaid.lat.toFixed(4)}, {navaid.lon.toFixed(4)}
            </span>
          </div>
        </SH>
        <Sep />
        <div className="p-4 flex-1 min-h-0 text-sm text-muted-foreground">
          Navaid route waypoint. The bundled database provides identifier, type,
          coordinates, and frequency only — no additional metadata.
        </div>
      </>
    );
  };

  // Keep an unused reference so the tree-shaker doesn't drop the imports
  // that are consumed inside factory-returned sub-components.
  void SheetContent;
  void SheetHeader;
  void SheetTitle;
  void SheetDescription;
  void Separator;
  void ScrollArea;
  void Badge;

  return AirportDetailSheet;
}

export type { Waypoint };
