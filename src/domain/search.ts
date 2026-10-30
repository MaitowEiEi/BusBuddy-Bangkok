import { SERVICE_LABEL } from '../lib/labels';
import type { TransitNetwork } from '../types/transit';
import { mainVariantId } from './lookup';

export type SearchResult =
  | { kind: 'route'; id: string; variantId: string; titleTh: string; subtitleTh: string }
  | { kind: 'stop'; id: string; titleTh: string; subtitleTh: string }
  | { kind: 'place'; id: string; titleTh: string; subtitleTh: string };

const normalize = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, '');

function score(q: string, fields: string[]): number | null {
  let best: number | null = null;
  for (const field of fields) {
    const n = normalize(field);
    if (!n) continue;
    const s = n === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : null;
    if (s !== null && (best === null || s < best)) best = s;
  }
  return best;
}

export function searchNetwork(net: TransitNetwork, query: string, limit = 8): SearchResult[] {
  const q = normalize(query);
  if (!q) return [];
  const scored: { result: SearchResult; s: number; order: number }[] = [];

  for (const route of net.routes) {
    const s = score(q, [route.shortName, route.nameTh]);
    const variantId = mainVariantId(net, route.id);
    if (s === null || !variantId) continue;
    scored.push({
      result: { kind: 'route', id: route.id, variantId, titleTh: `สาย ${route.shortName}`, subtitleTh: `${route.nameTh} · ${SERVICE_LABEL[route.serviceType]}` },
      s, order: 0,
    });
  }
  for (const stop of net.stops) {
    const s = score(q, [stop.nameTh, stop.code, stop.areaTh, ...stop.keywords]);
    if (s === null) continue;
    scored.push({ result: { kind: 'stop', id: stop.id, titleTh: stop.nameTh, subtitleTh: `ป้ายรถเมล์ · ${stop.areaTh} · รหัส ${stop.code}` }, s, order: 1 });
  }
  for (const place of net.places) {
    const s = score(q, [place.nameTh, place.categoryTh, ...place.keywords]);
    if (s === null) continue;
    scored.push({ result: { kind: 'place', id: place.id, titleTh: place.nameTh, subtitleTh: place.categoryTh }, s, order: 2 });
  }

  return scored.sort((a, b) => a.s - b.s || a.order - b.order).slice(0, limit).map((x) => x.result);
}