import type {
  Arrival, CrowdLevel, DataQuality, EtaRange, LatLng, LiveSnapshot, TransitNetwork, VehicleLiveState,
} from '../types/transit';
import { arrivalsForStop } from './arrivals';
import { fareForStops } from './fare';
import { boardableVariants } from './lookup';
import { walkFeasibility, type WalkFeasibility } from './nearby';
import { headwayMinAt, rideCrossesDisruption, scheduledRideSec } from './travelTime';
import { nearbyStops, walkingDistanceM, walkingMinutes, type NearbyStop } from './walking';

export type PlanCriterion = 'fastest' | 'fewest_transfers' | 'least_walking' | 'least_crowded';
export const PLAN_CRITERIA: PlanCriterion[] = ['fastest', 'fewest_transfers', 'least_walking', 'least_crowded'];

export interface PlanPoint {
  position: LatLng;
  stopId?: string;
}

export interface LegOption {
  variantId: string;
  boardIndex: number;
  alightIndex: number;
}

export interface WalkSegment {
  stopId: string;
  distanceM: number;
  walkMin: number;
}

/** Walk between two nearby stops when changing, e.g. bus stop -> BTS station. */
export interface TransferWalk {
  fromStopId: string;
  distanceM: number;
  walkMin: number;
}

export interface ItineraryLeg {
  boardStopId: string;
  alightStopId: string;
  options: LegOption[]; // every route/variant that serves this ride
  chosen: LegOption;
  avoidVariantIds: string[]; // same route + direction, but does not reach the alighting stop
  divergence: { stopId: string; beforeAlight: boolean } | null;
  transferWalk: TransferWalk | null; // walk before boarding this leg (transfers only)
  source: 'live' | 'schedule';
  vehicleId: string | null;
  quality: DataQuality | null;
  staleSec: number;
  vehicleEta: EtaRange | null;
  headwayMin: number;
  waitSec: number;
  boardAtSec: number; // seconds from now
  rideSec: number;
  alightAtSec: number;
  stopsCount: number;
  crowd: CrowdLevel;
  fare: [number, number];
  fareKnown: boolean; // false = no fare data for this ride
  crossesDisruption: boolean;
}

export interface Itinerary {
  id: string;
  patternId: string;
  mode: 'earliest' | 'comfort';
  access: WalkSegment;
  egress: WalkSegment;
  legs: ItineraryLeg[];
  totalSec: number;
  range: EtaRange;
  transfers: number;
  walkM: number;
  crowd: CrowdLevel;
  crowdRank: number;
  fare: [number, number];
  fareKnown: boolean; // false = at least one leg has no fare data
  usesSchedule: boolean;
  affectedByDisruption: boolean;
  catchFeasibility: WalkFeasibility;
  tightTransfer: boolean;
  comfortExtraMin: number | null;
}

export interface PlanResult {
  computedAtMs: number;
  itineraries: Itinerary[];
  walkOnly: { distanceM: number; walkMin: number } | null;
  directDistanceM: number;
  accessCount: number;
  egressCount: number;
}

const ACCESS_RADIUS_M = 900;
const ACCESS_LIMIT = 5;
const TRANSFER_BUFFER_SEC = 120;
const TIGHT_TRANSFER_SEC = 240;
const PLAN_HORIZON_MIN = 120;
const WALK_ONLY_MAX_M = 1500;
/** Walk to a different stop or station when changing, up to this distance. */
const TRANSFER_WALK_M = 400;
const TRANSFER_WALK_LIMIT = 6;
/** Keep only the most promising transfer patterns so planning stays fast on phones. */
const MAX_TRANSFER_PATTERNS = 80;
const MIN_PER_STOP = 1.5; // rough ranking only
const CROWD_ORDER: CrowdLevel[] = ['seats', 'standing', 'unknown', 'crowded'];

interface LegPattern {
  boardStopId: string;
  alightStopId: string;
  options: LegOption[];
  transferWalk: TransferWalk | null;
}

interface Pattern {
  id: string;
  access: NearbyStop;
  egress: NearbyStop;
  legs: LegPattern[];
}

interface Ctx {
  net: TransitNetwork;
  snapshot: LiveSnapshot;
  arrivalsAt: (stopId: string) => Arrival[];
  vehicleById: Map<string, VehicleLiveState>;
}

function endpointStops(net: TransitNetwork, point: PlanPoint): NearbyStop[] {
  const list = nearbyStops(net, point.position, ACCESS_RADIUS_M, ACCESS_LIMIT);
  const exact = point.stopId ? net.stopById[point.stopId] : undefined;
  if (!exact) return list;
  return [{ stop: exact, distanceM: 0, walkMin: 0 }, ...list.filter((n) => n.stop.id !== exact.id)].slice(0, ACCESS_LIMIT);
}

