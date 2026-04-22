import { describe, expect, it } from 'vitest';
import { parseMetarRow } from './metar-client';

const NOW = '2026-04-22T00:00:00.000Z';

describe('parseMetarRow', () => {
  it('parses a standard VFR day', () => {
    const obs = parseMetarRow(
      {
        icaoId: 'KSEA',
        reportTime: '2026-04-21 23:53:00',
        rawOb: 'KSEA 212353Z 21010KT 10SM FEW050 SCT250 12/05 A3012',
        temp: 12,
        dewp: 5,
        wdir: 210,
        wspd: 10,
        visib: '10+',
        altim: 30.12,
        clouds: [
          { cover: 'FEW', base: 5000 },
          { cover: 'SCT', base: 25000 },
        ],
      },
      NOW,
    );
    expect(obs).not.toBeNull();
    expect(obs!.icao).toBe('KSEA');
    expect(obs!.flightCategory).toBe('VFR');
    expect(obs!.ceilingFtAgl).toBeNull();
    expect(obs!.windDirDeg).toBe(210);
    expect(obs!.windSpeedKt).toBe(10);
    expect(obs!.altimeterInHg).toBeCloseTo(30.12, 2);
    expect(obs!.visibilitySm).toBe(Infinity);
  });

  it('parses an IFR report with OVC ceiling', () => {
    const obs = parseMetarRow(
      {
        icaoId: 'kpdx',
        reportTime: '2026-04-22 00:53:00',
        rawOb: 'KPDX 220053Z 16012KT 4SM BR OVC008 08/07 A2998',
        temp: 8,
        dewp: 7,
        wdir: 160,
        wspd: 12,
        visib: 4,
        altim: 29.98,
        wxString: 'BR',
        clouds: [{ cover: 'OVC', base: 800 }],
      },
      NOW,
    );
    expect(obs!.icao).toBe('KPDX');
    expect(obs!.ceilingFtAgl).toBe(800);
    expect(obs!.flightCategory).toBe('IFR');
    expect(obs!.wxString).toBe('BR');
  });

  it('normalizes altimeter reported in hPa (1013) to inHg', () => {
    const obs = parseMetarRow(
      {
        icaoId: 'EGLL',
        reportTime: '2026-04-22 00:00:00',
        rawOb: 'EGLL 220000Z AUTO 27015KT 9999 NCD 10/05 Q1013',
        temp: 10,
        dewp: 5,
        wdir: 270,
        wspd: 15,
        visib: 6,
        altim: 1013,
        clouds: [],
      },
      NOW,
    );
    expect(obs!.altimeterInHg).toBeCloseTo(29.91, 1);
  });

  it('returns null when icaoId is missing', () => {
    expect(parseMetarRow({ rawOb: 'x' }, NOW)).toBeNull();
  });
});
