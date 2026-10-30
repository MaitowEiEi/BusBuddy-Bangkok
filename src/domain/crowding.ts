import type { CrowdLevel } from '../types/transit';

export function crowdLevelFor(passengers: number | null, seats: number, capacity: number): CrowdLevel {
  if (passengers === null) return 'unknown';
  if (passengers <= seats) return 'seats';
  if (passengers <= capacity * 0.85) return 'standing';
  return 'crowded';
}

export function occupancyPercent(passengers: number | null, capacity: number): number | null {
  if (passengers === null || capacity <= 0) return null;
  return Math.round((passengers / capacity) * 100);
}