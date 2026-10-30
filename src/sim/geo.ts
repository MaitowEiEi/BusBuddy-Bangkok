import type { LatLng } from '../types/transit';

const EARTH_RADIUS_M = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDeg(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const dLng = toRad(b[1] - a[1]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function cumulativeDistances(points: LatLng[]): number[] {
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + haversineM(points[i - 1], points[i]));
  return cum;
}

export function pointAlong(shape: LatLng[], cum: number[], distanceM: number): { position: LatLng; bearingDeg: number } {
  if (shape.length === 0) return { position: [0, 0], bearingDeg: 0 };
  if (shape.length === 1) return { position: shape[0], bearingDeg: 0 };
  const total = cum[cum.length - 1];
  const d = Math.min(Math.max(distanceM, 0), total);
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const a = shape[i - 1];
  const b = shape[i];
  const segLen = cum[i] - cum[i - 1];
  const t = segLen > 0 ? (d - cum[i - 1]) / segLen : 0;
  return {
    position: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    bearingDeg: bearingDeg(a, b),
  };
}

const COMPASS_TH = [
  'ทิศเหนือ', 'ทิศตะวันออกเฉียงเหนือ', 'ทิศตะวันออก', 'ทิศตะวันออกเฉียงใต้',
  'ทิศใต้', 'ทิศตะวันตกเฉียงใต้', 'ทิศตะวันตก', 'ทิศตะวันตกเฉียงเหนือ',
];

export function compassTh(deg: number): string {
  return COMPASS_TH[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}