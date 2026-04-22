// Schema migrations. v0.2.0 introduces aircraft & plan schemaVersion: 2.
// Aircraft v2 adds climbGph/descentTasKt/descentGph/taxiMinutes/patternMinutes/
// serviceCeilingFt/taxiGph. Plan v2 adds `altAutoPicked` to legs.

export const CURRENT_SCHEMA_VERSION = 3 as const;

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
  if (version === 3) return rec;

  let migrated: AnyRecord = rec;
  if ((migrated.schemaVersion ?? 1) === 1) {
    // v1 → v2: fill in sane defaults for block-time & performance fields.
    const tas = typeof migrated.tasKt === 'number' ? migrated.tasKt : 120;
    const gph = typeof migrated.fuelBurnGph === 'number' ? migrated.fuelBurnGph : 8.5;
    const defaults: AnyRecord = {
      climbGph: typeof migrated.climbGph === 'number' ? migrated.climbGph : gph * 1.15,
      descentFpm: typeof migrated.descentFpm === 'number' ? migrated.descentFpm : 500,
      descentTasKt: typeof migrated.descentTasKt === 'number' ? migrated.descentTasKt : tas,
      descentGph: typeof migrated.descentGph === 'number' ? migrated.descentGph : gph * 0.6,
      taxiMinutes: typeof migrated.taxiMinutes === 'number' ? migrated.taxiMinutes : 10,
      taxiGph: typeof migrated.taxiGph === 'number' ? migrated.taxiGph : gph * 0.3,
      patternMinutes:
        typeof migrated.patternMinutes === 'number' ? migrated.patternMinutes : 5,
      serviceCeilingFt:
        typeof migrated.serviceCeilingFt === 'number' ? migrated.serviceCeilingFt : 14000,
    };
    migrated = { ...migrated, schemaVersion: 2, ...defaults };
  }

  if ((migrated.schemaVersion ?? 1) === 2) {
    // v2 → v3: W&B support. New fields are all optional; existing profiles
    // just carry forward with undefined stations (W&B editor will prompt the
    // pilot to fill them in before the envelope plot is meaningful).
    migrated = { ...migrated, schemaVersion: 3 };
  }

  if (migrated.schemaVersion !== 3) {
    throw new Error(`Unknown aircraft schemaVersion: ${migrated.schemaVersion}`);
  }
  return migrated;
}

export function migrateSettings(raw: unknown): unknown {
  const rec = asRecord(raw);
  if (!rec) return raw;
  const version = typeof rec.schemaVersion === 'number' ? rec.schemaVersion : 1;
  if (version === 1) return rec;
  throw new Error(`Unknown settings schemaVersion: ${version}`);
}
