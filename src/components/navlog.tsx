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
  const { Badge } = Shared;

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
              <th className="px-2 py-1 text-right">Dist</th>
              <th className="px-2 py-1 text-right">TC</th>
              <th className="px-2 py-1 text-right">WCA</th>
              <th className="px-2 py-1 text-right">TH</th>
              <th className="px-2 py-1 text-right">Var</th>
              <th className="px-2 py-1 text-right">MH</th>
              <th className="px-2 py-1 text-right">Freq</th>
              <th className="px-2 py-1 text-right">GS</th>
              <th className="px-2 py-1 text-right">ETE</th>
              <th className="px-2 py-1 text-right">Fuel</th>
              <th className="px-2 py-1 text-right">Remain</th>
              <th className="px-2 py-1 text-right">Res</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.legIndex} className="border-t">
                <td className="px-2 py-1">{r.legIndex + 1}</td>
                <td className="px-2 py-1 whitespace-nowrap">
                  <span className="font-medium">{r.fromRef}</span>
                  <span className="text-muted-foreground mx-1">→</span>
                  <span className="font-medium">{r.toRef}</span>
                </td>
                <td className="px-2 py-1 text-right">{round(r.distanceNm, 1)}</td>
                <td className="px-2 py-1 text-right">{deg(r.trueCourseDeg)}</td>
                <td className="px-2 py-1 text-right">{round(r.windCorrectionAngleDeg, 0)}</td>
                <td className="px-2 py-1 text-right">{deg(r.trueHeadingDeg)}</td>
                <td className="px-2 py-1 text-right">{round(r.magVarDeg, 1)}</td>
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
                <td className="px-2 py-1 text-right">{round(r.fuelRemainingGal, 1)}</td>
                <td className="px-2 py-1 text-right">
                  <Badge variant={r.reserveOk ? 'secondary' : 'destructive'}>
                    {r.reserveOk ? 'OK' : 'LOW'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return Navlog;
}
