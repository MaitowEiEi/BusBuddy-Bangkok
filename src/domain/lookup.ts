import type { RouteVariant, Stop, TransitNetwork } from '../types/transit';

export function mainVariantId(net: TransitNetwork, routeId: string): string | null {
  return net.variants.find((v) => v.routeId === routeId && v.direction === 'outbound' && !v.isShortTurn)?.id ?? null;
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