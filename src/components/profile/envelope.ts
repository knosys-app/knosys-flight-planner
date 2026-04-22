import type { NavlogRow, Plan, Waypoint } from '../../types';

/**
 * Build the piecewise planned-altitude envelope keyed by along-track nm.
 * Uses each leg's climb/cruise/descent distances from the phase model to
 * place TOC / TOD markers along the continuous along-track axis.
 */
export function buildEnvelope(
  plan: Plan,
  rows: NavlogRow[],
  departureElevFt: number,
  arrivalElevFt: number,
): Array<{ alongTrackNm: number; plannedAltFt: number }> {
  if (plan.legs.length === 0 || rows.length === 0) return [];
  const wpIndex = new Map<string, Waypoint>(plan.waypoints.map((w) => [w.id, w]));
  const points: Array<{ alongTrackNm: number; plannedAltFt: number }> = [];
  let along = 0;
  let startAlt = departureElevFt + 50;

  plan.legs.forEach((leg, i) => {
    const from = wpIndex.get(leg.fromId);
    const to = wpIndex.get(leg.toId);
    const row = rows[i];
    if (!from || !to || !row) return;

    const legDist = row.distanceNm;
    const climbDist = row.phases?.climb?.distanceNm ?? 0;
    const descentDist = row.phases?.descent?.distanceNm ?? 0;
    const cruiseAlt = leg.altFt;

    if (climbDist > 0) {
      points.push({ alongTrackNm: along, plannedAltFt: startAlt });
      points.push({ alongTrackNm: along + climbDist, plannedAltFt: cruiseAlt });
    } else {
      points.push({ alongTrackNm: along, plannedAltFt: cruiseAlt });
    }

    const cruiseEnd = along + legDist - descentDist;
    points.push({ alongTrackNm: cruiseEnd, plannedAltFt: cruiseAlt });

    const nextAlt =
      i < plan.legs.length - 1 ? plan.legs[i + 1].altFt : arrivalElevFt + 1000;
    if (descentDist > 0) {
      points.push({ alongTrackNm: along + legDist, plannedAltFt: nextAlt });
    }

    along += legDist;
    startAlt = nextAlt;
  });

  return points;
}

export function buildLegBoundaries(
  plan: Plan,
  rows: NavlogRow[],
): Array<{ alongTrackNm: number; label: string }> {
  const wpIndex = new Map<string, Waypoint>(plan.waypoints.map((w) => [w.id, w]));
  const boundaries: Array<{ alongTrackNm: number; label: string }> = [];
  let along = 0;
  rows.forEach((row, i) => {
    const leg = plan.legs[row.legIndex];
    if (!leg) return;
    const to = wpIndex.get(leg.toId);
    along += row.distanceNm;
    if (i < rows.length - 1 && to) {
      boundaries.push({ alongTrackNm: along, label: to.ref });
    }
  });
  return boundaries;
}
