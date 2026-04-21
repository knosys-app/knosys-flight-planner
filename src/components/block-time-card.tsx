import type { FC } from 'react';
import type {
  BlockTotals,
  NavlogRow,
  NavlogWarning,
  SharedDependencies,
} from '../types';

export interface BlockTimeCardProps {
  totals: BlockTotals;
  rows: NavlogRow[];
  loading?: boolean;
  error?: string | null;
  onShowProfile: () => void;
  /** True when terrain-aware altitude selection adjusted at least one leg. */
  anyAutoPicked: boolean;
}

function fmtHM(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function fmtGal(g: number): string {
  if (!Number.isFinite(g)) return '—';
  return `${g.toFixed(1)} gal`;
}

function fmtNm(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(0)} nm`;
}

export function createBlockTimeCard(Shared: SharedDependencies) {
  const { Button, Badge, lucideIcons } = Shared;
  const { Activity, AlertTriangle } = lucideIcons as Record<string, any>;

  const BlockTimeCard: FC<BlockTimeCardProps> = ({
    totals,
    rows,
    loading,
    error,
    onShowProfile,
    anyAutoPicked,
  }) => {
    const warnings = collectWarnings(rows);
    const reserveOk = rows.length === 0 || rows[rows.length - 1]?.reserveOk !== false;

    return (
      <div className="border rounded-md p-3 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Activity && <Activity className="w-4 h-4 text-muted-foreground" />}
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Block time
            </span>
          </div>
          {loading && (
            <span className="text-muted-foreground" style={{ fontSize: 10 }}>calculating…</span>
          )}
        </div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">
          {fmtHM(totals.blockMin)}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {fmtGal(totals.blockFuelGal)} · {fmtNm(totals.blockDistanceNm)}
          {!reserveOk && (
            <span className="ml-2 text-red-600 font-medium">· below reserve</span>
          )}
        </div>

        <div className="mt-3">
          <Button size="sm" variant="outline" className="w-full" onClick={onShowProfile}>
            Show profile
          </Button>
        </div>

        <div className="mt-3 border-t pt-2 space-y-0.5 text-xs">
          <BreakdownRow label="Taxi" minutes={totals.taxiMin} fuelGal={totals.taxiFuelGal} />
          <BreakdownRow label="Climb" minutes={totals.climbMin} fuelGal={totals.climbFuelGal} />
          <BreakdownRow label="Cruise" minutes={totals.cruiseMin} fuelGal={totals.cruiseFuelGal} />
          <BreakdownRow label="Descent" minutes={totals.descentMin} fuelGal={totals.descentFuelGal} />
          <BreakdownRow label="Pattern" minutes={totals.patternMin} fuelGal={totals.patternFuelGal} />
        </div>

        {anyAutoPicked && (
          <div className="mt-2">
            <Badge variant="secondary" style={{ fontSize: 10 }}>auto altitudes applied</Badge>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mt-3 border-t pt-2 space-y-1">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1 text-xs text-red-700">
                {AlertTriangle && <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />}
                <span>{w.message}</span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-2 text-xs text-red-700">Profile error: {error}</div>
        )}
      </div>
    );
  };

  return BlockTimeCard;
}

const BreakdownRow: FC<{ label: string; minutes: number; fuelGal: number }> = ({
  label,
  minutes,
  fuelGal,
}) => (
  <div className="flex justify-between">
    <span className="text-muted-foreground">{label}</span>
    <span>
      {fmtHM(minutes)} · {fuelGal.toFixed(1)} gal
    </span>
  </div>
);

function collectWarnings(rows: NavlogRow[]): NavlogWarning[] {
  const seen = new Set<string>();
  const out: NavlogWarning[] = [];
  for (const r of rows) {
    for (const w of r.warnings ?? []) {
      const key = `${r.legIndex}:${w.kind}:${w.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ ...w, message: `Leg ${r.legIndex + 1}: ${w.message}` });
      }
    }
  }
  return out;
}
