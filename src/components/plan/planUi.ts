import { Footprints, Shuffle, Users, Zap, type LucideIcon } from 'lucide-react';
import type { ItineraryLeg, PlanCriterion, PlanPoint } from '../../domain/planner';
import type { Route, TransitNetwork } from '../../types/transit';
import type { Origin } from '../../types/ui';
import { stopLabel } from '../../domain/lookup';

export const CRITERION_META: Record<PlanCriterion, { label: string; tag: string; Icon: LucideIcon }> = {
  fastest: { label: 'ถึงเร็วที่สุด', tag: 'เร็วที่สุด', Icon: Zap },
  fewest_transfers: { label: 'เปลี่ยนรถน้อยที่สุด', tag: 'เปลี่ยนรถน้อยที่สุด', Icon: Shuffle },
  least_walking: { label: 'เดินน้อยที่สุด', tag: 'เดินน้อยที่สุด', Icon: Footprints },
  least_crowded: { label: 'แน่นน้อยกว่า', tag: 'แน่นน้อยกว่า', Icon: Users },
};

export interface ResolvedEndpoint {
  point: PlanPoint;
  labelTh: string;
}

/** Values: "origin", "stop:S01", "place:P01". */
export function resolveEndpoint(net: TransitNetwork, origin: Origin | null, value: string): ResolvedEndpoint | null {
  if (value === 'origin') {
    if (!origin) return null;
    return {
      point: { position: origin.position, stopId: origin.kind === 'stop' ? origin.refId : undefined },
      labelTh: origin.labelTh,
    };
  }
  const [kind, id] = value.split(':');
  if (kind === 'stop' && net.stopById[id]) {
    const s = net.stopById[id];
    return { point: { position: s.position, stopId: s.id }, labelTh: stopLabel(net, s) };
  }
  if (kind === 'place' && net.placeById[id]) {
    const p = net.placeById[id];
    return { point: { position: p.position }, labelTh: p.nameTh };
  }
  return null;
}

/** Unique routes of a leg, the recommended one first. */
export function routesForLeg(net: TransitNetwork, leg: ItineraryLeg): Route[] {
  const ids = [leg.chosen, ...leg.options].map((o) => net.variantById[o.variantId].routeId);
  return [...new Set(ids)].map((id) => net.routeById[id]);
}

/** Keeps the last inputs so returning from a vehicle or route page does not reset the form. */
export const planMemory: { fromValue: string; toValue: string; criterion: PlanCriterion } = {
  fromValue: '',
  toValue: '',
  criterion: 'fastest',
};