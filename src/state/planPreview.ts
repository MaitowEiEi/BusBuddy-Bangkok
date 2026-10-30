import { useSyncExternalStore } from 'react';
import type { LatLng } from '../types/transit';

export interface PreviewLeg {
  variantId: string;
  fromStopIndex: number;
  toStopIndex: number;
}

export interface PlanPreview {
  key: string; // changes whenever anything drawn changes
  fitKey: string; // changes only when the map should re-fit
  legs: PreviewLeg[];
  fitPoints: LatLng[];
  destination: { position: LatLng; labelTh: string } | null;
  boardStopId: string | null;
}

let current: PlanPreview | null = null;
const listeners = new Set<() => void>();

/** Shares the selected itinerary with the map without changing App state. */
export function setPlanPreview(next: PlanPreview | null): void {
  if ((current?.key ?? null) === (next?.key ?? null)) return;
  current = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PlanPreview | null {
  return current;
}

export function usePlanPreview(): PlanPreview | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}