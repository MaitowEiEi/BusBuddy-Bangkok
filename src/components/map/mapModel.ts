import { boardableVariants } from '../../domain/lookup';
import { nearbyStops } from '../../domain/walking';
import { CROWD_LABEL, QUALITY_LABEL } from '../../lib/labels';
import { bearingDeg, haversineM } from '../../sim/geo';
import type { PlanPreview } from '../../state/planPreview';
import type { LatLng, LiveSnapshot, Place, RouteVariant, Stop, TransitNetwork, VehicleLiveState } from '../../types/transit';
import type { Origin, PanelView } from '../../types/ui';

export type MapTarget = { kind: 'stop'; id: string } | { kind: 'variant'; id: string } | { kind: 'vehicle'; id: string };

export interface Highlight {
  variantId: string;
  fromStopIndex: number; // draw from this stop onward
  toStopIndex?: number; // ...and stop here (planned rides)
}

export interface MapScene {
  highlights: Highlight[];
  selectedStopId: string | null;
  selectedVehicleId: string | null;
  place: Place | null;
  fitPoints: LatLng[];
  /** true = a route, stop, vehicle or plan is open: hide everything unrelated to it. */
  focused: boolean;
}

const EMPTY: MapScene = {
  highlights: [], selectedStopId: null, selectedVehicleId: null, place: null, fitPoints: [], focused: false,
};
const NEAR_ORIGIN_M = 2500;
const MAX_STOPS_ON_MAP = 250;

/** One line per route: prefer the full outbound trip, fall back to whatever exists in the focus area. */
export function baseVariants(net: TransitNetwork): RouteVariant[] {
  const score = (v: RouteVariant) => (v.direction === 'outbound' ? 2 : 0) + (v.isShortTurn ? 0 : 1);
  const best = new Map<string, RouteVariant>();
  for (const v of net.variants) {
    const cur = best.get(v.routeId);
    if (!cur || score(v) > score(cur) || (score(v) === score(cur) && v.stopIds.length > cur.stopIds.length)) {
      best.set(v.routeId, v);
    }
  }
  return [...best.values()];
}

export function shapeFrom(variant: RouteVariant, stopIndex: number, toStopIndex?: number): LatLng[] {
  const startM = stopIndex <= 0 ? 0 : variant.stopDistancesM[stopIndex];
  const endM = toStopIndex === undefined ? Infinity : variant.stopDistancesM[toStopIndex];
  const pts = variant.shape.filter((_, i) => variant.shapeCumM[i] >= startM - 0.5 && variant.shapeCumM[i] <= endM + 0.5);
  return pts.length >= 2 ? pts : variant.shape;
}

export function directionArrows(points: LatLng[]): { position: LatLng; bearing: number }[] {
  const out: { position: LatLng; bearing: number }[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (haversineM(a, b) < 200) continue;
    out.push({ position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], bearing: bearingDeg(a, b) });
  }
  return out;
}

export function vehicleLabel(net: TransitNetwork, vs: VehicleLiveState): string {
  const route = net.routeById[vs.routeId];
  const variant = net.variantById[vs.variantId];
  return `รถสาย ${route?.shortName ?? ''} ${variant?.headsignTh ?? ''} · ${CROWD_LABEL[vs.crowd].short} · ${QUALITY_LABEL[vs.quality].short}`;
}

// ---------- which stops to draw ----------
export interface RankedStop {
  stop: Stop;
  routes: number; // how many different routes stop here
}

/** Busiest stops first, so zoomed-out maps keep the main interchanges. */
export function rankedStops(net: TransitNetwork): RankedStop[] {
  return net.stops
    .map((stop) => {
      const routeIds = new Set<string>();
      for (const id of net.variantIdsByStop[stop.id] ?? []) {
        const v = net.variantById[id];
        if (v) routeIds.add(v.routeId);
      }
      return { stop, routes: routeIds.size };
    })
    .sort((a, b) => b.routes - a.routes);
}

/** Minimum distance between two drawn stops at this zoom. 0 = draw every stop. */
function spacingM(zoom: number): number {
  if (zoom >= 16) return 0;
  if (zoom >= 15) return 350;
  if (zoom >= 14) return 800;
  if (zoom >= 13) return 1500;
  return 2500;
}

