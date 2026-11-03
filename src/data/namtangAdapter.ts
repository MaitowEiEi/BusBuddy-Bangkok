/**
 * Builds the app's TransitNetwork from real Namtang GTFS data (src/data/namtang.json).
 * Real: routes, stops, street paths, today's frequencies, fares, wheelchair flag,
 *       AC / non-AC when the route description says so.
 * Simulated: vehicles, positions, load, and any feature the data does not cover (featureSource 'sim').
 * Data: Office of Transport and Traffic Policy and Planning (OTP), Ministry of Transport, via Namtang. CC BY 4.0.
 */
import namtangText from './namtang.json?raw';
import type {
  Accessibility, Direction, FareRule, FeatureSource, FrequencyPeriod, LatLng, Place, Route, RouteMode,
  RouteVariant, ServiceType, Stop, TransitNetwork, Vehicle, VehicleType,
} from '../types/transit';

// ---------- settings (edit, then reload) ----------
/** Routes are cut to the part inside this circle so the map and simulation stay fast on phones. null = whole routes. */
const FOCUS_CENTER: LatLng = [13.7456, 100.53413]; // Siam
const FOCUS_RADIUS_M: number | null = 7000;
/** Simulated buses per route. More = closer to the real headway, but a heavier map. */
const MAX_VEHICLES_PER_ROUTE = 4;
const LAYOVER_MIN = 8;
const SLOT_MIN = 5;
const DAY_SLOTS = (24 * 60) / SLOT_MIN;

// ---------- JSON written by scripts/import-namtang.mjs ----------
interface NtService {
  periods: [number, number, number][];
  departures: number[];
}
interface NtVariant {
  id: string;
  routeId: string;
  directionId: number;
  headsignTh: string;
  stopIds: string[];
  arrSec: number[] | null;
  shapeId: string | null;
  wheelchair: number; // 0 unknown, 1 yes, 2 no
  isShortTurn: boolean;
  services: Record<string, NtService>;
}
interface NtRoute {
  id: string;
  agencyId: string;
  shortName: string;
  legacyName?: string | null;
  longNameTh: string;
  descTh?: string;
  mode: RouteMode;
  color: string;
  hubs: string[];
}
interface NtStop {
  id: string;
  nameTh: string;
  nameEn: string;
  lat: number;
  lon: number;
}
interface NtCalendar {
  days: number[];
  startDate: string;
  endDate: string;
  added: string[];
  removed: string[];
}
interface NtHub {
  id: string;
  nameTh: string;
  lat: number;
  lon: number;
}
export interface NamtangSource {
  publisherTh: string;
  publisherUrl: string;
  license: string;
  feedVersion: string;
  feedStartDate: string;
  feedEndDate: string;
  generatedAt: string;
}
interface NtData {
  source: NamtangSource;
  hubs: NtHub[];
  agencies: { id: string; nameTh: string }[];
  routes: NtRoute[];
  variants: NtVariant[];
  stops: NtStop[];
  shapes: Record<string, string>;
  services: Record<string, NtCalendar>;
  fares: Record<string, { min: number; max: number }>;
}

const data = JSON.parse(namtangText) as NtData;

/** Credit required by CC BY 4.0. */
export const namtangSource: NamtangSource = data.source;

// ---------- helpers ----------
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const pad2 = (n: number) => String(n).padStart(2, '0');

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** Stable pseudo-random 0..1, so the simulated fleet is the same on every load. */
const rand01 = (s: string) => hash(s) / 4294967296;

function distM(a: LatLng, b: LatLng): number {
  const r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r;
  const dLon = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

function indexBy<T extends { id: string }>(items: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const item of items) out[item.id] = item;
  return out;
}

function decodePolyline(str: string): LatLng[] {
  const out: LatLng[] = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let b = 0;
    do {
      b = str.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < str.length) {
    lat += next();
    lon += next();
    out.push([lat / 1e5, lon / 1e5]);
  }
  return out;
}

