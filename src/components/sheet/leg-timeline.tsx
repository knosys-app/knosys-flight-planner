import type { CSSProperties, FC, PointerEvent as ReactPointerEvent } from 'react';
import type {
  NavlogRow,
  Plan,
  SharedDependencies,
  WindsEntryRow,
} from '../../types';

export interface LegTimelineProps {
  plan: Plan | null;
  rows: NavlogRow[];
  /** Winds used for navlog computation — shown on each chip when available. */
  winds: WindsEntryRow[];
  /**
   * Current scrub position along the route, measured in nautical miles from
   * the first waypoint. `null` means "not scrubbing"; timeline shows its
   * default summary state.
   */
  scrubAlongNm: number | null;
  onScrubChange: (along: number | null) => void;
}

function nearestWind(winds: WindsEntryRow[], altFt: number): WindsEntryRow | null {
  if (winds.length === 0) return null;
  return winds.reduce((best, w) =>
    Math.abs(w.altFt - altFt) < Math.abs(best.altFt - altFt) ? w : best,
  );
}

interface LegChipSpan {
  index: number;
  startNm: number;
  endNm: number;
  row: NavlogRow;
}

function buildSpans(rows: NavlogRow[]): LegChipSpan[] {
  const out: LegChipSpan[] = [];
  let along = 0;
  rows.forEach((r, i) => {
    const start = along;
    const end = along + r.distanceNm;
    out.push({ index: i, startNm: start, endNm: end, row: r });
    along = end;
  });
  return out;
}

