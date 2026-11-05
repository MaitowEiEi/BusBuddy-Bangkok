import type { RouteVariant, Stop, TransitNetwork } from '../types/transit';

/** The variant to open for a route: the full outbound trip if it exists, otherwise the best one we have. */

export function mainVariantId(net: TransitNetwork, routeId: string): string | null {
  const score = (v: RouteVariant) => (v.direction === 'outbound' ? 2 : 0) + (v.isShortTurn ? 0 : 1);
  let best: RouteVariant | null = null;
  for (const v of net.variants) {
    if (v.routeId !== routeId) continue;
    if (!best || score(v) > score(best) || (score(v) === score(best) && v.stopIds.length > best.stopIds.length)) best = v;
  }
  return best?.id ?? null;
}

function variantsAt(net: TransitNetwork, stopId: string): RouteVariant[] {
  return (net.variantIdsByStop[stopId] ?? []).map((id) => net.variantById[id]);
}

/** Variants a passenger can board here (the stop is not the trip's terminal). */
export function boardableVariants(net: TransitNetwork, stopId: string): RouteVariant[] {
  return variantsAt(net, stopId).filter((v) => v.stopIds.indexOf(stopId) < v.stopIds.length - 1);
}

export function terminatingVariants(net: TransitNetwork, stopId: string): RouteVariant[] {
  return variantsAt(net, stopId).filter((v) => v.stopIds.indexOf(stopId) === v.stopIds.length - 1);
}

export function routeIdsAtStop(net: TransitNetwork, stopId: string): string[] {
  const ids = new Set(boardableVariants(net, stopId).map((v) => v.routeId));
  return net.routes.filter((r) => ids.has(r.id)).map((r) => r.id);
}

/** Stops the full trip serves but this short-turn trip skips. */
export function shortTurnSkippedStops(net: TransitNetwork, variant: RouteVariant): Stop[] {
  if (!variant.isShortTurn) return [];
  const full = net.variants.find((v) => v.routeId === variant.routeId && v.direction === variant.direction && !v.isShortTurn);
  if (!full) return [];
  return full.stopIds.filter((id) => !variant.stopIds.includes(id)).map((id) => net.stopById[id]);
}

const railStopCache = new WeakMap<TransitNetwork, Set<string>>();

/** true when a BTS/MRT line stops here. */
export function isRailStop(net: TransitNetwork, stopId: string): boolean {
  let set = railStopCache.get(net);
  if (!set) {
    set = new Set<string>();
    for (const v of net.variants) {
      const mode = net.routeById[v.routeId]?.mode;
      if (mode && mode !== 'bus') for (const id of v.stopIds) set.add(id);
    }
    railStopCache.set(net, set);
  }
  return set.has(stopId);
}

/** "ป้ายสยาม" for buses, "สถานี MRT สีลม" for rail, never "สถานีสถานี…". */
export function placeLabel(name: string, rail: boolean): string {
  if (!rail) return `ป้าย${name}`;
  if (name.startsWith('สถานี')) return name;
  return /^[A-Za-z]/.test(name) ? `สถานี ${name}` : `สถานี${name}`;
}

export function stopLabel(net: TransitNetwork, stop: Stop): string {
  return placeLabel(stop.nameTh, isRailStop(net, stop.id));
}