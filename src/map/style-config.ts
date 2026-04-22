import { layers, namedFlavor } from '@protomaps/basemaps';
import type { StyleSpecification } from 'maplibre-gl';
import { MAP_ATTRIBUTION } from '../constants';

export type MapTheme = 'light' | 'dark';

const GLYPHS_URL =
  'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';

function spriteUrl(theme: MapTheme): string {
  return `https://protomaps.github.io/basemaps-assets/sprites/v4/${theme}`;
}

/**
 * Current system color-scheme preference as a MapTheme. Safe at module
 * load — `matchMedia` is available in every modern Electron renderer.
 */
export function currentMapTheme(): MapTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * Build a MapLibre style for the Protomaps basemap that reads tiles from
 * our custom `pmtiles://` protocol. Layers are produced by the
 * @protomaps/basemaps npm package — no remote style fetch, fast cold
 * start, works with only the tile CDN reachable.
 *
 * Theme selects between named Protomaps flavors ("light" / "dark") so
 * the map palette tracks the host's appearance. A matchMedia listener
 * in map-viewer swaps styles when the user changes system appearance
 * mid-session.
 */
export function buildPlanetStyle(
  planetUrl: string,
  theme: MapTheme = 'light',
): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sprite: spriteUrl(theme),
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${planetUrl}`,
        attribution: MAP_ATTRIBUTION,
      },
    },
    layers: layers('protomaps', namedFlavor(theme), { lang: 'en' }),
  } as StyleSpecification;
}
