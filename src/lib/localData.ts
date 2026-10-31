/**
 * Storage keys written by this app. GitHub Pages shares one origin (username.github.io)
 * across all of your repositories, so we never call localStorage.clear().
 * If your keys use a different prefix, change this pattern.
 */
export const APP_KEY_PATTERN = /busbuddy/i;

export interface StoredItem {
  area: 'local' | 'session';
  key: string;
}

function storageAreas(): [StoredItem['area'], Storage][] {
  const out: [StoredItem['area'], Storage][] = [];
  try {
    out.push(['local', window.localStorage]);
  } catch {
    // Storage blocked (private mode or browser settings)
  }
  try {
    out.push(['session', window.sessionStorage]);
  } catch {
    // Storage blocked
  }
  return out;
}

export function listAppData(): StoredItem[] {
  const items: StoredItem[] = [];
  for (const [area, storage] of storageAreas()) {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && APP_KEY_PATTERN.test(key)) items.push({ area, key });
    }
  }
  return items;
}

export function clearAppData(): number {
  const items = listAppData();
  const areas = new Map(storageAreas());
  for (const item of items) {
    try {
      areas.get(item.area)?.removeItem(item.key);
    } catch {
      // Ignore a key that cannot be removed
    }
  }
  return items.length;
}