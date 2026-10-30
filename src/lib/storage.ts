const PREFIX = 'busbuddy:v1:';
export const STORAGE_EVENT = 'busbuddy:storage';

export const STORAGE_KEYS = {
  scenario: 'scenario',
  favorites: 'favorites',
  preferences: 'preferences',
  savedPlaces: 'savedPlaces',
  rewards: 'rewards',
  reminders: 'reminders',
  reports: 'reports',
  feedback: 'feedback',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

function notify(key: string): void {
  window.dispatchEvent(new CustomEvent<string>(STORAGE_EVENT, { detail: key }));
}

export function readStorage<T>(key: StorageKey, fallback: T, validate?: (v: unknown) => v is T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (validate && !validate(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: StorageKey, value: T): boolean {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    notify(key);
    return true;
  } catch {
    return false;
  }
}

/** Removes only this app's demo keys. */
export function clearDemoStorage(): void {
  try {
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* storage unavailable: nothing to clear */
  }
  notify('*');
}