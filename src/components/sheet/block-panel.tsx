import type { FC } from 'react';
import type {
  BlockTotals,
  NavlogRow,
  NavlogWarning,
  SharedDependencies,
} from '../../types';

export interface BlockPanelProps {
  totals: BlockTotals;
  rows: NavlogRow[];
  loading?: boolean;
  error?: string | null;
  anyAutoPicked: boolean;
}

function fmtHM(min: number): string {
  if (!Number.isFinite(min) || min < 0) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function fmtGal(g: number): string {
  return Number.isFinite(g) ? `${g.toFixed(1)} gal` : '—';
}

export function createBlockPanel(Shared: SharedDependencies) {
  const { lucideIcons } = Shared;
  const { AlertTriangle, Wand2 } = lucideIcons as Record<string, any>;

  const BlockPanel: FC<BlockPanelProps> = ({
    totals,
    rows,
    loading,
    error,
    anyAutoPicked,
  }) => {
    const warnings = collectWarnings(rows);
    const reserveOk = rows.length === 0 || rows[rows.length - 1]?.reserveOk !== false;
    const hasRoute = rows.length > 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <header>
          <div className="kfp-label-caps" style={{ display: 'flex', gap: 6 }}>
            Block time
            {loading && (
              <span style={{ color: 'rgb(var(--kfp-fg-faint))', fontWeight: 400 }}>
                · calculating…
              </span>
            )}
          </div>
          <div
            className="kfp-display"
            style={{
              fontSize: 56,
              fontWeight: 600,
              letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              marginTop: 6,
            }}
          >
            {hasRoute ? fmtHM(totals.blockMin) : '—'}
          </div>
          <div
            className="kfp-mono"
            style={{ color: 'rgb(var(--kfp-fg-muted))', fontSize: 13, marginTop: 6 }}
          >
            {hasRoute
              ? `${fmtGal(totals.blockFuelGal)} · ${totals.blockDistanceNm.toFixed(0)} nm`
              : 'Add waypoints to compute'}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {anyAutoPicked && (
              <span className="kfp-chip">
                {Wand2 && <Wand2 className="w-3 h-3" />}
                Auto altitudes
              </span>
            )}
            {!reserveOk && hasRoute && (
              <span className="kfp-chip kfp-chip-danger">Below reserve</span>
            )}
          </div>
        </header>

        {hasRoute && (
          <section>
            <div className="kfp-label-caps" style={{ marginBottom: 4 }}>Breakdown</div>
            <div className="kfp-mono" style={{ fontSize: 13 }}>
              <MetricRow label="Taxi" minutes={totals.taxiMin} fuelGal={totals.taxiFuelGal} />
              <MetricRow label="Climb" minutes={totals.climbMin} fuelGal={totals.climbFuelGal} />
              <MetricRow label="Cruise" minutes={totals.cruiseMin} fuelGal={totals.cruiseFuelGal} />
              <MetricRow label="Descent" minutes={totals.descentMin} fuelGal={totals.descentFuelGal} />
              <MetricRow label="Pattern" minutes={totals.patternMin} fuelGal={totals.patternFuelGal} />
            </div>
          </section>
        )}

        {warnings.length > 0 && (
          <section>
            <div className="kfp-label-caps" style={{ marginBottom: 6 }}>Advisories</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {warnings.map((w, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'rgb(var(--kfp-warn) / 0.10)',
                    color: 'rgb(var(--kfp-warn))',
                    fontSize: 13,
                  }}
                >
                  {AlertTriangle && (
                    <AlertTriangle className="w-4 h-4" style={{ flexShrink: 0, marginTop: 1 }} />
                  )}
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {error && (
          <div
            style={{
              fontSize: 12,
              color: 'rgb(var(--kfp-danger))',
              padding: '8px 10px',
              borderRadius: 8,
              background: 'rgb(var(--kfp-danger) / 0.08)',
            }}
          >
            Profile error: {error}
          </div>
        )}
      </div>
    );
  };

  return BlockPanel;
}

const MetricRow: FC<{ label: string; minutes: number; fuelGal: number }> = ({
  label,
  minutes,
  fuelGal,
}) => (
  <div className="kfp-metric-row">
    <span className="kfp-metric-row-label">{label}</span>
    <span className="kfp-metric-row-value">
      {fmtHM(minutes)} <span style={{ color: 'rgb(var(--kfp-fg-faint))' }}>·</span>{' '}
      {fuelGal.toFixed(1)} gal
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