function fmtEte(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  const m = Math.round(minutes);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m - h * 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

function fmtWind(dirDeg: number | undefined, kt: number | undefined): string | null {
  if (!Number.isFinite(dirDeg) || !Number.isFinite(kt)) return null;
  if ((kt ?? 0) < 1) return 'calm';
  const d = Math.round((dirDeg ?? 0) % 360).toString().padStart(3, '0');
  return `${d}°/${Math.round(kt ?? 0)}`;
}

function legWarningTone(row: NavlogRow): 'danger' | 'warn' | null {
  if (row.reserveOk === false) return 'danger';
  if (row.warnings?.some((w) => w.kind === 'terrainPierces')) return 'danger';
  if (row.warnings && row.warnings.length > 0) return 'warn';
  return null;
}

/**
 * Scrubbable horizontal leg strip — the v0.7 hero. Chips sized by ETE so
 * the visual rhythm reflects actual flight time, not equal widths.
 * Pointer-scrubbing on the strip emits `alongTrackNm` for synchronized
 * cursors on the profile ribbon + map.
 */
export function createLegTimeline(_Shared: SharedDependencies) {
  const LegTimeline: FC<LegTimelineProps> = ({
    plan,
    rows,
    winds,
    scrubAlongNm,
    onScrubChange,
  }) => {
    if (!plan || rows.length === 0) {
      return (
        <div
          className="kfp-timeline-empty"
          style={{
            padding: 24,
            textAlign: 'center',
            fontFamily: 'var(--kfp-font-display)',
            color: 'rgb(var(--kfp-fg-muted))',
            fontSize: 15,
          }}
        >
          Add waypoints to see your flight timeline.
        </div>
      );
    }

    const spans = buildSpans(rows);
    const totalNm = spans[spans.length - 1]?.endNm ?? 0;
    const totalMin = rows.reduce((s, r) => s + (r.eteMinutes || 0), 0);
    const activeSpan = scrubAlongNm != null
      ? spans.find((s) => scrubAlongNm >= s.startNm && scrubAlongNm <= s.endNm) ?? spans[spans.length - 1]
      : null;

    const progressPct =
      scrubAlongNm != null && totalNm > 0
        ? Math.max(0, Math.min(100, (scrubAlongNm / totalNm) * 100))
        : null;

    const scrubFromClientX = (clientX: number, el: HTMLElement) => {
      if (totalNm <= 0) return;
      const rect = el.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onScrubChange(t * totalNm);
    };

    const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      scrubFromClientX(e.clientX, e.currentTarget);
    };
    const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.buttons === 0) return;
      scrubFromClientX(e.clientX, e.currentTarget);
    };
    const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    // Summary row: total ETE + distance, active leg detail when scrubbing.
    const summaryLine = (() => {
      if (activeSpan) {
        const r = activeSpan.row;
        const legNm = r.distanceNm;
        const w = nearestWind(winds, r.altFt);
        const wind = w ? fmtWind(w.dirTrueDeg, w.speedKt) : null;
        return {
          headline: `Leg ${activeSpan.index + 1} · ${r.fromRef} → ${r.toRef}`,
          detail: `${fmtEte(r.eteMinutes)} · ${Math.round(legNm)} nm · FL${String(
            Math.round(r.altFt / 100),
          ).padStart(3, '0')}${wind ? ` · ${wind}` : ''}`,
        };
      }
      return {
        headline: `${rows.length} leg${rows.length === 1 ? '' : 's'} · ${plan.departureIcao} → ${plan.destinationIcao}`,
        detail: `${fmtEte(totalMin)} total · ${Math.round(totalNm)} nm`,
      };
    })();

    return (
      <div
        className="kfp-timeline"
        onMouseLeave={() => onScrubChange(null)}
      >
        <div className="kfp-timeline-summary">
          <div className="kfp-timeline-summary-head">{summaryLine.headline}</div>
          <div className="kfp-timeline-summary-sub">{summaryLine.detail}</div>
        </div>

        <div
          className="kfp-timeline-strip"
          role="slider"
          aria-label="Scrub flight progress"
          aria-valuemin={0}
          aria-valuemax={Math.round(totalNm)}
          aria-valuenow={scrubAlongNm != null ? Math.round(scrubAlongNm) : 0}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onKeyDown={(e) => {
            const step = Math.max(1, totalNm / 40);
            const cur = scrubAlongNm ?? 0;
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              onScrubChange(Math.min(totalNm, cur + step));
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              onScrubChange(Math.max(0, cur - step));
            } else if (e.key === 'Home') {
              e.preventDefault();
              onScrubChange(0);
            } else if (e.key === 'End') {
              e.preventDefault();
              onScrubChange(totalNm);
            } else if (e.key === 'Escape') {
              onScrubChange(null);
            }
          }}
        >
          {spans.map((s) => {
            const ete = Math.max(0.001, s.row.eteMinutes);
            const flexBasis = `${(ete / Math.max(totalMin, 0.001)) * 100}%`;
            const tone = legWarningTone(s.row);
            const isActive = activeSpan?.index === s.index;
            const chipStyle: CSSProperties = {
              flexBasis,
              flexGrow: 0,
              flexShrink: 0,
            };
            return (
              <div
                key={s.index}
                className="kfp-timeline-chip"
                data-tone={tone ?? 'none'}
                data-active={isActive ? 'true' : 'false'}
                style={chipStyle}
                title={`Leg ${s.index + 1}: ${s.row.fromRef} → ${s.row.toRef}`}
              >
                <div className="kfp-timeline-chip-top">
                  <span className="kfp-timeline-chip-index">
                    {String(s.index + 1).padStart(2, '0')}
                  </span>
                  <span className="kfp-timeline-chip-ref">
                    {s.row.fromRef}
                    <span className="kfp-timeline-chip-arrow" aria-hidden>
                      →
                    </span>
                    {s.row.toRef}
                  </span>
                </div>
                <div className="kfp-timeline-chip-bot">
                  <span>{fmtEte(s.row.eteMinutes)}</span>
                  <span>·</span>
                  <span>{Math.round(s.row.distanceNm)} nm</span>
                  {(() => {
                    const w = nearestWind(winds, s.row.altFt);
                    const text = w ? fmtWind(w.dirTrueDeg, w.speedKt) : null;
                    return text ? (
                      <>
                        <span>·</span>
                        <span>{text}</span>
                      </>
                    ) : null;
                  })()}
                </div>
              </div>
            );
          })}

          {progressPct != null && (
            <div
              className="kfp-timeline-cursor"
              style={{ left: `${progressPct}%` }}
              aria-hidden
            />
          )}
        </div>

        <div className="kfp-timeline-axis" aria-hidden>
          <span>0</span>
          <span>{Math.round(totalNm / 2)} nm</span>
          <span>{Math.round(totalNm)} nm</span>
        </div>
      </div>
    );
  };

  return LegTimeline;
}