/**
 * Board and alight positions for a ride between two stops on each variant.
 * Real routes can pass the same stop twice (loops, turnarounds at the terminal),
 * so check every occurrence instead of only the first, and keep the shortest ride.
 */
function legOptions(net: TransitNetwork, fromStopId: string, toStopId: string): LegOption[] {
  const out: LegOption[] = [];
  for (const v of boardableVariants(net, fromStopId)) {
    let best: LegOption | null = null;
    for (let i = 0; i < v.stopIds.length - 1; i++) {
      if (v.stopIds[i] !== fromStopId) continue;
      const j = v.stopIds.indexOf(toStopId, i + 1);
      if (j !== -1 && (!best || j - i < best.alightIndex - best.boardIndex)) {
        best = { variantId: v.id, boardIndex: i, alightIndex: j };
      }
    }
    if (best) out.push(best);
  }
  return out;
}

/** Stops from which at least one variant reaches `targetId` later in its trip. */
function stopsReaching(net: TransitNetwork, targetId: string): Set<string> {
  const out = new Set<string>();
  for (const id of net.variantIdsByStop[targetId] ?? []) {
    const v = net.variantById[id];
    if (!v) continue;
    const last = v.stopIds.lastIndexOf(targetId);
    for (let i = 0; i < last; i++) out.add(v.stopIds[i]);
  }
  return out;
}

const rideStops = (options: LegOption[]) => Math.min(...options.map((o) => o.alightIndex - o.boardIndex));

function buildPatterns(net: TransitNetwork, access: NearbyStop[], egress: NearbyStop[]): Pattern[] {
  const direct = new Map<string, Pattern>();
  const transfers = new Map<string, { pattern: Pattern; score: number }>();
  const reaching = new Map(egress.map((e) => [e.stop.id, stopsReaching(net, e.stop.id)] as const));

  // Where you can board after getting off at `stopId`: the same stop, or a stop/station within walking distance.
  const walkCache = new Map<string, NearbyStop[]>();
  const transferPoints = (stopId: string): NearbyStop[] => {
    const hit = walkCache.get(stopId);
    if (hit) return hit;
    const stop = net.stopById[stopId];
    const list: NearbyStop[] = stop
      ? [
          { stop, distanceM: 0, walkMin: 0 },
          ...nearbyStops(net, stop.position, TRANSFER_WALK_M, TRANSFER_WALK_LIMIT).filter((n) => n.stop.id !== stopId),
        ]
      : [];
    walkCache.set(stopId, list);
    return list;
  };

  for (const a of access) {
    // Direct rides
    for (const e of egress) {
      if (e.stop.id === a.stop.id) continue;
      const options = legOptions(net, a.stop.id, e.stop.id);
      if (options.length === 0) continue;
      const id = `d:${a.stop.id}:${e.stop.id}`;
      direct.set(id, {
        id, access: a, egress: e,
        legs: [{ boardStopId: a.stop.id, alightStopId: e.stop.id, options, transferWalk: null }],
      });
    }

    // One transfer, at the same stop or after a short walk
    const alightStops = new Set<string>();
    for (const v of boardableVariants(net, a.stop.id)) {
      v.stopIds.slice(v.stopIds.indexOf(a.stop.id) + 1).forEach((id) => alightStops.add(id));
    }
    for (const t of alightStops) {
      const first = legOptions(net, a.stop.id, t);
      if (first.length === 0) continue;
      const firstRoutes = new Set(first.map((o) => net.variantById[o.variantId].routeId));
      for (const e of egress) {
        if (e.stop.id === a.stop.id) continue;
        // If a first-leg vehicle already reaches the destination stop, the transfer is pointless.
        if (first.some((o) => net.variantById[o.variantId].stopIds.indexOf(e.stop.id, o.boardIndex + 1) !== -1)) continue;
        const canReach = reaching.get(e.stop.id) ?? new Set<string>();
        for (const w of transferPoints(t)) {
          if (w.stop.id === e.stop.id || w.stop.id === a.stop.id || !canReach.has(w.stop.id)) continue;
          const second = legOptions(net, w.stop.id, e.stop.id).filter(
            (o) => !firstRoutes.has(net.variantById[o.variantId].routeId),
          );
          if (second.length === 0) continue;
          const id = `t:${a.stop.id}:${t}:${w.stop.id}:${e.stop.id}`;
          const score =
            a.walkMin + e.walkMin + w.walkMin * 1.5 + (rideStops(first) + rideStops(second)) * MIN_PER_STOP;
          transfers.set(id, {
            score,
            pattern: {
              id, access: a, egress: e,
              legs: [
                { boardStopId: a.stop.id, alightStopId: t, options: first, transferWalk: null },
                {
                  boardStopId: w.stop.id,
                  alightStopId: e.stop.id,
                  options: second,
                  transferWalk: w.distanceM > 0 ? { fromStopId: t, distanceM: w.distanceM, walkMin: w.walkMin } : null,
                },
              ],
            },
          });
        }
      }
    }
  }

  const bestTransfers = [...transfers.values()]
    .sort((x, y) => x.score - y.score)
    .slice(0, MAX_TRANSFER_PATTERNS)
    .map((x) => x.pattern);
  return [...direct.values(), ...bestTransfers];
}

