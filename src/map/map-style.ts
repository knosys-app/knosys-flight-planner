import type { StyleSpecification } from 'maplibre-gl';
import { pmtilesSourceUrl } from './pmtiles-protocol';

/**
 * Minimal Protomaps-compatible style. A real release should swap in the
 * full published Protomaps basemaps styles, but this keeps v1 self-contained.
 * Input: an array of installed region ids (all shown as sources).
 */
export function buildStyle(regionIds: string[]): StyleSpecification {
  const sources: StyleSpecification['sources'] = {};
  for (const id of regionIds) {
    sources[id] = {
      type: 'vector',
      url: pmtilesSourceUrl(id),
    };
  }

  const layers: StyleSpecification['layers'] = [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#EAEFF2' },
    },
  ];

  regionIds.forEach((id) => {
    layers.push(
      {
        id: `${id}-landcover`,
        type: 'fill',
        source: id,
        'source-layer': 'earth',
        paint: { 'fill-color': '#E8ECEE' },
      },
      {
        id: `${id}-water`,
        type: 'fill',
        source: id,
        'source-layer': 'water',
        paint: { 'fill-color': '#B3D5E5' },
      },
      {
        id: `${id}-roads`,
        type: 'line',
        source: id,
        'source-layer': 'roads',
        paint: {
          'line-color': '#C8C8C8',
          'line-width': 0.5,
        },
      },
      {
        id: `${id}-boundaries`,
        type: 'line',
        source: id,
        'source-layer': 'boundaries',
        paint: {
          'line-color': '#888',
          'line-width': 0.5,
          'line-dasharray': [2, 2],
        },
      },
    );
  });

  return {
    version: 8,
    glyphs: undefined,
    sources,
    layers,
  };
}
