import { useCallback } from 'react';
import { STORAGE_KEYS } from '../lib/storage';
import type { Favorites } from '../types/ui';
import { useLocalStorage } from './useLocalStorage';

const DEFAULT_FAVORITES: Favorites = { stopIds: [], variantIds: [] };

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isFavorites(v: unknown): v is Favorites {
  if (!v || typeof v !== 'object') return false;
  const f = v as Record<string, unknown>;
  return isStringArray(f.stopIds) && isStringArray(f.variantIds);
}

export function useFavorites() {
  const [favorites, setFavorites] = useLocalStorage<Favorites>(STORAGE_KEYS.favorites, DEFAULT_FAVORITES, isFavorites);

  const toggle = useCallback(
    (list: keyof Favorites, id: string) =>
      setFavorites((prev) => ({
        ...prev,
        [list]: prev[list].includes(id) ? prev[list].filter((x) => x !== id) : [...prev[list], id],
      })),
    [setFavorites],
  );

  return {
    favorites,
    isStopFavorite: (id: string) => favorites.stopIds.includes(id),
    isVariantFavorite: (id: string) => favorites.variantIds.includes(id),
    toggleStop: (id: string) => toggle('stopIds', id),
    toggleVariant: (id: string) => toggle('variantIds', id),
  };
}