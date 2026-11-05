import type { LatLng, RouteVariant } from '../types/transit';

const STOP_PASSED_M = 40; // a stop this close counts as reached
const PASSED_M = 250; // this far beyond the alighting stop = missed it
const SEARCH_BEHIND_M = 300;
const SEARCH_AHEAD_M = 1000;

export interface AlightProgress {
  offRouteM: number; // distance from the route line
  alongM: number;
  metersLeft: number;
  stopsLeft: number;
  nextStopId: string | null;
  passed: boolean;
}

/** Where the rider is along the ride from boardIndex to alightIndex, from a GPS position. */
export function alightProgress(
  variant: RouteVariant,
  boardIndex: number,
  alightIndex: number,
  position: LatLng,
): AlightProgress | null {
  const { shape, shapeCumM: cum, stopDistancesM: stopM } = variant;
  if (shape.length < 2) return null;
  const endM = stopM[alightIndex] ?? cum[cum.length - 1];
  const fromM = (stopM[boardIndex] ?? 0) - SEARCH_BEHIND_M;
  const toM = endM + SEARCH_AHEAD_M;

  // Flat projection is accurate enough over a few kilometres.
  const kx = 111320 * Math.cos((position[0] * Math.PI) / 180);
  const ky = 110540;
  const px = position[1] * kx;
  const py = position[0] * ky;
  let bestD = Infinity;
  let bestM = fromM;
  for (let i = 0; i < shape.length - 1; i++) {
    if (cum[i + 1] < fromM || cum[i] > toM) continue; // only this ride, so loop routes do not confuse it
    const ax = shape[i][1] * kx;
    const ay = shape[i][0] * ky;
    const dx = shape[i + 1][1] * kx - ax;
    const dy = shape[i + 1][0] * ky - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    const d = Math.hypot(ax + t * dx - px, ay + t * dy - py);
    if (d < bestD) {
      bestD = d;
      bestM = cum[i] + t * (cum[i + 1] - cum[i]);
    }
  }

  let stopsLeft = 0;
  let nextIndex = -1;
  for (let k = boardIndex + 1; k <= alightIndex; k++) {
    if ((stopM[k] ?? 0) > bestM + STOP_PASSED_M) {
      stopsLeft++;
      if (nextIndex < 0) nextIndex = k;
    }
  }
  return {
    offRouteM: bestD,
    alongM: bestM,
    metersLeft: Math.max(0, endM - bestM),
    stopsLeft,
    nextStopId: nextIndex >= 0 ? variant.stopIds[nextIndex] : null,
    passed: bestM > endM + PASSED_M,
  };
}