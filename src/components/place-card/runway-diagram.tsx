import type { FC } from 'react';
import type { Airport, Runway } from '../../types';

/**
 * Miniature airport runway diagram rendered at airport-local scale.
 *
 * Our airport DB stores per-runway length, width, and heading, but NOT
 * end-point coordinates — so "real" positions aren't available. Real
 * airports have parallel runways laterally offset from each other (KSEA's
 * 16L/16C/16R sit ~800 ft apart). Without coordinates we'd draw all three
 * on top of each other. The workaround here: detect near-parallel runways
 * (heading within ±5°), spread them perpendicular to their heading by a
 * fraction of the longest runway, and label each end. The result is a
 * layout diagram, not a chart — runway IDs and relative orientation read
 * correctly, but absolute positions are schematic.
 */

const FT_PER_M = 3.28084;
const PARALLEL_TOLERANCE_DEG = 5;

interface LaidOutRunway {
  runway: Runway;
  /** Center offset perpendicular to the runway's heading, in meters. */
  perpOffsetM: number;
  halfLenM: number;
  halfWidthM: number;
  angleDeg: number;
}

export interface RunwayDiagramProps {
  airport: Airport;
  size?: number;
}

function angularDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  // Treat reciprocal headings as parallel (16/34 vs 34/16).
  return Math.min(d, 180 - d);
}

/** Assign lateral offsets within a set of near-parallel runways. */
function spreadOffsets(groupSize: number, spreadM: number): number[] {
  if (groupSize === 1) return [0];
  const step = spreadM / Math.max(groupSize - 1, 1);
  const half = (spreadM * (groupSize - 1)) / (2 * Math.max(groupSize - 1, 1));
  const out: number[] = [];
  for (let i = 0; i < groupSize; i++) {
    out.push(i * step - half * (groupSize - 1) / Math.max(groupSize - 1, 1));
  }
  // The formula above reduces to: i * step - half*(n-1)/(n-1) = i*step - half.
  // Simplify — but keep the guard against n==1.
  return out;
}

function layoutRunways(runways: Runway[]): LaidOutRunway[] {
  if (runways.length === 0) return [];

  const longestFt = runways.reduce((m, r) => Math.max(m, r.lengthFt || 0), 0);
  const longestM = longestFt / FT_PER_M;
  const groupSpreadM = longestM * 0.22; // ~22% of the longest runway width-wise

  // Group near-parallel runways.
  const groups: Runway[][] = [];
  for (const r of runways) {
    const g = groups.find((grp) =>
      grp.some(
        (x) => angularDiff(x.headingTrue, r.headingTrue) <= PARALLEL_TOLERANCE_DEG,
      ),
    );
    if (g) g.push(r);
    else groups.push([r]);
  }

  const out: LaidOutRunway[] = [];
  for (const grp of groups) {
    // Sort parallel runways by ident so L → C → R lands left-to-right
    // relative to the shared heading (consistent reading).
    grp.sort((a, b) => (a.leIdent ?? '').localeCompare(b.leIdent ?? ''));
    const offsets = spreadOffsets(grp.length, groupSpreadM);
    grp.forEach((r, i) => {
      out.push({
        runway: r,
        perpOffsetM: grp.length === 1 ? 0 : offsets[i],
        halfLenM: (r.lengthFt / FT_PER_M) / 2,
        halfWidthM: Math.max(r.widthFt || 0, 40) / FT_PER_M / 2,
        angleDeg: r.headingTrue,
      });
    });
  }

  return out;
}

