import { haversineM } from '../sim/geo';
import type { LatLng, Stop, TransitNetwork } from '../types/transit';

export const WALK_M_PER_MIN = 75;
const WALK_DETOUR_FACTOR = 1.25;

export function walkingDistanceM(a: LatLng, b: LatLng): number {
  return Math.round(haversineM(a, b) * WALK_DETOUR_FACTOR);
}

export function walkingMinutes(distanceM: number): number {
  return Math.max(1, Math.ceil(distanceM / WALK_M_PER_MIN));
}

export interface NearbyStop {
  stop: Stop;
  distanceM: number;
  walkMin: number;
}

export function nearbyStops(net: TransitNetwork, from: LatLng, radiusM = 900, limit = 5): NearbyStop[] {
  return net.stops
    .map((stop) => {
      const distanceM = walkingDistanceM(from, stop.position);
      return { stop, distanceM, walkMin: walkingMinutes(distanceM) };
    })
    .filter((x) => x.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}