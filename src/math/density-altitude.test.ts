import { describe, expect, it } from 'vitest';
import { computeDensityAltitude, densityAltitudeChip } from './density-altitude';

describe('computeDensityAltitude', () => {
  it('sea level, standard day → DA ≈ 0', () => {
    const r = computeDensityAltitude({ fieldElevFt: 0, tempC: 15, altimeterInHg: 29.92 });
    expect(r.pressureAltFt).toBe(0);
    expect(r.isaTempC).toBeCloseTo(15, 1);
    expect(r.densityAltFt).toBeCloseTo(0, 1);
    expect(r.deviationFt).toBeCloseTo(0, 1);
  });

  it('1000 ft field, standard temp at elevation → DA ≈ field', () => {
    // ISA temp at 1000 ft pressure alt = 13°C
    const r = computeDensityAltitude({ fieldElevFt: 1000, tempC: 13, altimeterInHg: 29.92 });
    expect(r.pressureAltFt).toBe(1000);
    expect(r.densityAltFt).toBeCloseTo(1000, 0);
  });

  it('hot day at low field pushes DA up significantly', () => {
    // Phoenix-summer scenario: 1100 ft field, 40 °C, 29.90 inHg
    const r = computeDensityAltitude({ fieldElevFt: 1100, tempC: 40, altimeterInHg: 29.9 });
    expect(r.densityAltFt).toBeGreaterThan(3500);
    expect(r.densityAltFt).toBeLessThan(4500);
  });

  it('cold winter day lowers DA below field', () => {
    // Anchorage: 150 ft field, -20 °C, 30.10 inHg
    const r = computeDensityAltitude({ fieldElevFt: 150, tempC: -20, altimeterInHg: 30.1 });
    expect(r.densityAltFt).toBeLessThan(-2800);
    expect(r.deviationFt).toBeLessThan(-2800);
  });

  it('pressure altitude reflects altimeter deviation from 29.92', () => {
    const high = computeDensityAltitude({ fieldElevFt: 1000, tempC: 13, altimeterInHg: 30.42 });
    // altimeter 30.42 is 0.50 inHg above standard → PA = 1000 + (-500) = 500
    expect(high.pressureAltFt).toBe(500);
  });
});

describe('densityAltitudeChip', () => {
  it('returns null under threshold', () => {
    expect(
      densityAltitudeChip(
        { pressureAltFt: 0, isaTempC: 15, densityAltFt: 100, deviationFt: 100 },
        500,
      ),
    ).toBeNull();
  });

  it('formats positive deviation with +', () => {
    expect(
      densityAltitudeChip({
        pressureAltFt: 1100,
        isaTempC: 12.8,
        densityAltFt: 4200,
        deviationFt: 3100,
      }),
    ).toBe('DA +3,100 ft');
  });

  it('formats negative deviation with the minus sign', () => {
    const s = densityAltitudeChip({
      pressureAltFt: 150,
      isaTempC: 14.7,
      densityAltFt: -3000,
      deviationFt: -3150,
    });
    expect(s).toMatch(/^DA /);
    expect(s).toMatch(/3,150 ft$/);
  });
});
