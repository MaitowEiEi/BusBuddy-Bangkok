import type { DataQuality, EtaRange } from '../types/transit';

/** Convert a point estimate into an honest range; wider when data is stale or a disruption lies ahead. */
export function estimateEtaRange(
  etaSec: number | null,
  quality: DataQuality,
  staleSec: number,
  crossesDisruption: boolean,
): EtaRange | null {
  if (etaSec === null || quality === 'unavailable') return null;
  const base = Math.max(0, etaSec);
  if (quality === 'live' && base <= 45) return { minMin: 0, maxMin: 1, arriving: true };

  let low = base * 0.85 - 30;
  let high = base * 1.2 + 60;
  if (quality === 'delayed') {
    low -= staleSec * 0.5;
    high += staleSec * 0.8 + 60;
  }
  if (crossesDisruption) high += 5 * 60;

  const minMin = Math.max(0, Math.floor(low / 60));
  const maxMin = Math.max(minMin + 2, Math.ceil(high / 60));
  return { minMin, maxMin, arriving: false };
}