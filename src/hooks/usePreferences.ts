import { STORAGE_KEYS } from '../lib/storage';
import type { LatLng } from '../types/transit';
import type { Origin, Preferences } from '../types/ui';
import { useLocalStorage } from './useLocalStorage';

const ORIGIN_KINDS = ['gps', 'demo', 'stop', 'place'];

function isLatLng(v: unknown): v is LatLng {
  return Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
}

function isOrigin(v: unknown): v is Origin {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.kind === 'string' && ORIGIN_KINDS.includes(o.kind) && isLatLng(o.position) && typeof o.labelTh === 'string';
}

export function isPreferences(v: unknown): v is Preferences {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return p.origin === null || isOrigin(p.origin);
}

export const DEFAULT_PREFERENCES: Preferences = { origin: null };

export function usePreferences() {
  return useLocalStorage<Preferences>(STORAGE_KEYS.preferences, DEFAULT_PREFERENCES, isPreferences);
}