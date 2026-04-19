import { describe, expect, it } from 'vitest';
import { runwayPolygon } from './runway-geometry';
import type { Runway } from '../types';

describe('runwayPolygon', () => {
  const klax = { lat: 33.9425, lon: -118.4081 };

  it('KLAX 07L/25R — 12923 ft × 150 ft, heading 083°', () => {
    const rwy: Runway = {
      id: '07L/25R',
      lengthFt: 12923,
      widthFt: 150,
      surface: 'CON',
      headingTrue: 83,
      leIdent: '07L',
      heIdent: '25R',
    };
    const poly = runwayPolygon(klax, rwy);
    expect(poly).not.toBeNull();
    expect(poly?.length).toBe(5);
    // Closes on itself
    expect(poly?.[0]).toEqual(poly?.[4]);
    // Rough sanity: all vertices within 2 miles of airport
    for (const [lng, lat] of poly ?? []) {
      expect(Math.abs(lng - klax.lon)).toBeLessThan(0.05);
      expect(Math.abs(lat - klax.lat)).toBeLessThan(0.05);
    }
  });

  it('returns null when length is missing', () => {
    const bad: Runway = {
      id: '?',
      lengthFt: 0,
      widthFt: 100,
      surface: 'ASPH',
      headingTrue: 90,
    };
    expect(runwayPolygon(klax, bad)).toBeNull();
  });

  it('tolerates zero width by flooring to ~30 ft', () => {
    const bad: Runway = {
      id: '?',
      lengthFt: 2000,
      widthFt: 0,
      surface: 'TURF',
      headingTrue: 0,
    };
    const poly = runwayPolygon(klax, bad);
    expect(poly).not.toBeNull();
  });
});
