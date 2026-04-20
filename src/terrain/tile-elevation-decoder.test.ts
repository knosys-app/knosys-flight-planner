import { describe, it, expect } from 'vitest';
import {
  decodeTerrariumPixelMeters,
  decodeTerrariumPixelFeet,
  decodeTerrariumTileFeet,
} from './tile-elevation-decoder';

describe('decodeTerrariumPixelMeters', () => {
  it('oceans encode at zero RGB → -32768 m', () => {
    expect(decodeTerrariumPixelMeters(0, 0, 0)).toBe(-32768);
  });
  it('RGB 128,0,0 encodes 0 m (sea level: 128*256 - 32768 = 0)', () => {
    expect(decodeTerrariumPixelMeters(128, 0, 0)).toBe(0);
  });
  it('RGB (128, 128, 128) encodes 128.5 m', () => {
    expect(decodeTerrariumPixelMeters(128, 128, 128)).toBeCloseTo(128.5, 3);
  });
  it('RGB (129, 0, 0) → 256 m (129*256 - 32768 = 256)', () => {
    expect(decodeTerrariumPixelMeters(129, 0, 0)).toBe(256);
  });
  it('RGB (130, 0, 0) → 512 m (130*256 - 32768 = 512)', () => {
    expect(decodeTerrariumPixelMeters(130, 0, 0)).toBe(512);
  });
});

describe('decodeTerrariumPixelFeet', () => {
  it('converts to feet (3.28084 ft/m)', () => {
    const m = decodeTerrariumPixelMeters(130, 0, 0);
    expect(decodeTerrariumPixelFeet(130, 0, 0)).toBeCloseTo(m * 3.28084, 3);
  });
});

describe('decodeTerrariumTileFeet', () => {
  it('decodes a 2x2 tile in order', () => {
    // 4 pixels: (0,0,0), (128,0,0), (129,0,0), (130,0,0)
    const rgba = new Uint8ClampedArray([
      0, 0, 0, 255,
      128, 0, 0, 255,
      129, 0, 0, 255,
      130, 0, 0, 255,
    ]);
    const out = decodeTerrariumTileFeet(rgba, 2, 2);
    expect(out).toHaveLength(4);
    expect(out[0]).toBeCloseTo(-32768 * 3.28084, 1);
    expect(out[1]).toBeCloseTo(0, 1);
    expect(out[2]).toBeCloseTo(256 * 3.28084, 1);
    expect(out[3]).toBeCloseTo(512 * 3.28084, 1);
  });
});
