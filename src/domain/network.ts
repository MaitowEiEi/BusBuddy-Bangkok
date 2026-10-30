import { cumulativeDistances } from '../sim/geo';
import type { LatLng, Place, Route, RouteVariant, RouteVariantDef, Stop, TransitNetwork, Vehicle } from '../types/transit';

export interface NetworkSource {
  stops: Stop[];
  routes: Route[];
  variantDefs: RouteVariantDef[];
  vehicles: Vehicle[];
  places: Place[];
}

function indexBy<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function resolveVariant(def: RouteVariantDef, stopById: Record<string, Stop>): RouteVariant {
  const shape: LatLng[] = [];
  const stopIds: string[] = [];
  const stopShapeIdx: number[] = [];
  for (const point of def.path) {
    if ('stopId' in point) {
      const stop = stopById[point.stopId];
      if (!stop) throw new Error(`Unknown stop ${point.stopId} in variant ${def.id}`);
      stopIds.push(stop.id);
      stopShapeIdx.push(shape.length);
      shape.push(stop.position);
    } else {
      shape.push(point.via);
    }
  }
  const shapeCumM = cumulativeDistances(shape);
  return {
    ...def,
    stopIds,
    shape,
    shapeCumM,
    stopDistancesM: stopShapeIdx.map((i) => shapeCumM[i]),
    lengthM: shapeCumM[shapeCumM.length - 1] ?? 0,
  };
}

export function buildNetwork(src: NetworkSource): TransitNetwork {
  const stopById = indexBy(src.stops);
  const variants = src.variantDefs.map((def) => resolveVariant(def, stopById));
  const variantIdsByStop: Record<string, string[]> = Object.fromEntries(src.stops.map((st) => [st.id, [] as string[]]));
  for (const v of variants) for (const id of v.stopIds) variantIdsByStop[id].push(v.id);

  return {
    stops: src.stops,
    routes: src.routes,
    variants,
    vehicles: src.vehicles,
    places: src.places,
    stopById,
    routeById: indexBy(src.routes),
    variantById: indexBy(variants),
    vehicleById: indexBy(src.vehicles),
    placeById: indexBy(src.places),
    variantIdsByStop,
  };
}