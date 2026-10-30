import type { Disruption, Route, RouteVariant } from '../types/transit';

export const DWELL_SEC = 25;

export interface TripProfile {
  arriveSec: number[];
  departSec: number[];
  totalSec: number;
  disruptedSegment: [number, number] | null; // stop indices in this variant's order
}

function findSegment(variant: RouteVariant, [a, b]: [string, string]): [number, number] | null {
  const ia = variant.stopIds.indexOf(a);
  const ib = variant.stopIds.indexOf(b);
  if (ia < 0 || ib < 0) return null;
  return [Math.min(ia, ib), Math.max(ia, ib)];
}

/** Deterministic timing of one trip: travel at route speed, dwell at intermediate stops, slow down in disrupted segments. */
export function buildTripProfile(variant: RouteVariant, route: Route, disruption: Disruption | null): TripProfile {
  const speedMps = route.avgSpeedKmh / 3.6;
  const n = variant.stopIds.length;
  const seg = disruption && disruption.affectedRouteIds.includes(variant.routeId)
    ? findSegment(variant, disruption.segmentStopIds)
    : null;
  const extraPerLegSec = seg && disruption ? (disruption.extraDelayMin * 60) / Math.max(1, seg[1] - seg[0]) : 0;

  const arriveSec: number[] = [0];
  const departSec: number[] = [0];
  for (let i = 1; i < n; i++) {
    let travel = (variant.stopDistancesM[i] - variant.stopDistancesM[i - 1]) / speedMps;
    if (seg && i - 1 >= seg[0] && i <= seg[1]) travel += extraPerLegSec;
    arriveSec.push(departSec[i - 1] + travel);
    departSec.push(i === n - 1 ? arriveSec[i] : arriveSec[i] + DWELL_SEC);
  }
  return { arriveSec, departSec, totalSec: arriveSec[n - 1], disruptedSegment: seg };
}

export function locateInTrip(
  variant: RouteVariant,
  profile: TripProfile,
  tau: number,
): { distanceAlongM: number; nextStopIndex: number; atStopIndex: number | null } {
  const d = variant.stopDistancesM;
  const n = variant.stopIds.length;
  if (tau <= 0) return { distanceAlongM: 0, nextStopIndex: 0, atStopIndex: 0 };
  for (let i = 1; i < n; i++) {
    if (tau < profile.arriveSec[i]) {
      const start = profile.departSec[i - 1];
      const frac = Math.min(1, Math.max(0, (tau - start) / (profile.arriveSec[i] - start)));
      return { distanceAlongM: d[i - 1] + frac * (d[i] - d[i - 1]), nextStopIndex: i, atStopIndex: null };
    }
    if (tau < profile.departSec[i]) return { distanceAlongM: d[i], nextStopIndex: i, atStopIndex: i };
  }
  return { distanceAlongM: variant.lengthM, nextStopIndex: n - 1, atStopIndex: n - 1 };
}