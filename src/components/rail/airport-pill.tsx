import type { FC, ReactNode } from 'react';
import type { SharedDependencies } from '../../types';
import type { FlightCategory, MetarObservation } from '../../weather/types';
import {
  fmtAgeLabel,
  fmtAltimeter,
  fmtClouds,
  fmtTempDew,
  fmtVisibility,
  fmtWind,
  fmtZulu,
} from '../../weather/metar-format';
import {
  computeDensityAltitude,
  type DensityAltitudeResult,
} from '../../math/density-altitude';

const CATEGORY_COLOR: Record<FlightCategory, string> = {
  VFR: 'rgb(60 175 90)',
  MVFR: 'rgb(50 140 235)',
  IFR: 'rgb(230 70 60)',
  LIFR: 'rgb(160 70 180)',
  UNKNOWN: 'rgb(140 140 150)',
};

export interface AirportPillProps {
  icao: string;
  metar: MetarObservation;
  /** Field elevation in ft MSL — needed for density altitude. */
  fieldElevFt?: number;
}

export function createAirportPill(Shared: SharedDependencies) {
  const { Popover, PopoverTrigger, PopoverContent } = Shared;

  const AirportPill: FC<AirportPillProps> = ({ icao, metar, fieldElevFt }) => {
    const cat = metar.flightCategory;
    const color = CATEGORY_COLOR[cat];
    const cig =
      metar.ceilingFtAgl != null ? `${metar.ceilingFtAgl.toLocaleString()}'` : null;
    const vis =
      metar.visibilitySm == null
        ? null
        : metar.visibilitySm === Number.POSITIVE_INFINITY
          ? '10+ sm'
          : `${metar.visibilitySm} sm`;
    const detail = [cig, vis].filter(Boolean).join(' · ') || '—';

    // Density altitude lives in the popover only — the compact pill is
    // reserved for glance info (category + ceiling + visibility) so it
    // never overflows a narrow rail card.
    const da = computeDa(metar, fieldElevFt);

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e: any) => e.stopPropagation()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgb(var(--kfp-surface-tint) / 0.85)',
              border: '1px solid rgb(var(--kfp-hairline))',
              fontSize: 11,
              lineHeight: 1.2,
              cursor: 'pointer',
              color: 'inherit',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
              minWidth: 0,
              overflow: 'hidden',
            }}
            title={`${icao} · ${cat} · tap for details`}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: color,
                flex: '0 0 auto',
                boxShadow: `0 0 8px ${color}`,
              }}
            />
            <span style={{ fontWeight: 600 }}>{icao}</span>
            <span
              style={{
                color: 'rgb(var(--kfp-fg-muted))',
                fontFamily: 'var(--kfp-font-mono)',
              }}
            >
              {cat}
            </span>
            <span style={{ color: 'rgb(var(--kfp-fg-muted))' }}>·</span>
            <span
              style={{
                color: 'rgb(var(--kfp-fg))',
                fontFamily: 'var(--kfp-font-mono)',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {detail}
            </span>
            {da && da.deviationFt >= 1500 && (
              <>
                <span style={{ color: 'rgb(var(--kfp-fg-muted))' }}>·</span>
                <span
                  aria-label={`High density altitude, ${da.densityAltFt.toLocaleString()} feet`}
                  title={`Density altitude ${da.densityAltFt.toLocaleString()} ft (${da.deviationFt >= 0 ? '+' : '−'}${Math.abs(da.deviationFt).toLocaleString()} vs field)`}
                  style={{
                    color: 'rgb(var(--kfp-warn))',
                    fontFamily: 'var(--kfp-font-mono)',
                    fontWeight: 600,
                  }}
                >
                  ⚠ DA
                </span>
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          onClick={(e: any) => e.stopPropagation()}
          className="kfp-scope"
          style={{ width: 340, padding: 0, borderRadius: 14 }}
        >
          <MetarDetail icao={icao} metar={metar} da={da} fieldElevFt={fieldElevFt} />
        </PopoverContent>
      </Popover>
    );
  };

  return AirportPill;
}

function computeDa(
  metar: MetarObservation,
  fieldElevFt: number | undefined,
): DensityAltitudeResult | null {
  if (
    fieldElevFt == null ||
    metar.tempC == null ||
    metar.altimeterInHg == null ||
    !Number.isFinite(fieldElevFt) ||
    !Number.isFinite(metar.tempC) ||
    !Number.isFinite(metar.altimeterInHg)
  ) {
    return null;
  }
  return computeDensityAltitude({
    fieldElevFt,
    tempC: metar.tempC,
    altimeterInHg: metar.altimeterInHg,
  });
}

const MetarDetail: FC<{
  icao: string;
  metar: MetarObservation;
  da: DensityAltitudeResult | null;
  fieldElevFt?: number;
}> = ({ icao, metar, da, fieldElevFt }) => (
  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: CATEGORY_COLOR[metar.flightCategory],
          boxShadow: `0 0 10px ${CATEGORY_COLOR[metar.flightCategory]}`,
        }}
      />
      <span
        style={{
          fontFamily: 'var(--kfp-font-display)',
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '-0.01em',
        }}
      >
        {icao}
      </span>
      <span
        style={{
          fontFamily: 'var(--kfp-font-mono)',
          fontSize: 12,
          color: 'rgb(var(--kfp-fg-muted))',
        }}
      >
        {metar.flightCategory}
      </span>
      <span
        style={{
          marginLeft: 'auto',
          fontSize: 11,
          color: 'rgb(var(--kfp-fg-muted))',
          fontFamily: 'var(--kfp-font-mono)',
        }}
        title={metar.observedAtIso}
      >
        {fmtZulu(metar.observedAtIso)} · {fmtAgeLabel(metar.observedAtIso)}
      </span>
    </div>

    <div
      style={{
        borderTop: '1px solid rgb(var(--kfp-hairline))',
        paddingTop: 10,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '6px 12px',
        fontSize: 12,
        lineHeight: 1.35,
      }}
    >
      <Label>Wind</Label>
      <Value mono>{fmtWind(metar)}</Value>

      <Label>Visibility</Label>
      <Value mono>{fmtVisibility(metar)}</Value>

      <Label>Clouds</Label>
      <Value>{fmtClouds(metar)}</Value>

      <Label>Ceiling</Label>
      <Value mono>
        {metar.ceilingFtAgl != null
          ? `${metar.ceilingFtAgl.toLocaleString()} ft AGL`
          : '—'}
      </Value>

      <Label>Altimeter</Label>
      <Value mono>{fmtAltimeter(metar)}</Value>

      <Label>Temp / Dew</Label>
      <Value mono>{fmtTempDew(metar)}</Value>

      {metar.wxString && (
        <>
          <Label>Weather</Label>
          <Value mono>{metar.wxString}</Value>
        </>
      )}

      {fieldElevFt != null && (
        <>
          <Label>Field elev</Label>
          <Value mono>{fieldElevFt.toLocaleString()} ft MSL</Value>
        </>
      )}

      {da && (
        <>
          <Label>Pressure alt</Label>
          <Value mono>{da.pressureAltFt.toLocaleString()} ft</Value>

          <Label>Density alt</Label>
          <Value mono>
            <span
              style={{
                color:
                  da.deviationFt >= 1500
                    ? 'rgb(var(--kfp-warn))'
                    : 'rgb(var(--kfp-fg))',
              }}
            >
              {da.densityAltFt.toLocaleString()} ft
            </span>
            <span style={{ color: 'rgb(var(--kfp-fg-muted))' }}>
              {' '}
              ({da.deviationFt >= 0 ? '+' : '−'}
              {Math.abs(da.deviationFt).toLocaleString()} vs field)
            </span>
          </Value>
        </>
      )}
    </div>

    {metar.rawText && (
      <div
        style={{
          marginTop: 4,
          padding: '8px 10px',
          borderRadius: 8,
          background: 'rgb(var(--kfp-fg) / 0.05)',
          fontFamily: 'var(--kfp-font-mono)',
          fontSize: 11,
          color: 'rgb(var(--kfp-fg))',
          wordBreak: 'break-word',
          lineHeight: 1.35,
        }}
      >
        {metar.rawText}
      </div>
    )}
  </div>
);

const Label: FC<{ children: ReactNode }> = ({ children }) => (
  <div
    style={{
      color: 'rgb(var(--kfp-fg-muted))',
      fontSize: 11,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      fontWeight: 500,
      alignSelf: 'center',
    }}
  >
    {children}
  </div>
);

const Value: FC<{ children: ReactNode; mono?: boolean }> = ({
  children,
  mono,
}) => (
  <div
    style={{
      color: 'rgb(var(--kfp-fg))',
      fontFamily: mono ? 'var(--kfp-font-mono)' : 'var(--kfp-font-text)',
      fontVariantNumeric: mono ? 'tabular-nums' : undefined,
    }}
  >
    {children}
  </div>
);
