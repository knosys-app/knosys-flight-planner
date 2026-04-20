// Vertical route profile chart using Recharts (provided via Shared).
// Renders terrain curve + planned altitude envelope + optional obstacle
// spikes + per-leg boundary markers. Entirely presentational — gets fed
// pre-computed samples, obstacles, altitude envelope, and leg boundaries.

import type { FC } from 'react';
import type { Obstacle, ProfileSample, SharedDependencies } from '../types';

export interface ProfileChartProps {
  samples: ProfileSample[];
  obstacles: Array<Obstacle & { alongTrackNm: number }>;
  envelope: Array<{ alongTrackNm: number; plannedAltFt: number }>;
  legBoundaries: Array<{ alongTrackNm: number; label: string }>;
}

export function createVerticalProfileChart(Shared: SharedDependencies) {
  const R = Shared.recharts as any;
  if (!R?.ComposedChart) {
    const Fallback: FC<ProfileChartProps> = () => (
      <div className="text-xs text-muted-foreground p-2">
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
    ReferenceDot,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
  } = R;

  const VerticalProfileChart: FC<ProfileChartProps> = ({
    samples,
    obstacles,
    envelope,
    legBoundaries,
  }) => {
    if (samples.length === 0) {
      return (
        <div className="text-sm text-muted-foreground p-4 text-center">
          Build a route to see the vertical profile.
        </div>
      );
    }

    // Merge samples + envelope by along-track axis. Chart reads both series
    // from the same data set so hover tooltips align.
    const envByAlong = new Map(envelope.map((e) => [round(e.alongTrackNm), e.plannedAltFt]));
    const data = samples.map((s) => ({
      along: Number(s.alongTrackNm.toFixed(2)),
      terrain: Math.round(s.terrainElevFt),
      planned: nearestEnvelope(envelope, s.alongTrackNm),
    }));

    const maxY = Math.max(
      ...data.map((d) => d.terrain),
      ...data.map((d) => d.planned ?? 0),
      ...obstacles.map((o) => o.heightMsl),
    );
    const yDomain = [
      Math.min(0, ...samples.map((s) => s.terrainElevFt)) - 500,
      Math.ceil((maxY + 500) / 500) * 500,
    ];

    return (
      <div style={{ width: '100%', height: 360 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="along"
              type="number"
              domain={[0, 'dataMax']}
              unit=" nm"
              fontSize={11}
            />
            <YAxis domain={yDomain as any} unit=" ft" fontSize={11} width={70} />
            <Tooltip
              contentStyle={{ fontSize: 12 }}
              formatter={(value: number, name: string) => [
                Number.isFinite(value) ? `${Math.round(value)} ft` : '—',
                name === 'terrain' ? 'Terrain' : 'Planned alt',
              ]}
              labelFormatter={(v: any) => `${Number(v).toFixed(1)} nm`}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="terrain"
              stroke="#6b4020"
              fill="#92633a"
              fillOpacity={0.6}
              name="terrain"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="planned"
              stroke="#1e40af"
              strokeWidth={2}
              dot={false}
              name="planned"
              isAnimationActive={false}
            />
            {legBoundaries.map((b, i) => (
              <ReferenceLine
                key={i}
                x={b.alongTrackNm}
                stroke="#94a3b8"
                strokeDasharray="3 3"
                label={{ value: b.label, position: 'insideTop', fill: '#64748b', fontSize: 10 }}
              />
            ))}
            {obstacles.map((o) => (
              <ReferenceDot
                key={o.id}
                x={o.alongTrackNm}
                y={o.heightMsl}
                r={3}
                fill="#dc2626"
                stroke="#7f1d1d"
                ifOverflow="extendDomain"
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return VerticalProfileChart;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function nearestEnvelope(
  envelope: Array<{ alongTrackNm: number; plannedAltFt: number }>,
  alongTrackNm: number,
): number | null {
  if (envelope.length === 0) return null;
  // Linear interpolation for smoother rendering.
  for (let i = 0; i < envelope.length - 1; i++) {
    const a = envelope[i];
    const b = envelope[i + 1];
    if (alongTrackNm >= a.alongTrackNm && alongTrackNm <= b.alongTrackNm) {
      const span = b.alongTrackNm - a.alongTrackNm;
      if (span <= 0) return a.plannedAltFt;
      const t = (alongTrackNm - a.alongTrackNm) / span;
      return Math.round(a.plannedAltFt + (b.plannedAltFt - a.plannedAltFt) * t);
    }
  }
  // Out of range — pin to nearest endpoint.
  return alongTrackNm < envelope[0].alongTrackNm
    ? envelope[0].plannedAltFt
    : envelope[envelope.length - 1].plannedAltFt;
}
