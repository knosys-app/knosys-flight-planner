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
  const { ArrowDown, X, Plus, Wand2 } = lucideIcons as Record<string, any>;

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

  /**
   * Rebuild the legs list when waypoints change. Preserves each leg's
   * previously chosen altFt + altAutoPicked flag keyed by (fromId, toId)
   * so editing a waypoint list doesn't clobber user altitude choices.
   */
  function rebuildLegs(
    prev: Plan['legs'],
    waypoints: Waypoint[],
    defaultAlt: number,
  ): Plan['legs'] {
    const prevByKey = new Map(prev.map((l) => [`${l.fromId}:${l.toId}`, l]));
    const legs: Plan['legs'] = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const fromId = waypoints[i].id;
      const toId = waypoints[i + 1].id;
      const existing = prevByKey.get(`${fromId}:${toId}`);
      if (existing) {
        legs.push({ ...existing, fromId, toId });
      } else {
        legs.push({
          fromId,
          toId,
          altFt: waypoints[i + 1].altFt ?? defaultAlt,
          altAutoPicked: true,
        });
      }
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

    const updateWaypoints = (waypoints: Waypoint[]) => {
      const legs = rebuildLegs(plan.legs, waypoints, defaultCruiseAltFt);
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

    const updateLegAlt = (index: number, altFt: number) => {
      const next = plan.legs.map((l, i) =>
        i === index ? { ...l, altFt, altAutoPicked: false } : l,
      );
      onChange({ ...plan, legs: next });
    };

    const resetLegToAuto = (index: number) => {
      const next = plan.legs.map((l, i) =>
        i === index ? { ...l, altAutoPicked: true } : l,
      );
      onChange({ ...plan, legs: next });
    };

    const addSelection = (sel: AirportSearchSelection) => {
      if (sel.kind === 'airport' && sel.airport) {
        updateWaypoints([
          ...plan.waypoints,
          waypointFromAirport(sel.airport, defaultCruiseAltFt),
        ]);
      } else if (sel.kind === 'navaid' && sel.navaid) {
        updateWaypoints([
          ...plan.waypoints,
          waypointFromNavaid(sel.navaid, defaultCruiseAltFt),
        ]);
      }
    };

    const removeWaypoint = (id: string) => {
      updateWaypoints(plan.waypoints.filter((w) => w.id !== id));
    };

    const moveUp = (index: number) => {
      if (index === 0) return;
      const next = [...plan.waypoints];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      updateWaypoints(next);
    };

    const moveDown = (index: number) => {
      if (index === plan.waypoints.length - 1) return;
      const next = [...plan.waypoints];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      updateWaypoints(next);
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
          updateWaypoints([...plan.waypoints, ...found]);
          setRouteText('');
        }
      } finally {
        setImporting(false);
      }
    };

    const waypointById = new Map(plan.waypoints.map((w) => [w.id, w]));

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

        {plan.legs.length > 0 && (
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Leg altitudes
            </Label>
            <div className="space-y-1">
              {plan.legs.map((leg, i) => {
                const from = waypointById.get(leg.fromId);
                const to = waypointById.get(leg.toId);
                return (
                  <div
                    key={`${leg.fromId}:${leg.toId}:${i}`}
                    className="flex items-center gap-2 text-xs border rounded px-2 py-1"
                  >
                    <span className="font-medium whitespace-nowrap">
                      {from?.ref ?? '?'} → {to?.ref ?? '?'}
                    </span>
                    <div className="flex-1" />
                    <Input
                      type="number"
                      className="w-24 h-7 text-right"
                      value={leg.altFt}
                      onChange={(e: any) => {
                        const v = Number.parseInt(e.target.value, 10);
                        if (Number.isFinite(v)) updateLegAlt(i, v);
                      }}
                    />
                    <span className="text-muted-foreground">ft</span>
                    {leg.altAutoPicked ? (
                      <Badge variant="secondary" className="text-[10px]">auto</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => resetLegToAuto(i)}
                        title="Reset to terrain-safe auto altitude"
                      >
                        {Wand2 && <Wand2 className="w-3 h-3 mr-1" />}
                        auto
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return RouteBuilder;
}