export const RunwayDiagram: FC<RunwayDiagramProps> = ({ airport, size = 200 }) => {
  const valid = airport.runways.filter(
    (r) => r.lengthFt && Number.isFinite(r.headingTrue),
  );
  if (valid.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          height: size,
          display: 'grid',
          placeItems: 'center',
          color: 'rgb(var(--kfp-fg-muted))',
          fontFamily: 'var(--kfp-font-mono)',
          fontSize: 11,
        }}
      >
        no runway data
      </div>
    );
  }

  const laid = layoutRunways(valid);

  // Compute extents in local meters so the diagram fits inside viewBox.
  let maxExtent = 0;
  for (const r of laid) {
    const rad = (r.angleDeg * Math.PI) / 180;
    // Rotated rectangle corners (relative to its own center)
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    // Runway axis is along (sin, cos) in "screen-up is north" orientation.
    // Center is offset perpendicular to the axis: (cos, -sin).
    const cx = r.perpOffsetM * cosA;
    const cy = r.perpOffsetM * -sinA;
    const ex = Math.abs(r.halfLenM * sinA) + Math.abs(r.halfWidthM * cosA);
    const ey = Math.abs(r.halfLenM * cosA) + Math.abs(r.halfWidthM * sinA);
    maxExtent = Math.max(maxExtent, Math.abs(cx) + ex, Math.abs(cy) + ey);
  }
  const viewHalf = Math.max(maxExtent * 1.18, 100);

  const metersToSvg = (mx: number, my: number) => {
    const x = size / 2 + (mx / viewHalf) * (size / 2);
    const y = size / 2 - (my / viewHalf) * (size / 2);
    return { x, y };
  };

  // For each runway, compute centerline endpoints in SVG coords.
  const drawn = laid.map((r) => {
    const rad = (r.angleDeg * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    // Axis direction: heading 0 (north) → (0, +1). So axis = (sin, cos).
    const axisX = sinA;
    const axisY = cosA;
    // Perpendicular (right of runway heading) = (cos, -sin).
    const perpX = cosA;
    const perpY = -sinA;
    const cx = r.perpOffsetM * perpX;
    const cy = r.perpOffsetM * perpY;
    const tip = metersToSvg(cx + axisX * r.halfLenM, cy + axisY * r.halfLenM);
    const tail = metersToSvg(cx - axisX * r.halfLenM, cy - axisY * r.halfLenM);
    const widthPx = (r.halfWidthM / viewHalf) * (size / 2) * 2;
    return {
      runway: r.runway,
      tip,
      tail,
      widthPx: Math.max(widthPx, 3),
    };
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height={size}
      style={{ display: 'block' }}
      aria-label={`${airport.icao} runway layout diagram`}
      role="img"
    >
      <defs>
        <linearGradient id={`rwy-bg-${airport.icao}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--kfp-surface-tint))" stopOpacity="0.9" />
          <stop offset="100%" stopColor="rgb(var(--kfp-surface-tint))" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width={size} height={size} fill={`url(#rwy-bg-${airport.icao})`} />

      {/* Airport reference point */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r="2"
        fill="rgb(var(--kfp-accent))"
        opacity="0.55"
      />

      {drawn.map((d, i) => (
        <g key={i}>
          <line
            x1={d.tail.x}
            y1={d.tail.y}
            x2={d.tip.x}
            y2={d.tip.y}
            stroke="rgb(var(--kfp-fg))"
            strokeOpacity="0.82"
            strokeWidth={d.widthPx}
            strokeLinecap="round"
          />
          <line
            x1={d.tail.x}
            y1={d.tail.y}
            x2={d.tip.x}
            y2={d.tip.y}
            stroke="rgb(var(--kfp-surface-tint))"
            strokeOpacity="0.9"
            strokeWidth={Math.max(d.widthPx * 0.18, 0.5)}
            strokeDasharray="3 3"
          />
          {d.runway.leIdent && (
            <RunwayLabel
              x={d.tail.x}
              y={d.tail.y}
              tipX={d.tip.x}
              tipY={d.tip.y}
              label={d.runway.leIdent}
            />
          )}
          {d.runway.heIdent && (
            <RunwayLabel
              x={d.tip.x}
              y={d.tip.y}
              tipX={d.tail.x}
              tipY={d.tail.y}
              label={d.runway.heIdent}
            />
          )}
        </g>
      ))}

      {/* North arrow */}
      <g transform={`translate(${size - 18} 18)`}>
        <circle r="10" fill="rgb(var(--kfp-surface-tint))" opacity="0.85" />
        <path d="M 0 -6 L 3 5 L 0 3 L -3 5 Z" fill="rgb(var(--kfp-accent))" />
        <text
          y="-2"
          x="0"
          dy="13"
          textAnchor="middle"
          style={{
            fontFamily: 'var(--kfp-font-mono)',
            fontSize: 6,
            fill: 'rgb(var(--kfp-fg-muted))',
            fontWeight: 600,
          }}
        >
          N
        </text>
      </g>

      <text
        x={size / 2}
        y={size - 6}
        textAnchor="middle"
        style={{
          fontFamily: 'var(--kfp-font-mono)',
          fontSize: 7,
          fill: 'rgb(var(--kfp-fg-muted))',
          letterSpacing: '0.08em',
        }}
      >
        LAYOUT · NOT TO SCALE
      </text>
    </svg>
  );
};

/**
 * Runway-end label placed just outside the runway end, offset along the
 * runway's own axis so it reads cleanly without colliding with a parallel
 * neighbor.
 */
const RunwayLabel: FC<{
  x: number;
  y: number;
  tipX: number;
  tipY: number;
  label: string;
}> = ({ x, y, tipX, tipY, label }) => {
  const dx = x - tipX;
  const dy = y - tipY;
  const len = Math.hypot(dx, dy) || 1;
  const offset = 8;
  const ox = (dx / len) * offset;
  const oy = (dy / len) * offset;
  return (
    <text
      x={x + ox}
      y={y + oy}
      dy="2.5"
      textAnchor="middle"
      style={{
        fontFamily: 'var(--kfp-font-mono)',
        fontSize: 8.5,
        fill: 'rgb(var(--kfp-fg))',
        fontWeight: 600,
      }}
    >
      {label}
    </text>
  );
};
