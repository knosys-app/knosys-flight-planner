// Schema migrations. v1 is the initial version — migrations stub is here
// so future schemaVersion bumps (e.g. when IFR fields are added) have a home.

export const CURRENT_SCHEMA_VERSION = 1 as const;

export function migratePlan(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const version = (raw as { schemaVersion?: number }).schemaVersion;
  if (!version || version === 1) return raw;
  throw new Error(`Unknown plan schemaVersion: ${version}`);
}

export function migrateAircraft(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const version = (raw as { schemaVersion?: number }).schemaVersion;
  if (!version || version === 1) return raw;
  throw new Error(`Unknown aircraft schemaVersion: ${version}`);
}

export function migrateSettings(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const version = (raw as { schemaVersion?: number }).schemaVersion;
  if (!version || version === 1) return raw;
  throw new Error(`Unknown settings schemaVersion: ${version}`);
}
