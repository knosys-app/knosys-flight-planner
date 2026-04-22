// Weight + Balance math. Pure, testable. All arithmetic in pounds / inches.

import type {
  AircraftProfile,
  EnvelopeCorner,
  FuelStation,
  WeightStation,
} from '../types';

/** Weight loaded on a single station, in pounds. */
export interface StationLoad {
  stationId: string;
  weightLb: number;
}

/** Fuel loaded in a tank, in gallons. */
export interface FuelLoad {
  stationId: string;
  gallons: number;
}

export interface Loadout {
  stations: StationLoad[];
  fuel: FuelLoad[];
}

export interface WBPoint {
  weightLb: number;
  cgIn: number;
  /** ΣWi*Ai; handy for printouts. */
  momentInLb: number;
}

export interface WBBreakdown {
  rows: Array<{
    name: string;
    weightLb: number;
    armIn: number;
    momentInLb: number;
  }>;
  totals: WBPoint;
}

/** 100LL / MoGas ≈ 6.0 lb/gal; Jet-A ≈ 6.7 lb/gal. */
export function fuelDensityLbPerGal(fuelType: AircraftProfile['fuelType']): number {
  return fuelType === 'Jet-A' ? 6.7 : 6.0;
}

/**
 * Compute the center of gravity + gross weight for a loadout. Returns null
 * when the aircraft profile lacks the mandatory empty-weight / empty-cg
 * values (the W&B editor will prompt the user to fill them in).
 */
export function computeCG(
  aircraft: AircraftProfile,
  loadout: Loadout,
): WBPoint | null {
  if (aircraft.emptyWeightLb == null || aircraft.emptyCgIn == null) return null;

  const bd = buildBreakdown(aircraft, loadout);
  return bd.totals;
}

/** Same as computeCG but also returns the per-row moment breakdown. */
export function buildBreakdown(
  aircraft: AircraftProfile,
  loadout: Loadout,
): WBBreakdown {
  const rows: WBBreakdown['rows'] = [];
  const stations = new Map<string, WeightStation>(
    (aircraft.weightStations ?? []).map((s) => [s.id, s]),
  );
  const tanks = new Map<string, FuelStation>(
    (aircraft.fuelStations ?? []).map((t) => [t.id, t]),
  );
  const density = fuelDensityLbPerGal(aircraft.fuelType);

  const emptyW = aircraft.emptyWeightLb ?? 0;
  const emptyA = aircraft.emptyCgIn ?? 0;
  rows.push({
    name: 'Empty',
    weightLb: emptyW,
    armIn: emptyA,
    momentInLb: emptyW * emptyA,
  });

  for (const it of loadout.stations) {
    const s = stations.get(it.stationId);
    if (!s || it.weightLb <= 0) continue;
    rows.push({
      name: s.name,
      weightLb: it.weightLb,
      armIn: s.armIn,
      momentInLb: it.weightLb * s.armIn,
    });
  }

  for (const it of loadout.fuel) {
    const t = tanks.get(it.stationId);
    if (!t || it.gallons <= 0) continue;
    const w = it.gallons * density;
    rows.push({
      name: `${t.name} (${it.gallons.toFixed(0)} gal)`,
      weightLb: w,
      armIn: t.armIn,
      momentInLb: w * t.armIn,
    });
  }

  const totalWeight = rows.reduce((sum, r) => sum + r.weightLb, 0);
  const totalMoment = rows.reduce((sum, r) => sum + r.momentInLb, 0);
  const cg = totalWeight > 0 ? totalMoment / totalWeight : 0;
  return {
    rows,
    totals: { weightLb: totalWeight, cgIn: cg, momentInLb: totalMoment },
  };
}

/**
 * Point-in-polygon (ray-casting). Envelope polygon is given as an ordered
 * list of (weight, cg) corners forming a closed ring.
 */
export function isInsideEnvelope(
  envelope: EnvelopeCorner[],
  point: WBPoint,
): boolean {
  if (envelope.length < 3) return false;
  const { cgIn: x, weightLb: y } = point;
  let inside = false;
  for (let i = 0, j = envelope.length - 1; i < envelope.length; j = i++) {
    const xi = envelope[i].cgIn;
    const yi = envelope[i].weightLb;
    const xj = envelope[j].cgIn;
    const yj = envelope[j].weightLb;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Default loadout: station defaults (e.g. front seat 170 lb), full fuel. */
export function defaultLoadout(aircraft: AircraftProfile): Loadout {
  return {
    stations: (aircraft.weightStations ?? []).map((s) => ({
      stationId: s.id,
      weightLb: s.defaultWeightLb ?? 0,
    })),
    fuel: (aircraft.fuelStations ?? []).map((t) => ({
      stationId: t.id,
      gallons: t.capacityGal,
    })),
  };
}

/**
 * Produce a landing-weight loadout by burning `fuelBurnedGal` from the
 * given loadout. Burn is proportional across tanks by their current load
 * (equivalent to a balanced fuel selector). Does not go negative.
 */
export function burnFuel(loadout: Loadout, fuelBurnedGal: number): Loadout {
  const totalCurrent = loadout.fuel.reduce((s, f) => s + f.gallons, 0);
  if (totalCurrent <= 0 || fuelBurnedGal <= 0) return loadout;
  const toBurn = Math.min(totalCurrent, fuelBurnedGal);
  const ratio = toBurn / totalCurrent;
  return {
    stations: loadout.stations,
    fuel: loadout.fuel.map((f) => ({
      stationId: f.stationId,
      gallons: Math.max(0, f.gallons - f.gallons * ratio),
    })),
  };
}