export function pickStops(
  net: TransitNetwork,
  ranked: RankedStop[],
  opts: { zoom: number; contains: (p: LatLng) => boolean; candidates: Set<string> | null; must: Set<string> },
): Stop[] {
  const focused = opts.candidates !== null;
  const spacing = focused ? spacingM(opts.zoom) / 2 : spacingM(opts.zoom);
  const minRoutes = focused || opts.zoom >= 16 ? 0 : opts.zoom >= 15 ? 2 : 4;

  const picked: Stop[] = [];
  for (const id of opts.must) {
    const s = net.stopById[id];
    if (s) picked.push(s);
  }
  for (const { stop, routes } of ranked) {
    if (picked.length >= MAX_STOPS_ON_MAP) break;
    if (opts.must.has(stop.id)) continue;
    if (opts.candidates && !opts.candidates.has(stop.id)) continue;
    if (routes < minRoutes) continue;
    if (!opts.contains(stop.position)) continue;
    if (spacing > 0 && picked.some((p) => haversineM(p.position, stop.position) < spacing)) continue;
    picked.push(stop);
  }
  return picked;
}

// ---------- scene per panel ----------
export function buildScene(
  net: TransitNetwork,
  view: PanelView,
  snapshot: LiveSnapshot | null,
  origin: Origin | null,
  preview: PlanPreview | null = null,
): MapScene {
  const allStops = net.stops.map((s) => s.position);
  switch (view.kind) {
    case 'stop': {
      const stop = net.stopById[view.stopId];
      if (!stop) return EMPTY;
      const variants = boardableVariants(net, stop.id);
      const nearOrigin = origin && haversineM(origin.position, stop.position) < NEAR_ORIGIN_M ? [origin.position] : [];
      const nextStops = variants
        .map((v) => net.stopById[v.stopIds[v.stopIds.indexOf(stop.id) + 1]]?.position)
        .filter((p): p is LatLng => p !== undefined);
      return {
        ...EMPTY,
        focused: true,
        selectedStopId: stop.id,
        highlights: variants.map((v) => ({ variantId: v.id, fromStopIndex: v.stopIds.indexOf(stop.id) })),
        fitPoints: [stop.position, ...nearOrigin, ...nextStops],
      };
    }
    case 'route': {
      const v = net.variantById[view.variantId];
      return v ? { ...EMPTY, focused: true, highlights: [{ variantId: v.id, fromStopIndex: 0 }], fitPoints: v.shape } : EMPTY;
    }
    case 'vehicle': {
      const vs = snapshot?.vehicles.find((x) => x.vehicleId === view.vehicleId);
      const v = vs ? net.variantById[vs.variantId] : undefined;
      if (!vs || !v) return { ...EMPTY, focused: true, selectedVehicleId: view.vehicleId };
      const next = net.stopById[v.stopIds[vs.nextStopIndex]];
      return {
        ...EMPTY,
        focused: true,
        selectedVehicleId: vs.vehicleId,
        highlights: [{ variantId: v.id, fromStopIndex: 0 }],
        fitPoints: next ? [vs.position, next.position] : [vs.position],
      };
    }
    case 'place': {
      const p = net.placeById[view.placeId];
      if (!p) return EMPTY;
      return { ...EMPTY, place: p, fitPoints: [p.position, ...nearbyStops(net, p.position, 800, 3).map((n) => n.stop.position)] };
    }
    case 'plan': {
      if (!preview) return { ...EMPTY, focused: true, fitPoints: allStops };
      const destination: Place | null = preview.destination
        ? {
            id: 'plan-destination',
            nameTh: preview.destination.labelTh,
            categoryTh: 'ปลายทาง',
            position: preview.destination.position,
            keywords: [],
          }
        : null;
      return {
        ...EMPTY,
        focused: true,
        highlights: preview.legs.map((l) => ({ variantId: l.variantId, fromStopIndex: l.fromStopIndex, toStopIndex: l.toStopIndex })),
        selectedStopId: preview.boardStopId,
        place: destination,
        fitPoints: preview.fitPoints,
      };
    }
    case 'home': {
      if (origin) {
        const near = nearbyStops(net, origin.position, 900, 3);
        if (near.length > 0) return { ...EMPTY, fitPoints: [origin.position, ...near.map((n) => n.stop.position)] };
      }
      return { ...EMPTY, fitPoints: allStops };
    }
    default:
      return { ...EMPTY, fitPoints: allStops };
  }
}