function cumulative(line: LatLng[]): number[] {
  const out = [0];
  for (let i = 1; i < line.length; i++) out.push(out[i - 1] + distM(line[i - 1], line[i]));
  return out;
}

/** Distance along the line for each stop, never moving backwards (safe for loop routes). */
function projectAlong(line: LatLng[], cum: number[], points: LatLng[]): number[] {
  const kx = 111320 * Math.cos((line[0][0] * Math.PI) / 180);
  const ky = 110540;
  const out: number[] = [];
  let seg = 0;
  let lastM = 0;
  for (const p of points) {
    const px = p[1] * kx;
    const py = p[0] * ky;
    let bestD = Infinity;
    let bestM = lastM;
    let bestSeg = seg;
    for (let i = seg; i < line.length - 1; i++) {
      const ax = line[i][1] * kx;
      const ay = line[i][0] * ky;
      const dx = line[i + 1][1] * kx - ax;
      const dy = line[i + 1][0] * ky - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 ? clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1) : 0;
      const d = Math.hypot(ax + t * dx - px, ay + t * dy - py);
      const m = cum[i] + t * (cum[i + 1] - cum[i]);
      if (m >= lastM && d < bestD) {
        bestD = d;
        bestM = m;
        bestSeg = i;
      }
      if (bestD < 40 && m - bestM > 2000) break;
    }
    out.push(bestM);
    lastM = bestM;
    seg = bestSeg;
  }
  return out;
}

function pointAt(line: LatLng[], cum: number[], m: number): LatLng {
  for (let i = 0; i < line.length - 1; i++) {
    if (m <= cum[i + 1]) {
      const span = cum[i + 1] - cum[i];
      const t = span > 0 ? (m - cum[i]) / span : 0;
      return [line[i][0] + (line[i + 1][0] - line[i][0]) * t, line[i][1] + (line[i + 1][1] - line[i][1]) * t];
    }
  }
  return line[line.length - 1];
}

function sliceLine(line: LatLng[], cum: number[], fromM: number, toM: number): LatLng[] {
  const out: LatLng[] = [pointAt(line, cum, fromM)];
  for (let i = 0; i < line.length; i++) if (cum[i] > fromM && cum[i] < toM) out.push(line[i]);
  out.push(pointAt(line, cum, toM));
  return out;
}

// ---------- service calendar (which timetable runs today) ----------
const today = (() => {
  const now = new Date();
  const ymd = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }).replace(/-/g, '');
  const weekday = now.toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok', weekday: 'short' });
  return { ymd, dayIndex: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekday) };
})();

function runsToday(serviceId: string): boolean {
  const c = data.services[serviceId];
  if (!c) return true;
  if (c.removed.includes(today.ymd)) return false;
  if (c.added.includes(today.ymd)) return true;
  if (c.startDate && today.ymd < c.startDate) return false;
  if (c.endDate && today.ymd > c.endDate) return false;
  return c.days[today.dayIndex] === 1;
}

// ---------- variants ----------
interface BuiltVariant {
  variant: RouteVariant;
  rideSec: number | null;
  wheelchair: number;
  services: Record<string, NtService>;
}

