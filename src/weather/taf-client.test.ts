import { describe, expect, it } from 'vitest';
import { parseTafRow } from './taf-client';

const FETCHED = '2026-04-22T12:00:00.000Z';

describe('parseTafRow', () => {
  it('parses a multi-period TAF', () => {
    const taf = parseTafRow(
      {
        icaoId: 'KPDX',
        rawTAF:
          'KPDX 220000Z 2200/2306 17010KT P6SM BKN035 FM221000 19012KT 5SM BR OVC015 PROB30 2212/2216 3SM -SHRA',
        issueTime: '2026-04-22 00:00:00',
        validTimeFrom: '2026-04-22 00:00:00',
        validTimeTo: '2026-04-23 06:00:00',
        fcsts: [
          {
            timeFrom: '2026-04-22 00:00:00',
            timeTo: '2026-04-22 10:00:00',
            wdir: 170,
            wspd: 10,
            visib: 'P6SM',
            clouds: [{ cover: 'BKN', base: 3500 }],
          },
          {
            timeFrom: '2026-04-22 10:00:00',
            timeTo: '2026-04-23 06:00:00',
            fcstChange: 'FM221000',
            wdir: 190,
            wspd: 12,
            visib: 5,
            clouds: [{ cover: 'OVC', base: 1500 }],
            wxString: 'BR',
          },
          {
            timeFrom: '2026-04-22 12:00:00',
            timeTo: '2026-04-22 16:00:00',
            fcstChange: 'PROB30',
            probability: 30,
            wdir: 200,
            wspd: 14,
            visib: 3,
            clouds: [{ cover: 'BKN', base: 1200 }],
            wxString: '-SHRA',
          },
        ],
      },
      FETCHED,
    );
    expect(taf).not.toBeNull();
    expect(taf!.icao).toBe('KPDX');
    expect(taf!.periods).toHaveLength(3);
    expect(taf!.periods[0].change).toBe('BASE');
    expect(taf!.periods[0].flightCategory).toBe('VFR');
    expect(taf!.periods[1].change).toBe('FM');
    expect(taf!.periods[1].flightCategory).toBe('MVFR');
    expect(taf!.periods[2].change).toBe('PROB');
    expect(taf!.periods[2].probability).toBe(30);
    // Ceiling 1200 + visibility 3: both are at the MVFR boundary, not into IFR.
    expect(taf!.periods[2].flightCategory).toBe('MVFR');
  });

  it('handles BECMG + TEMPO change kinds', () => {
    const taf = parseTafRow(
      {
        icaoId: 'KSEA',
        rawTAF: 'KSEA 220000Z 2200/2306 ...',
        issueTime: '2026-04-22 00:00:00',
        validTimeFrom: '2026-04-22 00:00:00',
        validTimeTo: '2026-04-23 06:00:00',
        fcsts: [
          { timeFrom: '2026-04-22 00:00:00', timeTo: '2026-04-22 06:00:00', fcstChange: null, visib: 10, clouds: [] },
          { timeFrom: '2026-04-22 06:00:00', timeTo: '2026-04-22 08:00:00', fcstChange: 'BECMG', visib: 6, clouds: [{ cover: 'OVC', base: 4000 }] },
          { timeFrom: '2026-04-22 10:00:00', timeTo: '2026-04-22 14:00:00', fcstChange: 'TEMPO', visib: 0.5, clouds: [{ cover: 'BKN', base: 400 }] },
        ],
      },
      FETCHED,
    );
    expect(taf!.periods[0].change).toBe('BASE');
    expect(taf!.periods[1].change).toBe('BECMG');
    expect(taf!.periods[2].change).toBe('TEMPO');
    // Ceiling 400 + vis 0.5 → LIFR on both criteria.
    expect(taf!.periods[2].flightCategory).toBe('LIFR');
  });

  it('sorts periods by start time', () => {
    const taf = parseTafRow(
      {
        icaoId: 'KABC',
        issueTime: '2026-04-22 00:00:00',
        validTimeFrom: '2026-04-22 00:00:00',
        validTimeTo: '2026-04-23 00:00:00',
        fcsts: [
          { timeFrom: '2026-04-22 10:00:00', timeTo: '2026-04-22 14:00:00', visib: 10 },
          { timeFrom: '2026-04-22 00:00:00', timeTo: '2026-04-22 10:00:00', visib: 10 },
        ],
      },
      FETCHED,
    );
    expect(taf!.periods[0].startIso).toBe('2026-04-22T00:00:00.000Z');
    expect(taf!.periods[1].startIso).toBe('2026-04-22T10:00:00.000Z');
  });

  it('returns null when icaoId missing', () => {
    expect(parseTafRow({}, FETCHED)).toBeNull();
  });
});
