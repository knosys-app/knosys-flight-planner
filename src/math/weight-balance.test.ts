import { describe, expect, it } from 'vitest';
import type { AircraftProfile } from '../types';
import {
  buildBreakdown,
  burnFuel,
  computeCG,
  defaultLoadout,
  isInsideEnvelope,
} from './weight-balance';

const c172s: AircraftProfile = {
  schemaVersion: 3,
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name: 'Cessna 172S',
  type: 'C172S',
  tasKt: 120,
  fuelBurnGph: 8.5,
  fuelCapacityGal: 53,
  fuelType: '100LL',
  reserveMinutes: 45,
  emptyWeightLb: 1680,
  emptyCgIn: 39.9,
  maxGrossWeightLb: 2550,
  weightStations: [
    { id: 'front', name: 'Front seats', armIn: 37, maxWeightLb: 450, defaultWeightLb: 170 },
    { id: 'rear', name: 'Rear seats', armIn: 73, maxWeightLb: 450 },
    { id: 'bagA', name: 'Baggage A', armIn: 95, maxWeightLb: 120 },
  ],
  fuelStations: [{ id: 'main', name: 'Main tanks', armIn: 48, capacityGal: 53 }],
  envelopeCorners: [
    { weightLb: 1500, cgIn: 35.0 },
    { weightLb: 1950, cgIn: 35.0 },
    { weightLb: 2550, cgIn: 41.0 },
    { weightLb: 2550, cgIn: 47.3 },
    { weightLb: 1500, cgIn: 47.3 },
  ],
};

describe('computeCG', () => {
  it('returns null when empty weight / cg missing', () => {
    const p = { ...c172s, emptyWeightLb: undefined };
    expect(computeCG(p, defaultLoadout(p))).toBeNull();
  });

  it('empty aircraft alone sits at empty cg', () => {
    const out = computeCG(c172s, { stations: [], fuel: [] })!;
    expect(out.weightLb).toBe(1680);
    expect(out.cgIn).toBeCloseTo(39.9, 3);
  });

  it('adds station + fuel moments correctly', () => {
    // pilot 200, passenger 180, 53 gal fuel (= 318 lb)
    const out = computeCG(c172s, {
      stations: [{ stationId: 'front', weightLb: 380 }],
      fuel: [{ stationId: 'main', gallons: 53 }],
    })!;
    // Σw = 1680 + 380 + 318 = 2378
    expect(out.weightLb).toBeCloseTo(2378, 1);
    // Σm = 1680*39.9 + 380*37 + 318*48 = 67032 + 14060 + 15264 = 96356
    // cg = 96356 / 2378 ≈ 40.52
    expect(out.cgIn).toBeCloseTo(40.52, 1);
  });

  it('ignores unknown station ids', () => {
    const out = computeCG(c172s, {
      stations: [{ stationId: 'mystery', weightLb: 500 }],
      fuel: [],
    })!;
    expect(out.weightLb).toBe(1680);
  });
});

describe('isInsideEnvelope', () => {
  it('point inside the polygon', () => {
    expect(
      isInsideEnvelope(c172s.envelopeCorners!, {
        weightLb: 2200,
        cgIn: 42,
        momentInLb: 0,
      }),
    ).toBe(true);
  });

  it('point above max gross', () => {
    expect(
      isInsideEnvelope(c172s.envelopeCorners!, {
        weightLb: 2700,
        cgIn: 42,
        momentInLb: 0,
      }),
    ).toBe(false);
  });

  it('point forward of forward limit', () => {
    expect(
      isInsideEnvelope(c172s.envelopeCorners!, {
        weightLb: 1800,
        cgIn: 34,
        momentInLb: 0,
      }),
    ).toBe(false);
  });

  it('point aft of aft limit', () => {
    expect(
      isInsideEnvelope(c172s.envelopeCorners!, {
        weightLb: 2000,
        cgIn: 48,
        momentInLb: 0,
      }),
    ).toBe(false);
  });

  it('returns false on degenerate envelopes', () => {
    expect(
      isInsideEnvelope([{ weightLb: 1, cgIn: 1 }], {
        weightLb: 1,
        cgIn: 1,
        momentInLb: 0,
      }),
    ).toBe(false);
  });
});

describe('burnFuel', () => {
  it('burns proportionally across tanks', () => {
    const l = {
      stations: [],
      fuel: [
        { stationId: 'L', gallons: 20 },
        { stationId: 'R', gallons: 30 },
      ],
    };
    const after = burnFuel(l, 10);
    expect(after.fuel[0].gallons).toBeCloseTo(16, 2); // 20 - 20*(10/50)
    expect(after.fuel[1].gallons).toBeCloseTo(24, 2); // 30 - 30*(10/50)
  });

  it('clamps negative to zero', () => {
    const l = { stations: [], fuel: [{ stationId: 'main', gallons: 10 }] };
    const after = burnFuel(l, 100);
    expect(after.fuel[0].gallons).toBe(0);
  });

  it('returns input unchanged when no fuel to burn', () => {
    const l = { stations: [], fuel: [{ stationId: 'main', gallons: 10 }] };
    expect(burnFuel(l, 0)).toEqual(l);
  });
});

describe('buildBreakdown', () => {
  it('includes one row per non-zero item', () => {
    const bd = buildBreakdown(c172s, {
      stations: [
        { stationId: 'front', weightLb: 360 },
        { stationId: 'bagA', weightLb: 0 }, // skipped
      ],
      fuel: [{ stationId: 'main', gallons: 40 }],
    });
    // empty + front + fuel
    expect(bd.rows).toHaveLength(3);
    expect(bd.rows[0].name).toBe('Empty');
    expect(bd.rows.find((r) => r.name === 'Front seats')).toBeDefined();
    expect(bd.rows.find((r) => /Main tanks/.test(r.name))).toBeDefined();
  });
});
