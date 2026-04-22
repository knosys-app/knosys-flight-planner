import type { FC } from 'react';
import type {
  AircraftProfile,
  NavlogRow,
  Obstacle,
  Plan,
  ProfileSample,
  SharedDependencies,
  WindsEntryRow,
} from '../../types';
import { buildEnvelope, buildLegBoundaries } from './envelope';

export interface ProfileRibbonProps {
  plan: Plan | null;
  aircraft: AircraftProfile | null;
  rows: NavlogRow[];
  samples: ProfileSample[];
  obstacles: Array<Obstacle & { alongTrackNm: number }>;
  winds: WindsEntryRow[];
  departureElevFt: number;
  arrivalElevFt: number;
}

interface RibbonRow {
  along: number;
  terrain: number;
  planned: number | null;
}

/**
 * Animated vertical profile — the v0.3 signature.
 * Layered SVG: sky gradient → terrain hypsometric area → planned path
 * (drawn in over ~1.1s) → leg boundaries → wind barbs → obstacle pulses
 * → scrub cursor with readout pill. Uses Recharts for the chart scaffolding
 * + Customized overlays for the decorative layers.
 */
export function createProfileRibbon(Shared: SharedDependencies) {
  const { useMemo, useState, useRef } = Shared;
  const R = Shared.recharts as any;

  if (!R?.ComposedChart) {
    const Fallback: FC<ProfileRibbonProps> = () => (
      <div className="p-4 text-sm" style={{ color: 'rgb(var(--kfp-fg-muted))' }}>
        Chart unavailable — Recharts not exposed by host.
      </div>
    );
    return Fallback;
  }

  const {
    ResponsiveContainer,
    ComposedChart,
    Area,
    Line,
    ReferenceLine,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Customized,
  } = R;

  const ProfileRibbon: FC<ProfileRibbonProps> = ({
    plan,
    rows,
    samples,
    obstacles,
    winds,
    departureElevFt,
    arrivalElevFt,
  }) => {
    const [hover, setHover] = useState<RibbonRow | null>(null);
    const keyRef = useRef(0);

    const data = useMemo<RibbonRow[]>(() => {
      if (samples.length === 0 || !plan) return [];
      const envelope = buildEnvelope(plan, rows, departureElevFt, arrivalElevFt);
      return samples.map((s) => ({
        along: Number(s.alongTrackNm.toFixed(2)),
        terrain: Math.round(s.terrainElevFt),
        planned: interpolateEnvelope(envelope, s.alongTrackNm),
      }));
    }, [plan, rows, samples, departureElevFt, arrivalElevFt]);

    const boundaries = useMemo(
      () => (plan ? buildLegBoundaries(plan, rows) : []),
      [plan, rows],
    );

    // Re-key the chart on plan or sample-count changes so the CSS path-draw
    // animation replays.
    const animKey = useMemo(() => {
      keyRef.current += 1;
      return keyRef.current;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plan?.id, samples.length]);

    const yDomain = useMemo<[number, number]>(() => {
      if (data.length === 0) return [0, 10000];
      const maxTerrain = Math.max(...data.map((d) => d.terrain));
      const maxPlanned = Math.max(...data.map((d) => d.planned ?? 0));
      const maxObstacle = obstacles.reduce(
        (m, o) => Math.max(m, o.heightMsl),
        0,
      );
      const top = Math.max(maxTerrain, maxPlanned, maxObstacle) + 1000;
      const bottom = Math.min(0, ...data.map((d) => d.terrain)) - 500;
      return [bottom, Math.ceil(top / 500) * 500];
    }, [data, obstacles]);

    if (data.length === 0) {
      return (
        <div
          className="kfp-profile"
          style={{ justifyContent: 'center', alignItems: 'center' }}
        >
          <div
            className="kfp-display"
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: 'rgb(var(--kfp-fg-muted))',
              textAlign: 'center',
            }}
          >
            Build a route to reveal the profile
          </div>
        </div>
      );
    }

    const hypsoId = `kfp-hypso-${animKey}`;
    const glowId = `kfp-glow-${animKey}`;

    return (
      <div className="kfp-profile">
        <div className="kfp-profile-sky" aria-hidden />

        <div className="kfp-profile-chart">
          <ResponsiveContainer>
            <ComposedChart
              key={animKey}
              data={data}
              margin={{ top: 20, right: 16, bottom: 8, left: 8 }}
              onMouseMove={(s: any) => {
                const p = s?.activePayload?.[0]?.payload as RibbonRow | undefined;
                if (p) setHover(p);
              }}
              onMouseLeave={() => setHover(null)}
            >
              <defs>
                <linearGradient id={hypsoId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--kfp-terrain-peak))" stopOpacity={0.92} />
                  <stop offset="18%" stopColor="rgb(var(--kfp-terrain-5))" stopOpacity={0.88} />
                  <stop offset="35%" stopColor="rgb(var(--kfp-terrain-4))" stopOpacity={0.84} />
                  <stop offset="55%" stopColor="rgb(var(--kfp-terrain-3))" stopOpacity={0.82} />
                  <stop offset="75%" stopColor="rgb(var(--kfp-terrain-2))" stopOpacity={0.8} />
                  <stop offset="90%" stopColor="rgb(var(--kfp-terrain-1))" stopOpacity={0.78} />
                  <stop offset="100%" stopColor="rgb(var(--kfp-terrain-0))" stopOpacity={0.76} />
                </linearGradient>
                <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <CartesianGrid
                strokeDasharray="2 4"
                stroke="rgb(var(--kfp-fg))"
                strokeOpacity={0.08}
                vertical={false}
              />
              <XAxis
                dataKey="along"
                type="number"
                domain={[0, 'dataMax']}
                tickFormatter={(v: number) => `${Math.round(v)}`}
                fontSize={10}
                stroke="rgb(var(--kfp-fg-muted))"
                tickLine={false}
                axisLine={false}
                unit=" nm"
              />
              <YAxis
                domain={yDomain}
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                width={40}
                fontSize={10}
                stroke="rgb(var(--kfp-fg-muted))"
                tickLine={false}
                axisLine={false}
                unit=""
              />
              <Tooltip
                cursor={{ stroke: 'rgb(var(--kfp-accent))', strokeOpacity: 0.35 }}
                content={() => null}
              />

              <Area
                type="monotone"
                dataKey="terrain"
                stroke="rgb(var(--kfp-terrain-peak))"
                strokeOpacity={0.55}
                strokeWidth={1}
                fill={`url(#${hypsoId})`}
                isAnimationActive={true}
                animationDuration={850}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="planned"
                stroke="rgb(var(--kfp-accent))"
                strokeWidth={2.25}
                dot={false}
                className="kfp-planned-path"
                filter={`url(#${glowId})`}
                isAnimationActive={false}
              />

              {boundaries.map((b, i) => (
                <ReferenceLine
                  key={`bnd-${i}`}
                  x={b.alongTrackNm}
                  stroke="rgb(var(--kfp-fg))"
                  strokeOpacity={0.14}
                  strokeDasharray="3 4"
                  label={{
                    value: b.label,
                    position: 'insideTop',
                    fill: 'rgb(var(--kfp-fg-muted))',
                    fontSize: 10,
                    fontFamily: 'var(--kfp-font-mono)',
                    dy: 4,
                  }}
                />
              ))}

              {obstacles.length > 0 && (
                <Customized
                  component={(props: any) => (
                    <ObstacleOverlay
                      obstacles={obstacles}
                      xAxisMap={props.xAxisMap}
                      yAxisMap={props.yAxisMap}
                    />
                  )}
                />
              )}

              {winds.length > 0 && plan && rows.length > 0 && (
                <Customized
                  component={(props: any) => (
                    <WindBarbOverlay
                      rows={rows}
                      plan={plan}
                      winds={winds}
                      xAxisMap={props.xAxisMap}
                      yAxisMap={props.yAxisMap}
                    />
                  )}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="kfp-profile-readout">
          <span>
            <span style={{ color: 'rgb(var(--kfp-fg-muted))' }}>At </span>
            <b>{hover ? hover.along.toFixed(1) : (data[0]?.along ?? 0).toFixed(1)}</b>
            <span style={{ color: 'rgb(var(--kfp-fg-muted))' }}> nm</span>
          </span>
          <span>
            <span style={{ color: 'rgb(var(--kfp-fg-muted))' }}>Alt </span>
            <b>
              {hover?.planned != null
                ? hover.planned.toLocaleString()
                : data[0]?.planned?.toLocaleString() ?? '—'}
            </b>
            <span style={{ color: 'rgb(var(--kfp-fg-muted))' }}> ft</span>
          </span>
          <span>
            <span style={{ color: 'rgb(var(--kfp-fg-muted))' }}>Terrain </span>
            <b>{hover ? hover.terrain.toLocaleString() : data[0].terrain.toLocaleString()}</b>
            <span style={{ color: 'rgb(var(--kfp-fg-muted))' }}> ft</span>
          </span>
          {hover?.planned != null && (
            <span>
              <span style={{ color: 'rgb(var(--kfp-fg-muted))' }}>Clearance </span>
              <b>{(hover.planned - hover.terrain).toLocaleString()}</b>
              <span style={{ color: 'rgb(var(--kfp-fg-muted))' }}> ft</span>
            </span>
          )}
        </div>
      </div>
    );
  };

  return ProfileRibbon;
}

