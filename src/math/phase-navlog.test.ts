import { describe, it, expect } from 'vitest';
import { computePhaseLeg } from './phase-navlog';
import type { AircraftProfile, Leg, Waypoint } from '../types';

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
    climbFpm: 700,
    climbTasKt: 75,
    climbGph: 10,
    descentFpm: 500,
    descentTasKt: 110,
    descentGph: 6,
    taxiMinutes: 10,
    taxiGph: 3,
    patternMinutes: 5,
    serviceCeilingFt: 14000,
    ...partial,
  };
}

function wp(id: string, lat: number, lon: number): Waypoint {
  return { id, kind: 'airport', ref: id, name: id, lat, lon };
}

describe('computePhaseLeg', () => {
  const from = wp('A', 37, -120);
  const to = wp('B', 37, -119); // ~48 nm due east at this lat
  const leg: Leg = {
    fromId: 'A',
    toId: 'B',
    altFt: 5500,
    altAutoPicked: true,
  };

  it('first leg models climb from departure elevation', () => {
    const res = computePhaseLeg({
      leg,
      fromWp: from,
      toWp: to,
      prevCruiseAlt: null,
      nextCruiseAlt: null,
      departureElevFt: 100,
      arrivalElevFt: 200,
      aircraft: aircraft(),
      winds: [],
    });
    expect(res.climb).not.toBeNull();
    // Gain 5350 ft at 700 fpm = 7.64 min
    expect(res.climb!.timeMin).toBeCloseTo(5350 / 700, 2);
    expect(res.descent).not.toBeNull(); // last leg also descends to pattern
  });

  it('middle leg with same cruise across neighbors has no climb/descent', () => {
    const res = computePhaseLeg({
      leg,
      fromWp: from,
      toWp: to,
      prevCruiseAlt: 5500,
      nextCruiseAlt: 5500,
      departureElevFt: 100,
      arrivalElevFt: 200,
      aircraft: aircraft(),
      winds: [],
    });
    expect(res.climb).toBeNull();
    expect(res.descent).toBeNull();
    expect(res.cruise.distanceNm).toBeCloseTo(res.distanceNm, 3);
  });

  it('step-up cruise: next leg higher => this leg has no descent', () => {
    const res = computePhaseLeg({
      leg,
      fromWp: from,
      toWp: to,
      prevCruiseAlt: 3500,
      nextCruiseAlt: 7500,
      departureElevFt: 100,
      arrivalElevFt: 200,
      aircraft: aircraft(),
      winds: [],
    });
    expect(res.climb).not.toBeNull();
    expect(res.descent).toBeNull();
  });

  it('emits warning when leg too short for climb', () => {
    // Request 10500 ft from 500 ft across a very short 5 nm leg.
    const short = wp('Z', 37, -120.08);
    const tallLeg: Leg = { ...leg, toId: 'Z', altFt: 10500, altAutoPicked: true };
    const res = computePhaseLeg({
      leg: tallLeg,
      fromWp: from,
      toWp: short,
      prevCruiseAlt: null,
      nextCruiseAlt: null,
      departureElevFt: 500,
      arrivalElevFt: 500,
      aircraft: aircraft(),
      winds: [],
    });
    expect(res.warnings.some((w) => w.kind === 'legTooShortForClimb')).toBe(true);
    // Cruise should be zero — climb + descent fill the whole short distance.
    expect(res.cruise.distanceNm).toBeCloseTo(0, 3);
  });

  it('total time equals sum of phase times', () => {
    const res = computePhaseLeg({
      leg,
      fromWp: from,
      toWp: to,
      prevCruiseAlt: null,
      nextCruiseAlt: null,
      departureElevFt: 100,
      arrivalElevFt: 200,
      aircraft: aircraft(),
      winds: [],
    });
    const sum =
      (res.climb?.timeMin ?? 0) + res.cruise.timeMin + (res.descent?.timeMin ?? 0);
    expect(res.totalTimeMin).toBeCloseTo(sum, 3);
  });
});
