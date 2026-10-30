import { boardableVariants } from '../../domain/lookup';
import { nearbyStops } from '../../domain/walking';
import { CROWD_LABEL, QUALITY_LABEL } from '../../lib/labels';
import { bearingDeg, haversineM } from '../../sim/geo';
import type { PlanPreview } from '../../state/planPreview';
import type { LatLng, LiveSnapshot, Place, RouteVariant, TransitNetwork, VehicleLiveState } from '../../types/transit';
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
}

const EMPTY: MapScene = { highlights: [], selectedStopId: null, selectedVehicleId: null, place: null, fitPoints: [] };
const NEAR_ORIGIN_M = 2500;

/** One faint line per route; inbound shares the outbound geometry. */
export function baseVariants(net: TransitNetwork): RouteVariant[] {
  return net.variants.filter((v) => v.direction === 'outbound' && !v.isShortTurn);
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
  return `รถสาย ${route.shortName} ${variant.headsignTh} · ${CROWD_LABEL[vs.crowd].short} · ${QUALITY_LABEL[vs.quality].short}`;
}

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
      const nextStops = variants.map((v) => net.stopById[v.stopIds[v.stopIds.indexOf(stop.id) + 1]].position);
      return {
        ...EMPTY,
        selectedStopId: stop.id,
        highlights: variants.map((v) => ({ variantId: v.id, fromStopIndex: v.stopIds.indexOf(stop.id) })),
        fitPoints: [stop.position, ...nearOrigin, ...nextStops],
      };
    }
    case 'route': {
      const v = net.variantById[view.variantId];
      return v ? { ...EMPTY, highlights: [{ variantId: v.id, fromStopIndex: 0 }], fitPoints: v.shape } : EMPTY;
    }
    case 'vehicle': {
      const vs = snapshot?.vehicles.find((x) => x.vehicleId === view.vehicleId);
      if (!vs) return { ...EMPTY, selectedVehicleId: view.vehicleId };
      const v = net.variantById[vs.variantId];
      return {
        ...EMPTY,
        selectedVehicleId: vs.vehicleId,
        highlights: [{ variantId: v.id, fromStopIndex: 0 }],
        fitPoints: [vs.position, net.stopById[v.stopIds[vs.nextStopIndex]].position],
      };
    }
    case 'place': {
      const p = net.placeById[view.placeId];
      if (!p) return EMPTY;
      return { ...EMPTY, place: p, fitPoints: [p.position, ...nearbyStops(net, p.position, 800, 3).map((n) => n.stop.position)] };
    }
    case 'plan': {
      if (!preview) return { ...EMPTY, fitPoints: allStops };
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