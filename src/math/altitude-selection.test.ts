import { describe, it, expect } from 'vitest';
import { selectCruiseAltitude } from './altitude-selection';
import type { AircraftProfile, Obstacle, ProfileSample } from '../types';

function aircraft(partial: Partial<AircraftProfile> = {}): AircraftProfile {
  return {
    schemaVersion: 2,
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Test',
    type: 'C172S',
    tasKt: 120,
    fuelBurnGph: 8.5,
    fuelCapacityGal: 53,
    fuelType: '100LL',
    reserveMinutes: 45,
    serviceCeilingFt: 14000,
    ...partial,
  };
}

function sample(elev: number, along = 0): ProfileSample {
  return { alongTrackNm: along, lat: 37, lon: -120, terrainElevFt: elev };
}

describe('selectCruiseAltitude', () => {
  it('non-mountainous eastbound terrain 2500 → 3500 (buffer 1000, no VFR round below 3000 AGL from sea level)', () => {
    const res = selectCruiseAltitude({
      samples: [sample(1000), sample(2500), sample(2000)],
      magneticCourseDeg: 90,
      departureElevFt: 0,
      aircraft: aircraft(),
      obstaclesEnabled: false,
    });
    // Max terrain 2500 + 1000 buffer = 3500 ft. AGL = 3500 > 3000, so VFR rule applies (eastbound odd+500).
    // 3500 is already odd+500, so unchanged.
    expect(res.altFt).toBe(3500);
    expect(res.isMountainous).toBe(false);
  });

  it('non-mountainous westbound terrain 4700 → 6500 (4700+1000=5700 → VFR round → 6500)', () => {
    const res = selectCruiseAltitude({
      samples: [sample(4700)],
      magneticCourseDeg: 270,
      departureElevFt: 0,
      aircraft: aircraft(),
      obstaclesEnabled: false,
    });
    // 4700 + 1000 = 5700. Above 3000 AGL → westbound even+500 → 6500.
    expect(res.altFt).toBe(6500);
  });

  it('mountainous terrain 9500 eastbound → 11500 (2000 buffer + VFR round)', () => {
    const res = selectCruiseAltitude({
      samples: [sample(6000), sample(9500), sample(7000)],
      magneticCourseDeg: 90,
      departureElevFt: 1000,
      aircraft: aircraft(),
      obstaclesEnabled: false,
    });
    // Mountainous: 9500 + 2000 = 11500. Eastbound odd+500 → 11500 is valid.
    expect(res.altFt).toBe(11500);
    expect(res.isMountainous).toBe(true);
  });

  it('service ceiling pins altitude and emits warning', () => {
    const res = selectCruiseAltitude({
      samples: [sample(13000)],
      magneticCourseDeg: 90,
      departureElevFt: 0,
      aircraft: aircraft({ serviceCeilingFt: 12000 }),
      obstaclesEnabled: false,
    });
    expect(res.altFt).toBe(12000);
    expect(res.warnings.some((w) => w.kind === 'serviceCeilingExceeded')).toBe(true);
  });

  it('obstacles considered when enabled', () => {
    const obstacles: Obstacle[] = [
      {
        id: 'o1',
        lat: 37,
        lon: -120,
        heightAgl: 1000,
        heightMsl: 6500,
        type: 'tower',
      },
    ];
    const res = selectCruiseAltitude({
      samples: [sample(2000)],
      obstacles,
      magneticCourseDeg: 90,
      departureElevFt: 0,
      aircraft: aircraft(),
      obstaclesEnabled: true,
    });
    // Max = max(2000 terrain, 6500 obstacle) = 6500. +1000 buffer = 7500. VFR-valid (eastbound odd+500).
    expect(res.altFt).toBe(7500);
  });

  it('obstacles ignored when disabled', () => {
    const obstacles: Obstacle[] = [
      {
        id: 'o1',
        lat: 37,
        lon: -120,
        heightAgl: 1000,
        heightMsl: 6500,
        type: 'tower',
      },
    ];
    const res = selectCruiseAltitude({
      samples: [sample(2000)],
      obstacles,
      magneticCourseDeg: 90,
      departureElevFt: 0,
      aircraft: aircraft(),
      obstaclesEnabled: false,
    });
    // 2000 + 1000 = 3000 → VFR applies? AGL = 3000, not strictly > 3000. So it stays at 3000 rounded to 100.
    // Actually our code: agl > 3000 (strict), so 3000 AGL does NOT trigger VFR rounding.
    expect(res.altFt).toBe(3000);
  });

  it('low-altitude leg below 3000 AGL skips VFR rounding', () => {
    const res = selectCruiseAltitude({
      samples: [sample(500)],
      magneticCourseDeg: 90,
      departureElevFt: 0,
      aircraft: aircraft(),
      obstaclesEnabled: false,
    });
    // 500 + 1000 = 1500. AGL = 1500, not > 3000 → no VFR round.
    expect(res.altFt).toBe(1500);
  });
});
