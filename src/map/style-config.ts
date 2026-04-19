import { layers, namedFlavor } from '@protomaps/basemaps';
import type { StyleSpecification } from 'maplibre-gl';
import { MAP_ATTRIBUTION } from '../constants';

const SPRITE_URL = 'https://protomaps.github.io/basemaps-assets/sprites/v4/light';
const GLYPHS_URL =
  'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';

/**
 * Build a MapLibre style for the Protomaps "light" basemap that reads tiles
 * from our custom `pmtiles://` protocol. Layers are produced by the
 * @protomaps/basemaps npm package — no remote style fetch required, which
 * keeps cold start fast and makes the style work even when only the tile
 * CDN is reachable.
 *
 * Sprite + glyph URLs point at protomaps.github.io (CORS-friendly). They
 * aren't cached in OPFS yet — first paint needs internet. v1.2 can cache
 * these too if/when pilots report a problem.
 */
export function buildPlanetStyle(planetUrl: string): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sprite: SPRITE_URL,
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${planetUrl}`,
        attribution: MAP_ATTRIBUTION,
      },
    },
    layers: layers('protomaps', namedFlavor('light'), { lang: 'en' }),
  } as StyleSpecification;
}