function variantsToAvoid(net: TransitNetwork, lp: LegPattern): string[] {
  const ok = new Set(lp.options.map((o) => o.variantId));
  const keys = new Set(lp.options.map((o) => {
    const v = net.variantById[o.variantId];
    return `${v.routeId}|${v.direction}`;
  }));
  return boardableVariants(net, lp.boardStopId)
    .filter((v) => !ok.has(v.id) && keys.has(`${v.routeId}|${v.direction}`))
    .map((v) => v.id);
}

/** Where the grouped routes stop sharing the same sequence of stops. */
function divergence(net: TransitNetwork, lp: LegPattern): ItineraryLeg['divergence'] {
  if (lp.options.length < 2) return null;
  const seqs = lp.options.map((o) => ({ ids: net.variantById[o.variantId].stopIds, i: o.boardIndex }));
  const ref = seqs[0];
  let k = 1;
  while (seqs.every((x) => x.i + k < x.ids.length && x.ids[x.i + k] === ref.ids[ref.i + k])) k++;
  if (seqs.every((x) => x.i + k >= x.ids.length)) return null; // all end together
  return { stopId: ref.ids[ref.i + k - 1], beforeAlight: ref.i + k - 1 < lp.options[0].alightIndex };
}

function evaluate(ctx: Ctx, pattern: Pattern, mode: Itinerary['mode']): Itinerary | null {
  const { net, snapshot } = ctx;
  const disruption = snapshot.disruption;
  const nowMs = snapshot.generatedAtMs;
  const legs: ItineraryLeg[] = [];
  let clock = pattern.access.walkMin * 60;
  let slackLow = 0;
  let slackHigh = 0;
  let skippedCrowded = false;

  for (const lp of pattern.legs) {
    if (lp.options.length === 0) return null; // no route serves this ride; skip the whole itinerary
    const walkSec = (lp.transferWalk?.walkMin ?? 0) * 60;
    const ready = clock + walkSec + (legs.length > 0 ? TRANSFER_BUFFER_SEC : 0);
    const ids = new Set(lp.options.map((o) => o.variantId));
    const pool = ctx.arrivalsAt(lp.boardStopId).filter(
      (a) => ids.has(a.variantId) && a.etaSec !== null && !a.mayHavePassed && a.etaSec >= ready,
    );
    const earliest = pool[0] ?? null;
    const comfy = pool.find((a) => a.crowd === 'seats' || a.crowd === 'standing') ?? null;
    if (mode === 'comfort' && !comfy) return null;
    if (mode === 'comfort' && comfy && earliest && comfy.vehicleId !== earliest.vehicleId) skippedCrowded = true;
    const pick = mode === 'comfort' ? comfy : earliest;
    const pickEta = pick ? pick.etaSec : null;
    const base = {
      boardStopId: lp.boardStopId,
      alightStopId: lp.alightStopId,
      options: lp.options,
      avoidVariantIds: variantsToAvoid(net, lp),
      divergence: divergence(net, lp),
      transferWalk: lp.transferWalk,
    };

    if (pick && pickEta !== null) {
      const chosen = lp.options.find((o) => o.variantId === pick.variantId) ?? lp.options[0];
      const variant = net.variantById[chosen.variantId];
      const route = net.routeById[variant.routeId];
      const alightPred = ctx.vehicleById.get(pick.vehicleId)?.predictions.find((pr) => pr.stopIndex === chosen.alightIndex);
      const predictedRide = alightPred && alightPred.etaSec !== null ? alightPred.etaSec - pickEta : 0;
      const rideSec = predictedRide > 0
        ? predictedRide
        : scheduledRideSec(route, variant, chosen.boardIndex, chosen.alightIndex, disruption);
      const waitSec = pickEta - ready;
      const crosses = rideCrossesDisruption(variant, chosen.boardIndex, chosen.alightIndex, disruption);
      const fareKnown = route.fareKnown !== false;
      const fare = fareKnown ? fareForStops(route, chosen.alightIndex - chosen.boardIndex) : 0;
      slackLow += 0.1 * (rideSec + waitSec) + 30;
      slackHigh += 0.2 * (rideSec + waitSec) + 60 + (pick.quality === 'delayed' ? pick.staleSec : 0) + (crosses ? 300 : 0);
      legs.push({
        ...base,
        chosen,
        source: 'live',
        vehicleId: pick.vehicleId,
        quality: pick.quality,
        staleSec: pick.staleSec,
        vehicleEta: pick.etaRange,
        headwayMin: headwayMinAt(route, nowMs),
        waitSec,
        boardAtSec: pickEta,
        rideSec,
        alightAtSec: pickEta + rideSec,
        stopsCount: chosen.alightIndex - chosen.boardIndex,
        crowd: pick.crowd,
        fare: [fare, fare],
        fareKnown,
        crossesDisruption: crosses,
      });
      clock = pickEta + rideSec;
    } else {
      const chosen = lp.options[0];
      const variant = net.variantById[chosen.variantId];
      const route = net.routeById[variant.routeId];
      const headwayMin = Math.min(
        ...lp.options.map((o) => headwayMinAt(net.routeById[net.variantById[o.variantId].routeId], nowMs)),
      );
      const waitSec = Math.round((headwayMin * 60) / 2);
      const rideSec = scheduledRideSec(route, variant, chosen.boardIndex, chosen.alightIndex, disruption);
      const crosses = lp.options.some((o) =>
        rideCrossesDisruption(net.variantById[o.variantId], o.boardIndex, o.alightIndex, disruption),
      );
      const fares: number[] = [];
      for (const o of lp.options) {
        const r = net.routeById[net.variantById[o.variantId].routeId];
        if (r.fareKnown !== false) fares.push(fareForStops(r, o.alightIndex - o.boardIndex));
      }
      slackLow += waitSec + 0.1 * rideSec;
      slackHigh += waitSec + 0.25 * rideSec + 60 + (crosses ? 300 : 0);
      legs.push({
        ...base,
        chosen,
        source: 'schedule',
        vehicleId: null,
        quality: null,
        staleSec: 0,
        vehicleEta: null,
        headwayMin,
        waitSec,
        boardAtSec: ready + waitSec,
        rideSec,
        alightAtSec: ready + waitSec + rideSec,
        stopsCount: chosen.alightIndex - chosen.boardIndex,
        crowd: 'unknown',
        fare: fares.length > 0 ? [Math.min(...fares), Math.max(...fares)] : [0, 0],
        fareKnown: fares.length > 0,
        crossesDisruption: crosses,
      });
      clock = ready + waitSec + rideSec;
    }
  }

  if (mode === 'comfort' && !skippedCrowded) return null; // identical to the earliest version

  const totalSec = Math.round(clock + pattern.egress.walkMin * 60);
  const minMin = Math.max(1, Math.floor((totalSec - slackLow) / 60));
  const maxMin = Math.max(minMin + 2, Math.ceil((totalSec + slackHigh) / 60));
  const crowdRank = Math.max(...legs.map((l) => CROWD_ORDER.indexOf(l.crowd)));
  const firstLeg = legs[0];
  const transferWalkM = legs.reduce((s, l) => s + (l.transferWalk?.distanceM ?? 0), 0);

  return {
    id: `${pattern.id}|${mode}`,
    patternId: pattern.id,
    mode,
    access: { stopId: pattern.access.stop.id, distanceM: pattern.access.distanceM, walkMin: pattern.access.walkMin },
    egress: { stopId: pattern.egress.stop.id, distanceM: pattern.egress.distanceM, walkMin: pattern.egress.walkMin },
    legs,
    totalSec,
    range: { minMin, maxMin, arriving: false },
    transfers: legs.length - 1,
    walkM: pattern.access.distanceM + pattern.egress.distanceM + transferWalkM,
    crowd: CROWD_ORDER[crowdRank],
    crowdRank,
    fare: [legs.reduce((s, l) => s + l.fare[0], 0), legs.reduce((s, l) => s + l.fare[1], 0)],
    fareKnown: legs.every((l) => l.fareKnown),
    usesSchedule: legs.some((l) => l.source === 'schedule'),
    affectedByDisruption: legs.some((l) => l.crossesDisruption),
    catchFeasibility: firstLeg.source === 'live' ? walkFeasibility(pattern.access.walkMin, firstLeg.vehicleEta) : 'unknown',
    tightTransfer: legs.some(
      (l, i) =>
        i > 0 &&
        l.source === 'live' &&
        l.boardAtSec - legs[i - 1].alightAtSec - (l.transferWalk?.walkMin ?? 0) * 60 < TIGHT_TRANSFER_SEC,
    ),
    comfortExtraMin: null,
  };
}

