import Papa from 'papaparse';
import type { PlanFormatCodec } from './plan-format';
import type { AircraftProfile, NavlogRow, Plan } from '../types';

function round(n: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

export const CsvFormat: PlanFormatCodec = {
  id: 'csv',
  name: 'CSV Navlog',
  extension: '.csv',
  mime: 'text/csv',

  write(plan: Plan, aircraft: AircraftProfile, navlog: NavlogRow[]): string {
    const header = `# Plan: ${plan.name}\n# Aircraft: ${aircraft.name} (${aircraft.type})\n# TAS: ${aircraft.tasKt} kt, Fuel: ${aircraft.fuelBurnGph} gph\n# Departure: ${plan.departureIcao}\n# Destination: ${plan.destinationIcao}\n`;
    const rows = navlog.map((r) => ({
      Leg: r.legIndex + 1,
      From: r.fromRef,
      To: r.toRef,
      'Alt (ft)': r.altFt,
      'Dist (NM)': round(r.distanceNm, 1),
      'TC (\u00B0)': round(r.trueCourseDeg, 0),
      'WCA (\u00B0)': round(r.windCorrectionAngleDeg, 0),
      'TH (\u00B0)': round(r.trueHeadingDeg, 0),
      'Var (\u00B0)': round(r.magVarDeg, 1),
      'MH (\u00B0)': round(r.magneticHeadingDeg, 0),
      'Freq (MHz)': r.primaryFreq ? round(r.primaryFreq.mhz, 3) : '',
      'Freq Type': r.primaryFreq?.type ?? '',
      'TAS (kt)': round(r.tasKt, 0),
      'GS (kt)': round(r.groundSpeedKt, 0),
      'ETE (min)': round(r.eteMinutes, 1),
      ETA: r.etaIso ?? '',
      'Fuel (gal)': round(r.fuelBurnedGal, 1),
      'Remaining (gal)': round(r.fuelRemainingGal, 1),
      'Reserve OK': r.reserveOk ? 'YES' : 'NO',
    }));
    const csv = Papa.unparse(rows);
    return header + csv + '\n';
  },
};
