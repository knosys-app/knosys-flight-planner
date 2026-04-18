import type { FC } from 'react';
import type { Airport, SharedDependencies } from '../types';
import { getAeroDataSource } from '../hooks/use-aero-data';

export function createAirportSearch(Shared: SharedDependencies) {
  const { useState, useEffect, useCallback, Input, Popover, PopoverTrigger, PopoverContent } = Shared;

  const AirportSearch: FC<{
    value?: string;
    placeholder?: string;
    onSelect: (airport: Airport) => void;
  }> = ({ placeholder = 'Search airports (KLAX, "los angeles")', onSelect }) => {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [results, setResults] = useState<Airport[]>([]);
    const [pending, setPending] = useState(false);

    useEffect(() => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      let cancelled = false;
      setPending(true);
      const handle = setTimeout(async () => {
        try {
          const ds = getAeroDataSource();
          const found = await ds.searchAirports(query, 10);
          if (!cancelled) setResults(found);
        } catch (err) {
          if (!cancelled) setResults([]);
        } finally {
          if (!cancelled) setPending(false);
        }
      }, 150);
      return () => {
        cancelled = true;
        clearTimeout(handle);
      };
    }, [query]);

    const handleSelect = useCallback(
      (airport: Airport) => {
        onSelect(airport);
        setQuery('');
        setOpen(false);
      },
      [onSelect],
    );

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
        <PopoverContent className="w-80 p-0" onOpenAutoFocus={(e: any) => e.preventDefault()}>
          <div className="max-h-72 overflow-auto">
            {pending && <div className="p-3 text-sm text-muted-foreground">Searching…</div>}
            {!pending && query && results.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">No airports match "{query}"</div>
            )}
            {results.map((a) => (
              <button
                key={a.icao}
                className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground border-b last:border-b-0"
                onClick={() => handleSelect(a)}
              >
                <div className="font-medium">
                  {a.icao} {a.iata ? `· ${a.iata}` : ''}
                </div>
                <div className="text-xs text-muted-foreground">
                  {a.name}
                  {a.municipality ? ` — ${a.municipality}` : ''}
                  {a.country ? `, ${a.country}` : ''}
                </div>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return AirportSearch;
}
