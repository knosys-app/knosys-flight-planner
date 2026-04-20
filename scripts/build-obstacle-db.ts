// Build-time-only script. Fetches the FAA Digital Obstacle File and
// produces data/obstacles.sqlite with an R-tree spatial index. The
// resulting file is committed to the repo so raw.githubusercontent.com
// can serve it with CORS to the plugin's OPFS downloader.
//
// FAA DOF source: public-domain US government data. Daily release file
// name is the current date (e.g., DOF_250301.CSV) in the /DOF/ directory.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { parse } from 'csv-parse/sync';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'data', 'cache');
const OUTPUT_DB = path.join(ROOT, 'data', 'obstacles.sqlite');
const OUTPUT_META = path.join(ROOT, 'data', 'obstacles.meta.json');

// Zipped daily product (CSV inside). Use the fixed-name evergreen path.
const FAA_DOF_URL =
  'https://aeronav.faa.gov/Obst_Data/DAILY_DOF_CSV.ZIP';

async function ensureDir(p: string): Promise<void> {
  await fs.promises.mkdir(p, { recursive: true });
}

async function downloadZip(): Promise<Buffer> {
  const cacheFile = path.join(CACHE_DIR, 'DAILY_DOF_CSV.zip');
  const staleAfterMs = 24 * 60 * 60 * 1000;
  try {
    const stat = await fs.promises.stat(cacheFile);
    if (Date.now() - stat.mtime.getTime() < staleAfterMs) {
      return fs.promises.readFile(cacheFile);
    }
  } catch {
    // not cached
  }
  process.stdout.write('Fetching FAA DOF zip… ');
  const res = await fetch(FAA_DOF_URL);
  if (!res.ok) throw new Error(`Failed FAA DOF: ${res.status}`);
  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);
  await fs.promises.writeFile(cacheFile, buf);
  console.log(`${(buf.length / 1024 / 1024).toFixed(1)} MB`);
  return buf;
}

// Minimal zip unpacker for a single CSV entry. FAA ships one CSV per zip.
// Uses the "stored" or "deflated" methods common to DOS zip tools.
async function extractCsv(zip: Buffer): Promise<string> {
  // Lazy-load adm-zip only at build time to avoid adding it to runtime deps.
  const AdmZip = (await import('adm-zip')).default;
  const z = new AdmZip(zip);
  const entries = z.getEntries().filter((e) => /\.csv$/i.test(e.entryName));
  if (entries.length === 0) throw new Error('No CSV in FAA DOF zip');
  return entries[0].getData().toString('utf8');
}

