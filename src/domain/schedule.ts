import { bangkokMinutesOfDay } from '../lib/format';
import type { FrequencyPeriod, Route } from '../types/transit';

export function parseHHmm(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export function frequencyAt(route: Route, minuteOfDay: number): FrequencyPeriod | null {
  return route.frequency.find((p) => minuteOfDay >= parseHHmm(p.from) && minuteOfDay < parseHHmm(p.to)) ?? null;
}

export function isInServiceHours(route: Route, nowMs: number): boolean {
  const m = bangkokMinutesOfDay(nowMs);
  return m >= parseHHmm(route.firstDeparture) && m <= parseHHmm(route.lastDeparture) + 60;
}

/** Planned departures from the origin terminal (timetable), separate from live estimates. */
export function scheduledDepartures(route: Route, nowMs: number, count = 5): number[] {
  const dayStartMs = nowMs - bangkokMinutesOfDay(nowMs) * 60_000;
  const first = parseHHmm(route.firstDeparture);
  const last = parseHHmm(route.lastDeparture);
  const times: number[] = [];
  for (let day = 0; day < 2 && times.length < count; day++) {
    let m = first;
    while (m <= last && times.length < count) {
      const ms = dayStartMs + day * 86_400_000 + m * 60_000;
      if (ms >= nowMs) times.push(ms);
      const period = frequencyAt(route, m);
      m += period ? Math.round((period.headwayMin[0] + period.headwayMin[1]) / 2) : 30;
    }
  }
  return times;
}