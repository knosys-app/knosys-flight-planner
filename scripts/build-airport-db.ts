// Build-time-only script. Downloads OurAirports CSVs and assembles a
// single airports.sqlite file with FTS-friendly indexes. Runtime uses
// sql.js (WASM) — this script is the ONLY place `better-sqlite3` (native)
// is loaded. The resulting sqlite file ships out-of-bundle and is
// downloaded on first run (or hosted on a CDN).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { parse } from 'csv-parse/sync';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'data', 'cache');
const OUTPUT_DB = path.join(ROOT, 'data', 'airports.sqlite');
const OUTPUT_META = path.join(ROOT, 'data', 'airports.meta.json');

const SOURCES = {
  airports: 'https://davidmegginson.github.io/ourairports-data/airports.csv',
  runways: 'https://davidmegginson.github.io/ourairports-data/runways.csv',
  navaids: 'https://davidmegginson.github.io/ourairports-data/navaids.csv',
  frequencies: 'https://davidmegginson.github.io/ourairports-data/airport-frequencies.csv',
};

async function ensureDir(p: string): Promise<void> {
  await fs.promises.mkdir(p, { recursive: true });
}

async function fetchCsv(name: string, url: string): Promise<string> {
  const cacheFile = path.join(CACHE_DIR, `${name}.csv`);
  const staleAfterMs = 12 * 60 * 60 * 1000;
  try {
    const stat = await fs.promises.stat(cacheFile);
    if (Date.now() - stat.mtime.getTime() < staleAfterMs) {
      return fs.promises.readFile(cacheFile, 'utf8');
    }
  } catch {
    // not cached
  }
  process.stdout.write(`Fetching ${name}\u2026 `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${name}: ${res.status}`);
  const text = await res.text();
  await fs.promises.writeFile(cacheFile, text);
  console.log(`${(text.length / 1024).toFixed(0)} KB`);
  return text;
}

function num(v: string | undefined): number | null {
  if (!v || v === '') return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function int(v: string | undefined): number | null {
  if (!v || v === '') return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function str(v: string | undefined): string | null {
  if (v === undefined || v === null || v === '') return null;
  return String(v);
}

async function main(): Promise<void> {
  await ensureDir(CACHE_DIR);
  await ensureDir(path.dirname(OUTPUT_DB));

  const [airportsCsv, runwaysCsv, navaidsCsv, frequenciesCsv] = await Promise.all([
    fetchCsv('airports', SOURCES.airports),
    fetchCsv('runways', SOURCES.runways),
    fetchCsv('navaids', SOURCES.navaids),
    fetchCsv('frequencies', SOURCES.frequencies),
  ]);

  const airports = parse(airportsCsv, { columns: true, skip_empty_lines: true }) as any[];
  const runways = parse(runwaysCsv, { columns: true, skip_empty_lines: true }) as any[];
  const navaids = parse(navaidsCsv, { columns: true, skip_empty_lines: true }) as any[];
  const frequencies = parse(frequenciesCsv, { columns: true, skip_empty_lines: true }) as any[];

  console.log(
    `Parsed: ${airports.length} airports, ${runways.length} runways, ${navaids.length} navaids, ${frequencies.length} frequencies`,
  );

  try {
    await fs.promises.unlink(OUTPUT_DB);
  } catch {}

  const db = new Database(OUTPUT_DB);
  db.pragma('journal_mode = MEMORY');
  db.pragma('synchronous = OFF');

  db.exec(`
    CREATE TABLE airports (
      ident TEXT PRIMARY KEY,
      type TEXT,
      name TEXT,
      latitude_deg REAL,
      longitude_deg REAL,
      elevation_ft INTEGER,
      continent TEXT,
      iso_country TEXT,
      iso_region TEXT,
      municipality TEXT,
      iata_code TEXT,
      local_code TEXT,
      gps_code TEXT
    );
    CREATE INDEX airports_iata_idx ON airports(iata_code);
    CREATE INDEX airports_local_idx ON airports(local_code);
    CREATE INDEX airports_country_idx ON airports(iso_country);
    CREATE INDEX airports_geo_idx ON airports(latitude_deg, longitude_deg);

    CREATE TABLE runways (
      airport_ident TEXT,
      le_ident TEXT,
      he_ident TEXT,
      length_ft INTEGER,
      width_ft INTEGER,
      surface TEXT,
      le_heading_degT REAL,
      he_heading_degT REAL
    );
    CREATE INDEX runways_ident_idx ON runways(airport_ident);

    CREATE TABLE navaids (
      ident TEXT PRIMARY KEY,
      name TEXT,
      type TEXT,
      latitude_deg REAL,
      longitude_deg REAL,
      elevation_ft INTEGER,
      iso_country TEXT,
      frequency_khz INTEGER
    );
    CREATE INDEX navaids_country_idx ON navaids(iso_country);

    CREATE TABLE frequencies (
      airport_ident TEXT,
      type TEXT,
      description TEXT,
      frequency_mhz REAL
    );
    CREATE INDEX frequencies_ident_idx ON frequencies(airport_ident);
  `);

  const insertAirport = db.prepare(`
    INSERT INTO airports
      (ident, type, name, latitude_deg, longitude_deg, elevation_ft,
       continent, iso_country, iso_region, municipality, iata_code, local_code, gps_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRunway = db.prepare(`
    INSERT INTO runways
      (airport_ident, le_ident, he_ident, length_ft, width_ft, surface,
       le_heading_degT, he_heading_degT)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertNavaid = db.prepare(`
    INSERT INTO navaids
      (ident, name, type, latitude_deg, longitude_deg, elevation_ft, iso_country, frequency_khz)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertFrequency = db.prepare(`
    INSERT INTO frequencies (airport_ident, type, description, frequency_mhz)
    VALUES (?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const a of airports) {
      insertAirport.run(
        str(a.ident),
        str(a.type),
        str(a.name),
        num(a.latitude_deg),
        num(a.longitude_deg),
        int(a.elevation_ft),
        str(a.continent),
        str(a.iso_country),
        str(a.iso_region),
        str(a.municipality),
        str(a.iata_code),
        str(a.local_code),
        str(a.gps_code),
      );
    }
    for (const r of runways) {
      insertRunway.run(
        str(r.airport_ident),
        str(r.le_ident),
        str(r.he_ident),
        int(r.length_ft),
        int(r.width_ft),
        str(r.surface),
        num(r.le_heading_degT),
        num(r.he_heading_degT),
      );
    }
    const seenNavaids = new Set<string>();
    for (const n of navaids) {
      const ident = String(n.ident ?? '');
      if (!ident || seenNavaids.has(ident)) continue;
      seenNavaids.add(ident);
      insertNavaid.run(
        ident,
        str(n.name),
        str(n.type),
        num(n.latitude_deg),
        num(n.longitude_deg),
        int(n.elevation_ft),
        str(n.iso_country),
        int(n.frequency_khz),
      );
    }
    for (const f of frequencies) {
      insertFrequency.run(
        str(f.airport_ident),
        str(f.type),
        str(f.description),
        num(f.frequency_mhz),
      );
    }
  });

  console.log('Inserting rows\u2026');
  tx();

  console.log('VACUUM\u2026');
  db.exec('VACUUM');
  db.close();

  const stat = await fs.promises.stat(OUTPUT_DB);
  const meta = {
    buildDate: new Date().toISOString(),
    rowCounts: {
      airports: airports.length,
      runways: runways.length,
      navaids: navaids.length,
      frequencies: frequencies.length,
    },
    source: 'ourairports.com (davidmegginson.github.io mirror)',
    sizeBytes: stat.size,
  };
  await fs.promises.writeFile(OUTPUT_META, JSON.stringify(meta, null, 2));
  console.log(`\u2713 Wrote ${OUTPUT_DB} (${(stat.size / 1_000_000).toFixed(1)} MB)`);
  console.log(`\u2713 Wrote ${OUTPUT_META}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
