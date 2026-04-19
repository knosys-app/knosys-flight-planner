import { describe, expect, it } from 'vitest';
import { pickPrimaryFrequency, waypointFrequency } from './frequency-picker';
import type { Frequency, Navaid, Waypoint } from '../types';

const klaxFreqs: Frequency[] = [
  { type: 'APP', description: 'SOCAL APP', mhz: 124.3 },
  { type: 'ATIS', description: 'ATIS', mhz: 133.8 },
  { type: 'CLD', description: 'CLNC DEL', mhz: 121.4 },
  { type: 'GND', description: 'GND', mhz: 121.65 },
  { type: 'TWR', description: 'TWR', mhz: 119.8 },
  { type: 'UNIC', description: 'UNICOM', mhz: 122.95 },
];

const smallField: Frequency[] = [
  { type: 'CTAF', description: 'CTAF', mhz: 122.8 },
  { type: 'UNIC', description: 'UNICOM', mhz: 122.8 },
];

const awosOnly: Frequency[] = [
  { type: 'AWOS', description: 'AWOS-3', mhz: 135.075 },
  { type: 'MISC', description: 'Ops', mhz: 131.0 },
];

const miscOnly: Frequency[] = [
  { type: 'MISC', description: 'Other', mhz: 128.25 },
  { type: 'FSS', description: 'FSS', mhz: 122.2 },
];

describe('pickPrimaryFrequency', () => {
  it('KLAX prefers CTAF (none), then TWR 119.8', () => {
    const f = pickPrimaryFrequency(klaxFreqs);
    expect(f?.type).toBe('TWR');
    expect(f?.mhz).toBeCloseTo(119.8, 1);
  });

  it('uncontrolled field prefers CTAF over UNICOM even with same freq', () => {
    const f = pickPrimaryFrequency(smallField);
    expect(f?.type).toBe('CTAF');
  });

  it('falls back to AWOS when no CTAF/TWR/UNIC present', () => {
    const f = pickPrimaryFrequency(awosOnly);
    expect(f?.type).toBe('AWOS');
  });

  it('returns null when only MISC/FSS are present', () => {
    expect(pickPrimaryFrequency(miscOnly)).toBeNull();
  });

  it('returns null for empty/undefined input', () => {
    expect(pickPrimaryFrequency([])).toBeNull();
    expect(pickPrimaryFrequency(undefined)).toBeNull();
  });

  it('is case-insensitive on the type field', () => {
    const weird: Frequency[] = [
      { type: 'tower', description: 'mixed case', mhz: 118.3 },
    ];
    expect(pickPrimaryFrequency(weird)?.mhz).toBe(118.3);
  });

  it('tolerates whitespace around the type', () => {
    const padded: Frequency[] = [
      { type: ' CTAF ', description: 'padded', mhz: 122.7 },
    ];
    expect(pickPrimaryFrequency(padded)?.mhz).toBe(122.7);
  });
});

describe('waypointFrequency', () => {
  const airportWp: Waypoint = {
    id: 'a',
    kind: 'airport',
    ref: 'KLAX',
    name: 'LAX',
    lat: 33.9,
    lon: -118.4,
  };
  const navaidWp: Waypoint = {
    id: 'n',
    kind: 'navaid',
    ref: 'DAG',
    name: 'Daggett VOR',
    lat: 34.9,
    lon: -116.8,
  };
  const userWp: Waypoint = {
    id: 'u',
    kind: 'userPoint',
    ref: '34.9,-116.8',
    name: 'user',
    lat: 34.9,
    lon: -116.8,
  };

  const navaid: Navaid = {
    id: 'DAG',
    name: 'Daggett VOR',
    type: 'VOR-DME',
    lat: 34.9,
    lon: -116.8,
    freq: 113.2,
  };

  it('returns primary airport freq', () => {
    const r = waypointFrequency(airportWp, klaxFreqs);
    expect(r?.type).toBe('TWR');
    expect(r?.mhz).toBe(119.8);
  });

  it('returns navaid freq using navaid type as label', () => {
    const r = waypointFrequency(navaidWp, undefined, navaid);
    expect(r?.type).toBe('VOR-DME');
    expect(r?.mhz).toBe(113.2);
  });

  it('null for user point', () => {
    expect(waypointFrequency(userWp)).toBeNull();
  });

  it('null for navaid without a freq', () => {
    expect(waypointFrequency(navaidWp, undefined, { ...navaid, freq: undefined })).toBeNull();
  });
});
