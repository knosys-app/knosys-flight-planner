import { describe, expect, it } from 'vitest';
import {
  interpAngle,
  interpolateWindAt,
  pressureHpaToFeet,
  type WindsAloft,
} from './winds-aloft-client';

describe('pressureHpaToFeet', () => {
  it('850 hPa is roughly 5000 ft', () => {
    const ft = pressureHpaToFeet(850);
    expect(ft).toBeGreaterThan(4500);
    expect(ft).toBeLessThan(5500);
  });
  it('700 hPa is roughly 10000 ft', () => {
    const ft = pressureHpaToFeet(700);
    expect(ft).toBeGreaterThan(9500);
    expect(ft).toBeLessThan(10500);
  });
  it('500 hPa is roughly 18000 ft', () => {
    const ft = pressureHpaToFeet(500);
    expect(ft).toBeGreaterThan(17500);
    expect(ft).toBeLessThan(18800);
  });
});

describe('interpAngle', () => {
  it('midpoint between 10 and 30 is 20', () => {
    expect(Math.round(interpAngle(10, 30, 0.5))).toBe(20);
  });
  it('wraps across 0/360: midpoint of 350 and 10 is 0', () => {
    const mid = interpAngle(350, 10, 0.5);
    expect(Math.round(mid) % 360).toBe(0);
  });
  it('t=0 returns a; t=1 returns b mod 360', () => {
    expect(interpAngle(100, 200, 0)).toBe(100);
    expect(interpAngle(100, 200, 1)).toBe(200);
  });
});

describe('interpolateWindAt', () => {
  const col: WindsAloft = {
    lat: 47,
    lon: -122,
    forecastTimeIso: '2026-04-22T12:00:00Z',
    fetchedAtIso: '2026-04-22T12:00:00Z',
    levels: [
      { pressureHpa: 1000, altFt: 364, dirTrueDeg: 180, speedKt: 10, tempC: 15 },
      { pressureHpa: 850, altFt: 5000, dirTrueDeg: 220, speedKt: 20, tempC: 5 },
      { pressureHpa: 700, altFt: 10000, dirTrueDeg: 260, speedKt: 30, tempC: -10 },
    ],
  };

  it('interpolates between two pressure levels', () => {
    const w = interpolateWindAt(col, 7500); // halfway between 5000 and 10000
    expect(w).not.toBeNull();
    expect(w!.speedKt).toBe(25);
    expect(w!.dirTrueDeg).toBe(240);
    expect(w!.tempC).toBeCloseTo(-2.5, 1);
  });

  it('clamps below the lowest level', () => {
    const w = interpolateWindAt(col, -500);
    expect(w!.speedKt).toBe(10);
    expect(w!.dirTrueDeg).toBe(180);
  });

  it('clamps above the highest level', () => {
    const w = interpolateWindAt(col, 50000);
    expect(w!.speedKt).toBe(30);
  });

  it('returns null when all levels lack data', () => {
    const empty: WindsAloft = {
      ...col,
      levels: col.levels.map((l) => ({ ...l, dirTrueDeg: null, speedKt: null })),
    };
    expect(interpolateWindAt(empty, 5000)).toBeNull();
  });
});
