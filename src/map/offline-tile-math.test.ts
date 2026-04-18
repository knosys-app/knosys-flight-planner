import { describe, expect, it } from 'vitest';
import {
  bboxToTileList,
  estimateTileCount,
  lat2tile,
  lon2tile,
} from './offline-tile-math';

describe('lon2tile', () => {
  it('centers (lon=0) at tile x = 2^(z-1)', () => {
    expect(lon2tile(0, 0)).toBe(0);
    expect(lon2tile(0, 1)).toBe(1);
    expect(lon2tile(0, 2)).toBe(2);
    expect(lon2tile(0, 10)).toBe(512);
  });

  it('antimeridian edges (±180) wrap to 0 / 2^z-1', () => {
    expect(lon2tile(-180, 5)).toBe(0);
    expect(lon2tile(180, 5)).toBeLessThanOrEqual(31);
  });

  it('San Francisco lon ≈ -122.4 at z=10 ≈ 163', () => {
    expect(lon2tile(-122.4, 10)).toBe(163);
  });
});

describe('lat2tile', () => {
  it('equator (lat=0) at tile y = 2^(z-1)', () => {
    expect(lat2tile(0, 0)).toBe(0);
    expect(lat2tile(0, 1)).toBe(1);
    expect(lat2tile(0, 10)).toBe(512);
  });

  it('clamps beyond ±85.0511', () => {
    expect(lat2tile(90, 10)).toBe(lat2tile(85.0511, 10));
    expect(lat2tile(-90, 10)).toBe(lat2tile(-85.0511, 10));
  });

  it('San Francisco lat ≈ 37.77 at z=10 ≈ 395', () => {
    expect(lat2tile(37.77, 10)).toBe(395);
  });
});

describe('bboxToTileList', () => {
  it('z=0 emits exactly one tile regardless of bbox', () => {
    const tiles = bboxToTileList([-180, -85, 180, 85], 0, 0);
    expect(tiles).toEqual([{ z: 0, x: 0, y: 0 }]);
  });

  it('covers expected tile count for CONUS z=0-4', () => {
    // Continental US at low zoom is a small region
    const tiles = bboxToTileList([-125, 24, -66, 50], 0, 4);
    // z=0: 1 tile, z=1: up to 2, z=2: ~2, z=3: ~4-6, z=4: ~10
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThan(50);
    // First tile always (0,0,0)
    expect(tiles[0]).toEqual({ z: 0, x: 0, y: 0 });
  });

  it('throws for antimeridian-crossing bboxes', () => {
    expect(() => bboxToTileList([170, 30, -170, 50], 0, 4)).toThrow();
  });

  it('empty when zMin > zMax', () => {
    expect(bboxToTileList([-125, 24, -66, 50], 5, 3)).toEqual([]);
  });
});

describe('estimateTileCount', () => {
  it('matches bboxToTileList length', () => {
    const bbox: [number, number, number, number] = [-125, 24, -66, 50];
    const tiles = bboxToTileList(bbox, 0, 6);
    const estimated = estimateTileCount(bbox, 0, 6);
    expect(estimated).toBe(tiles.length);
  });

  it('scales roughly 4x per zoom level', () => {
    const bbox: [number, number, number, number] = [-125, 24, -66, 50];
    const count8 = estimateTileCount(bbox, 8, 8);
    const count9 = estimateTileCount(bbox, 9, 9);
    expect(count9).toBeGreaterThan(count8);
    expect(count9).toBeLessThan(count8 * 6); // imprecise but upper bound
  });
});
