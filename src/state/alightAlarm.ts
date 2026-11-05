import { useSyncExternalStore } from 'react';

/** Warn this many stops before the alighting stop. */
export const ALIGHT_PREPARE_STOPS = 2;
export const ALIGHT_MAX_AGE_MS = 3 * 60 * 60 * 1000;

export type AlightStage = 'watching' | 'prepare' | 'arrived' | 'passed';

export interface AlightAlarm {
  variantId: string;
  boardIndex: number;
  alightIndex: number;
  stage: AlightStage;
  createdAtMs: number;
}

// One alarm at a time, in memory only.
let current: AlightAlarm | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function setAlightAlarm(input: Pick<AlightAlarm, 'variantId' | 'boardIndex' | 'alightIndex'> | null): void {
  current = input ? { ...input, stage: 'watching', createdAtMs: Date.now() } : null;
  emit();
}

export function setAlightStage(stage: AlightStage): void {
  if (!current || current.stage === stage) return;
  current = { ...current, stage };
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => current;

export function useAlightAlarm(): AlightAlarm | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}