import type { Route, RouteVariant } from '../types/transit';

export function fareForStops(route: Route, stopsTravelled: number): number {
  const f = route.fare;
  if (f.kind === 'flat') return f.amountThb;
  const steps = Math.floor(Math.max(0, stopsTravelled - 1) / f.stopsPerStep);
  return Math.min(f.maxThb, f.baseThb + steps * f.stepThb);
}

/** Range of possible fares when boarding at stopIndex, before the destination is known. */
export function fareRangeFromStop(route: Route, variant: RouteVariant, stopIndex: number): [number, number] {
  const remaining = Math.max(1, variant.stopIds.length - 1 - stopIndex);
  return [fareForStops(route, 1), fareForStops(route, remaining)];
}