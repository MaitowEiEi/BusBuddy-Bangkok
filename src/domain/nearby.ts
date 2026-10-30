import type { Arrival, EtaRange, LiveSnapshot, TransitNetwork } from '../types/transit';
import { arrivalsForStop } from './arrivals';
import type { NearbyStop } from './walking';

export type WalkFeasibility = 'ok' | 'tight' | 'miss' | 'unknown';

export function walkFeasibility(walkMin: number, range: EtaRange | null): WalkFeasibility {
  if (!range) return 'unknown';
  if (walkMin > range.maxMin) return 'miss';
  if (walkMin > range.minMin) return 'tight';
  return 'ok';
}

export interface NearbyArrival {
  arrival: Arrival;
  walk: NearbyStop;
  feasibility: WalkFeasibility;
}

/** Arrivals across the closest stops; each vehicle appears once, at the closest stop it will still reach. */
export function arrivalsNearOrigin(
  net: TransitNetwork,
  snapshot: LiveSnapshot,
  nearby: NearbyStop[],
  maxStops = 3,
): NearbyArrival[] {
  const best = new Map<string, NearbyArrival>();
  for (const walk of nearby.slice(0, maxStops)) {
    for (const arrival of arrivalsForStop(net, snapshot, walk.stop.id)) {
      const existing = best.get(arrival.vehicleId);
      if (!existing || walk.distanceM < existing.walk.distanceM) {
        best.set(arrival.vehicleId, { arrival, walk, feasibility: walkFeasibility(walk.walkMin, arrival.etaRange) });
      }
    }
  }
  return [...best.values()].sort((a, b) => {
    const ea = a.arrival.etaSec;
    const eb = b.arrival.etaSec;
    if (ea === null && eb === null) return a.walk.distanceM - b.walk.distanceM;
    if (ea === null) return 1;
    if (eb === null) return -1;
    return ea - eb;
  });
}