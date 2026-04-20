// sql.js-backed obstacle provider. Expects a SQLite database with:
//
//   CREATE TABLE obstacles (
//     id TEXT PRIMARY KEY,
//     lat REAL NOT NULL,
//     lon REAL NOT NULL,
//     height_agl REAL NOT NULL,
//     height_msl REAL NOT NULL,
//     type TEXT NOT NULL,
//     lighted INTEGER,
//     marked INTEGER,
//     name TEXT
//   );
//   CREATE VIRTUAL TABLE obstacles_rtree USING rtree(
//     id_num, min_lat, max_lat, min_lon, max_lon
//   );
//   CREATE TABLE obstacles_idmap (id_num INTEGER PRIMARY KEY, id TEXT UNIQUE);
//
// The build script in scripts/build-obstacle-db.ts produces exactly this
// layout from the FAA DOF CSV.

import type { Database } from 'sql.js';
import { loadSqlJs } from '../data/sqljs-loader';
import type { ObstacleProvider } from './obstacle-provider';
import type { Obstacle, ObstacleType, ProfileSample } from '../types';
import { greatCircleDistanceNm } from '../math/aviation-math';

type DbLoader = () => Promise<Uint8Array>;

function normalizeType(raw: string): ObstacleType {
  const upper = (raw ?? '').toUpperCase();
  if (upper.includes('TOWER')) return 'tower';
  if (upper.includes('ANTENNA') || upper.includes('MAST')) return 'antenna';
  if (upper.includes('BLDG') || upper.includes('BUILDING')) return 'building';
  if (upper.includes('STACK') || upper.includes('CHIMNEY')) return 'stack';
  if (upper.includes('CRANE')) return 'crane';
  if (upper.includes('POLE')) return 'pole';
  if (upper.includes('TREE')) return 'tree';
  return 'other';
}

export class FaaDofObstacleProvider implements ObstacleProvider {
  private db: Database | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(private readonly loadDb: DbLoader) {}

  async ready(): Promise<void> {
    if (this.db) return;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const [SQL, bytes] = await Promise.all([loadSqlJs(), this.loadDb()]);
        this.db = new SQL.Database(bytes);
      })();
    }
    await this.initPromise;
  }

  async obstaclesInBbox(
    bbox: [number, number, number, number],
  ): Promise<Obstacle[]> {
    await this.ready();
    const db = this.db;
    if (!db) return [];
    const [west, south, east, north] = bbox;
    // The bundled sql.js WASM doesn't ship with the R-tree extension, so we
    // always use a plain index on (lat, lon). 14k obstacles scan in a few
    // milliseconds — R-tree isn't worth the custom WASM build.
    const stmt = db.prepare(
      `SELECT * FROM obstacles
       WHERE lat BETWEEN ? AND ?
         AND lon BETWEEN ? AND ?`,
    );
    try {
      stmt.bind([south, north, west, east]);
      const out: Obstacle[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject() as Record<string, unknown>;
        out.push(rowToObstacle(row));
      }
      return out;
    } finally {
      stmt.free();
    }
  }

  async obstaclesAlongRoute(
    samples: Array<Pick<ProfileSample, 'lat' | 'lon'>>,
    corridorNm: number,
  ): Promise<Obstacle[]> {
    if (samples.length === 0) return [];
    // Bounding box of the route padded by the corridor.
    const corridorDeg = corridorNm / 60; // rough, adequate for bbox pre-filter
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;
    for (const s of samples) {
      if (s.lat < minLat) minLat = s.lat;
      if (s.lat > maxLat) maxLat = s.lat;
      if (s.lon < minLon) minLon = s.lon;
      if (s.lon > maxLon) maxLon = s.lon;
    }
    const candidates = await this.obstaclesInBbox([
      minLon - corridorDeg,
      minLat - corridorDeg,
      maxLon + corridorDeg,
      maxLat + corridorDeg,
    ]);
    if (candidates.length === 0) return [];
    // Refine: keep only obstacles within corridorNm of any sample.
    const kept = new Map<string, Obstacle>();
    for (const o of candidates) {
      for (const s of samples) {
        if (greatCircleDistanceNm(o, s) <= corridorNm) {
          kept.set(o.id, o);
          break;
        }
      }
    }
    return Array.from(kept.values());
  }
}

function rowToObstacle(row: Record<string, unknown>): Obstacle {
  const lit = row.lighted;
  const mk = row.marked;
  return {
    id: String(row.id),
    lat: Number(row.lat),
    lon: Number(row.lon),
    heightAgl: Number(row.height_agl),
    heightMsl: Number(row.height_msl),
    type: normalizeType(String(row.type ?? '')),
    lighted: typeof lit === 'number' ? lit === 1 : undefined,
    marked: typeof mk === 'number' ? mk === 1 : undefined,
    name: row.name ? String(row.name) : undefined,
  };
}