function buildVariant(nv: NtVariant, routeId: string, stopById: Map<string, NtStop>): BuiltVariant | null {
  const pts: LatLng[] = [];
  for (const id of nv.stopIds) {
    const s = stopById.get(id);
    if (!s) return null;
    pts.push([s.lat, s.lon]);
  }
  if (pts.length < 2) return null;

  let a = 0;
  let b = pts.length - 1;
  const radius = FOCUS_RADIUS_M;
  if (radius !== null) {
    const inside = pts.map((p) => distM(p, FOCUS_CENTER) <= radius);
    a = inside.indexOf(true);
    b = inside.lastIndexOf(true);
    if (a === -1 || b - a < 1) return null;
  }
  const clipped = a > 0 || b < pts.length - 1;

  const encoded = nv.shapeId ? data.shapes[nv.shapeId] : undefined;
  const decoded = encoded ? decodePolyline(encoded) : [];
  const full = decoded.length >= 2 ? decoded : pts;
  const fullCum = cumulative(full);
  const along = projectAlong(full, fullCum, pts);
  const fromM = along[a];
  const toM = along[b];

  let shape: LatLng[];
  let stopDistancesM: number[];
  if (toM - fromM > 50) {
    shape = sliceLine(full, fullCum, fromM, toM);
    stopDistancesM = along.slice(a, b + 1).map((m) => m - fromM);
  } else {
    shape = pts.slice(a, b + 1);
    stopDistancesM = cumulative(shape);
  }
  const shapeCumM = cumulative(shape);
  const lengthM = shapeCumM[shapeCumM.length - 1];
  stopDistancesM = stopDistancesM.map((m) => clamp(m, 0, lengthM));

  const stopIds = nv.stopIds.slice(a, b + 1);
  const direction: Direction = nv.directionId === 1 ? 'inbound' : 'outbound';
  const headsignTh = nv.headsignTh;
  const variant: RouteVariant = {
    id: nv.id,
    routeId,
    direction,
    isShortTurn: nv.isShortTurn,
    variantLabelTh: `${nv.isShortTurn ? 'เที่ยวสั้น ' : ''}ไป${headsignTh}${clipped ? ' (เฉพาะช่วงในเมือง)' : ''}`,
    headsignTh,
    path: stopIds.map((stopId) => ({ stopId })),
    stopIds,
    shape,
    shapeCumM,
    stopDistancesM,
    lengthM,
  };
  return {
    variant,
    rideSec: nv.arrSec ? nv.arrSec[b] - nv.arrSec[a] : null,
    wheelchair: nv.wheelchair,
    services: nv.services,
  };
}

function pickMain(list: BuiltVariant[], direction: Direction): BuiltVariant | undefined {
  return list
    .filter((x) => x.variant.direction === direction)
    .sort(
      (x, y) =>
        Number(x.variant.isShortTurn) - Number(y.variant.isShortTurn) ||
        y.variant.stopIds.length - x.variant.stopIds.length,
    )[0];
}

function averageSpeed(list: BuiltVariant[], rail: boolean): number {
  let metres = 0;
  let seconds = 0;
  for (const x of list) {
    if (x.rideSec && x.rideSec > 60) {
      metres += x.variant.lengthM;
      seconds += x.rideSec;
    }
  }
  if (seconds === 0) return rail ? 35 : 14;
  const kmh = metres / 1000 / (seconds / 3600);
  return Math.round(clamp(kmh, rail ? 25 : 8, rail ? 60 : 35) * 10) / 10;
}

// ---------- timetable ----------
interface Schedule {
  periods: FrequencyPeriod[];
  source: 'today' | 'other_day' | 'estimated';
  middayHeadwayMin: number;
}

function periodLabel(min: number): string {
  if (min < 6 * 60) return 'เช้ามืด';
  if (min < 9 * 60) return 'เร่งด่วนเช้า';
  if (min < 16 * 60) return 'กลางวัน';
  if (min < 19 * 60) return 'เร่งด่วนเย็น';
  if (min < 22 * 60) return 'หัวค่ำ';
  return 'กลางคืน';
}

