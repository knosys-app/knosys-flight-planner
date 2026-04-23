import type { Airport, AirportType, Navaid } from '../types';

export type BoundingBox = [west: number, south: number, east: number, north: number];

export interface AirportQueryOptions {
  types?: AirportType[];
  limit?: number;
}

export interface AeroDataSource {
  ready(): Promise<void>;
  findAirportByIcao(icao: string): Promise<Airport | null>;
  searchAirports(query: string, limit?: number, opts?: AirportQueryOptions): Promise<Airport[]>;
  findNavaid(id: string): Promise<Navaid | null>;
  searchNavaids(query: string, limit?: number): Promise<Navaid[]>;
  airportsInBbox(bbox: BoundingBox, opts?: AirportQueryOptions): Promise<Airport[]>;
  /**
   * Same as airportsInBbox, but skips the runway + frequency joins. Used by
   * the map markers layer where we only need lat/lon/ident/type to render,
   * then fetch the full airport when the user clicks a marker.
   */
  airportsInBboxLite(bbox: BoundingBox, opts?: AirportQueryOptions): Promise<Airport[]>;
  /** Navaids in a lat/lon bbox. Used by the map navaids layer. */
  navaidsInBbox(bbox: BoundingBox, limit?: number): Promise<Navaid[]>;
}
