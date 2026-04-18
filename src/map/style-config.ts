import { PROTOMAPS_STYLE_URL } from '../constants';
import { pluginFetch } from './plugin-fetch';

type StyleSource = {
  type?: string;
  url?: string;
  tiles?: string[];
};

type StyleSpec = {
  version?: number;
  sources?: Record<string, StyleSource>;
  sprite?: string;
  glyphs?: string;
  [k: string]: unknown;
};

/**
 * Fetch the Protomaps "light" basemap style and rewrite the vector source
 * to reference our `pmtiles://` archive. Sprite + glyphs are left as-is
 * (they're served by GitHub Pages, which has CORS).
 */
export async function buildPlanetStyle(planetUrl: string): Promise<StyleSpec> {
  const res = await pluginFetch(PROTOMAPS_STYLE_URL);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(
      `Failed to load Protomaps style (${res.status}): ${PROTOMAPS_STYLE_URL}`,
    );
  }
  const text = new TextDecoder().decode(res.body);
  const style = JSON.parse(text) as StyleSpec;

  const pmtilesUrl = `pmtiles://${planetUrl}`;

  if (style.sources) {
    for (const [name, src] of Object.entries(style.sources)) {
      if (src && (src.type === 'vector' || src.type === 'raster')) {
        // Protomaps' published styles reference protomaps.com/v4.pmtiles
        // via `url`. Swap to our pmtiles:// pointer at the planet archive.
        src.url = pmtilesUrl;
        delete src.tiles;
      }
      void name;
    }
  }

  return style;
}
