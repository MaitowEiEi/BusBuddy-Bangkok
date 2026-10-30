import type { Arrival, LiveSnapshot, TransitNetwork } from '../types/transit';
import { estimateEtaRange } from './eta';

export const ARRIVAL_HORIZON_MIN = 60;

function compareArrivals(a: Arrival, b: Arrival): number {
  if (a.etaSec === null && b.etaSec === null) return a.routeId.localeCompare(b.routeId);
  if (a.etaSec === null) return 1;
  if (b.etaSec === null) return -1;
  return a.etaSec - b.etaSec;
}

/** Vehicles approaching a stop that passengers can still board (excludes trips ending at this stop). */
export function arrivalsForStop(
  net: TransitNetwork,
  snapshot: LiveSnapshot,
  stopId: string,
  horizonMin = ARRIVAL_HORIZON_MIN,
): Arrival[] {
  const result: Arrival[] = [];
  for (const vs of snapshot.vehicles) {
    const pred = vs.predictions.find((p) => p.stopId === stopId);
    if (!pred) continue;
    const variant = net.variantById[vs.variantId];
    if (pred.stopIndex === variant.stopIds.length - 1) continue; // terminal: cannot board for a further trip
    if (pred.etaSec !== null && pred.etaSec > horizonMin * 60) continue;
    const vehicle = net.vehicleById[vs.vehicleId];
    result.push({
      vehicleId: vs.vehicleId,
      routeId: vs.routeId,
      variantId: vs.variantId,
      direction: vs.direction,
      stopId,
      stopIndex: pred.stopIndex,
      stopsAway: pred.stopIndex - vs.nextStopIndex,
      etaSec: pred.etaSec,
      etaRange: estimateEtaRange(pred.etaSec, vs.quality, vs.staleSec, pred.crossesDisruption),
      mayHavePassed: pred.mayHavePassed,
      crossesDisruption: pred.crossesDisruption,
      crowd: vs.crowd,
      passengers: vs.passengers,
      capacity: vehicle.capacity,
      quality: vs.quality,
      lastUpdatedMs: vs.lastUpdatedMs,
      staleSec: vs.staleSec,
      status: vs.status,
    });
  }
  return result.sort(compareArrivals);
}