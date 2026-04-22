import type { CSSProperties, FC } from 'react';
import type {
  BlockTotals,
  NavlogRow,
  Plan,
  SharedDependencies,
} from '../../types';
import type { FlightCategory, MetarObservation } from '../../weather/types';
import { createAirportPill } from './airport-pill';

export interface AlternateEntry {
  icao: string;
  name?: string;
  distanceNm: number;
  elevationFt?: number;
}

export interface BriefingCardProps {
  plan: Plan;
  totals: BlockTotals;
  rows: NavlogRow[];
  anyAutoPicked: boolean;
  loading?: boolean;
  onOpenBlock: () => void;
  onOpenWindsOverride: () => void;
  metars: Record<string, MetarObservation>;
  metarsLoading: boolean;
  metarsError: string | null;
  windsOverrideActive: boolean;
  autoWindsActive: boolean;
  alternates: AlternateEntry[];
  /** ICAO → field elevation in ft MSL. Used for density altitude. */
  airportElevations: Record<string, number>;
}

function fmtHM(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

/** Pick the tone for the atmospheric background. Worst category wins. */
function toneForCategory(cat: FlightCategory | null): string {
  switch (cat) {
    case 'LIFR':
      return 'rgb(var(--kfp-danger))';
    case 'IFR':
      return 'rgb(255 110 70)';
    case 'MVFR':
      return 'rgb(var(--kfp-warn))';
    case 'VFR':
      return 'rgb(100 185 255)';
    default:
      return 'rgb(var(--kfp-accent))';
  }
}

function worst(cats: Array<FlightCategory | null>): FlightCategory | null {
  const order: FlightCategory[] = ['VFR', 'MVFR', 'IFR', 'LIFR'];
  let best = -1;
  for (const c of cats) {
    if (!c || c === 'UNKNOWN') continue;
    const i = order.indexOf(c);
    if (i > best) best = i;
  }
  return best >= 0 ? order[best] : null;
}

function fmtStalenessLabel(isoish: string | undefined): string | null {
  if (!isoish) return null;
  const then = new Date(isoish).getTime();
  if (!Number.isFinite(then)) return null;
  const ageMin = Math.round((Date.now() - then) / 60_000);
  if (ageMin < 90) return null; // under 90 min: treat as current
  if (ageMin < 60 * 24) return `${Math.round(ageMin / 60)}h old`;
  return `${Math.round(ageMin / (60 * 24))}d old`;
}

export function createBriefingCard(Shared: SharedDependencies) {
  const { lucideIcons } = Shared;
  const { Plane, AlertTriangle, Wand2, Wind, CloudOff } = lucideIcons as Record<
    string,
    any
  >;
  const AirportPill = createAirportPill(Shared);

  const BriefingCard: FC<BriefingCardProps> = ({
    plan,
    totals,
    rows,
    anyAutoPicked,
    loading,
    onOpenBlock,
    onOpenWindsOverride,
    metars,
    metarsLoading,
    metarsError,
    windsOverrideActive,
    autoWindsActive,
    alternates,
    airportElevations,
  }) => {
    const lastRow = rows[rows.length - 1];
    const reserveOk = rows.length === 0 || lastRow?.reserveOk !== false;
    const warningCount = rows.reduce((n, r) => n + (r.warnings?.length ?? 0), 0);
    const hasRoute = rows.length > 0;

    const altitudes = rows
      .map((r) => r.altFt)
      .filter((n): n is number => Number.isFinite(n));
    const minAlt = altitudes.length ? Math.min(...altitudes) : 0;
    const maxAlt = altitudes.length ? Math.max(...altitudes) : 0;
    const altText =
      altitudes.length === 0
        ? null
        : minAlt === maxAlt
          ? `${minAlt.toLocaleString()} ft`
          : `${minAlt.toLocaleString()}–${maxAlt.toLocaleString()} ft`;

    const dep = plan.departureIcao;
    const arr = plan.destinationIcao;
    const depMetar = dep ? metars[dep] : undefined;
    const arrMetar = arr ? metars[arr] : undefined;
    const toneCategory = worst([
      depMetar?.flightCategory ?? null,
      arrMetar?.flightCategory ?? null,
    ]);
    const toneColor = toneForCategory(toneCategory);

    const staleness =
      [depMetar, arrMetar]
        .map((m) => fmtStalenessLabel(m?.observedAtIso))
        .find((x) => x != null) ?? null;

    const atmosphere: CSSProperties = {
      backgroundImage: `
        radial-gradient(140% 140% at 0% 0%,
          color-mix(in oklab, ${toneColor} 22%, transparent) 0%,
          color-mix(in oklab, ${toneColor} 4%, transparent) 45%,
          transparent 75%),
        linear-gradient(180deg, rgb(var(--kfp-surface-tint) / 0.72) 0%, rgb(var(--kfp-surface-tint) / 0.86) 100%)
      `,
    };

    return (
      <div
        role="button"
        tabIndex={0}
        className="kfp-briefing"
        onClick={onOpenBlock}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenBlock();
          }
        }}
        aria-label="Open block time details"
        style={{ cursor: 'pointer', ...atmosphere }}
      >
        <div className="kfp-briefing-eyebrow">
          {Plane && <Plane className="w-3 h-3" />}
          Today's flight
          {(loading || metarsLoading) && (
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 400 }}>
              calculating…
            </span>
          )}
          {!loading && !metarsLoading && staleness && (
            <span
              title="Weather data is older than 90 minutes. Check for refresh."
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10,
                fontWeight: 500,
                color: 'rgb(var(--kfp-warn))',
              }}
            >
              {CloudOff && <CloudOff className="w-3 h-3" />}
              {staleness}
            </span>
          )}
        </div>

        <div className="kfp-briefing-headline">
          {hasRoute ? fmtHM(totals.blockMin) : '—'}
        </div>

        <div className="kfp-briefing-sub">
          {hasRoute
            ? `${totals.blockFuelGal.toFixed(1)} gal · ${totals.blockDistanceNm.toFixed(0)} nm${altText ? ` · ${altText}` : ''}`
            : 'Add waypoints to begin'}
        </div>

        {(depMetar || arrMetar) && (
          <div
            className="kfp-briefing-airports"
            style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}
          >
            {depMetar && (
              <AirportPill
                icao={dep}
                metar={depMetar}
                fieldElevFt={airportElevations[dep]}
              />
            )}
            {arrMetar && (
              <AirportPill
                icao={arr}
                metar={arrMetar}
                fieldElevFt={airportElevations[arr]}
              />
            )}
          </div>
        )}

        {alternates.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              marginTop: 10,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontWeight: 600,
                color: 'rgb(var(--kfp-fg-muted))',
              }}
            >
              Alternates
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {alternates.map((alt) => {
                const m = metars[alt.icao];
                return m ? (
                  <AlternateMiniPill
                    key={alt.icao}
                    icao={alt.icao}
                    metar={m}
                    distanceNm={alt.distanceNm}
                  />
                ) : (
                  <span
                    key={alt.icao}
                    title={
                      alt.name
                        ? `${alt.icao} · ${alt.name} · no METAR published`
                        : `${alt.icao} · no METAR published`
                    }
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '3px 8px',
                      borderRadius: 999,
                      background: 'rgb(var(--kfp-fg) / 0.04)',
                      border: '1px dashed rgb(var(--kfp-hairline-strong))',
                      fontSize: 10,
                      lineHeight: 1.2,
                      color: 'rgb(var(--kfp-fg-muted))',
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'transparent',
                        border: '1px solid rgb(var(--kfp-fg-muted))',
                        flex: '0 0 auto',
                      }}
                    />
                    <span style={{ fontWeight: 600 }}>{alt.icao}</span>
                    <span style={{ fontFamily: 'var(--kfp-font-mono)' }}>
                      {Math.round(alt.distanceNm)} nm
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}
                    >
                      no wx
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="kfp-briefing-chips" onClick={(e) => e.stopPropagation()}>
          {!reserveOk && (
            <span className="kfp-chip kfp-chip-danger">Below reserve</span>
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
          <button
            type="button"
            className={`kfp-chip${windsOverrideActive ? ' kfp-chip-accent' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenWindsOverride();
            }}
            style={{ border: 'none', cursor: 'pointer' }}
            title={
              windsOverrideActive
                ? 'Manual winds are overriding the auto forecast. Click to edit.'
                : autoWindsActive
                  ? 'Auto winds from Open-Meteo. Click to override.'
                  : 'Click to set manual winds.'
            }
          >
            {Wind && <Wind className="w-3 h-3" />}
            {windsOverrideActive
              ? 'Winds overridden'
              : autoWindsActive
                ? 'Auto winds'
                : 'Override winds'}
          </button>
          {metarsError && !depMetar && !arrMetar && (
            <span className="kfp-chip kfp-chip-warn" title={metarsError}>
              Weather offline
            </span>
          )}
        </div>
      </div>
    );
  };

  function AlternateMiniPill({
    icao,
    metar,
    distanceNm,
  }: {
    icao: string;
    metar: MetarObservation;
    distanceNm: number;
  }) {
    const cat = metar.flightCategory;
    const color = {
      VFR: 'rgb(60 175 90)',
      MVFR: 'rgb(50 140 235)',
      IFR: 'rgb(230 70 60)',
      LIFR: 'rgb(160 70 180)',
      UNKNOWN: 'rgb(140 140 150)',
    }[cat];
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 8px',
          borderRadius: 999,
          background: 'rgb(var(--kfp-surface-tint) / 0.78)',
          border: '1px solid rgb(var(--kfp-hairline))',
          fontSize: 10,
          lineHeight: 1.2,
        }}
        title={`${icao} · ${cat} · ${Math.round(distanceNm)} nm`}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: color,
            flex: '0 0 auto',
          }}
        />
        <span style={{ fontWeight: 600 }}>{icao}</span>
        <span
          style={{
            color: 'rgb(var(--kfp-fg-muted))',
            fontFamily: 'var(--kfp-font-mono)',
          }}
        >
          {Math.round(distanceNm)} nm
        </span>
      </span>
    );
  }

  return BriefingCard;
}