const COMPARE: Record<PlanCriterion, (a: Itinerary, b: Itinerary) => number> = {
  fastest: (a, b) => a.totalSec - b.totalSec || a.transfers - b.transfers || a.walkM - b.walkM,
  fewest_transfers: (a, b) => a.transfers - b.transfers || a.totalSec - b.totalSec,
  least_walking: (a, b) => a.walkM - b.walkM || a.totalSec - b.totalSec,
  least_crowded: (a, b) => a.crowdRank - b.crowdRank || a.totalSec - b.totalSec,
};

export function sortItineraries(list: Itinerary[], criterion: PlanCriterion): Itinerary[] {
  return [...list].sort(COMPARE[criterion]);
}

/** Best itinerary per criterion. "Less crowded" is only awarded when crowding is actually known. */
export function bestByCriterion(list: Itinerary[]): Record<PlanCriterion, string | null> {
  const out = {} as Record<PlanCriterion, string | null>;
  for (const c of PLAN_CRITERIA) {
    const best = sortItineraries(list, c)[0];
    out[c] = best && (c !== 'least_crowded' || best.crowdRank <= 1) ? best.id : null;
  }
  return out;
}

const minutes = (it: Itinerary) => Math.round(it.totalSec / 60);

function dominates(a: Itinerary, b: Itinerary): boolean {
  if (a.usesSchedule && !b.usesSchedule) return false; // a guess never beats live data
  const noWorse = minutes(a) <= minutes(b) && a.transfers <= b.transfers && a.walkM <= b.walkM && a.crowdRank <= b.crowdRank;
  const better = minutes(a) < minutes(b) || a.transfers < b.transfers || a.walkM < b.walkM || a.crowdRank < b.crowdRank;
  return noWorse && better;
}

