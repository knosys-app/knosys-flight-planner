import { describe, expect, it } from 'vitest';
import { migrateAircraft, migratePlan } from './migrations';

describe('migrateAircraft', () => {
  it('v1 → v3 fills block-time defaults + bumps to 3', () => {
    const v1 = {
      schemaVersion: 1,
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Old C172',
      type: 'C172P',
      tasKt: 115,
      fuelBurnGph: 8,
      fuelCapacityGal: 42,
      fuelType: '100LL',
      reserveMinutes: 30,
    };
    const v3 = migrateAircraft(v1) as any;
    expect(v3.schemaVersion).toBe(3);
    expect(v3.climbGph).toBeCloseTo(8 * 1.15, 3);
    expect(v3.descentFpm).toBe(500);
    expect(v3.taxiMinutes).toBe(10);
    expect(v3.serviceCeilingFt).toBe(14000);
    // Name/type pass through.
    expect(v3.name).toBe('Old C172');
  });

  it('v2 → v3 bumps version without mutating existing fields', () => {
    const v2 = {
      schemaVersion: 2,
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      name: 'Warrior',
      type: 'PA-28-161',
      tasKt: 108,
      fuelBurnGph: 8,
      fuelCapacityGal: 48,
      fuelType: '100LL',
      reserveMinutes: 45,
      climbGph: 9,
      descentFpm: 500,
      descentTasKt: 105,
      descentGph: 5,
      taxiMinutes: 10,
      taxiGph: 2.5,
      patternMinutes: 5,
      serviceCeilingFt: 11000,
      emptyWeightLb: 1420,
    };
    const v3 = migrateAircraft(v2) as any;
    expect(v3.schemaVersion).toBe(3);
    expect(v3.emptyWeightLb).toBe(1420);
    expect(v3.serviceCeilingFt).toBe(11000);
    // v0.5.1 leaves W&B fields undefined so the editor prompts.
    expect(v3.weightStations).toBeUndefined();
    expect(v3.envelopeCorners).toBeUndefined();
  });

  it('v3 is returned unchanged', () => {
    const v3 = {
      schemaVersion: 3,
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      name: 'SR22',
      type: 'SR22',
      tasKt: 180,
      fuelBurnGph: 16,
      fuelCapacityGal: 92,
      fuelType: '100LL',
      reserveMinutes: 45,
      weightStations: [{ id: 'a', name: 'Front', armIn: 37 }],
    };
    const out = migrateAircraft(v3) as any;
    expect(out).toBe(v3);
  });
});

describe('migratePlan', () => {
  it('v1 → v2 adds altAutoPicked: false to legs', () => {
    const v1 = {
      schemaVersion: 1,
      id: 'p1',
      name: 'Old plan',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      departureIcao: 'KS50',
      destinationIcao: 'KPSC',
      waypoints: [],
      legs: [{ fromId: 'a', toId: 'b', altFt: 5500 }],
      aircraftProfileId: 'x',
    };
    const v2 = migratePlan(v1) as any;
    expect(v2.schemaVersion).toBe(2);
    expect(v2.legs[0].altAutoPicked).toBe(false);
  });
});