// ----------------------------------------------------------------------

const ObstacleOverlay: FC<{
  obstacles: Array<Obstacle & { alongTrackNm: number }>;
  xAxisMap: any;
  yAxisMap: any;
}> = ({ obstacles, xAxisMap, yAxisMap }) => {
  const xKey = xAxisMap ? Object.keys(xAxisMap)[0] : null;
  const yKey = yAxisMap ? Object.keys(yAxisMap)[0] : null;
  if (!xKey || !yKey) return null;
  const xScale = xAxisMap[xKey].scale;
  const yScale = yAxisMap[yKey].scale;
  return (
    <g aria-hidden>
      {obstacles.map((o) => {
        const cx = xScale(o.alongTrackNm);
        const cy = yScale(o.heightMsl);
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
        return (
          <g key={o.id} transform={`translate(${cx} ${cy})`}>
            <circle
              className="kfp-obstacle-pulse"
              r={4}
              fill="rgb(var(--kfp-danger))"
              fillOpacity={0.35}
            />
            <circle r={2.5} fill="rgb(var(--kfp-danger))" />
          </g>
        );
      })}
    </g>
  );
};

const WindBarbOverlay: FC<{
  rows: NavlogRow[];
  plan: Plan;
  winds: WindsEntryRow[];
  xAxisMap: any;
  yAxisMap: any;
}> = ({ rows, plan, winds, xAxisMap, yAxisMap }) => {
  const xKey = xAxisMap ? Object.keys(xAxisMap)[0] : null;
  const yKey = yAxisMap ? Object.keys(yAxisMap)[0] : null;
  if (!xKey || !yKey) return null;
  const xScale = xAxisMap[xKey].scale;
  const yScale = yAxisMap[yKey].scale;

  let along = 0;
  const barbs: Array<{ x: number; y: number; dir: number; kt: number; course: number }> = [];
  rows.forEach((row, i) => {
    const leg = plan.legs[i];
    if (!leg) return;
    const mid = along + row.distanceNm / 2;
    const alt = leg.altFt;
    const w = nearestWind(winds, alt);
    if (w) {
      barbs.push({
        x: xScale(mid),
        y: yScale(alt),
        dir: w.dirTrueDeg,
        kt: w.speedKt,
        course: row.trueCourseDeg,
      });
    }
    along += row.distanceNm;
  });

  return (
    <g aria-hidden>
      {barbs.map((b, i) => {
        if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) return null;
        // Rotate barb so shaft points in the direction the wind is coming FROM
        // relative to the route direction. SVG 0° points right; we want 0°
        // wind (from North) to point UP, so subtract 90°.
        const rot = b.dir - 90;
        const len = Math.min(18, 6 + b.kt * 0.35);
        return (
          <g key={i} transform={`translate(${b.x} ${b.y}) rotate(${rot})`}>
            <line x1={0} y1={0} x2={len} y2={0} className="kfp-wind-barb" />
            <circle r={2} fill="rgb(var(--kfp-fg))" fillOpacity={0.85} />
            {/* simple feather indicating speed */}
            {b.kt >= 5 && (
              <line
                x1={len - 4}
                y1={0}
                x2={len - 7}
                y2={-4}
                className="kfp-wind-barb"
              />
            )}
            {b.kt >= 15 && (
              <line
                x1={len - 8}
                y1={0}
                x2={len - 11}
                y2={-4}
                className="kfp-wind-barb"
              />
            )}
          </g>
        );
      })}
    </g>
  );
};

function nearestWind(winds: WindsEntryRow[], altFt: number): WindsEntryRow | null {
  if (winds.length === 0) return null;
  return winds.reduce((best, w) =>
    Math.abs(w.altFt - altFt) < Math.abs(best.altFt - altFt) ? w : best,
  );
}

function interpolateEnvelope(
  envelope: Array<{ alongTrackNm: number; plannedAltFt: number }>,
  along: number,
): number | null {
  if (envelope.length === 0) return null;
  for (let i = 0; i < envelope.length - 1; i++) {
    const a = envelope[i];
    const b = envelope[i + 1];
    if (along >= a.alongTrackNm && along <= b.alongTrackNm) {
      const span = b.alongTrackNm - a.alongTrackNm;
      if (span <= 0) return a.plannedAltFt;
      const t = (along - a.alongTrackNm) / span;
      return Math.round(a.plannedAltFt + (b.plannedAltFt - a.plannedAltFt) * t);
    }
  }
  return along < envelope[0].alongTrackNm
    ? envelope[0].plannedAltFt
    : envelope[envelope.length - 1].plannedAltFt;
}
