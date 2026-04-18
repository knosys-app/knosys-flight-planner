import { interpolateWinds } from '../math/aviation-math';
import type { WindsEntryRow } from '../types';
import type { WeatherProvider, WeatherWinds } from './weather-provider';

/**
 * v1 weather provider. Reads the pilot-entered winds table and interpolates
 * by altitude. Location/time are ignored — manual winds are assumed global
 * across the flight.
 */
export class ManualWeatherProvider implements WeatherProvider {
  readonly id = 'manual';
  readonly name = 'Manual (pilot-entered)';

  constructor(private table: WindsEntryRow[] = []) {}

  setTable(table: WindsEntryRow[]): void {
    this.table = [...table];
  }

  async getWinds(_lat: number, _lon: number, altFt: number): Promise<WeatherWinds> {
    const { dirTrueDeg, speedKt } = interpolateWinds(this.table, altFt);
    const temp = this.table.find((r) => r.altFt === altFt)?.tempC;
    return { dirTrueDeg, speedKt, tempC: temp };
  }
}
