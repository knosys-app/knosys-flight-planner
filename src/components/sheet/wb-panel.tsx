import type { FC } from 'react';
import { useMemo, useState } from 'react';
import type {
  AircraftProfile,
  BlockTotals,
  SharedDependencies,
} from '../../types';
import {
  buildBreakdown,
  burnFuel,
  computeCG,
  defaultLoadout,
  fuelDensityLbPerGal,
  isInsideEnvelope,
  type Loadout,
  type WBPoint,
} from '../../math/weight-balance';

export interface WBPanelProps {
  aircraft: AircraftProfile;
  totals: BlockTotals;
}

export function createWBPanel(Shared: SharedDependencies) {
  const { Input } = Shared;

  const WBPanel: FC<WBPanelProps> = ({ aircraft, totals }) => {
    const [loadout, setLoadout] = useState<Loadout>(() => defaultLoadout(aircraft));

    // Reset loadout if the user switches aircraft.
    const aircraftKey = aircraft.id;
    const [lastKey, setLastKey] = useState(aircraftKey);
    if (lastKey !== aircraftKey) {
      setLastKey(aircraftKey);
      setLoadout(defaultLoadout(aircraft));
    }

    const takeoff = computeCG(aircraft, loadout);
    const landing = useMemo(() => {
      const burned = totals.blockFuelGal || 0;
      return computeCG(aircraft, burnFuel(loadout, burned));
    }, [aircraft, loadout, totals.blockFuelGal]);

    const breakdown = useMemo(() => buildBreakdown(aircraft, loadout), [aircraft, loadout]);

    const missingProfileData = !aircraft.emptyWeightLb || !aircraft.emptyCgIn;

    const takeoffInEnv =
      takeoff && aircraft.envelopeCorners
        ? isInsideEnvelope(aircraft.envelopeCorners, takeoff)
        : null;
    const landingInEnv =
      landing && aircraft.envelopeCorners
        ? isInsideEnvelope(aircraft.envelopeCorners, landing)
        : null;
    const overGross =
      takeoff != null &&
      aircraft.maxGrossWeightLb != null &&
      takeoff.weightLb > aircraft.maxGrossWeightLb;

    if (missingProfileData) {
      return (
        <MissingProfileData />
      );
    }

    const updateStation = (id: string, weightLb: number) => {
      setLoadout((prev) => ({
        ...prev,
        stations: prev.stations.map((s) =>
          s.stationId === id ? { ...s, weightLb } : s,
        ),
      }));
    };
    const updateFuel = (id: string, gallons: number) => {
      setLoadout((prev) => ({
        ...prev,
        fuel: prev.fuel.map((f) => (f.stationId === id ? { ...f, gallons } : f)),
      }));
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <WBHeader
          takeoff={takeoff}
          landing={landing}
          takeoffInEnv={takeoffInEnv}
          landingInEnv={landingInEnv}
          overGross={overGross}
          maxGross={aircraft.maxGrossWeightLb}
        />

        <EnvelopePlot
          envelope={aircraft.envelopeCorners ?? []}
          maxGross={aircraft.maxGrossWeightLb}
          takeoff={takeoff}
          landing={landing}
          takeoffInEnv={takeoffInEnv}
          landingInEnv={landingInEnv}
        />

        <section>
          <div className="kfp-label-caps" style={{ marginBottom: 8 }}>
            Loadout
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(aircraft.weightStations ?? []).map((s) => {
              const cur = loadout.stations.find((l) => l.stationId === s.id);
              const over =
                s.maxWeightLb != null && (cur?.weightLb ?? 0) > s.maxWeightLb;
              return (
                <div
                  key={s.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 110px auto',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                    <div
                      className="kfp-mono"
                      style={{ fontSize: 11, color: 'rgb(var(--kfp-fg-muted))' }}
                    >
                      arm {s.armIn.toFixed(1)}"
                      {s.maxWeightLb ? ` · max ${s.maxWeightLb} lb` : ''}
                    </div>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={cur?.weightLb ?? 0}
                    onChange={(e: any) =>
                      updateStation(s.id, Number.parseFloat(e.target.value) || 0)
                    }
                    style={{
                      textAlign: 'right',
                      fontFamily: 'var(--kfp-font-mono)',
                      color: over ? 'rgb(var(--kfp-danger))' : undefined,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: 'rgb(var(--kfp-fg-muted))',
                      fontFamily: 'var(--kfp-font-mono)',
                    }}
                  >
                    lb
                  </span>
                </div>
              );
            })}

            {(aircraft.fuelStations ?? []).map((t) => {
              const cur = loadout.fuel.find((l) => l.stationId === t.id);
              const over = (cur?.gallons ?? 0) > t.capacityGal;
              const lb = (cur?.gallons ?? 0) * fuelDensityLbPerGal(aircraft.fuelType);
              return (
                <div
                  key={t.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 110px auto',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</div>
                    <div
                      className="kfp-mono"
                      style={{ fontSize: 11, color: 'rgb(var(--kfp-fg-muted))' }}
                    >
                      arm {t.armIn.toFixed(1)}" · capacity {t.capacityGal} gal ·{' '}
                      {lb.toFixed(0)} lb
                    </div>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={t.capacityGal}
                    value={cur?.gallons ?? 0}
                    onChange={(e: any) =>
                      updateFuel(t.id, Number.parseFloat(e.target.value) || 0)
                    }
                    style={{
                      textAlign: 'right',
                      fontFamily: 'var(--kfp-font-mono)',
                      color: over ? 'rgb(var(--kfp-danger))' : undefined,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: 'rgb(var(--kfp-fg-muted))',
                      fontFamily: 'var(--kfp-font-mono)',
                    }}
                  >
                    gal
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <div className="kfp-label-caps" style={{ marginBottom: 8 }}>
            Breakdown
          </div>
          <div
            style={{
              fontFamily: 'var(--kfp-font-mono)',
              fontSize: 12,
              display: 'grid',
              gridTemplateColumns: '1fr auto auto auto',
              rowGap: 4,
              columnGap: 16,
            }}
          >
            <div style={{ color: 'rgb(var(--kfp-fg-muted))' }}>Item</div>
            <div style={{ color: 'rgb(var(--kfp-fg-muted))', textAlign: 'right' }}>Weight</div>
            <div style={{ color: 'rgb(var(--kfp-fg-muted))', textAlign: 'right' }}>Arm</div>
            <div style={{ color: 'rgb(var(--kfp-fg-muted))', textAlign: 'right' }}>Moment</div>
            {breakdown.rows.map((r, i) => (
              <Row
                key={i}
                name={r.name}
                weight={r.weightLb}
                arm={r.armIn}
                moment={r.momentInLb}
              />
            ))}
            <div style={{ color: 'rgb(var(--kfp-fg))', borderTop: '1px solid rgb(var(--kfp-hairline))', paddingTop: 4, fontWeight: 600 }}>
              Total
            </div>
            <div style={{ textAlign: 'right', borderTop: '1px solid rgb(var(--kfp-hairline))', paddingTop: 4, fontWeight: 600 }}>
              {breakdown.totals.weightLb.toFixed(0)} lb
            </div>
            <div style={{ textAlign: 'right', borderTop: '1px solid rgb(var(--kfp-hairline))', paddingTop: 4, fontWeight: 600 }}>
              {breakdown.totals.cgIn.toFixed(1)}"
            </div>
            <div style={{ textAlign: 'right', borderTop: '1px solid rgb(var(--kfp-hairline))', paddingTop: 4, fontWeight: 600 }}>
              {Math.round(breakdown.totals.momentInLb).toLocaleString()}
            </div>
          </div>
        </section>
      </div>
    );
  };

  return WBPanel;
}

// ---------- sub components ----------

const Row: FC<{ name: string; weight: number; arm: number; moment: number }> = ({
  name,
  weight,
  arm,
  moment,
}) => (
  <>
    <div>{name}</div>
    <div style={{ textAlign: 'right' }}>{weight.toFixed(0)}</div>
    <div style={{ textAlign: 'right' }}>{arm.toFixed(1)}"</div>
    <div style={{ textAlign: 'right' }}>{Math.round(moment).toLocaleString()}</div>
  </>
);

const WBHeader: FC<{
  takeoff: WBPoint | null;
  landing: WBPoint | null;
  takeoffInEnv: boolean | null;
  landingInEnv: boolean | null;
  overGross: boolean;
  maxGross: number | undefined;
}> = ({ takeoff, landing, takeoffInEnv, landingInEnv, overGross, maxGross }) => {
  const status: {
    label: string;
    tone: 'ok' | 'warn' | 'danger';
  } = overGross
    ? { label: 'Over gross', tone: 'danger' }
    : takeoffInEnv === false || landingInEnv === false
      ? { label: 'Out of envelope', tone: 'danger' }
      : takeoffInEnv === true
        ? { label: 'Within envelope', tone: 'ok' }
        : { label: 'Envelope not defined', tone: 'warn' };

  const toneColor =
    status.tone === 'ok'
      ? 'rgb(var(--kfp-success))'
      : status.tone === 'danger'
        ? 'rgb(var(--kfp-danger))'
        : 'rgb(var(--kfp-warn))';

  return (
    <header>
      <div
        className="kfp-label-caps"
        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
      >
        Weight &amp; balance
        <span style={{ marginLeft: 'auto', color: toneColor, fontWeight: 600 }}>
          {status.label}
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          marginTop: 8,
        }}
      >
        <HeaderStat
          label="Takeoff"
          point={takeoff}
          inEnv={takeoffInEnv}
          maxGross={maxGross}
        />
        <HeaderStat
          label="Landing"
          point={landing}
          inEnv={landingInEnv}
          maxGross={maxGross}
        />
      </div>
    </header>
  );
};

const HeaderStat: FC<{
  label: string;
  point: WBPoint | null;
  inEnv: boolean | null;
  maxGross: number | undefined;
}> = ({ label, point, inEnv, maxGross }) => {
  const overGross = point && maxGross && point.weightLb > maxGross;
  const bad = overGross || inEnv === false;
  return (
    <div>
      <div
        className="kfp-label-caps"
        style={{ color: 'rgb(var(--kfp-fg-muted))' }}
      >
        {label}
      </div>
      <div
        className="kfp-display kfp-tabular"
        style={{
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: '-0.015em',
          color: bad ? 'rgb(var(--kfp-danger))' : 'rgb(var(--kfp-fg))',
        }}
      >
        {point ? `${point.weightLb.toFixed(0)} lb` : '—'}
      </div>
      <div
        className="kfp-mono"
        style={{ fontSize: 11, color: 'rgb(var(--kfp-fg-muted))' }}
      >
        {point ? `CG ${point.cgIn.toFixed(2)}"` : '—'}
      </div>
    </div>
  );
};

const MissingProfileData: FC = () => (
  <div
    style={{
      padding: 16,
      borderRadius: 12,
      background: 'rgb(var(--kfp-warn) / 0.1)',
      color: 'rgb(var(--kfp-warn))',
      fontSize: 13,
      lineHeight: 1.5,
    }}
  >
    <strong>W&amp;B profile incomplete.</strong> This aircraft is missing empty
    weight and/or empty CG. Edit the aircraft and fill those in to enable the
    weight-and-balance plot.
  </div>
);

// ---------- SVG envelope plot ----------

const EnvelopePlot: FC<{
  envelope: Array<{ weightLb: number; cgIn: number }>;
  maxGross: number | undefined;
  takeoff: WBPoint | null;
  landing: WBPoint | null;
  takeoffInEnv: boolean | null;
  landingInEnv: boolean | null;
}> = ({ envelope, maxGross, takeoff, landing, takeoffInEnv, landingInEnv }) => {
  const width = 520;
  const height = 260;
  const padL = 48;
  const padR = 12;
  const padT = 12;
  const padB = 30;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  // Determine plot bounds from envelope + points, with a bit of padding.
  const allPoints: Array<{ cgIn: number; weightLb: number }> = [
    ...envelope,
    ...(takeoff ? [takeoff] : []),
    ...(landing ? [landing] : []),
  ];
  if (allPoints.length === 0) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 12,
          background: 'rgb(var(--kfp-fg) / 0.04)',
          fontSize: 12,
          color: 'rgb(var(--kfp-fg-muted))',
        }}
      >
        Envelope not defined for this aircraft.
      </div>
    );
  }

  const cgs = allPoints.map((p) => p.cgIn);
  const wts = allPoints.map((p) => p.weightLb);
  const cgMin = Math.min(...cgs) - 1;
  const cgMax = Math.max(...cgs) + 1;
  const wtMax = Math.max(...wts, maxGross ?? 0) * 1.05;
  const wtMin = Math.min(...wts, 0) * 0.95;

  const xScale = (cg: number) => padL + ((cg - cgMin) / (cgMax - cgMin)) * plotW;
  // Y-axis inverted (higher weight = higher position)
  const yScale = (wt: number) =>
    padT + plotH - ((wt - wtMin) / (wtMax - wtMin)) * plotH;

  const polyPts = envelope
    .map((p) => `${xScale(p.cgIn)},${yScale(p.weightLb)}`)
    .join(' ');

  const xTicks: number[] = [];
  for (
    let c = Math.ceil(cgMin);
    c <= Math.floor(cgMax);
    c += Math.max(1, Math.round((cgMax - cgMin) / 6))
  ) {
    xTicks.push(c);
  }
  const yTicks: number[] = [];
  const yStep = Math.ceil(((wtMax - wtMin) / 5) / 100) * 100;
  for (let w = Math.ceil(wtMin / yStep) * yStep; w <= wtMax; w += yStep) {
    yTicks.push(w);
  }

  return (
    <div
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid rgb(var(--kfp-hairline))',
        background: 'rgb(var(--kfp-surface-tint) / 0.5)',
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {/* Grid */}
        {yTicks.map((w) => (
          <g key={`y${w}`}>
            <line
              x1={padL}
              x2={width - padR}
              y1={yScale(w)}
              y2={yScale(w)}
              stroke="rgb(var(--kfp-fg))"
              strokeOpacity={0.08}
              strokeDasharray="2 4"
            />
            <text
              x={padL - 6}
              y={yScale(w)}
              fontSize={10}
              textAnchor="end"
              dominantBaseline="middle"
              fill="rgb(var(--kfp-fg-muted))"
              fontFamily="var(--kfp-font-mono)"
            >
              {w >= 1000 ? `${(w / 1000).toFixed(1)}k` : w.toFixed(0)}
            </text>
          </g>
        ))}
        {xTicks.map((c) => (
          <g key={`x${c}`}>
            <text
              x={xScale(c)}
              y={height - padB + 16}
              fontSize={10}
              textAnchor="middle"
              fill="rgb(var(--kfp-fg-muted))"
              fontFamily="var(--kfp-font-mono)"
            >
              {c}"
            </text>
          </g>
        ))}

        {/* Envelope polygon */}
        {envelope.length >= 3 && (
          <polygon
            points={polyPts}
            fill="rgb(var(--kfp-accent) / 0.18)"
            stroke="rgb(var(--kfp-accent))"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        )}

        {/* Takeoff → landing connector (fuel burn trail) */}
        {takeoff && landing && (
          <line
            x1={xScale(takeoff.cgIn)}
            y1={yScale(takeoff.weightLb)}
            x2={xScale(landing.cgIn)}
            y2={yScale(landing.weightLb)}
            stroke="rgb(var(--kfp-accent))"
            strokeOpacity={0.55}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        )}

        {/* Takeoff dot */}
        {takeoff && (
          <Dot
            x={xScale(takeoff.cgIn)}
            y={yScale(takeoff.weightLb)}
            color={
              takeoffInEnv === false
                ? 'rgb(var(--kfp-danger))'
                : 'rgb(var(--kfp-accent))'
            }
            r={7}
            label="Takeoff"
          />
        )}

        {/* Landing dot */}
        {landing && (
          <Dot
            x={xScale(landing.cgIn)}
            y={yScale(landing.weightLb)}
            color={
              landingInEnv === false
                ? 'rgb(var(--kfp-danger))'
                : 'rgb(var(--kfp-warn))'
            }
            r={5}
            label="Landing"
          />
        )}

        {/* Axis labels */}
        <text
          x={padL}
          y={height - 4}
          fontSize={10}
          fill="rgb(var(--kfp-fg-muted))"
          fontFamily="var(--kfp-font-text)"
        >
          CG (in from datum)
        </text>
        <text
          x={4}
          y={padT + 4}
          fontSize={10}
          fill="rgb(var(--kfp-fg-muted))"
          fontFamily="var(--kfp-font-text)"
        >
          Weight (lb)
        </text>
      </svg>
    </div>
  );
};

const Dot: FC<{
  x: number;
  y: number;
  color: string;
  r: number;
  label: string;
}> = ({ x, y, color, r, label }) => (
  <g>
    <circle
      cx={x}
      cy={y}
      r={r + 4}
      fill={color}
      fillOpacity={0.25}
      className="kfp-obstacle-pulse"
    />
    <circle cx={x} cy={y} r={r} fill={color} stroke="white" strokeWidth={1.5} />
    <text
      x={x + r + 6}
      y={y - r - 2}
      fontSize={10}
      fill={color}
      fontFamily="var(--kfp-font-text)"
      fontWeight={600}
    >
      {label}
    </text>
  </g>
);
