import type { Database } from 'sql.js';
import { loadSqlJs } from './sqljs-loader';
import type { AeroDataSource, BoundingBox } from './aero-data-source';
import type { Airport, AirportType, Frequency, Navaid, Runway } from '../types';

const AIRPORT_COLUMNS = [
  'ident',
  'iata_code',
  'local_code',
  'name',
  'latitude_deg',
  'longitude_deg',
  'elevation_ft',
  'iso_country',
  'iso_region',
  'municipality',
  'type',
].join(', ');

interface AirportRow {
  ident: string;
  iata_code: string | null;
  local_code: string | null;
  name: string;
  latitude_deg: number;
  longitude_deg: number;
  elevation_ft: number | null;
  iso_country: string;
  iso_region: string | null;
  municipality: string | null;
  type: string;
}

function coerceAirportType(raw: string): AirportType {
  const valid: AirportType[] = [
    'large_airport',
    'medium_airport',
    'small_airport',
    'heliport',
    'seaplane_base',
    'closed',
  ];
  return (valid as string[]).includes(raw) ? (raw as AirportType) : 'small_airport';
}

export class SqlJsAeroDataSource implements AeroDataSource {
  private db: Database | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(private readonly getDbBytes: () => Promise<Uint8Array>) {}

  ready(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }
    return this.initPromise;
  }

  private async initialize(): Promise<void> {
    const [SQL, bytes] = await Promise.all([loadSqlJs(), this.getDbBytes()]);
    this.db = new SQL.Database(bytes);
  }

  private requireDb(): Database {
    if (!this.db) throw new Error('SqlJsAeroDataSource: not initialized (call ready() first)');
    return this.db;
  }

  async findAirportByIcao(icao: string): Promise<Airport | null> {
    await this.ready();
    const db = this.requireDb();
    const stmt = db.prepare(
      `SELECT ${AIRPORT_COLUMNS} FROM airports WHERE ident = :icao LIMIT 1`,
    );
    try {
      stmt.bind({ ':icao': icao.toUpperCase() });
      if (!stmt.step()) return null;
      const row = stmt.getAsObject() as unknown as AirportRow;
      return this.hydrateAirport(row);
    } finally {
      stmt.free();
    }
  }

  async searchAirports(query: string, limit = 20): Promise<Airport[]> {
    await this.ready();
    const db = this.requireDb();
    const q = query.trim();
    if (!q) return [];
    const likeTerm = `${q.toUpperCase()}%`;

    const stmt = db.prepare(
      `SELECT ${AIRPORT_COLUMNS} FROM airports
       WHERE ident LIKE :like
          OR iata_code LIKE :like
          OR local_code LIKE :like
       ORDER BY
         CASE WHEN ident = :exact THEN 0
              WHEN iata_code = :exact THEN 1
              WHEN local_code = :exact THEN 2
              ELSE 3 END,
         CASE type
           WHEN 'large_airport' THEN 0
           WHEN 'medium_airport' THEN 1
           WHEN 'small_airport' THEN 2
           ELSE 3 END
       LIMIT :limit`,
    );
    try {
      stmt.bind({ ':like': likeTerm, ':exact': q.toUpperCase(), ':limit': limit });
      const rows: Airport[] = [];
      while (stmt.step()) {
        rows.push(this.hydrateAirport(stmt.getAsObject() as unknown as AirportRow));
      }
      if (rows.length >= limit) return rows;
      return rows.concat(await this.searchByName(q, limit - rows.length));
    } finally {
      stmt.free();
    }
  }

  private async searchByName(query: string, limit: number): Promise<Airport[]> {
    const db = this.requireDb();
    const stmt = db.prepare(
      `SELECT ${AIRPORT_COLUMNS} FROM airports WHERE name LIKE :like LIMIT :limit`,
    );
    try {
      stmt.bind({ ':like': `%${query}%`, ':limit': limit });
      const rows: Airport[] = [];
      while (stmt.step()) {
        rows.push(this.hydrateAirport(stmt.getAsObject() as unknown as AirportRow));
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  async findNavaid(id: string): Promise<Navaid | null> {
    await this.ready();
    const db = this.requireDb();
    const stmt = db.prepare(
      `SELECT ident, name, type, latitude_deg, longitude_deg, elevation_ft, frequency_khz
       FROM navaids WHERE ident = :id LIMIT 1`,
    );
    try {
      stmt.bind({ ':id': id.toUpperCase() });
      if (!stmt.step()) return null;
      const row = stmt.getAsObject() as {
        ident: string;
        name: string;
        type: string;
        latitude_deg: number;
        longitude_deg: number;
        elevation_ft: number | null;
        frequency_khz: number | null;
      };
      return {
        id: row.ident,
        name: row.name,
        type: (row.type?.toUpperCase() as any) ?? 'VOR',
        lat: row.latitude_deg,
        lon: row.longitude_deg,
        elevationFt: row.elevation_ft ?? undefined,
        freq: row.frequency_khz ? row.frequency_khz / 1000 : undefined,
      };
    } finally {
      stmt.free();
    }
  }

  async airportsInBbox(bbox: BoundingBox, limit = 500): Promise<Airport[]> {
    await this.ready();
    const db = this.requireDb();
    const [west, south, east, north] = bbox;
    const stmt = db.prepare(
      `SELECT ${AIRPORT_COLUMNS} FROM airports
       WHERE longitude_deg BETWEEN :west AND :east
         AND latitude_deg BETWEEN :south AND :north
         AND type IN ('large_airport','medium_airport','small_airport')
       LIMIT :limit`,
    );
    try {
      stmt.bind({
        ':west': west,
        ':east': east,
        ':south': south,
        ':north': north,
        ':limit': limit,
      });
      const rows: Airport[] = [];
      while (stmt.step()) {
        rows.push(this.hydrateAirport(stmt.getAsObject() as unknown as AirportRow));
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  private hydrateAirport(row: AirportRow): Airport {
    const db = this.requireDb();
    const runways = this.loadRunways(db, row.ident);
    const frequencies = this.loadFrequencies(db, row.ident);
    return {
      icao: row.ident,
      iata: row.iata_code ?? undefined,
      localCode: row.local_code ?? undefined,
      name: row.name,
      lat: row.latitude_deg,
      lon: row.longitude_deg,
      elevationFt: row.elevation_ft ?? 0,
      country: row.iso_country,
      region: row.iso_region ?? undefined,
      municipality: row.municipality ?? undefined,
      type: coerceAirportType(row.type),
      runways,
      frequencies,
    };
  }

  private loadRunways(db: Database, ident: string): Runway[] {
    const stmt = db.prepare(
      `SELECT le_ident, he_ident, length_ft, width_ft, surface, le_heading_degT
       FROM runways WHERE airport_ident = :id`,
    );
    try {
      stmt.bind({ ':id': ident });
      const out: Runway[] = [];
      while (stmt.step()) {
        const r = stmt.getAsObject() as {
          le_ident: string | null;
          he_ident: string | null;
          length_ft: number | null;
          width_ft: number | null;
          surface: string | null;
          le_heading_degT: number | null;
        };
        out.push({
          id: `${r.le_ident ?? '?'}/${r.he_ident ?? '?'}`,
          leIdent: r.le_ident ?? undefined,
          heIdent: r.he_ident ?? undefined,
          lengthFt: r.length_ft ?? 0,
          widthFt: r.width_ft ?? 0,
          surface: r.surface ?? 'unknown',
          headingTrue: r.le_heading_degT ?? 0,
        });
      }
      return out;
    } finally {
      stmt.free();
    }
  }

  private loadFrequencies(db: Database, ident: string): Frequency[] {
    const stmt = db.prepare(
      `SELECT type, description, frequency_mhz FROM frequencies WHERE airport_ident = :id`,
    );
    try {
      stmt.bind({ ':id': ident });
      const out: Frequency[] = [];
      while (stmt.step()) {
        const f = stmt.getAsObject() as {
          type: string | null;
          description: string | null;
          frequency_mhz: number | null;
        };
        out.push({
          type: f.type ?? 'UNKNOWN',
          description: f.description ?? '',
          mhz: f.frequency_mhz ?? 0,
        });
      }
      return out;
    } finally {
      stmt.free();
    }
  }
}
