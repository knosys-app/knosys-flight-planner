// Schema migrations. v0.2.0 introduces aircraft & plan schemaVersion: 2.
// Aircraft v2 adds climbGph/descentTasKt/descentGph/taxiMinutes/patternMinutes/
// serviceCeilingFt/taxiGph. Plan v2 adds `altAutoPicked` to legs.

export const CURRENT_SCHEMA_VERSION = 2 as const;

type AnyRecord = Record<string, unknown>;

function asRecord(raw: unknown): AnyRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as AnyRecord;
}

export function migratePlan(raw: unknown): unknown {
  const rec = asRecord(raw);
  if (!rec) return raw;
  const version = typeof rec.schemaVersion === 'number' ? rec.schemaVersion : 1;
  if (version === 2) return rec;
  if (version === 1) {
    // v1 → v2: existing legs keep their user-chosen altitude. altAutoPicked
    // defaults to false so the auto-bump effect doesn't clobber saved plans.
    const legs = Array.isArray(rec.legs) ? rec.legs : [];
    const migratedLegs = legs.map((leg) => {
      const legRec = asRecord(leg);
      if (!legRec) return leg;
      if (typeof legRec.altAutoPicked === 'boolean') return legRec;
      return { ...legRec, altAutoPicked: false };
    });
    return { ...rec, schemaVersion: 2, legs: migratedLegs };
  }
  throw new Error(`Unknown plan schemaVersion: ${version}`);
}

export function migrateAircraft(raw: unknown): unknown {
  const rec = asRecord(raw);
  if (!rec) return raw;
  const version = typeof rec.schemaVersion === 'number' ? rec.schemaVersion : 1;
  if (version === 2) return rec;
  if (version === 1) {
    // v1 → v2: fill in sane defaults for new block-time & performance fields.
    const tas = typeof rec.tasKt === 'number' ? rec.tasKt : 120;
    const gph = typeof rec.fuelBurnGph === 'number' ? rec.fuelBurnGph : 8.5;
    const defaults: AnyRecord = {
      climbGph: typeof rec.climbGph === 'number' ? rec.climbGph : gph * 1.15,
      descentFpm: typeof rec.descentFpm === 'number' ? rec.descentFpm : 500,
      descentTasKt: typeof rec.descentTasKt === 'number' ? rec.descentTasKt : tas,
      descentGph: typeof rec.descentGph === 'number' ? rec.descentGph : gph * 0.6,
      taxiMinutes: typeof rec.taxiMinutes === 'number' ? rec.taxiMinutes : 10,
      taxiGph: typeof rec.taxiGph === 'number' ? rec.taxiGph : gph * 0.3,
      patternMinutes: typeof rec.patternMinutes === 'number' ? rec.patternMinutes : 5,
      serviceCeilingFt: typeof rec.serviceCeilingFt === 'number' ? rec.serviceCeilingFt : 14000,
    };
    return { ...rec, schemaVersion: 2, ...defaults };
  }
  throw new Error(`Unknown aircraft schemaVersion: ${version}`);
}

export function migrateSettings(raw: unknown): unknown {
  const rec = asRecord(raw);
  if (!rec) return raw;
  const version = typeof rec.schemaVersion === 'number' ? rec.schemaVersion : 1;
  if (version === 1) return rec;
  throw new Error(`Unknown settings schemaVersion: ${version}`);
}
