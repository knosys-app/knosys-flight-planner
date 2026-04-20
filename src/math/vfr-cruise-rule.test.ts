import { describe, it, expect } from 'vitest';
import { isEastbound, vfrCruiseAltitude } from './vfr-cruise-rule';

describe('isEastbound', () => {
  it('000 through 179 is eastbound', () => {
    expect(isEastbound(0)).toBe(true);
    expect(isEastbound(90)).toBe(true);
    expect(isEastbound(179)).toBe(true);
  });
  it('180 through 359 is westbound', () => {
    expect(isEastbound(180)).toBe(false);
    expect(isEastbound(270)).toBe(false);
    expect(isEastbound(359)).toBe(false);
  });
  it('wraps negatives and >=360', () => {
    expect(isEastbound(-10)).toBe(false); // 350 westbound
    expect(isEastbound(360)).toBe(true); // 0 eastbound
  });
});

describe('vfrCruiseAltitude', () => {
  it('eastbound: course 090, min 5200 → 5500', () => {
    expect(vfrCruiseAltitude(90, 5200)).toBe(5500);
  });
  it('eastbound: course 090, min 5500 → 5500 (exact)', () => {
    expect(vfrCruiseAltitude(90, 5500)).toBe(5500);
  });
  it('eastbound: course 090, min 5501 → 7500 (next odd+500)', () => {
    expect(vfrCruiseAltitude(90, 5501)).toBe(7500);
  });
  it('westbound: course 270, min 5200 → 6500', () => {
    expect(vfrCruiseAltitude(270, 5200)).toBe(6500);
  });
  it('westbound: course 180, min 3000 → 4500', () => {
    expect(vfrCruiseAltitude(180, 3000)).toBe(4500);
  });
  it('eastbound: course 001, min 100 → 1500 (first valid)', () => {
    expect(vfrCruiseAltitude(1, 100)).toBe(1500);
  });
  it('westbound: course 200, min 100 → 2500 (first valid)', () => {
    expect(vfrCruiseAltitude(200, 100)).toBe(2500);
  });
  it('boundary: course 179 is eastbound', () => {
    expect(vfrCruiseAltitude(179, 7000)).toBe(7500);
  });
  it('boundary: course 180 is westbound', () => {
    expect(vfrCruiseAltitude(180, 7000)).toBe(8500);
  });
  it('handles high altitudes', () => {
    expect(vfrCruiseAltitude(90, 11000)).toBe(11500);
    expect(vfrCruiseAltitude(270, 11000)).toBe(12500);
  });
});
