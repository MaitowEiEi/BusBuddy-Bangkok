import { useSyncExternalStore } from 'react';

/** Alerts are kept in memory only: closing the tab removes them. */
export const ALERT_MAX_AGE_MS = 90 * 60 * 1000;

export interface ArrivalAlert {
  id: string;
  vehicleId: string;
  stopId: string;
  variantId: string;
  thresholdMin: number;
  createdAtMs: number;
}

let alerts: ArrivalAlert[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function alertId(vehicleId: string, stopId: string): string {
  return `${vehicleId}@${stopId}`;
}

export function addAlert(input: Omit<ArrivalAlert, 'id' | 'createdAtMs'>): void {
  const id = alertId(input.vehicleId, input.stopId);
  alerts = [...alerts.filter((a) => a.id !== id), { ...input, id, createdAtMs: Date.now() }];
  emit();
}

export function removeAlert(id: string): void {
  if (!alerts.some((a) => a.id === id)) return;
  alerts = alerts.filter((a) => a.id !== id);
  emit();
}

export function clearAlerts(): void {
  if (alerts.length === 0) return;
  alerts = [];
  emit();
}

export function getAlerts(): ArrivalAlert[] {
  return alerts;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useArrivalAlerts(): ArrivalAlert[] {
  return useSyncExternalStore(subscribe, getAlerts, getAlerts);
}