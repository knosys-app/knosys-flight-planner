import type { FC } from 'react';
import { v4 as uuid } from 'uuid';
import type { Airport, Navaid, Plan, SharedDependencies, Waypoint } from '../types';
import { tokenizeRouteString } from '../utils/parse-route-string';
import { getAeroDataSource } from '../hooks/use-aero-data';
import { createAirportSearch, type AirportSearchSelection } from './airport-search';

export function createRouteBuilder(
  Shared: SharedDependencies,
  hooks?: {
    onWaypointClick?: (waypoint: Waypoint) => void;
  },
) {
  const { useState, Input, Button, Label, Badge, lucideIcons } = Shared;
  const AirportSearch = createAirportSearch(Shared);
  const { ArrowDown, X, Plus } = lucideIcons as Record<string, any>;

  function waypointFromAirport(a: Airport, altFt?: number): Waypoint {
    return {
      id: uuid(),
      kind: 'airport',
      ref: a.icao,
      name: a.name,
      lat: a.lat,
      lon: a.lon,
      altFt,
    };
  }

  function waypointFromNavaid(n: Navaid, altFt?: number): Waypoint {
    return {
      id: uuid(),
      kind: 'navaid',
      ref: n.id,
      name: n.name,
      lat: n.lat,
      lon: n.lon,
      altFt,
    };
  }

  function rebuildLegs(waypoints: Waypoint[], defaultAlt: number): Plan['legs'] {
    const legs: Plan['legs'] = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      legs.push({
        fromId: waypoints[i].id,
        toId: waypoints[i + 1].id,
        altFt: waypoints[i + 1].altFt ?? defaultAlt,
      });
    }
    return legs;
  }

  const RouteBuilder: FC<{
    plan: Plan;
    defaultCruiseAltFt: number;
    onChange: (next: Plan) => void;
  }> = ({ plan, defaultCruiseAltFt, onChange }) => {
    const [routeText, setRouteText] = useState('');
    const [importing, setImporting] = useState(false);

    const update = (waypoints: Waypoint[]) => {
      const legs = rebuildLegs(waypoints, defaultCruiseAltFt);
      const first = waypoints[0]?.ref ?? '';
      const last = waypoints[waypoints.length - 1]?.ref ?? '';
      onChange({
        ...plan,
        waypoints,
        legs,
        departureIcao: first,
        destinationIcao: last,
      });
    };

    const addSelection = (sel: AirportSearchSelection) => {
      if (sel.kind === 'airport' && sel.airport) {
        update([...plan.waypoints, waypointFromAirport(sel.airport, defaultCruiseAltFt)]);
      } else if (sel.kind === 'navaid' && sel.navaid) {
        update([...plan.waypoints, waypointFromNavaid(sel.navaid, defaultCruiseAltFt)]);
      }
    };

    const removeWaypoint = (id: string) => {
      update(plan.waypoints.filter((w) => w.id !== id));
    };

    const moveUp = (index: number) => {
      if (index === 0) return;
      const next = [...plan.waypoints];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      update(next);
    };

    const moveDown = (index: number) => {
      if (index === plan.waypoints.length - 1) return;
      const next = [...plan.waypoints];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      update(next);
    };

    const importRouteString = async () => {
      if (!routeText.trim()) return;
      setImporting(true);
      try {
        const tokens = tokenizeRouteString(routeText);
        const ds = getAeroDataSource();
        const found: Waypoint[] = [];
        for (const token of tokens) {
          const airport = await ds.findAirportByIcao(token);
          if (airport) {
            found.push(waypointFromAirport(airport, defaultCruiseAltFt));
            continue;
          }
          const navaid = await ds.findNavaid(token);
          if (navaid) {
            found.push({
              id: uuid(),
              kind: 'navaid',
              ref: navaid.id,
              name: navaid.name,
              lat: navaid.lat,
              lon: navaid.lon,
              altFt: defaultCruiseAltFt,
            });
            continue;
          }
        }
        if (found.length > 0) {
          update([...plan.waypoints, ...found]);
          setRouteText('');
        }
      } finally {
        setImporting(false);
      }
    };

    return (
      <div className="space-y-3">
        <div>
          <Label>Route string</Label>
          <div className="flex gap-2">
            <Input
              placeholder="KLAX KPMD KLAS"
              value={routeText}
              onChange={(e: any) => setRouteText(e.target.value)}
              onKeyDown={(e: any) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void importRouteString();
                }
              }}
            />
            <Button onClick={() => void importRouteString()} disabled={importing}>
              {Plus && <Plus className="w-4 h-4 mr-1" />}
              Add
            </Button>
          </div>
        </div>

        <div>
          <Label>Add airport or navaid</Label>
          <AirportSearch onSelect={addSelection} />
        </div>

        <div className="space-y-1">
          {plan.waypoints.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground border rounded">
              No waypoints. Paste a route string or search for an airport above.
            </div>
          )}
          {plan.waypoints.map((wp, index) => (
            <div
              key={wp.id}
              className="flex items-center gap-2 p-2 border rounded bg-card hover:bg-accent/40 cursor-pointer"
              onClick={(e: any) => {
                // Ignore clicks on the row's action buttons
                if ((e.target as HTMLElement).closest('button')) return;
                hooks?.onWaypointClick?.(wp);
              }}
            >
              <Badge variant="secondary">{index + 1}</Badge>
              {wp.kind === 'navaid' && (
                <Badge variant="outline" className="text-[10px]">NAV</Badge>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium">{wp.ref}</div>
                <div className="text-xs text-muted-foreground truncate">{wp.name}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => moveUp(index)} title="Up">
                <span>▲</span>
              </Button>
              <Button size="icon" variant="ghost" onClick={() => moveDown(index)} title="Down">
                {ArrowDown && <ArrowDown className="w-4 h-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => removeWaypoint(wp.id)} title="Remove">
                {X && <X className="w-4 h-4" />}
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return RouteBuilder;
}