function num(v: string | undefined): number | null {
  if (!v || v === '') return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

async function main(): Promise<void> {
  await ensureDir(CACHE_DIR);
  await ensureDir(path.dirname(OUTPUT_DB));

  const zip = await downloadZip();
  const csv = await extractCsv(zip);
  const rows = parse(csv, {
    columns: (header: string[]) => header.map((h) => h.trim().replace(/\s+/g, '_')),
    skip_empty_lines: true,
    trim: true,
  }) as any[];
  console.log(`Parsed ${rows.length} DOF rows`);

  // FAA DOF CSV columns (current format, after whitespace normalization):
  //   OAS, VERIFIED_STATUS, COUNTRY, STATE, CITY, LATDEC, LONDEC, DMSLAT,
  //   DMSLON, TYPE, QUANTITY, AGL, AMSL, LIGHTING, ACCURACY, MARKING,
  //   FAA_STUDY, ACTION, JDATE

  if (fs.existsSync(OUTPUT_DB)) fs.unlinkSync(OUTPUT_DB);
  const db = new Database(OUTPUT_DB);
  db.pragma('journal_mode = OFF');
  db.pragma('synchronous = OFF');

  // No R-tree virtual table — the sql.js WASM doesn't ship the R-tree
  // module, and 14k CONUS obstacles scan fine with a plain (lat, lon) index.
  db.exec(`
    CREATE TABLE obstacles (
      id TEXT PRIMARY KEY,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      height_agl REAL NOT NULL,
      height_msl REAL NOT NULL,
      type TEXT NOT NULL,
      lighted INTEGER,
      marked INTEGER,
      name TEXT
    );
    CREATE INDEX idx_obstacles_lat_lon ON obstacles(lat, lon);
  `);

  const insertObs = db.prepare(`
    INSERT OR IGNORE INTO obstacles (id, lat, lon, height_agl, height_msl, type, lighted, marked, name)
    VALUES (@id, @lat, @lon, @height_agl, @height_msl, @type, @lighted, @marked, @name)
  `);

  let inserted = 0;
  // Filter: CONUS + height >= 200 ft AGL keeps the dataset small enough to
  // ship via raw.githubusercontent.com. Below 200 ft AGL doesn't affect VFR
  // cruise planning (pilots are always above 500 ft AGL in cruise).
  const CONUS_STATES = new Set([
    'AL','AZ','AR','CA','CO','CT','DE','FL','GA','ID','IL','IN','IA','KS','KY','LA',
    'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND',
    'OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
    'DC',
  ]);
  const MIN_AGL_FT = 500;

  let skipped = 0;
  let filtered = 0;
  const txn = db.transaction((records: any[]) => {
    for (const r of records) {
      const country = String(r.COUNTRY ?? '').trim().toUpperCase();
      const state = String(r.STATE ?? '').trim().toUpperCase();
      if (country !== 'US' || !CONUS_STATES.has(state)) {
        filtered++;
        continue;
      }
      const lat = parseLat(r);
      const lon = parseLon(r);
      if (lat === null || lon === null) {
        skipped++;
        continue;
      }
      const agl = num(r.AGL ?? r.AGL_HT ?? r.AGL_HT_FT);
      const msl = num(r.AMSL ?? r.AMSL_HT ?? r.AMSL_HT_FT ?? r.MSL);
      if (agl === null || msl === null) {
        skipped++;
        continue;
      }
      if (agl < MIN_AGL_FT) {
        filtered++;
        continue;
      }
      const id = String(r.OAS ?? r.FAA_STUDY ?? r.FAA_STUDY_NUMBER ?? `${inserted}`).trim();
      const type = String(r.TYPE ?? '').trim() || 'OTHER';
      const lighting = String(r.LIGHTING ?? '').trim().toUpperCase();
      const marking = String(r.MARKING ?? r.MARK_INDICATOR ?? '').trim().toUpperCase();
      // FAA lighting codes: R=red, W=white, D=dual, L=lit (non-specific),
      // N=none, U=unknown. Treat non-N/U as lit.
      const lit = lighting !== '' && lighting !== 'N' && lighting !== 'U';
      // Marking: M=marked, P=painted, F=flag. Anything other than N/U/empty is marked.
      const mk = marking !== '' && marking !== 'N' && marking !== 'U';
      const info = insertObs.run({
        id,
        lat,
        lon,
        height_agl: agl,
        height_msl: msl,
        type,
        lighted: lit ? 1 : 0,
        marked: mk ? 1 : 0,
        name: null,
      });
      if (info.changes > 0) inserted++;
    }
  });
  txn(rows);
  if (skipped > 0) console.log(`Skipped ${skipped} rows with missing coords/heights`);
  if (filtered > 0) console.log(`Filtered ${filtered} rows outside CONUS or below ${MIN_AGL_FT} ft AGL`);

  db.exec('VACUUM');
  db.close();

  const meta = {
    buildDate: new Date().toISOString(),
    sourceUrl: FAA_DOF_URL,
    rows: inserted,
    schema: 'obstacles v1',
  };
  await fs.promises.writeFile(OUTPUT_META, JSON.stringify(meta, null, 2));

  const outStat = await fs.promises.stat(OUTPUT_DB);
  console.log(`Built ${OUTPUT_DB}: ${inserted} obstacles, ${(outStat.size / 1024 / 1024).toFixed(2)} MB`);
}

function parseLat(r: any): number | null {
  // Primary: LATDEC column (decimal degrees). Fall back to DMS parsing.
  const direct = num(r.LATDEC ?? r.LATITUDE ?? r.LAT);
  if (direct !== null) return direct;
  const dmsStr = String(r.DMSLAT ?? '').trim();
  if (dmsStr) {
    const m = dmsStr.match(/(\d+)\s+(\d+)\s+([\d.]+)\s*([NS])/i);
    if (m) {
      const deg = Number(m[1]);
      const min = Number(m[2]);
      const sec = Number(m[3]);
      const hemi = m[4].toUpperCase();
      const abs = deg + min / 60 + sec / 3600;
      return hemi === 'S' ? -abs : abs;
    }
  }
  const deg = num(r.LAT_DEG);
  const min = num(r.LAT_MIN) ?? 0;
  const sec = num(r.LAT_SEC) ?? 0;
  const hemi = String(r.LAT_HEMI ?? 'N').toUpperCase();
  if (deg === null) return null;
  const abs = deg + min / 60 + sec / 3600;
  return hemi === 'S' ? -abs : abs;
}

function parseLon(r: any): number | null {
  const direct = num(r.LONDEC ?? r.LONGITUDE ?? r.LON);
  if (direct !== null) return direct;
  const dmsStr = String(r.DMSLON ?? '').trim();
  if (dmsStr) {
    const m = dmsStr.match(/(\d+)\s+(\d+)\s+([\d.]+)\s*([EW])/i);
    if (m) {
      const deg = Number(m[1]);
      const min = Number(m[2]);
      const sec = Number(m[3]);
      const hemi = m[4].toUpperCase();
      const abs = deg + min / 60 + sec / 3600;
      return hemi === 'W' ? -abs : abs;
    }
  }
  const deg = num(r.LON_DEG);
  const min = num(r.LON_MIN) ?? 0;
  const sec = num(r.LON_SEC) ?? 0;
  const hemi = String(r.LON_HEMI ?? 'W').toUpperCase();
  if (deg === null) return null;
  const abs = deg + min / 60 + sec / 3600;
  return hemi === 'E' ? abs : -abs;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
