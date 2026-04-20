import type { FC } from 'react';
import type {
  AircraftProfile,
  NavlogRow,
  Obstacle,
  Plan,
  ProfileSample,
  SharedDependencies,
  Waypoint,
} from '../types';
import { createVerticalProfileChart } from './vertical-profile-chart';

export interface VerticalProfileModalProps {
  open: boolean;
  onClose: () => void;
  plan: Plan | null;
  aircraft: AircraftProfile | null;
  rows: NavlogRow[];
  samples: ProfileSample[];
  obstacles: Array<Obstacle & { alongTrackNm: number }>;
  departureElevFt: number;
  arrivalElevFt: number;
}

export function createVerticalProfileModal(Shared: SharedDependencies) {
  const { Dialog, DialogContent, DialogHeader, DialogTitle } = Shared;
  const Chart = createVerticalProfileChart(Shared);

  const VerticalProfileModal: FC<VerticalProfileModalProps> = ({
    open,
    onClose,
    plan,
    rows,
    samples,
    obstacles,
    departureElevFt,
    arrivalElevFt,
  }) => {
    const envelope = plan ? buildEnvelope(plan, rows, departureElevFt, arrivalElevFt) : [];
    const legBoundaries = plan ? buildLegBoundaries(plan, rows) : [];

    return (
      <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
        <DialogContent className="!max-w-5xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>Vertical profile</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <Chart
              samples={samples}
              obstacles={obstacles}
              envelope={envelope}
              legBoundaries={legBoundaries}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Terrain sampled every 0.5 nm via AWS Terrarium. Planned altitude
            envelope reflects climb-out, cruise, and descent-in per leg.
            Obstacles (red dots) are shown when FAA DOF is enabled in Settings.
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return VerticalProfileModal;
}

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

    // Climb-out
    if (climbDist > 0) {
      points.push({ alongTrackNm: along, plannedAltFt: startAlt });
      points.push({ alongTrackNm: along + climbDist, plannedAltFt: cruiseAlt });
    } else {
      points.push({ alongTrackNm: along, plannedAltFt: cruiseAlt });
    }

    // Cruise
    const cruiseEnd = along + legDist - descentDist;
    points.push({ alongTrackNm: cruiseEnd, plannedAltFt: cruiseAlt });

    // Descent-in — only on last leg, or when next leg is lower.
    const nextAlt = i < plan.legs.length - 1 ? plan.legs[i + 1].altFt : arrivalElevFt + 1000;
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
