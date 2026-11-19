import { useEffect, useState } from 'react';
import { haversineM } from '../../sim/geo';
import type { LatLng } from '../../types/transit';

/** Free OSM foot routing by FOSSGIS (the one openstreetmap.org uses). Light use only. */
const ENDPOINT = 'https://routing.openstreetmap.de/routed-foot/route/v1/driving/';
const MIN_M = 60; // shorter walks stay straight
const MAX_M = 3000;

const cache = new Map<string, LatLng[] | null>(); // null = failed, keep the straight line
const pending = new Set<string>();
const listeners = new Set<() => void>();
const keyOf = (a: LatLng, b: LatLng) => [a[0], a[1], b[0], b[1]].map((n) => n.toFixed(5)).join(',');

async function fetchPath(a: LatLng, b: LatLng): Promise<LatLng[] | null> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 8000);
  try {
    const url = `${ENDPOINT}${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson&steps=false`;
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      code?: string;
      routes?: { distance: number; geometry: { coordinates: [number, number][] } }[];
    };
    const r = json.routes?.[0];
    if (json.code !== 'Ok' || !r || r.geometry.coordinates.length < 2) return null;
    // A huge detour usually means a gap in the OSM footpath data: the straight line is more honest.
    if (r.distance > haversineM(a, b) * 4 + 300) return null;
    return [a, ...r.geometry.coordinates.map(([lon, lat]) => [lat, lon] as LatLng), b];
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Replaces straight 2-point walks with street-following paths once they arrive. */
export function useWalkingPaths(walks: LatLng[][]): LatLng[][] {
  const [, setVersion] = useState(0);
  const key = walks.map((w) => w.map((p) => p.join(',')).join(';')).join('|');

  useEffect(() => {
    const listener = () => setVersion((v) => v + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    for (const w of walks) {
      if (w.length !== 2) continue;
      const [a, b] = w;
      const d = haversineM(a, b);
      if (d < MIN_M || d > MAX_M) continue;
      const k = keyOf(a, b);
      if (cache.has(k) || pending.has(k)) continue;
      pending.add(k);
      void fetchPath(a, b).then((path) => {
        cache.set(k, path);
        pending.delete(k);
        listeners.forEach((l) => l());
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return walks.map((w) => (w.length === 2 ? cache.get(keyOf(w[0], w[1])) ?? w : w));
}