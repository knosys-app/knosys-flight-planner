import type { FC } from 'react';
import type {
  BlockTotals,
  NavlogRow,
  SharedDependencies,
} from '../../types';

export interface BriefingCardProps {
  totals: BlockTotals;
  rows: NavlogRow[];
  anyAutoPicked: boolean;
  loading?: boolean;
  onOpenBlock: () => void;
}

function fmtHM(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export function createBriefingCard(Shared: SharedDependencies) {
  const { lucideIcons } = Shared;
  const { Plane, Fuel, AlertTriangle, Wand2 } = lucideIcons as Record<string, any>;

  const BriefingCard: FC<BriefingCardProps> = ({
    totals,
    rows,
    anyAutoPicked,
    loading,
    onOpenBlock,
  }) => {
    const lastRow = rows[rows.length - 1];
    const reserveOk = rows.length === 0 || lastRow?.reserveOk !== false;
    const warningCount = rows.reduce((n, r) => n + (r.warnings?.length ?? 0), 0);
    const hasRoute = rows.length > 0;

    return (
      <button
        type="button"
        className="kfp-briefing"
        onClick={onOpenBlock}
        aria-label="Open block time details"
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          font: 'inherit',
          color: 'inherit',
        }}
      >
        <div className="kfp-briefing-eyebrow">
          {Plane && <Plane className="w-3 h-3" />}
          Today's flight
          {loading && (
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 400 }}>
              calculating…
            </span>
          )}
        </div>

        <div className="kfp-briefing-headline">
          {hasRoute ? fmtHM(totals.blockMin) : '—'}
        </div>

        <div className="kfp-briefing-sub">
          {hasRoute
            ? `${totals.blockFuelGal.toFixed(1)} gal · ${totals.blockDistanceNm.toFixed(0)} nm`
            : 'Add waypoints to begin'}
        </div>

        <div className="kfp-briefing-chips">
          {!reserveOk && (
            <span className="kfp-chip kfp-chip-danger">
              {Fuel && <Fuel className="w-3 h-3" />}
              Below reserve
            </span>
          )}
          {warningCount > 0 && (
            <span className="kfp-chip kfp-chip-warn">
              {AlertTriangle && <AlertTriangle className="w-3 h-3" />}
              {warningCount} warning{warningCount === 1 ? '' : 's'}
            </span>
          )}
          {anyAutoPicked && (
            <span className="kfp-chip">
              {Wand2 && <Wand2 className="w-3 h-3" />}
              Auto altitudes
            </span>
          )}
          {hasRoute && reserveOk && warningCount === 0 && !anyAutoPicked && (
            <span className="kfp-chip">Clear</span>
          )}
        </div>
      </button>
    );
  };

  return BriefingCard;
}
