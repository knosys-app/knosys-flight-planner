import type { Airport, Navaid } from '../types';

export type BoundingBox = [west: number, south: number, east: number, north: number];

export interface AeroDataSource {
  ready(): Promise<void>;
  findAirportByIcao(icao: string): Promise<Airport | null>;
  searchAirports(query: string, limit?: number): Promise<Airport[]>;
  findNavaid(id: string): Promise<Navaid | null>;
  airportsInBbox(bbox: BoundingBox, limit?: number): Promise<Airport[]>;
}
