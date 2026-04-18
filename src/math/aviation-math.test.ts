import { describe, it, expect } from 'vitest';
import {
  windTriangle,
  magneticVariation,
  magneticHeading,
  greatCircleDistanceNm,
  greatCircleInitialBearingDeg,
  eteMinutes,
  fuelBurnGal,
  climbProfile,
  interpolateWinds,
  reserveOk,
  normalizeDeg,
} from './aviation-math';

describe('normalizeDeg', () => {
  it('wraps negatives', () => {
    expect(normalizeDeg(-10)).toBeCloseTo(350, 6);
    expect(normalizeDeg(-360)).toBeCloseTo(0, 6);
  });
  it('wraps >=360', () => {
    expect(normalizeDeg(370)).toBeCloseTo(10, 6);
    expect(normalizeDeg(720)).toBeCloseTo(0, 6);
  });
});

describe('windTriangle', () => {
  it('no wind => wca=0, gs=tas, th=tc', () => {
    const r = windTriangle(90, 110, 0, 0);
    expect(r.wcaDeg).toBeCloseTo(0, 6);
    expect(r.thDeg).toBeCloseTo(90, 6);
    expect(r.gsKt).toBeCloseTo(110, 6);
  });

  it('direct headwind reduces GS by wind speed', () => {
    const r = windTriangle(0, 120, 0, 30);
    expect(r.wcaDeg).toBeCloseTo(0, 6);
    expect(r.thDeg).toBeCloseTo(0, 6);
    expect(r.gsKt).toBeCloseTo(90, 6);
  });

  it('direct tailwind increases GS by wind speed', () => {
    const r = windTriangle(0, 120, 180, 30);
    expect(r.wcaDeg).toBeCloseTo(0, 6);
    expect(r.gsKt).toBeCloseTo(150, 6);
  });

  it('right crosswind yields positive WCA (turn right)', () => {
    // TC 000, TAS 100, wind from east (090) at 20 kt
    const r = windTriangle(0, 100, 90, 20);
    expect(r.wcaDeg).toBeGreaterThan(0);
    expect(r.wcaDeg).toBeCloseTo(Math.asin(20 / 100) * (180 / Math.PI), 3);
  });

  it('left crosswind yields negative WCA (turn left)', () => {
    const r = windTriangle(0, 100, 270, 20);
    expect(r.wcaDeg).toBeLessThan(0);
  });

  it('matches textbook: TC 090 TAS 110 wind 180@20 => WCA +10.5\u00B0, GS ~108', () => {
    const r = windTriangle(90, 110, 180, 20);
    // Wind from south, flying east => left crosswind component pushes plane north,
    // so pilot must crab right. Wind angle 180-90=90 (right perpendicular).
    // WCA = asin(20/110 * sin(90\u00B0)) = asin(0.1818) = 10.48\u00B0 (right, positive)
    expect(r.wcaDeg).toBeCloseTo(10.48, 1);
    // GS = 110*cos(10.48\u00B0) - 20*cos(90\u00B0) = 108.16 - 0 = 108.16
    expect(r.gsKt).toBeCloseTo(108.16, 1);
  });
});

describe('greatCircleDistanceNm', () => {
  it('KLAX -> KJFK is ~2144 nm', () => {
    const klax = { lat: 33.9425, lon: -118.4081 };
    const kjfk = { lat: 40.6398, lon: -73.7789 };
    const d = greatCircleDistanceNm(klax, kjfk);
    expect(d).toBeGreaterThan(2100);
    expect(d).toBeLessThan(2200);
  });

  it('zero distance for identical points', () => {
    const p = { lat: 37, lon: -122 };
    expect(greatCircleDistanceNm(p, p)).toBeCloseTo(0, 3);
  });

  it('60 nm per degree of latitude at equator (approximately)', () => {
    const a = { lat: 0, lon: 0 };
    const b = { lat: 1, lon: 0 };
    const d = greatCircleDistanceNm(a, b);
    expect(d).toBeCloseTo(60, 0);
  });
});

