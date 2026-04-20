import type { FC } from 'react';
import type { NavlogRow, SharedDependencies } from '../types';

function round(n: number, digits: number): string {
  if (!Number.isFinite(n)) return '—';
  const f = Math.pow(10, digits);
  return (Math.round(n * f) / f).toFixed(digits);
}

function deg(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const v = ((Math.round(n) % 360) + 360) % 360;
  return v.toString().padStart(3, '0');
}

export function createNavlog(Shared: SharedDependencies) {
  const { Badge, React } = Shared;

  const Navlog: FC<{ rows: NavlogRow[] }> = ({ rows }) => {
    if (rows.length === 0) {
      return (
        <div className="border rounded p-3 text-sm text-muted-foreground">
          Add two or more waypoints to see the navlog.
        </div>
      );
    }
    return (
      <div className="border rounded overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              <th className="px-2 py-1 text-left">#</th>
              <th className="px-2 py-1 text-left">Leg</th>
              <th className="px-2 py-1 text-right">Alt</th>
              <th className="px-2 py-1 text-right">Dist</th>
              <th className="px-2 py-1 text-right">MH</th>
              <th className="px-2 py-1 text-right">Freq</th>
              <th className="px-2 py-1 text-right">GS</th>
              <th className="px-2 py-1 text-right">ETE</th>
              <th className="px-2 py-1 text-right">Fuel</th>
              <th className="px-2 py-1 text-right">Res</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const hasWarn = (r.warnings ?? []).length > 0;
              return (
                <React.Fragment key={r.legIndex}>
                  <tr
                    className={`border-t ${hasWarn ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-2 py-1">{r.legIndex + 1}</td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span className="font-medium">{r.fromRef}</span>
                      <span className="text-muted-foreground mx-1">→</span>
                      <span className="font-medium">{r.toRef}</span>
                    </td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">
                      {r.altFt.toLocaleString()}
                      {r.altAutoPicked && (
                        <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0">auto</Badge>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right">{round(r.distanceNm, 1)}</td>
                    <td className="px-2 py-1 text-right font-medium">{deg(r.magneticHeadingDeg)}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">
                      {r.primaryFreq ? (
                        <span title={r.primaryFreq.type}>
                          {r.primaryFreq.mhz.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right">{round(r.groundSpeedKt, 0)}</td>
                    <td className="px-2 py-1 text-right">{round(r.eteMinutes, 0)}</td>
                    <td className="px-2 py-1 text-right">{round(r.fuelBurnedGal, 1)}</td>
                    <td className="px-2 py-1 text-right">
                      <Badge variant={r.reserveOk ? 'secondary' : 'destructive'}>
                        {r.reserveOk ? 'OK' : 'LOW'}
                      </Badge>
                    </td>
                  </tr>
                  {r.phases && (r.phases.climb || r.phases.descent) && (
                    <tr className="border-t bg-muted/30 text-[11px] text-muted-foreground">
                      <td />
                      <td className="px-2 py-0.5" colSpan={9}>
                        {r.phases.climb && (
                          <span>
                            Climb {round(r.phases.climb.timeMin, 0)}m · {r.phases.climb.distanceNm.toFixed(1)} nm · {r.phases.climb.fuelGal.toFixed(1)} gal
                          </span>
                        )}
                        {r.phases.climb && r.phases.cruise && (
                          <span className="mx-2">·</span>
                        )}
                        <span>
                          Cruise {round(r.phases.cruise.timeMin, 0)}m · {r.phases.cruise.distanceNm.toFixed(1)} nm · {r.phases.cruise.fuelGal.toFixed(1)} gal
                        </span>
                        {r.phases.descent && (
                          <>
                            <span className="mx-2">·</span>
                            <span>
                              Descent {round(r.phases.descent.timeMin, 0)}m · {r.phases.descent.distanceNm.toFixed(1)} nm · {r.phases.descent.fuelGal.toFixed(1)} gal
                            </span>
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                  {hasWarn && (
                    <tr className="border-t bg-red-50 text-[11px] text-red-700">
                      <td />
                      <td className="px-2 py-0.5" colSpan={9}>
                        {r.warnings!.map((w, i) => (
                          <div key={i}>⚠ {w.message}</div>
                        ))}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return Navlog;
}
