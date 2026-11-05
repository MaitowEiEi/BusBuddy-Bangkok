import { SERVICE_LABEL } from '../lib/labels';
import type { Route, TransitNetwork } from '../types/transit';
import { mainVariantId } from './lookup';

export type SearchResult =
  | { kind: 'route'; id: string; variantId: string; titleTh: string; subtitleTh: string; rail: boolean }
  | { kind: 'stop'; id: string; titleTh: string; subtitleTh: string; rail: boolean }
  | { kind: 'place'; id: string; titleTh: string; subtitleTh: string };

const normalize = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, '');
/** Route numbers without separators: "3-26E" -> "326e", "ต.121" -> "ต121". */
const compact = (s: string) => normalize(s).replace(/[-–.·/]/g, '');

function score(q: string, fields: (string | null | undefined)[], norm: (s: string) => string = normalize): number | null {
  if (!q) return null;
  let best: number | null = null;
  for (const field of fields) {
    if (!field) continue;
    const n = norm(field);
    if (!n) continue;
    const s = n === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : null;
    if (s !== null && (best === null || s < best)) best = s;
  }
  return best;
}

const lowest = (...xs: (number | null)[]): number | null => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length > 0 ? Math.min(...v) : null;
};
const plus = (x: number | null, n: number) => (x === null ? null : x + n);

const isRailRoute = (r: Route | undefined): boolean => !!r?.mode && r.mode !== 'bus';

const railCache = new WeakMap<TransitNetwork, Set<string>>();
function railStopIds(net: TransitNetwork): Set<string> {
  const hit = railCache.get(net);
  if (hit) return hit;
  const out = new Set<string>();
  for (const v of net.variants) if (isRailRoute(net.routeById[v.routeId])) v.stopIds.forEach((id) => out.add(id));
  railCache.set(net, out);
  return out;
}

function routeCount(net: TransitNetwork, stopId: string): number {
  const ids = new Set<string>();
  for (const id of net.variantIdsByStop[stopId] ?? []) {
    const v = net.variantById[id];
    if (v) ids.add(v.routeId);
  }
  return ids.size;
}

export function searchNetwork(
  net: TransitNetwork,
  query: string,
  limit = 8,
  kinds?: SearchResult['kind'][],
): SearchResult[] {
  const q = normalize(query);
  if (!q) return [];
  const qc = compact(query);
  const scored: { result: SearchResult; s: number; order: number; weight: number }[] = [];

  for (const route of net.routes) {
    const variantId = mainVariantId(net, route.id);
    if (!variantId) continue;
    const numberScore = lowest(score(q, [route.shortName]), score(qc, [route.shortName], compact));
    const legacyScore = route.legacyName
      ? lowest(score(q, [route.legacyName]), score(qc, [route.legacyName], compact))
      : null;
    const nameScore = plus(score(q, [route.nameTh, route.agencyTh]), 1);
    const s = lowest(numberScore, legacyScore, nameScore);
    if (s === null) continue;

    const rail = isRailRoute(route);
    const byLegacy = legacyScore !== null && (numberScore === null || legacyScore < numberScore);
    const baseName = route.nameTh.replace(/\s*\(เดิมสาย[^)]*\)\s*$/, '');
    const titleTh = rail
      ? `รถไฟฟ้า ${route.shortName}`
      : byLegacy
        ? `สาย ${route.shortName} (เดิม ${route.legacyName})`
        : `สาย ${route.shortName}`;
    const subtitleTh = rail
      ? `${baseName} · ${route.agencyTh ?? 'รถไฟฟ้า'}`
      : `${byLegacy ? baseName : route.nameTh} · ${SERVICE_LABEL[route.serviceType]}`;
    scored.push({ result: { kind: 'route', id: route.id, variantId, titleTh, subtitleTh, rail }, s, order: 0, weight: 0 });
  }

  const rails = railStopIds(net);
  for (const stop of net.stops) {
    const showCode = !!stop.code && stop.code !== stop.id; // Namtang codes are internal IDs, not printed on signs
    const s = lowest(
      score(q, [stop.nameTh, ...stop.keywords, showCode ? stop.code : null]),
      plus(score(q, [stop.areaTh]), 3), // area-only matches go after name matches
    );
    if (s === null) continue;
    const rail = rails.has(stop.id);
    const count = routeCount(net, stop.id);
    const parts = [rail ? 'สถานีรถไฟฟ้า' : 'ป้ายรถเมล์', stop.areaTh];
    if (count > 0) parts.push(`${count} สาย`);
    if (showCode) parts.push(`รหัส ${stop.code}`);
    scored.push({
      result: { kind: 'stop', id: stop.id, titleTh: stop.nameTh, subtitleTh: parts.join(' · '), rail },
      s, order: 1, weight: count + (rail ? 10 : 0),
    });
  }

  for (const place of net.places) {
    const s = score(q, [place.nameTh, place.categoryTh, ...place.keywords]);
    if (s === null) continue;
    scored.push({ result: { kind: 'place', id: place.id, titleTh: place.nameTh, subtitleTh: place.categoryTh }, s, order: 2, weight: 0 });
  }

  return scored
    .sort((a, b) => a.s - b.s || a.order - b.order || b.weight - a.weight)
    .filter((x) => !kinds || kinds.includes(x.result.kind))
    .slice(0, limit)
    .map((x) => x.result);
}