describe('greatCircleInitialBearingDeg', () => {
  it('due east from equator at (0,0) to (0,1) is 090', () => {
    const b = greatCircleInitialBearingDeg({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
    expect(b).toBeCloseTo(90, 1);
  });

  it('due north from (0,0) to (1,0) is 000', () => {
    const b = greatCircleInitialBearingDeg({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
    expect(b).toBeCloseTo(0, 1);
  });
});

describe('magneticVariation', () => {
  it('returns a reasonable value at SF Bay (positive east declination is ~13\u00B0E currently)', () => {
    // SFO ~= 37.62 N, 122.38 W. Current WMM puts declination around +13\u00B0 to +14\u00B0 east.
    const decl = magneticVariation(37.62, -122.38, new Date('2025-06-01'));
    expect(decl).toBeGreaterThan(10);
    expect(decl).toBeLessThan(17);
  });
});

describe('magneticHeading', () => {
  it('subtracts east declination (east is least)', () => {
    // If true heading is 090 and declination is +10 (east), magnetic should be 080.
    const trueHdg = 90;
    // Construct a location where we know declination is roughly +10. We use the
    // magneticVariation function itself to know what the answer should be, then
    // verify the relationship.
    const date = new Date('2025-01-01');
    const decl = magneticVariation(40, -100, date);
    const mh = magneticHeading(trueHdg, 40, -100, date);
    expect(mh).toBeCloseTo(normalizeDeg(trueHdg - decl), 3);
  });
});

describe('eteMinutes', () => {
  it('60 nm at 60 kt = 60 min', () => {
    expect(eteMinutes(60, 60)).toBeCloseTo(60, 6);
  });
  it('120 nm at 120 kt = 60 min', () => {
    expect(eteMinutes(120, 120)).toBeCloseTo(60, 6);
  });
  it('zero GS returns infinity', () => {
    expect(eteMinutes(10, 0)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('fuelBurnGal', () => {
  it('60 min at 8 gph = 8 gal', () => {
    expect(fuelBurnGal(60, 8)).toBeCloseTo(8, 6);
  });
  it('30 min at 10 gph = 5 gal', () => {
    expect(fuelBurnGal(30, 10)).toBeCloseTo(5, 6);
  });
});

describe('climbProfile', () => {
  it('climb 3000 ft at 600 fpm, 80 kt TAS => 5 min, 6.67 nm', () => {
    const r = climbProfile({ fromAltFt: 1000, toAltFt: 4000, climbFpm: 600, climbTasKt: 80 });
    expect(r.timeMin).toBeCloseTo(5, 3);
    expect(r.distanceNm).toBeCloseTo(6.667, 2);
  });
  it('zero gain returns zeros', () => {
    const r = climbProfile({ fromAltFt: 5000, toAltFt: 5000, climbFpm: 600, climbTasKt: 80 });
    expect(r.timeMin).toBe(0);
    expect(r.distanceNm).toBe(0);
  });
  it('descending (negative gain) returns zeros', () => {
    const r = climbProfile({ fromAltFt: 5000, toAltFt: 2000, climbFpm: 600, climbTasKt: 80 });
    expect(r.timeMin).toBe(0);
    expect(r.distanceNm).toBe(0);
  });
});

describe('interpolateWinds', () => {
  const table = [
    { altFt: 3000, dirTrueDeg: 270, speedKt: 10 },
    { altFt: 6000, dirTrueDeg: 280, speedKt: 20 },
    { altFt: 9000, dirTrueDeg: 290, speedKt: 30 },
  ];

  it('returns exact match', () => {
    expect(interpolateWinds(table, 6000)).toEqual({ dirTrueDeg: 280, speedKt: 20 });
  });

  it('interpolates midway', () => {
    const r = interpolateWinds(table, 4500);
    expect(r.speedKt).toBeCloseTo(15, 3);
    expect(r.dirTrueDeg).toBeCloseTo(275, 3);
  });

  it('clamps below range', () => {
    expect(interpolateWinds(table, 0)).toEqual({ dirTrueDeg: 270, speedKt: 10 });
  });

  it('clamps above range', () => {
    expect(interpolateWinds(table, 15000)).toEqual({ dirTrueDeg: 290, speedKt: 30 });
  });

  it('empty table returns zeros', () => {
    expect(interpolateWinds([], 5000)).toEqual({ dirTrueDeg: 0, speedKt: 0 });
  });

  it('handles direction wrap (350 -> 10 via 0, not the long way)', () => {
    const wrapTable = [
      { altFt: 3000, dirTrueDeg: 350, speedKt: 10 },
      { altFt: 6000, dirTrueDeg: 10, speedKt: 10 },
    ];
    const r = interpolateWinds(wrapTable, 4500);
    // Shortest arc from 350 to 10 goes through 0 (20 degrees total), so midpoint is 0.
    expect(r.dirTrueDeg).toBeCloseTo(0, 3);
  });
});

describe('reserveOk', () => {
  it('true when reserve fuel remains', () => {
    // 53 gal cap, burned 30 gal, 45 min reserve at 8.5 gph = 6.375 gal needed; 23 left.
    expect(reserveOk(30, 53, 45, 8.5)).toBe(true);
  });
  it('false when reserve insufficient', () => {
    // 53 cap, burned 49 gal, need 6.375 for reserve, only 4 left.
    expect(reserveOk(49, 53, 45, 8.5)).toBe(false);
  });
  it('exact match returns true (>=)', () => {
    expect(reserveOk(46.625, 53, 45, 8.5)).toBe(true);
  });
});
