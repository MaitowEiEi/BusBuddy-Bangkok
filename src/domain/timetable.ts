import type { Route, RouteVariant } from '../types/transit';
import { frequencyAt } from './schedule';
import { scheduledRideSec } from './travelTime';

const STEP_MIN = 5;
const DAY_MIN = 24 * 60;

export type Headway = [number, number] | null; // null = no service

export interface ServiceBand {
  startMin: number;
  endMin: number;
  headwayMin: Headway;
}

export interface ServiceSpan {
  firstMin: number; // first departure from the first stop
  lastMin: number; // end of the last service period
}

function sameHeadway(a: Headway, b: Headway): boolean {
  if (a === null || b === null) return a === b;
  return a[0] === b[0] && a[1] === b[1];
}

/** Whole-day frequency table, sampled every 5 minutes from the simulated timetable. */
export function serviceBands(route: Route): ServiceBand[] {
  const bands: ServiceBand[] = [];
  for (let m = 0; m < DAY_MIN; m += STEP_MIN) {
    const period = frequencyAt(route, m);
    const headwayMin: Headway = period ? [period.headwayMin[0], period.headwayMin[1]] : null;
    const last = bands[bands.length - 1];
    if (last && sameHeadway(last.headwayMin, headwayMin)) last.endMin = m + STEP_MIN;
    else bands.push({ startMin: m, endMin: m + STEP_MIN, headwayMin });
  }
  return bands;
}

export function serviceSpan(bands: ServiceBand[]): ServiceSpan | null {
  const running = bands.filter((b) => b.headwayMin !== null);
  if (running.length === 0) return null;
  return { firstMin: running[0].startMin, lastMin: running[running.length - 1].endMin };
}

/** Bands between the first and last departure, including gaps in service. */
export function bandsInService(bands: ServiceBand[], span: ServiceSpan | null): ServiceBand[] {
  if (!span) return [];
  return bands.filter((b) => b.endMin > span.firstMin && b.startMin < span.lastMin);
}

/** Timetable minutes from the first stop of the variant to the given stop. */
export function minutesFromOrigin(route: Route, variant: RouteVariant, stopIndex: number): number {
  if (stopIndex <= 0) return 0;
  return Math.round(scheduledRideSec(route, variant, 0, stopIndex, null) / 60);
}

export function formatMinutesOfDay(min: number): string {
  const total = Math.round(min);
  if (total === DAY_MIN) return '24:00';
  const m = ((total % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function headwayText(h: Headway): string {
  if (!h) return 'ไม่มีบริการ';
  return h[0] === h[1] ? `${h[0]} นาที` : `${h[0]}–${h[1]} นาที`;
}