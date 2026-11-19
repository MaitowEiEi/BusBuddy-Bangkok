import { Footprints, Shuffle, Users, Zap, type LucideIcon } from 'lucide-react';
import { stopLabel } from '../../domain/lookup';
import type { ItineraryLeg, PlanCriterion, PlanPoint } from '../../domain/planner';
import { pickName, type Lang } from '../../lib/i18n';
import type { Route, TransitNetwork } from '../../types/transit';
import type { Origin } from '../../types/ui';

export const CRITERION_META: Record<PlanCriterion, { label: string; labelEn: string; tag: string; tagEn: string; Icon: LucideIcon }> = {
  fastest: { label: 'ถึงเร็วที่สุด', labelEn: 'Fastest', tag: 'เร็วที่สุด', tagEn: 'Fastest', Icon: Zap },
  fewest_transfers: { label: 'เปลี่ยนรถน้อยที่สุด', labelEn: 'Fewest transfers', tag: 'เปลี่ยนรถน้อยที่สุด', tagEn: 'Fewest transfers', Icon: Shuffle },
  least_walking: { label: 'เดินน้อยที่สุด', labelEn: 'Least walking', tag: 'เดินน้อยที่สุด', tagEn: 'Least walking', Icon: Footprints },
  least_crowded: { label: 'แน่นน้อยกว่า', labelEn: 'Less crowded', tag: 'แน่นน้อยกว่า', tagEn: 'Less crowded', Icon: Users },
};

export const criterionLabel = (c: PlanCriterion, lang: Lang) => (lang === 'en' ? CRITERION_META[c].labelEn : CRITERION_META[c].label);
export const criterionTag = (c: PlanCriterion, lang: Lang) => (lang === 'en' ? CRITERION_META[c].tagEn : CRITERION_META[c].tag);

export interface ResolvedEndpoint {
  point: PlanPoint;
  /** In the chosen language (name kept so callers do not change). */
  labelTh: string;
}

/** Values: "origin", "stop:S01", "place:P01". */
export function resolveEndpoint(net: TransitNetwork, origin: Origin | null, value: string, lang: Lang = 'th'): ResolvedEndpoint | null {
  if (value === 'origin') {
    if (!origin) return null;
    const stopId = origin.kind === 'stop' ? origin.refId : undefined;
    const stop = stopId ? net.stopById[stopId] : undefined;
    const labelTh = lang === 'en' ? (stop ? stopLabel(net, stop, 'en') : 'Your starting point') : origin.labelTh;
    return { point: { position: origin.position, stopId }, labelTh };
  }
  const [kind, id] = value.split(':');
  if (kind === 'stop' && net.stopById[id]) {
    const s = net.stopById[id];
    return { point: { position: s.position, stopId: s.id }, labelTh: stopLabel(net, s, lang) };
  }
  if (kind === 'place' && net.placeById[id]) {
    const p = net.placeById[id];
    return { point: { position: p.position }, labelTh: pickName(lang, p.nameTh, p.nameEn) };
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