function sameScore(a: Itinerary, b: Itinerary): boolean {
  return minutes(a) === minutes(b) && a.transfers === b.transfers && a.walkM === b.walkM && a.crowdRank === b.crowdRank;
}

/** Keep only itineraries that are best in at least one trade-off. */
function prune(list: Itinerary[]): Itinerary[] {
  const nonDominated = list.filter((x) => !list.some((y) => y !== x && dominates(y, x)));
  const out: Itinerary[] = [];
  for (const x of sortItineraries(nonDominated, 'fastest')) {
    if (!out.some((y) => sameScore(x, y))) out.push(x);
  }
  return out;
}

export function planTrip(net: TransitNetwork, snapshot: LiveSnapshot, from: PlanPoint, to: PlanPoint): PlanResult {
  const directDistanceM = walkingDistanceM(from.position, to.position);
  const access = endpointStops(net, from);
  const egress = endpointStops(net, to);
  const cache = new Map<string, Arrival[]>();
  const ctx: Ctx = {
    net,
    snapshot,
    arrivalsAt: (stopId) => {
      const hit = cache.get(stopId);
      if (hit) return hit;
      const list = arrivalsForStop(net, snapshot, stopId, PLAN_HORIZON_MIN);
      cache.set(stopId, list);
      return list;
    },
    vehicleById: new Map(snapshot.vehicles.map((v): [string, VehicleLiveState] => [v.vehicleId, v])),
  };

  const candidates: Itinerary[] = [];
  for (const pattern of buildPatterns(net, access, egress)) {
    const earliest = evaluate(ctx, pattern, 'earliest');
    const comfort = evaluate(ctx, pattern, 'comfort');
    if (earliest) candidates.push(earliest);
    if (comfort) {
      comfort.comfortExtraMin = earliest ? Math.max(0, Math.round((comfort.totalSec - earliest.totalSec) / 60)) : null;
      candidates.push(comfort);
    }
  }

  return {
    computedAtMs: snapshot.generatedAtMs,
    itineraries: prune(candidates),
    walkOnly: directWalkOnly(directDistanceM),
    directDistanceM,
    accessCount: access.length,
    egressCount: egress.length,
  };
}

function directWalkOnly(distanceM: number): PlanResult['walkOnly'] {
  return distanceM <= WALK_ONLY_MAX_M ? { distanceM, walkMin: walkingMinutes(distanceM) } : null;
}