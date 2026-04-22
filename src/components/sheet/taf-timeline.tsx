import type { FC } from 'react';
import type { SharedDependencies } from '../../types';
import type {
  FlightCategory,
  TafForecast,
  TafForecastPeriod,
} from '../../weather/types';
import {
  fmtAgeLabel,
  fmtClouds,
  fmtVisibility,
  fmtWind,
  fmtZulu,
} from '../../weather/metar-format';

const CATEGORY_COLOR: Record<FlightCategory, string> = {
  VFR: 'rgb(60 175 90)',
  MVFR: 'rgb(50 140 235)',
  IFR: 'rgb(230 70 60)',
  LIFR: 'rgb(160 70 180)',
  UNKNOWN: 'rgb(140 140 150)',
};

const CHANGE_LABEL: Record<TafForecastPeriod['change'], string> = {
  BASE: 'Base',
  FM: 'From',
  BECMG: 'Becoming',
  TEMPO: 'Temporarily',
  PROB: 'Prob',
};

export interface TafTimelineProps {
  taf: TafForecast | null;
  loading?: boolean;
  error?: string | null;
  /** Optional ICAO displayed in the section header when no TAF is loaded yet. */
  icao?: string;
}

export function createTafTimeline(_Shared: SharedDependencies) {
  const TafTimeline: FC<TafTimelineProps> = ({ taf, loading, error, icao }) => {
    if (!taf && !loading && !error) {
      return (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgb(var(--kfp-fg) / 0.04)',
            fontSize: 12,
            color: 'rgb(var(--kfp-fg-muted))',
            lineHeight: 1.5,
          }}
        >
          {icao ? `${icao} does not publish a TAF.` : 'No TAF available.'}
          <br />
          Smaller airports without forecast service aren't TAF stations — check a
          nearby larger airport for forecast conditions.
        </div>
      );
    }

    if (loading && !taf) {
      return (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgb(var(--kfp-fg) / 0.04)',
            fontSize: 12,
            color: 'rgb(var(--kfp-fg-muted))',
          }}
        >
          Loading forecast{icao ? ` for ${icao}` : ''}…
        </div>
      );
    }

    if (!taf) {
      return (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgb(var(--kfp-danger) / 0.1)',
            color: 'rgb(var(--kfp-danger))',
            fontSize: 12,
          }}
        >
          Forecast unavailable{icao ? ` for ${icao}` : ''}. {error ?? ''}
        </div>
      );
    }

    const windowFrom = new Date(taf.validFromIso).getTime();
    const windowTo = new Date(taf.validToIso).getTime();
    const totalMs = Math.max(1, windowTo - windowFrom);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              className="kfp-display"
              style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}
            >
              {taf.icao}
            </span>
            <span
              className="kfp-mono"
              style={{ fontSize: 11, color: 'rgb(var(--kfp-fg-muted))' }}
            >
              {fmtZulu(taf.validFromIso)} → {fmtZulu(taf.validToIso)}
            </span>
          </div>
          <span
            className="kfp-mono"
            style={{ fontSize: 11, color: 'rgb(var(--kfp-fg-muted))' }}
            title={taf.issuedAtIso}
          >
            Issued {fmtAgeLabel(taf.issuedAtIso)}
          </span>
        </header>

        {/* Ribbon — stacked horizontal periods sized by duration. Wraps to
         * multiple rows on narrow screens. */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'stretch',
          }}
        >
          {taf.periods.map((p, i) => {
            const start = new Date(p.startIso).getTime();
            const end = new Date(p.endIso).getTime();
            const share = Math.max(0.1, (end - start) / totalMs);
            // Grow proportionally but cap growth so short periods remain
            // readable. Basis 0 + grow N works inside a flex row.
            return (
              <PeriodChip
                key={`${p.startIso}-${i}`}
                period={p}
                flexGrow={share}
              />
            );
          })}
        </div>

        {taf.rawText && (
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              background: 'rgb(var(--kfp-fg) / 0.05)',
              fontFamily: 'var(--kfp-font-mono)',
              fontSize: 11,
              color: 'rgb(var(--kfp-fg))',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.35,
            }}
          >
            {taf.rawText}
          </div>
        )}
      </div>
    );
  };

  return TafTimeline;
}

const PeriodChip: FC<{ period: TafForecastPeriod; flexGrow: number }> = ({
  period,
  flexGrow,
}) => {
  const color = CATEGORY_COLOR[period.flightCategory];
  const label =
    period.change === 'PROB' && period.probability
      ? `Prob ${period.probability}%`
      : CHANGE_LABEL[period.change];

  return (
    <div
      style={{
        flex: `${Math.max(0.3, flexGrow)} 1 160px`,
        minWidth: 140,
        padding: '8px 10px',
        borderRadius: 10,
        background: 'rgb(var(--kfp-surface-tint) / 0.72)',
        border: '1px solid rgb(var(--kfp-hairline))',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 6px ${color}`,
            flex: '0 0 auto',
          }}
        />
        <span
          style={{
            fontSize: 10,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            fontWeight: 600,
            color: 'rgb(var(--kfp-fg-muted))',
          }}
        >
          {label}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: 'var(--kfp-font-mono)',
            fontSize: 10,
            color: 'rgb(var(--kfp-fg-muted))',
          }}
        >
          {fmtZulu(period.startIso)}
        </span>
      </div>

      <div
        style={{
          fontFamily: 'var(--kfp-font-mono)',
          fontSize: 11,
          color: 'rgb(var(--kfp-fg))',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <div>{fmtWind(period)}</div>
        <div>{fmtVisibility(period)}</div>
        <div style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
          {fmtClouds(period)}
        </div>
        {period.wxString && (
          <div style={{ color: 'rgb(var(--kfp-warn))' }}>{period.wxString}</div>
        )}
      </div>
    </div>
  );
};
