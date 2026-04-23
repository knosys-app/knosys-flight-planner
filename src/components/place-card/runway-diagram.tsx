import type { FC } from 'react';
import type { Airport, Runway } from '../../types';

/**
 * Miniature airport runway diagram, rendered at airport-local scale.
 * Shows each runway as a rounded rectangle oriented by its true heading,
 * with end-identifier labels (e.g. 16R, 34L) at each tip. Intended as the
 * hero of the airport place card — not a chart, but a legible glyph.
 */

const FT_PER_M = 3.28084;

interface RunwayRect {
  runway: Runway;
  cx: number;
  cy: number;
  halfLen: number;
  halfWidth: number;
  angleDeg: number;
}

function metersToDeg(m: number, latRad: number): { lon: number; lat: number } {
  return {
    lat: m / 111320,
    lon: m / (111320 * Math.cos(latRad)),
  };
}

export interface RunwayDiagramProps {
  airport: Airport;
  size?: number;
}

export const RunwayDiagram: FC<RunwayDiagramProps> = ({ airport, size = 200 }) => {
  const runways = airport.runways.filter(
    (r) => r.lengthFt && Number.isFinite(r.headingTrue),
  );
  if (runways.length === 0) {
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

  const latRad = (airport.lat * Math.PI) / 180;

  // Convert runways to local meters-from-airport coordinates.
  const rects = runways.map<RunwayRect>((r) => {
    return {
      runway: r,
      cx: 0,
      cy: 0,
      halfLen: (r.lengthFt / FT_PER_M) / 2,
      halfWidth: Math.max(r.widthFt || 0, 30) / FT_PER_M / 2,
      angleDeg: r.headingTrue,
    };
  });

  // Bounding box in meters needed to fit all runway rectangles.
  let maxHalfExtent = 0;
  for (const r of rects) {
    const rad = (r.angleDeg * Math.PI) / 180;
    const ex = Math.abs(r.halfLen * Math.sin(rad)) + Math.abs(r.halfWidth * Math.cos(rad));
    const ey = Math.abs(r.halfLen * Math.cos(rad)) + Math.abs(r.halfWidth * Math.sin(rad));
    maxHalfExtent = Math.max(maxHalfExtent, ex, ey);
  }
  const margin = 1.2;
  const viewHalf = maxHalfExtent * margin;

  const metersToSvg = (mx: number, my: number) => {
    const x = size / 2 + (mx / viewHalf) * (size / 2);
    const y = size / 2 - (my / viewHalf) * (size / 2);
    return { x, y };
  };

  // SVG coordinate for a local-meter point along a runway axis.
  const runwayEndpoints = (r: RunwayRect) => {
    const rad = (r.angleDeg * Math.PI) / 180;
    const dx = Math.sin(rad) * r.halfLen;
    const dy = Math.cos(rad) * r.halfLen;
    return {
      tip: metersToSvg(dx, dy),
      tail: metersToSvg(-dx, -dy),
    };
  };

  // Track whether we even need the lat-based meters scale; silences the
  // linter for an otherwise unused variable.
  void latRad;
  void metersToDeg;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height={size}
      style={{ display: 'block' }}
      aria-label={`${airport.icao} runway diagram`}
      role="img"
    >
      <defs>
        <linearGradient id={`rwy-bg-${airport.icao}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--kfp-surface-tint))" stopOpacity="0.9" />
          <stop offset="100%" stopColor="rgb(var(--kfp-surface-tint))" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      <rect
        x="0"
        y="0"
        width={size}
        height={size}
        fill={`url(#rwy-bg-${airport.icao})`}
      />

      {/* Center pin of the airport */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r="2.5"
        fill="rgb(var(--kfp-accent))"
        opacity="0.7"
      />

      {rects.map((r, i) => {
        const { tip, tail } = runwayEndpoints(r);
        // Width of the runway stripe in px — scale from meters via the
        // same ratio used for endpoints.
        const widthPx = (r.halfWidth / viewHalf) * (size / 2) * 2;
        return (
          <g key={i}>
            <line
              x1={tail.x}
              y1={tail.y}
              x2={tip.x}
              y2={tip.y}
              stroke="rgb(var(--kfp-fg))"
              strokeOpacity="0.82"
              strokeWidth={Math.max(widthPx, 3)}
              strokeLinecap="round"
            />
            <line
              x1={tail.x}
              y1={tail.y}
              x2={tip.x}
              y2={tip.y}
              stroke="rgb(var(--kfp-surface-tint))"
              strokeOpacity="0.95"
              strokeWidth={Math.max(widthPx * 0.2, 0.6)}
              strokeDasharray="3 3"
            />
            {r.runway.leIdent && (
              <text
                x={tail.x}
                y={tail.y}
                dy="3"
                textAnchor="middle"
                style={{
                  fontFamily: 'var(--kfp-font-mono)',
                  fontSize: 9,
                  fill: 'rgb(var(--kfp-fg))',
                  fontWeight: 600,
                }}
              >
                {r.runway.leIdent}
              </text>
            )}
            {r.runway.heIdent && (
              <text
                x={tip.x}
                y={tip.y}
                dy="3"
                textAnchor="middle"
                style={{
                  fontFamily: 'var(--kfp-font-mono)',
                  fontSize: 9,
                  fill: 'rgb(var(--kfp-fg))',
                  fontWeight: 600,
                }}
              >
                {r.runway.heIdent}
              </text>
            )}
          </g>
        );
      })}

      {/* North arrow */}
      <g transform={`translate(${size - 18} 18)`}>
        <circle r="10" fill="rgb(var(--kfp-surface-tint))" opacity="0.85" />
        <path
          d="M 0 -6 L 3 5 L 0 3 L -3 5 Z"
          fill="rgb(var(--kfp-accent))"
        />
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
    </svg>
  );
};
