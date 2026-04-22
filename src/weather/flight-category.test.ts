import { describe, expect, it } from 'vitest';
import { ceilingFromClouds, deriveFlightCategory } from './flight-category';

describe('ceilingFromClouds', () => {
  it('returns null for no ceiling-class layers', () => {
    expect(ceilingFromClouds([])).toBeNull();
    expect(ceilingFromClouds([{ coverage: 'FEW', baseFtAgl: 2000 }])).toBeNull();
    expect(
      ceilingFromClouds([
        { coverage: 'FEW', baseFtAgl: 2000 },
        { coverage: 'SCT', baseFtAgl: 5000 },
      ]),
    ).toBeNull();
  });

  it('picks the lowest BKN/OVC/VV', () => {
    expect(
      ceilingFromClouds([
        { coverage: 'FEW', baseFtAgl: 2000 },
        { coverage: 'BKN', baseFtAgl: 8000 },
        { coverage: 'OVC', baseFtAgl: 4500 },
      ]),
    ).toBe(4500);
  });

  it('handles VV as a ceiling', () => {
    expect(ceilingFromClouds([{ coverage: 'VV', baseFtAgl: 200 }])).toBe(200);
  });
});

describe('deriveFlightCategory', () => {
  it('VFR when no constraints', () => {
    expect(deriveFlightCategory(null, Infinity)).toBe('VFR');
    expect(deriveFlightCategory(10000, 10)).toBe('VFR');
  });

  it('MVFR at 2500 ceiling', () => {
    expect(deriveFlightCategory(2500, 10)).toBe('MVFR');
  });

  it('MVFR at 4 sm visibility', () => {
    expect(deriveFlightCategory(10000, 4)).toBe('MVFR');
  });

  it('IFR at 800 ceiling', () => {
    expect(deriveFlightCategory(800, 10)).toBe('IFR');
  });

  it('IFR at 2 sm visibility', () => {
    expect(deriveFlightCategory(10000, 2)).toBe('IFR');
  });

  it('LIFR at 300 ceiling', () => {
    expect(deriveFlightCategory(300, 10)).toBe('LIFR');
  });

  it('LIFR at 0.5 sm visibility', () => {
    expect(deriveFlightCategory(10000, 0.5)).toBe('LIFR');
  });

  it('UNKNOWN when both inputs null', () => {
    expect(deriveFlightCategory(null, null)).toBe('UNKNOWN');
  });
});
