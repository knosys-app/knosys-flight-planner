import { SqlJsAeroDataSource } from '../data/sqljs-aero-data-source';
import type { AeroDataSource } from '../data/aero-data-source';
import { loadAirportsDb } from '../data/first-run-download';

let singleton: AeroDataSource | null = null;

export function getAeroDataSource(): AeroDataSource {
  if (!singleton) {
    singleton = new SqlJsAeroDataSource(async () => {
      const bytes = await loadAirportsDb();
      if (!bytes) throw new Error('airports.sqlite not installed in OPFS');
      return bytes;
    });
  }
  return singleton;
}

export function resetAeroDataSource(): void {
  singleton = null;
}
