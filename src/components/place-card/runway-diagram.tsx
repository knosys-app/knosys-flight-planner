import type { FC } from 'react';
import type { Airport, Runway } from '../../types';

/**
 * Miniature airport runway diagram rendered at airport-local scale.
 *
 * Two drawing modes:
 *
 * 1. **True-position** (airport DB v2+): each runway carries
 *    `le{Lat,Lon}` + `he{Lat,Lon}`, so we project endpoints into
 *    airport-local meters and draw the real layout. Parallel runways
 *    end up where they actually are (KSEA's 16L/16C/16R properly
 *    separated by ~800 ft).
 *
 * 2. **Schematic fallback** (legacy v1 DBs): only heading + length
 *    are known, so all runways would collapse onto the airport
 *    reference point. We detect near-parallel runways and spread
 *    them laterally across ~22% of the longest runway length. Correct
 *    relative orientation, schematic absolute positions. A footer
 *    ("LAYOUT · NOT TO SCALE") flags the approximation.
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
  /**
   * Logical viewBox edge length. The rendered SVG uses 100% width/height
   * of its container (.kfp-place-hero styles it), so this only affects
   * internal scaling ratios (stroke widths, label offsets) — larger
   * values give finer-grained geometry, smaller ones exaggerate widths.
   * Defaults to 260.
   */
  size?: number;
}

interface DrawnRunway {
  runway: Runway;
  tip: { x: number; y: number };
  tail: { x: number; y: number };
  widthPx: number;
}

function angularDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return Math.min(d, 180 - d);
}

function spreadOffsets(groupSize: number, spreadM: number): number[] {
  if (groupSize === 1) return [0];
  const step = spreadM / Math.max(groupSize - 1, 1);
  const out: number[] = [];
  for (let i = 0; i < groupSize; i++) {
    out.push(i * step - spreadM / 2);
  }
  return out;
}

function layoutRunwaysSchematic(runways: Runway[]): LaidOutRunway[] {
  if (runways.length === 0) return [];

  const longestFt = runways.reduce((m, r) => Math.max(m, r.lengthFt || 0), 0);
  const longestM = longestFt / FT_PER_M;
  const groupSpreadM = longestM * 0.22;

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

function hasTrueEndpoints(r: Runway): boolean {
  return (
    Number.isFinite(r.leLat) &&
    Number.isFinite(r.leLon) &&
    Number.isFinite(r.heLat) &&
    Number.isFinite(r.heLon)
  );
}

/**
 * Project (lat, lon) onto airport-local metric plane. Equirectangular
 * around the airport reference point is plenty accurate for runway-scale
 * geometry; the scale distortion across even KDEN's 14,000 ft runway is
 * under 1%.
 */
function latLonToLocalMeters(
  lat: number,
  lon: number,
  refLat: number,
  refLon: number,
): { mx: number; my: number } {
  const refLatRad = (refLat * Math.PI) / 180;
  const mx = (lon - refLon) * 111320 * Math.cos(refLatRad);
  const my = (lat - refLat) * 111320;
  return { mx, my };
}

function drawnFromEndpoints(airport: Airport, size: number): DrawnRunway[] | null {
  const runways = airport.runways.filter(
    (r) => r.lengthFt && Number.isFinite(r.headingTrue) && hasTrueEndpoints(r),
  );
  if (runways.length === 0 || runways.length !== airport.runways.length) {
    // Any runway missing endpoints → fall back entirely so we don't mix
    // real + schematic in one diagram.
    return null;
  }

  // First pass: collect endpoint pairs in local meters, find extent.
  const endpoints = runways.map((r) => {
    const le = latLonToLocalMeters(r.leLat!, r.leLon!, airport.lat, airport.lon);
    const he = latLonToLocalMeters(r.heLat!, r.heLon!, airport.lat, airport.lon);
    return { runway: r, le, he };
  });

  let maxExtent = 0;
  for (const ep of endpoints) {
    maxExtent = Math.max(
      maxExtent,
      Math.abs(ep.le.mx),
      Math.abs(ep.le.my),
      Math.abs(ep.he.mx),
      Math.abs(ep.he.my),
    );
  }
  // 1.28 gives enough margin that a runway endpoint + its ~8 px label
  // comfortably sit inside the SVG viewBox even for the longest-runway
  // field in view. Combined with SVG overflow: visible on render, labels
  // are guaranteed not to clip at any airport.
  const viewHalf = Math.max(maxExtent * 1.28, 100);

  const metersToSvg = (mx: number, my: number) => ({
    x: size / 2 + (mx / viewHalf) * (size / 2),
    y: size / 2 - (my / viewHalf) * (size / 2),
  });

  return endpoints.map((ep) => {
    const tip = metersToSvg(ep.he.mx, ep.he.my);
    const tail = metersToSvg(ep.le.mx, ep.le.my);
    const halfWidthM = Math.max(ep.runway.widthFt || 0, 40) / FT_PER_M / 2;
    const widthPx = (halfWidthM / viewHalf) * (size / 2) * 2;
    return {
      runway: ep.runway,
      tip,
      tail,
      widthPx: Math.max(widthPx, 3),
    };
  });
}

function drawnFromSchematic(airport: Airport, size: number): DrawnRunway[] {
  const valid = airport.runways.filter(
    (r) => r.lengthFt && Number.isFinite(r.headingTrue),
  );
  if (valid.length === 0) return [];

  const laid = layoutRunwaysSchematic(valid);

  let maxExtent = 0;
  for (const r of laid) {
    const rad = (r.angleDeg * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    const cx = r.perpOffsetM * cosA;
    const cy = r.perpOffsetM * -sinA;
    const ex = Math.abs(r.halfLenM * sinA) + Math.abs(r.halfWidthM * cosA);
    const ey = Math.abs(r.halfLenM * cosA) + Math.abs(r.halfWidthM * sinA);
    maxExtent = Math.max(maxExtent, Math.abs(cx) + ex, Math.abs(cy) + ey);
  }
  const viewHalf = Math.max(maxExtent * 1.28, 100);

  const metersToSvg = (mx: number, my: number) => ({
    x: size / 2 + (mx / viewHalf) * (size / 2),
    y: size / 2 - (my / viewHalf) * (size / 2),
  });

  return laid.map((r) => {
    const rad = (r.angleDeg * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    const axisX = sinA;
    const axisY = cosA;
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
}

export const RunwayDiagram: FC<RunwayDiagramProps> = ({ airport, size = 260 }) => {
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

  const realPositions = drawnFromEndpoints(airport, size);
  const drawn = realPositions ?? drawnFromSchematic(airport, size);
  const isSchematic = realPositions === null;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', overflow: 'visible' }}
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

      {isSchematic && (
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
      )}
    </svg>
  );
};

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
