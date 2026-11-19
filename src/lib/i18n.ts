import { useSyncExternalStore } from 'react';

export type Lang = 'th' | 'en';
const KEY = 'busbuddy.lang';

// Thai by default: many Thai riders set their phone to English, so the browser language is not a good guess.
function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'th' || saved === 'en') return saved;
  } catch {
    // Storage blocked (private mode): fall back to Thai.
  }
  return 'th';
}

let lang: Lang = initial();
const listeners = new Set<() => void>();
if (typeof document !== 'undefined') document.documentElement.lang = lang;

export function setLang(next: Lang): void {
  if (next === lang) return;
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Not saved, but still switches for this visit.
  }
  document.documentElement.lang = next; // screen readers pick the right voice
  listeners.forEach((listener) => listener());
}

export const getLang = (): Lang => lang;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

/** Text for the current language: tr('ปิด', 'Close'). */
export function useT(): (th: string, en: string) => string {
  const current = useLang();
  return (th, en) => (current === 'en' ? en : th);
}

/** A data name in the current language, falling back to Thai when there is no English name. */
export function pickName(current: Lang, th: string, en?: string): string {
  return current === 'en' && en ? en : th;
}