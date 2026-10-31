import type { LatLng } from './transit';

export type OriginKind = 'gps' | 'demo' | 'stop' | 'place';

export interface Origin {
  kind: OriginKind;
  position: LatLng;
  labelTh: string;
  refId?: string;
  accuracyM?: number;
}

export type PanelView =
  | { kind: 'home' }
  | { kind: 'stop'; stopId: string }
  | { kind: 'route'; variantId: string }
  | { kind: 'vehicle'; vehicleId: string }
  | { kind: 'place'; placeId: string }
  | { kind: 'vehicles' }
  | { kind: 'plan'; toStopId?: string; toPlaceId?: string }
  | { kind: 'privacy' };

export function viewKey(view: PanelView): string {
  switch (view.kind) {
    case 'stop': return `stop:${view.stopId}`;
    case 'route': return `route:${view.variantId}`;
    case 'vehicle': return `vehicle:${view.vehicleId}`;
    case 'place': return `place:${view.placeId}`;
    case 'plan': return `plan:${view.toStopId ?? ''}:${view.toPlaceId ?? ''}`;
    default: return view.kind;
  }
}

export interface Favorites {
  stopIds: string[];
  variantIds: string[]; // route + direction + variant, so D21 outbound ≠ D21 short-turn
}

export interface Preferences {
  origin: Origin | null; // GPS origins are never persisted
}