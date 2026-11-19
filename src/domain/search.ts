import { pickName, type Lang } from '../lib/i18n';
import { SERVICE_LABEL } from '../lib/labels';
import type { Route, TransitNetwork } from '../types/transit';
import { isRailStop, mainVariantId } from './lookup';

/** titleTh / subtitleTh hold text in the chosen language (names kept so callers do not change). */
export type SearchResult =
  | { kind: 'route'; id: string; variantId: string; titleTh: string; subtitleTh: string; rail: boolean }
  | { kind: 'stop'; id: string; titleTh: string; subtitleTh: string; rail: boolean }
  | { kind: 'place'; id: string; titleTh: string; subtitleTh: string };

export interface SearchOptions {
  limit?: number;
  kinds?: SearchResult['kind'][];
  lang?: Lang;
}

const SERVICE_EN: Record<string, string> = { ac: 'Air-conditioned', non_ac: 'Non-AC (fan)' };

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
  { limit = 8, kinds, lang = 'th' }: SearchOptions = {},
): SearchResult[] {
  const q = normalize(query);
  if (!q) return [];
  const qc = compact(query);
  const en = lang === 'en';
  const want = (k: SearchResult['kind']) => !kinds || kinds.includes(k);
  const scored: { result: SearchResult; s: number; order: number; weight: number }[] = [];

  if (want('route')) {
    for (const route of net.routes) {
      const variantId = mainVariantId(net, route.id);
      if (!variantId) continue;
      const numberScore = lowest(score(q, [route.shortName]), score(qc, [route.shortName], compact));
      const legacyScore = route.legacyName
        ? lowest(score(q, [route.legacyName]), score(qc, [route.legacyName], compact))
        : null;
      const nameScore = plus(score(q, [route.nameTh, route.nameEn, route.agencyTh, route.agencyEn]), 1);
      const s = lowest(numberScore, legacyScore, nameScore);
      if (s === null) continue;

      const rail = isRailRoute(route);
      const byLegacy = legacyScore !== null && (numberScore === null || legacyScore < numberScore);
      const baseTh = route.nameTh.replace(/\s*\(เดิมสาย[^)]*\)\s*$/, '');
      let titleTh: string;
      let subtitleTh: string;
      if (en) {
        const name = route.nameEn || baseTh;
        titleTh = rail
          ? route.shortName
          : byLegacy
            ? `Route ${route.shortName} (formerly ${route.legacyName})`
            : `Route ${route.shortName}`;
        subtitleTh = rail
          ? `${name} · ${route.agencyEn || 'Rail'}`
          : `${name} · ${SERVICE_EN[route.serviceType] ?? 'Bus'}`;
      } else {
        titleTh = rail
          ? `รถไฟฟ้า ${route.shortName}`
          : byLegacy
            ? `สาย ${route.shortName} (เดิม ${route.legacyName})`
            : `สาย ${route.shortName}`;
        subtitleTh = rail
          ? `${baseTh} · ${route.agencyTh ?? 'รถไฟฟ้า'}`
          : `${byLegacy ? baseTh : route.nameTh} · ${SERVICE_LABEL[route.serviceType]}`;
      }
      scored.push({ result: { kind: 'route', id: route.id, variantId, titleTh, subtitleTh, rail }, s, order: 0, weight: 0 });
    }
  }

  if (want('stop')) {
    for (const stop of net.stops) {
      const showCode = !!stop.code && stop.code !== stop.id; // Namtang codes are internal IDs, not printed on signs
      const s = lowest(
        score(q, [stop.nameTh, stop.nameEn, ...stop.keywords, showCode ? stop.code : null]),
        plus(score(q, [stop.areaTh, stop.areaEn]), 3), // area-only matches go after name matches
      );
      if (s === null) continue;
      const rail = isRailStop(net, stop.id);
      const count = routeCount(net, stop.id);
      const parts = en
        ? [rail ? 'Rail station' : 'Bus stop', stop.areaEn || 'Bangkok']
        : [rail ? 'สถานีรถไฟฟ้า' : 'ป้ายรถเมล์', stop.areaTh];
      if (count > 0) parts.push(en ? `${count} ${count === 1 ? 'route' : 'routes'}` : `${count} สาย`);
      if (showCode) parts.push(en ? `Code ${stop.code}` : `รหัส ${stop.code}`);
      scored.push({
        result: { kind: 'stop', id: stop.id, titleTh: pickName(lang, stop.nameTh, stop.nameEn), subtitleTh: parts.join(' · '), rail },
        s, order: 1, weight: count + (rail ? 10 : 0),
      });
    }
  }

  if (want('place')) {
    for (const place of net.places) {
      const s = score(q, [place.nameTh, place.nameEn, place.categoryTh, place.categoryEn, ...place.keywords]);
      if (s === null) continue;
      scored.push({
        result: {
          kind: 'place',
          id: place.id,
          titleTh: pickName(lang, place.nameTh, place.nameEn),
          subtitleTh: pickName(lang, place.categoryTh, place.categoryEn),
        },
        s, order: 2, weight: 0,
      });
    }
  }

  return scored
    .sort((a, b) => a.s - b.s || a.order - b.order || b.weight - a.weight)
    .slice(0, limit)
    .map((x) => x.result);
}