import { crowdLevelFor } from '../domain/crowding';
import type {
  DataQuality, Disruption, LiveSnapshot, RouteVariant, ScenarioConfig, ServiceNotice,
  StopPrediction, TransitNetwork, Vehicle, VehicleLiveState, VehicleStatus,
} from '../types/transit';
import { pointAlong } from './geo';
import { buildTripProfile, locateInTrip, type TripProfile } from './tripProfile';

export const LAYOVER_SEC = 240;
export const STALE_THRESHOLD_SEC = 90;
export const UNAVAILABLE_AGE_SEC = 12 * 60;
const SIM_EPOCH_MS = Date.UTC(2024, 0, 1);

const mod = (a: number, n: number) => ((a % n) + n) % n;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const profileCache = new Map<string, TripProfile>();

export function getTripProfile(net: TransitNetwork, variantId: string, disruption: Disruption | null): TripProfile {
  const key = `${variantId}|${disruption?.id ?? 'none'}`;
  const cached = profileCache.get(key);
  if (cached) return cached;
  const variant = net.variantById[variantId];
  const profile = buildTripProfile(variant, net.routeById[variant.routeId], disruption);
  profileCache.set(key, profile);
  return profile;
}

interface RawPosition {
  variant: RouteVariant;
  profile: TripProfile;
  status: VehicleStatus;
  tripTimeSec: number;
  layoverRemainingSec: number;
  distanceAlongM: number;
  nextStopIndex: number;
  atStopIndex: number | null;
}

/** Each vehicle loops: layover → outbound trip → layover → inbound trip. Position is a pure function of time. */
function positionAt(net: TransitNetwork, vehicle: Vehicle, disruption: Disruption | null, atMs: number): RawPosition {
  const legs = vehicle.blockVariantIds.map((id) => ({
    variant: net.variantById[id],
    profile: getTripProfile(net, id, disruption),
  }));
  const cycle = legs.reduce((sum, leg) => sum + LAYOVER_SEC + leg.profile.totalSec, 0);
  let p = mod((atMs - SIM_EPOCH_MS) / 1000 + vehicle.phase * cycle, cycle);

  for (const leg of legs) {
    if (p < LAYOVER_SEC) {
      return { ...leg, status: 'layover', tripTimeSec: 0, layoverRemainingSec: LAYOVER_SEC - p, distanceAlongM: 0, nextStopIndex: 0, atStopIndex: 0 };
    }
    p -= LAYOVER_SEC;
    if (p < leg.profile.totalSec) {
      const loc = locateInTrip(leg.variant, leg.profile, p);
      return { ...leg, ...loc, status: loc.atStopIndex === null ? 'moving' : 'at_stop', tripTimeSec: p, layoverRemainingSec: 0 };
    }
    p -= leg.profile.totalSec;
  }
  return { ...legs[0], status: 'layover', tripTimeSec: 0, layoverRemainingSec: LAYOVER_SEC, distanceAlongM: 0, nextStopIndex: 0, atStopIndex: 0 };
}

/** Mock output of a future onboard occupancy estimator. Not produced by any AI model. */
function estimatePassengers(vehicle: Vehicle, scenario: ScenarioConfig, atMs: number, progress: number): number | null {
  if (!vehicle.hasOccupancySensor) return null;
  const t = atMs / 1000;
  const override = scenario.crowdRatioByRoute[vehicle.routeId];
  const ratio = override !== undefined
    ? override + 0.02 * Math.sin(t / 300 + vehicle.loadSeed)
    : vehicle.baseLoad + 0.15 * Math.sin(t / 900 + vehicle.loadSeed) + 0.3 * Math.sin(Math.PI * progress) - 0.1;
  return Math.round(clamp(ratio, 0.05, 1) * vehicle.capacity);
}

function buildPredictions(raw: RawPosition, staleSec: number, known: boolean): StopPrediction[] {
  const { variant, profile } = raw;
  const seg = profile.disruptedSegment;
  const list: StopPrediction[] = [];
  for (let i = raw.nextStopIndex; i < variant.stopIds.length; i++) {
    const reportedEta = raw.layoverRemainingSec + profile.arriveSec[i] - raw.tripTimeSec;
    const adjusted = reportedEta - staleSec; // assume the bus kept moving since its last report
    list.push({
      stopId: variant.stopIds[i],
      stopIndex: i,
      etaSec: known ? Math.max(0, Math.round(adjusted)) : null,
      mayHavePassed: known && staleSec > STALE_THRESHOLD_SEC && adjusted < 0,
      crossesDisruption: seg !== null && i >= seg[1] && raw.distanceAlongM < variant.stopDistancesM[seg[1]],
    });
  }
  return list;
}

function simulateVehicle(net: TransitNetwork, vehicle: Vehicle, scenario: ScenarioConfig, nowMs: number): VehicleLiveState {
  const unavailable = scenario.unavailableVehicleIds.includes(vehicle.id);
  const normalLatencySec = 5 + Math.round((vehicle.loadSeed * 37) % 10);
  const staleSec = unavailable ? UNAVAILABLE_AGE_SEC : (scenario.staleVehicleSec[vehicle.id] ?? normalLatencySec);
  const reportedAtMs = nowMs - staleSec * 1000;

  const raw = positionAt(net, vehicle, scenario.disruption, reportedAtMs);
  const { position, bearingDeg } = pointAlong(raw.variant.shape, raw.variant.shapeCumM, raw.distanceAlongM);
  const quality: DataQuality = unavailable ? 'unavailable' : staleSec > STALE_THRESHOLD_SEC ? 'delayed' : 'live';
  const passengers = unavailable
    ? null
    : estimatePassengers(vehicle, scenario, reportedAtMs, raw.distanceAlongM / Math.max(1, raw.variant.lengthM));

  return {
    vehicleId: vehicle.id,
    routeId: vehicle.routeId,
    variantId: raw.variant.id,
    direction: raw.variant.direction,
    status: raw.status,
    position,
    bearingDeg,
    distanceAlongM: raw.distanceAlongM,
    nextStopIndex: raw.nextStopIndex,
    atStopIndex: raw.atStopIndex,
    layoverRemainingSec: Math.round(raw.layoverRemainingSec),
    passengers,
    crowd: crowdLevelFor(passengers, vehicle.seats, vehicle.capacity),
    quality,
    lastUpdatedMs: reportedAtMs,
    staleSec,
    predictions: buildPredictions(raw, staleSec, !unavailable),
  };
}

export function computeSnapshot(
  net: TransitNetwork,
  scenario: ScenarioConfig,
  nowMs: number,
  staticNotices: ServiceNotice[],
): LiveSnapshot {
  return {
    generatedAtMs: nowMs,
    scenarioId: scenario.id,
    vehicles: net.vehicles.map((v) => simulateVehicle(net, v, scenario, nowMs)),
    notices: [...scenario.notices, ...staticNotices],
    disruption: scenario.disruption,
  };
}