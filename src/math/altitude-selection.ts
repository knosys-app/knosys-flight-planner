// Terrain-aware + obstacle-aware cruise altitude selector.
//
// Rules applied:
//   1. Find the highest MSL point along the leg (terrain + optional obstacles).
//   2. Add a buffer: 1000 ft in non-mountainous, 2000 ft where max terrain
//      exceeds 8000 ft MSL (informal VFR mountainous practice).
//   3. If above 3000 AGL from departure, round UP to the next VFR cruise
//      altitude for the leg's magnetic course (odd/even +500 rule).
//   4. Clamp to aircraft service ceiling; emit warning when pinned.

import { isMountainousSegment } from './aviation-math';
import { vfrCruiseAltitude } from './vfr-cruise-rule';
import type {
  AircraftProfile,
  NavlogWarning,
  Obstacle,
  ProfileSample,
} from '../types';

export interface AltitudeSelectionInput {
  samples: ProfileSample[];
  obstacles?: Obstacle[];
  /** Magnetic course used for the odd/even VFR cruise rule. */
  magneticCourseDeg: number;
  /** Used to decide whether the VFR cruise rule kicks in (above 3000 AGL). */
  departureElevFt: number;
  aircraft: AircraftProfile;
  obstaclesEnabled: boolean;
}

export interface AltitudeSelectionResult {
  altFt: number;
  autoPicked: true;
  maxTerrainFt: number;
  maxObstacleFt: number;
  isMountainous: boolean;
  warnings: NavlogWarning[];
}

export function selectCruiseAltitude(
  input: AltitudeSelectionInput,
): AltitudeSelectionResult {
  const maxTerrain = input.samples.reduce(
    (acc, s) => (s.terrainElevFt > acc ? s.terrainElevFt : acc),
    Number.NEGATIVE_INFINITY,
  );
  const terrainMsl = Number.isFinite(maxTerrain) ? maxTerrain : 0;

  let obstacleMsl = 0;
  if (input.obstaclesEnabled && input.obstacles && input.obstacles.length > 0) {
    obstacleMsl = input.obstacles.reduce(
      (acc, o) => (o.heightMsl > acc ? o.heightMsl : acc),
      0,
    );
  }

  const highestMsl = Math.max(terrainMsl, obstacleMsl);
  const isMountainous = isMountainousSegment(terrainMsl);
  const buffer = isMountainous ? 2000 : 1000;
  let minSafeMsl = Math.ceil((highestMsl + buffer) / 100) * 100;

  // Apply VFR cruise altitude rule when above 3000 AGL from departure.
  const agl = minSafeMsl - input.departureElevFt;
  if (agl > 3000) {
    minSafeMsl = vfrCruiseAltitude(input.magneticCourseDeg, minSafeMsl);
  }

  const warnings: NavlogWarning[] = [];
  const ceiling = input.aircraft.serviceCeilingFt ?? 14000;
  if (minSafeMsl > ceiling) {
    warnings.push({
      kind: 'serviceCeilingExceeded',
      message: `Required ${minSafeMsl} ft exceeds service ceiling ${ceiling} ft`,
    });
    minSafeMsl = ceiling;
  }

  return {
    altFt: minSafeMsl,
    autoPicked: true,
    maxTerrainFt: terrainMsl,
    maxObstacleFt: obstacleMsl,
    isMountainous,
    warnings,
  };
}
