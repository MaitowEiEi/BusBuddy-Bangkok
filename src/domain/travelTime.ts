import { bangkokMinutesOfDay } from '../lib/format';
import type { Disruption, Route, RouteVariant } from '../types/transit';
import { frequencyAt } from './schedule';

/** Planning assumption for time spent at each intermediate stop. */
export const PLANNING_DWELL_SEC = 25;

export function headwayMinAt(route: Route, nowMs: number): number {
  const period = frequencyAt(route, bangkokMinutesOfDay(nowMs));
  return period ? (period.headwayMin[0] + period.headwayMin[1]) / 2 : 30;
}

function disruptedSegment(variant: RouteVariant, disruption: Disruption | null): [number, number] | null {
  if (!disruption || !disruption.affectedRouteIds.includes(variant.routeId)) return null;
  const a = variant.stopIds.indexOf(disruption.segmentStopIds[0]);
  const b = variant.stopIds.indexOf(disruption.segmentStopIds[1]);
  if (a < 0 || b < 0) return null;
  return [Math.min(a, b), Math.max(a, b)];
}

/** Stop-to-stop hops of this ride that fall inside the disrupted segment. */
function disruptedHops(variant: RouteVariant, fromIndex: number, toIndex: number, disruption: Disruption | null) {
  const seg = disruptedSegment(variant, disruption);
  if (!seg) return { hops: 0, total: 0 };
  const hops = Math.max(0, Math.min(toIndex, seg[1]) - Math.max(fromIndex, seg[0]));
  return { hops, total: seg[1] - seg[0] };
}

export function rideCrossesDisruption(variant: RouteVariant, fromIndex: number, toIndex: number, disruption: Disruption | null): boolean {
  return disruptedHops(variant, fromIndex, toIndex, disruption).hops > 0;
}

/** Timetable-based in-vehicle time, used when no live vehicle can be matched. */
export function scheduledRideSec(
  route: Route,
  variant: RouteVariant,
  fromIndex: number,
  toIndex: number,
  disruption: Disruption | null,
): number {
  const speedMps = route.avgSpeedKmh / 3.6;
  const distM = variant.stopDistancesM[toIndex] - variant.stopDistancesM[fromIndex];
  let sec = distM / speedMps + Math.max(0, toIndex - fromIndex - 1) * PLANNING_DWELL_SEC;
  const { hops, total } = disruptedHops(variant, fromIndex, toIndex, disruption);
  if (disruption && hops > 0 && total > 0) sec += (disruption.extraDelayMin * 60 * hops) / total;
  return Math.round(sec);
}