import { describe, expect, it } from 'vitest';
import {
  fmtAgeLabel,
  fmtAltimeter,
  fmtClouds,
  fmtTempDew,
  fmtVisibility,
  fmtWind,
  fmtZulu,
} from './metar-format';
import type { MetarObservation } from './types';

const base: MetarObservation = {
  icao: 'KSEA',
  observedAtIso: '2026-04-22T12:00:00.000Z',
  fetchedAtIso: '2026-04-22T12:00:00.000Z',
  rawText: 'KSEA 221200Z 21010KT 10SM BKN020 12/09 A2998',
  tempC: 12,
  dewpointC: 9,
  windDirDeg: 210,
  windSpeedKt: 10,
  windGustKt: null,
  visibilitySm: 10,
  altimeterInHg: 29.98,
  clouds: [{ coverage: 'BKN', baseFtAgl: 2000 }],
  ceilingFtAgl: 2000,
  flightCategory: 'MVFR',
  wxString: null,
};

describe('fmtWind', () => {
  it('formats a standard wind', () => {
    expect(fmtWind(base)).toBe('210° @ 10 kt');
  });
  it('includes gusts', () => {
    expect(fmtWind({ ...base, windGustKt: 18 })).toBe('210° @ 10 kt G18');
  });
  it('shows calm when 0 kt', () => {
    expect(fmtWind({ ...base, windSpeedKt: 0, windDirDeg: 0 })).toBe('Calm');
  });
  it('shows VRB when direction null', () => {
    expect(fmtWind({ ...base, windDirDeg: null })).toBe('VRB° @ 10 kt');
  });
});

describe('fmtVisibility', () => {
  it('numeric visibility', () => {
    expect(fmtVisibility(base)).toBe('10 sm');
  });
  it('10+ as infinity', () => {
    expect(fmtVisibility({ ...base, visibilitySm: Number.POSITIVE_INFINITY })).toBe('10+ sm');
  });
  it('em-dash when null', () => {
    expect(fmtVisibility({ ...base, visibilitySm: null })).toBe('—');
  });
});

describe('fmtAltimeter', () => {
  it('two decimals in inHg', () => {
    expect(fmtAltimeter(base)).toBe('29.98 inHg');
  });
});

describe('fmtTempDew', () => {
  it('rounds to int C/C', () => {
    expect(fmtTempDew(base)).toBe('12°C / 9°C');
  });
});

describe('fmtClouds', () => {
  it('SKC when array empty', () => {
    expect(fmtClouds({ ...base, clouds: [] })).toBe('Sky clear');
  });
  it('joins layers with ·', () => {
    expect(
      fmtClouds({
        ...base,
        clouds: [
          { coverage: 'FEW', baseFtAgl: 5000 },
          { coverage: 'OVC', baseFtAgl: 12000 },
        ],
      }),
    ).toBe('FEW @ 5,000 ft · OVC @ 12,000 ft');
  });
});

describe('fmtAgeLabel', () => {
  const now = new Date('2026-04-22T12:30:00Z').getTime();
  it('just now under 1 min', () => {
    expect(fmtAgeLabel('2026-04-22T12:29:50Z', now)).toBe('just now');
  });
  it('minutes', () => {
    expect(fmtAgeLabel('2026-04-22T12:10:00Z', now)).toBe('20m ago');
  });
  it('hours', () => {
    expect(fmtAgeLabel('2026-04-22T08:00:00Z', now)).toBe('4h ago');
  });
});

describe('fmtZulu', () => {
  it('formats as DDHHMMZ', () => {
    expect(fmtZulu('2026-04-22T12:53:00Z')).toBe('221253Z');
  });
});
