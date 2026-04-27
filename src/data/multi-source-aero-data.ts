import type { AeroDataSource } from './aero-data-source';
import { getAeroDataSource } from '../hooks/use-aero-data';
import { OsmAeroDataSource } from './osm-aero-data-source';

export type AeroSourceId = 'ourairports' | 'osm' | 'openaip' | 'aixm';

export interface AeroSourceMeta {
  id: AeroSourceId;
  label: string;
  /** Short attribution string shown in the place-card footer when active. */
  attribution: string;
  /** True if the source is wired up enough to be queried at all. */
  available: boolean;
  /**
   * True if the source is configured (e.g. user has supplied an API key).
   * The tab is disabled when this is false.
   */
  configured: boolean;
}

const ORDER: AeroSourceId[] = ['ourairports', 'osm', 'aixm', 'openaip'];

/**
 * Facade exposing one AeroDataSource per supported source id, plus
 * configuration / availability metadata for the place-card source-tab
 * strip. Constructed once per session via `getMultiSourceAeroData()`.
 *
 * Only the place card consults this facade. Navlog, route planner, map
 * layers continue using `getAeroDataSource()` directly (the OurAirports
 * primary source).
 */
export class MultiSourceAeroData {
  private osm: OsmAeroDataSource | null = null;

  getSource(id: AeroSourceId): AeroDataSource | null {
    switch (id) {
      case 'ourairports':
        return getAeroDataSource();
      case 'osm':
        if (!this.osm) this.osm = new OsmAeroDataSource();
        return this.osm;
      case 'aixm':
      case 'openaip':
        // Wired up in v0.11 / v0.12.
        return null;
    }
  }

  /**
   * Per-source metadata snapshot. The source-tab UI re-renders this on
   * settings changes (e.g., when the user pastes an OpenAIP key).
   */
  getMeta(id: AeroSourceId): AeroSourceMeta {
    switch (id) {
      case 'ourairports':
        return {
          id,
          label: 'OurAirports',
          attribution: 'OurAirports — public domain (CC0)',
          available: true,
          configured: true,
        };
      case 'osm':
        return {
          id,
          label: 'OSM',
          attribution: '© OpenStreetMap contributors · ODbL',
          available: true,
          configured: true,
        };
      case 'aixm':
        return {
          id,
          label: 'AIXM',
          attribution: '© EUROCONTROL Open Data',
          available: false,
          configured: false,
        };
      case 'openaip':
        return {
          id,
          label: 'OpenAIP',
          attribution: '© OpenAIP · CC BY-NC-SA 4.0',
          available: false,
          configured: false,
        };
    }
  }

  orderedIds(): AeroSourceId[] {
    return ORDER.slice();
  }
}

let singleton: MultiSourceAeroData | null = null;

export function getMultiSourceAeroData(): MultiSourceAeroData {
  if (!singleton) singleton = new MultiSourceAeroData();
  return singleton;
}
