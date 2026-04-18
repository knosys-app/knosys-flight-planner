import { describe, it, expect } from 'vitest';
import { v4 as uuid } from 'uuid';
import { GpxFormat } from './gpx-codec';
import { FplGarminFormat, FplForeFlightFormat } from './fpl-codec';
import { CsvFormat } from './csv-codec';
import type { AircraftProfile, NavlogRow, Plan } from '../types';

function samplePlan(): Plan {
  const w1Id = uuid();
  const w2Id = uuid();
  const w3Id = uuid();
  return {
    schemaVersion: 1,
    id: uuid(),
    name: 'Test KLAX->KLAS',
    createdAt: '2026-04-17T10:00:00.000Z',
    updatedAt: '2026-04-17T10:00:00.000Z',
    departureIcao: 'KLAX',
    destinationIcao: 'KLAS',
    aircraftProfileId: uuid(),
    waypoints: [
      {
        id: w1Id,
        kind: 'airport',
        ref: 'KLAX',
        name: 'Los Angeles Intl',
        lat: 33.9425,
        lon: -118.4081,
        altFt: 126,
      },
      {
        id: w2Id,
        kind: 'navaid',
        ref: 'DAG',
        name: 'Daggett VOR',
        lat: 34.9537,
        lon: -116.7889,
        altFt: 9500,
      },
      {
        id: w3Id,
        kind: 'airport',
        ref: 'KLAS',
        name: 'Las Vegas McCarran',
        lat: 36.08,
        lon: -115.1522,
        altFt: 2181,
      },
    ],
    legs: [
      { fromId: w1Id, toId: w2Id, altFt: 9500 },
      { fromId: w2Id, toId: w3Id, altFt: 9500 },
    ],
  };
}

function sampleAircraft(): AircraftProfile {
  return {
    schemaVersion: 1,
    id: uuid(),
    name: 'N12345',
    type: 'C172S',
    tasKt: 120,
    fuelBurnGph: 8.5,
    fuelCapacityGal: 53,
    fuelType: '100LL',
    reserveMinutes: 45,
  };
}

function sampleNavlog(): NavlogRow[] {
  return [
    {
      legIndex: 0,
      fromRef: 'KLAX',
      fromName: 'Los Angeles Intl',
      toRef: 'DAG',
      toName: 'Daggett',
      altFt: 9500,
      distanceNm: 110,
      trueCourseDeg: 52,
      windCorrectionAngleDeg: 2,
      trueHeadingDeg: 54,
      magVarDeg: 12,
      magneticHeadingDeg: 42,
      tasKt: 120,
      groundSpeedKt: 128,
      eteMinutes: 51.5,
      fuelBurnedGal: 7.3,
      fuelRemainingGal: 45.7,
      reserveOk: true,
    },
    {
      legIndex: 1,
      fromRef: 'DAG',
      fromName: 'Daggett',
      toRef: 'KLAS',
      toName: 'Las Vegas',
      altFt: 9500,
      distanceNm: 108,
      trueCourseDeg: 76,
      windCorrectionAngleDeg: 1,
      trueHeadingDeg: 77,
      magVarDeg: 12,
      magneticHeadingDeg: 65,
      tasKt: 120,
      groundSpeedKt: 129,
      eteMinutes: 50.2,
      fuelBurnedGal: 7.1,
      fuelRemainingGal: 38.6,
      reserveOk: true,
    },
  ];
}

describe('GpxFormat', () => {
  it('writes valid GPX with route points', () => {
    const plan = samplePlan();
    const xml = GpxFormat.write(plan, sampleAircraft(), sampleNavlog());
    expect(xml).toContain('<gpx');
    expect(xml).toContain('creator="Knosys Flight Planner"');
    expect(xml).toContain('KLAX');
    expect(xml).toContain('KLAS');
    expect(xml).toContain('lat="33.9425"');
    expect(xml).toContain('lon="-118.4081"');
  });

  it('round-trips waypoint ref + coords', () => {
    const plan = samplePlan();
    const xml = GpxFormat.write(plan, sampleAircraft(), sampleNavlog());
    const parsed = GpxFormat.read!(xml);
    expect(parsed.waypoints.length).toBe(3);
    expect(parsed.waypoints[0].ref).toBe('KLAX');
    expect(parsed.waypoints[0].lat).toBeCloseTo(33.9425, 3);
    expect(parsed.waypoints[2].ref).toBe('KLAS');
  });
});

describe('FplGarminFormat', () => {
  it('writes valid Garmin FPL XML', () => {
    const plan = samplePlan();
    const xml = FplGarminFormat.write(plan, sampleAircraft(), sampleNavlog());
    expect(xml).toContain('garmin.com/xmlschemas/FlightPlan/v1');
    expect(xml).toContain('<waypoint-identifier>KLAX</waypoint-identifier>');
    expect(xml).toContain('<waypoint-identifier>KLAS</waypoint-identifier>');
    expect(xml).toContain('<waypoint-type>AIRPORT</waypoint-type>');
  });

  it('round-trips waypoints', () => {
    const plan = samplePlan();
    const xml = FplGarminFormat.write(plan, sampleAircraft(), sampleNavlog());
    const parsed = FplGarminFormat.read!(xml);
    expect(parsed.waypoints.length).toBe(3);
    expect(parsed.waypoints[0].ref).toBe('KLAX');
    expect(parsed.waypoints[1].ref).toBe('DAG');
    expect(parsed.waypoints[1].kind).toBe('navaid');
  });
});

describe('FplForeFlightFormat', () => {
  it('uses ForeFlight xmlns', () => {
    const xml = FplForeFlightFormat.write(samplePlan(), sampleAircraft(), sampleNavlog());
    expect(xml).toContain('foreflight.com/flightplan/1.0');
  });
});

describe('CsvFormat', () => {
  it('includes header lines and navlog columns', () => {
    const csv = CsvFormat.write(samplePlan(), sampleAircraft(), sampleNavlog());
    expect(csv).toContain('# Plan: Test KLAX->KLAS');
    expect(csv).toContain('Leg');
    expect(csv).toContain('KLAX');
    expect(csv).toContain('DAG');
    expect(csv).toContain('KLAS');
    expect(csv).toContain('YES');
  });

  it('has one data row per navlog entry', () => {
    const csv = CsvFormat.write(samplePlan(), sampleAircraft(), sampleNavlog());
    // Header comments (5 lines) + csv header + 2 data rows = 8 lines + trailing newline
    const lines = csv.trim().split('\n');
    expect(lines.length).toBe(5 + 1 + 2);
  });
});