function hhmm(min: number): string {
  const m = Math.min(Math.round(min), 24 * 60 - 1); // GTFS times after midnight are capped at 23:59
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

const headwayPair = (sec: number): [number, number] => [
  Math.max(1, Math.floor(sec / 60)),
  Math.max(1, Math.ceil(sec / 60)),
];

function buildSchedule(services: Record<string, NtService>): Schedule {
  const all = Object.entries(services);
  const todays = all.filter(([id]) => runsToday(id));
  const slots = new Array<number>(DAY_SLOTS).fill(Infinity); // headway in seconds per 5-minute slot
  const mark = (fromSec: number, toSec: number, headwaySec: number) => {
    const first = Math.max(0, Math.floor(fromSec / 60 / SLOT_MIN));
    const last = Math.min(DAY_SLOTS, Math.ceil(toSec / 60 / SLOT_MIN));
    for (let i = first; i < last; i++) slots[i] = Math.min(slots[i], headwaySec);
  };
  for (const [, svc] of todays.length > 0 ? todays : all) {
    for (const [from, to, headway] of svc.periods) mark(from, to, headway);
    const d = svc.departures;
    for (let i = 0; i + 1 < d.length; i++) {
      const gap = d[i + 1] - d[i];
      if (gap > 0 && gap <= 2 * 3600) mark(d[i], d[i + 1], Math.max(300, Math.round(gap / 300) * 300));
    }
  }

  const periods: FrequencyPeriod[] = [];
  let i = 0;
  while (i < DAY_SLOTS) {
    if (!Number.isFinite(slots[i])) {
      i++;
      continue;
    }
    const h = headwayPair(slots[i]);
    let j = i + 1;
    while (j < DAY_SLOTS && Number.isFinite(slots[j])) {
      const hj = headwayPair(slots[j]);
      if (hj[0] !== h[0] || hj[1] !== h[1]) break;
      j++;
    }
    periods.push({ labelTh: periodLabel(i * SLOT_MIN), from: hhmm(i * SLOT_MIN), to: hhmm(j * SLOT_MIN), headwayMin: h });
    i = j;
  }

  if (periods.length === 0) {
    return {
      periods: [{ labelTh: 'ทั้งวัน (ประมาณ)', from: '05:00', to: '22:00', headwayMin: [15, 20] }],
      source: 'estimated',
      middayHeadwayMin: 15,
    };
  }
  const noon = slots[(12 * 60) / SLOT_MIN];
  const middaySec = Number.isFinite(noon) ? noon : Math.min(...slots.filter((s) => Number.isFinite(s)));
  return { periods, source: todays.length > 0 ? 'today' : 'other_day', middayHeadwayMin: middaySec / 60 };
}

// ---------- fares ----------
function fareFor(routeIds: string[], stopCount: number): { fare: FareRule; known: boolean } {
  let min = Infinity;
  let max = 0;
  for (const id of routeIds) {
    const f = data.fares[id];
    if (!f) continue;
    for (const p of [f.min, f.max]) {
      if (p > 0) {
        min = Math.min(min, p);
        max = Math.max(max, p);
      }
    }
  }
  if (max === 0) return { fare: { kind: 'flat', amountThb: 0 }, known: false };
  if (min === max) return { fare: { kind: 'flat', amountThb: max }, known: true };
  const steps = 3; // approximation: GTFS gives a price range, not the exact steps
  return {
    fare: {
      kind: 'distance',
      baseThb: min,
      stepThb: Math.max(0.5, Math.round(((max - min) / steps) * 2) / 2),
      stopsPerStep: Math.max(3, Math.ceil(stopCount / (steps + 1))),
      maxThb: max,
    },
    known: true,
  };
}

// ---------- simulated fleet ----------
type Wheel = 'yes' | 'no' | 'unknown';

const FLEET: Record<VehicleType, { seats: number; capacity: number }> = {
  ev_low_floor: { seats: 28, capacity: 70 },
  ac_standard: { seats: 35, capacity: 80 },
  non_ac_standard: { seats: 40, capacity: 90 },
};

function acFromDescription(desc: string | undefined): ServiceType | null {
  if (!desc) return null;
  if (desc.includes('ปรับอากาศ')) return 'ac';
  if (desc.includes('ธรรมดา')) return 'non_ac';
  return null;
}

function wheelFromGtfs(a: number, b: number): Wheel {
  if (a === 2 || b === 2) return 'no';
  if (a === 1 && b === 1) return 'yes';
  return 'unknown';
}

function pickType(serviceType: ServiceType, agencyId: string, wheel: Wheel, seed: string): VehicleType {
  if (serviceType === 'non_ac') return 'non_ac_standard';
  if (wheel === 'no') return 'ac_standard';
  const evShare = agencyId === 'TSB' ? 0.9 : wheel === 'yes' ? 0.7 : 0.4;
  return rand01(`type:${seed}`) < evShare ? 'ev_low_floor' : 'ac_standard';
}

function accessibilityFor(type: VehicleType, wheel: Wheel): Accessibility {
  const lowFloor = type === 'ev_low_floor';
  const ramp = wheel === 'yes' ? true : wheel === 'no' ? false : lowFloor;
  return {
    lowFloor,
    ramp,
    wheelchairSpaces: ramp ? 1 : 0,
    audioAnnouncements: lowFloor,
    visualDisplay: type !== 'non_ac_standard',
  };
}

function buildVehicles(
  route: Route,
  nt: NtRoute,
  out: RouteVariant,
  back: RouteVariant,
  headwayMin: number,
  wheel: Wheel,
  acSource: FeatureSource,
): Vehicle[] {
  const cycleMin = ((out.lengthM + back.lengthM) / 1000 / route.avgSpeedKmh) * 60 + 2 * LAYOVER_MIN;
  const count = clamp(Math.ceil(cycleMin / Math.max(1, headwayMin)), 1, MAX_VEHICLES_PER_ROUTE);
  const vehicles: Vehicle[] = [];
  for (let k = 0; k < count; k++) {
    const id = `nt-${route.id}-${k + 1}`;
    const type = pickType(route.serviceType, nt.agencyId, wheel, id);
    vehicles.push({
      id,
      fleetCode: `${route.shortName}-${pad2(k + 1)}`, // fictional, not a real fleet number
      routeId: route.id,
      blockVariantIds: [out.id, back.id],
      phase: (k + rand01(`phase:${id}`) * 0.3) / count,
      type,
      seats: FLEET[type].seats,
      capacity: FLEET[type].capacity,
      accessibility: accessibilityFor(type, wheel),
      hasOccupancySensor: type !== 'non_ac_standard' || rand01(`sensor:${id}`) < 0.5,
      baseLoad: clamp(0.3 + 0.08 * nt.hubs.length + (rand01(`load:${id}`) - 0.5) * 0.2, 0.15, 0.85),
      loadSeed: Math.round(rand01(`seed:${id}`) * 60) / 10, // 0–6, same range as src/data/vehicles.ts
      featureSource: { ac: acSource, wheelchair: wheel === 'unknown' ? 'sim' : 'gtfs' },
    });
  }
  return vehicles;
}

// ---------- main ----------
export function buildNamtangNetwork(places: Place[]): TransitNetwork {
  const ntStopById = new Map(data.stops.map((s) => [s.id, s] as const));
  const ntRouteById = new Map(data.routes.map((r) => [r.id, r] as const));
  const agencyTh = new Map(data.agencies.map((a) => [a.id, a.nameTh] as const));

  // 1. Merge duplicate route_ids (same operator, number and name; loop left/right stay separate)
  const primaryByKey = new Map<string, NtRoute>();
  const primaryOf = new Map<string, string>();
  const originalIds = new Map<string, string[]>();
  for (const r of data.routes) {
    const key = `${r.agencyId}|${r.shortName}|${r.longNameTh}`;
    const p = primaryByKey.get(key) ?? r;
    primaryByKey.set(key, p);
    primaryOf.set(r.id, p.id);
    originalIds.set(p.id, [...(originalIds.get(p.id) ?? []), r.id]);
  }

  // 2. Variants: clip to the focus area, then drop exact duplicates
  const builtByRoute = new Map<string, BuiltVariant[]>();
  const seen = new Set<string>();
  for (const nv of data.variants) {
    const routeId = primaryOf.get(nv.routeId);
    if (!routeId) continue;
    const built = buildVariant(nv, routeId, ntStopById);
    if (!built) continue;
    const key = `${routeId}|${built.variant.direction}|${built.variant.stopIds.join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    builtByRoute.set(routeId, [...(builtByRoute.get(routeId) ?? []), built]);
  }

  // 3. Routes and the simulated fleet (buses only; rail shows lines, stations and timetables)
  const routes: Route[] = [];
  const variants: RouteVariant[] = [];
  const vehicles: Vehicle[] = [];
  for (const [routeId, list] of builtByRoute) {
    const nt = ntRouteById.get(routeId);
    if (!nt) continue;
    const out = pickMain(list, 'outbound') ?? list[0];
    const back = pickMain(list, 'inbound') ?? out;
    const rail = nt.mode !== 'bus';
    const sched = buildSchedule(out.services);
    const fare = fareFor(originalIds.get(routeId) ?? [routeId], out.variant.stopIds.length);
    const ac = acFromDescription(nt.descTh);
    const serviceType: ServiceType = ac ?? (rail || rand01(`ac:${routeId}`) < 0.7 ? 'ac' : 'non_ac');

    const route: Route = {
      id: routeId,
      shortName: rail ? `${nt.mode.toUpperCase()} ${nt.shortName}` : nt.shortName,
      nameTh: nt.legacyName ? `${nt.longNameTh} (เดิมสาย ${nt.legacyName})` : nt.longNameTh,
      serviceType,
      color: nt.color,
      avgSpeedKmh: averageSpeed(list, rail),
      fare: fare.fare,
      firstDeparture: sched.periods[0].from,
      lastDeparture: sched.periods[sched.periods.length - 1].to,
      frequency: sched.periods,
      mode: nt.mode,
      agencyTh: agencyTh.get(nt.agencyId) ?? nt.agencyId,
      legacyName: nt.legacyName ?? undefined,
      fareKnown: fare.known,
      scheduleSource: sched.source,
    };
    routes.push(route);
    variants.push(...list.map((x) => x.variant));
    if (!rail) {
      const wheel = wheelFromGtfs(out.wheelchair, back.wheelchair);
      vehicles.push(
        ...buildVehicles(route, nt, out.variant, back.variant, sched.middayHeadwayMin, wheel, ac ? 'gtfs' : 'sim'),
      );
    }
  }

  // 4. Only the stops that the clipped variants use
  const nearestHub = (p: LatLng): string | undefined =>
    data.hubs.find((h) => distM(p, [h.lat, h.lon]) <= 1200)?.nameTh;
  const stops: Stop[] = [];
  for (const id of new Set(variants.flatMap((v) => v.stopIds))) {
    const s = ntStopById.get(id);
    if (!s) continue;
    const position: LatLng = [s.lat, s.lon];
    stops.push({
      id,
      code: id,
      nameTh: s.nameTh,
      areaTh: nearestHub(position) ?? 'กรุงเทพฯ',
      position,
      keywords: [s.nameEn].filter(Boolean),
    });
  }

  const variantIdsByStop: Record<string, string[]> = {};
  for (const v of variants) {
    for (const id of new Set(v.stopIds)) (variantIdsByStop[id] ??= []).push(v.id);
  }

  if (import.meta.env.DEV) {
    console.info(
      `[namtang] ${routes.length} routes, ${variants.length} variants, ${stops.length} stops, ${vehicles.length} simulated buses`,
    );
  }

  return {
    stops,
    routes,
    variants,
    vehicles,
    places,
    stopById: indexBy(stops),
    routeById: indexBy(routes),
    variantById: indexBy(variants),
    vehicleById: indexBy(vehicles),
    placeById: indexBy(places),
    variantIdsByStop,
  };
}
import { PLACES } from './places';

export function loadNamtangNetwork(): TransitNetwork {
  return buildNamtangNetwork(PLACES);
}
export function getNamtangSourceInfo(): NamtangSource {
  return namtangSource;
}
