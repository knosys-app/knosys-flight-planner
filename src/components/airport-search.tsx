import type { FC } from 'react';
import type { Airport, AirportType, Navaid, SharedDependencies } from '../types';
import { getAeroDataSource } from '../hooks/use-aero-data';

const PRIMARY_TYPES: AirportType[] = [
  'large_airport',
  'medium_airport',
  'small_airport',
  'seaplane_base',
];

export interface AirportSearchSelection {
  kind: 'airport' | 'navaid';
  airport?: Airport;
  navaid?: Navaid;
}

export function createAirportSearch(Shared: SharedDependencies) {
  const {
    useState,
    useEffect,
    useCallback,
    Input,
    Popover,
    PopoverTrigger,
    PopoverContent,
    Switch,
    Label,
    Badge,
  } = Shared;

  const AirportSearch: FC<{
    value?: string;
    placeholder?: string;
    onSelect: (selection: AirportSearchSelection) => void;
  }> = ({ placeholder = 'Search airports, navaids (KLAX, DAG, "los angeles")', onSelect }) => {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [airportResults, setAirportResults] = useState<Airport[]>([]);
    const [navaidResults, setNavaidResults] = useState<Navaid[]>([]);
    const [pending, setPending] = useState(false);
    const [includeExtras, setIncludeExtras] = useState(false);

    useEffect(() => {
      if (!query.trim()) {
        setAirportResults([]);
        setNavaidResults([]);
        return;
      }
      let cancelled = false;
      setPending(true);
      const handle = setTimeout(async () => {
        try {
          const ds = getAeroDataSource();
          const opts = includeExtras ? {} : { types: PRIMARY_TYPES };
          const [airports, navaids] = await Promise.all([
            ds.searchAirports(query, 10, opts),
            ds.searchNavaids(query, 5),
          ]);
          if (!cancelled) {
            setAirportResults(airports);
            setNavaidResults(navaids);
          }
        } catch {
          if (!cancelled) {
            setAirportResults([]);
            setNavaidResults([]);
          }
        } finally {
          if (!cancelled) setPending(false);
        }
      }, 150);
      return () => {
        cancelled = true;
        clearTimeout(handle);
      };
    }, [query, includeExtras]);

    const choose = useCallback(
      (selection: AirportSearchSelection) => {
        onSelect(selection);
        setQuery('');
        setOpen(false);
      },
      [onSelect],
    );

    const empty =
      !pending && query && airportResults.length === 0 && navaidResults.length === 0;

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Input
            placeholder={placeholder}
            value={query}
            onChange={(e: any) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" onOpenAutoFocus={(e: any) => e.preventDefault()}>
          <div className="max-h-80 overflow-auto">
            {pending && <div className="p-3 text-sm text-muted-foreground">Searching…</div>}
            {empty && (
              <div className="p-3 text-sm text-muted-foreground">
                No match for "{query}"{' '}
                {!includeExtras && (
                  <span className="block mt-1 text-xs">
                    Heliports &amp; closed airports are hidden — toggle below to include them.
                  </span>
                )}
              </div>
            )}
            {airportResults.length > 0 && (
              <>
                <div className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Airports
                </div>
                {airportResults.map((a) => (
                  <button
                    key={`airport-${a.icao}`}
                    className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground border-b last:border-b-0"
                    onClick={() => choose({ kind: 'airport', airport: a })}
                  >
                    <div className="font-medium flex items-center gap-2">
                      <span>{a.icao}</span>
                      {a.iata && (
                        <span className="text-xs text-muted-foreground">· {a.iata}</span>
                      )}
                      <Badge variant="secondary" className="ml-auto text-[10px]">
                        {a.type.replace('_airport', '').replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {a.name}
                      {a.municipality ? ` — ${a.municipality}` : ''}
                      {a.country ? `, ${a.country}` : ''}
                    </div>
                  </button>
                ))}
              </>
            )}
            {navaidResults.length > 0 && (
              <>
                <div className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Navaids
                </div>
                {navaidResults.map((n) => (
                  <button
                    key={`navaid-${n.id}`}
                    className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground border-b last:border-b-0"
                    onClick={() => choose({ kind: 'navaid', navaid: n })}
                  >
                    <div className="font-medium flex items-center gap-2">
                      <span>{n.id}</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">
                        {n.type}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {n.name}
                      {n.freq !== undefined ? ` · ${n.freq.toFixed(3)} MHz` : ''}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
          <div className="border-t px-3 py-2 flex items-center justify-between text-xs">
            <Label
              htmlFor="airport-search-extras"
              className="text-xs text-muted-foreground"
            >
              Show heliports &amp; closed airports
            </Label>
            <Switch
              id="airport-search-extras"
              checked={includeExtras}
              onCheckedChange={(v: boolean) => setIncludeExtras(v)}
            />
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return AirportSearch;
}
