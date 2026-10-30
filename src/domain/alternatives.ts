import type { Arrival, RouteVariant, TransitNetwork } from '../types/transit';

/** Consecutive stops both trips serve after boarding, in the same order — where they stop overlapping, they diverge. */
export function sharedStopsAhead(a: RouteVariant, aIndex: number, b: RouteVariant, bIndex: number): string[] {
  const shared: string[] = [];
  let i = aIndex + 1;
  let j = bIndex + 1;
  while (i < a.stopIds.length && j < b.stopIds.length && a.stopIds[i] === b.stopIds[j]) {
    shared.push(a.stopIds[i]);
    i++;
    j++;
  }
  return shared;
}

export interface CrowdAlternative {
  arrival: Arrival;
  sharedStopIds: string[];
  coversAll: boolean;
}

export function findLessCrowdedAlternative(net: TransitNetwork, arrivals: Arrival[], target: Arrival): CrowdAlternative | null {
  if (target.crowd !== 'crowded') return null;
  const targetVariant = net.variantById[target.variantId];
  const remaining = targetVariant.stopIds.length - 1 - target.stopIndex;
  let best: CrowdAlternative | null = null;

  for (const a of arrivals) {
    if (a.vehicleId === target.vehicleId || a.stopId !== target.stopId) continue;
    if (a.crowd !== 'seats' && a.crowd !== 'standing') continue;
    if (a.etaSec === null || a.mayHavePassed) continue;
    const shared = sharedStopsAhead(targetVariant, target.stopIndex, net.variantById[a.variantId], a.stopIndex);
    if (shared.length === 0) continue;
    if (!best || a.etaSec < (best.arrival.etaSec ?? Infinity)) {
      best = { arrival: a, sharedStopIds: shared, coversAll: shared.length === remaining };
    }
  }
  return best;
}