export type LatLng = [number, number];
export type Direction = 'outbound' | 'inbound';
export type ServiceType = 'ac' | 'non_ac';
export type CrowdLevel = 'seats' | 'standing' | 'crowded' | 'unknown';
export type DataQuality = 'live' | 'delayed' | 'unavailable';
export type ScenarioId = 'normal' | 'delayed_data' | 'crowded' | 'unknown_eta' | 'disruption';
export type VehicleStatus = 'layover' | 'moving' | 'at_stop';
export type VehicleType = 'ev_low_floor' | 'ac_standard' | 'non_ac_standard';

export interface Stop {
  id: string;
  code: string; // fictional display code
  nameTh: string;
  areaTh: string;
  position: LatLng;
  keywords: string[];
}

export interface Place {
  id: string;
  nameTh: string;
  categoryTh: string;
  position: LatLng;
  keywords: string[];
}

export type FareRule =
  | { kind: 'flat'; amountThb: number }
  | { kind: 'distance'; baseThb: number; stepThb: number; stopsPerStep: number; maxThb: number };

export interface FrequencyPeriod {
  labelTh: string;
  from: string; // HH:mm (Asia/Bangkok)
  to: string;
  headwayMin: [number, number];
}

export interface Route {
  id: string;
  shortName: string;
  nameTh: string;
  serviceType: ServiceType;
  color: string;
  avgSpeedKmh: number;
  fare: FareRule;
  firstDeparture: string;
  lastDeparture: string;
  frequency: FrequencyPeriod[];
}

export type PathPoint = { stopId: string } | { via: LatLng };

export interface RouteVariantDef {
  id: string;
  routeId: string;
  direction: Direction;
  isShortTurn: boolean;
  variantLabelTh: string;
  headsignTh: string;
  path: PathPoint[];
}

export interface RouteVariant extends RouteVariantDef {
  stopIds: string[];
  shape: LatLng[];
  shapeCumM: number[];
  stopDistancesM: number[];
  lengthM: number;
}

export interface Accessibility {
  lowFloor: boolean;
  ramp: boolean;
  wheelchairSpaces: number;
  audioAnnouncements: boolean;
  visualDisplay: boolean;
}

export interface Vehicle {
  id: string;
  fleetCode: string; // fictional, not a registration number
  routeId: string;
  blockVariantIds: [string, string]; // runs outbound then inbound, repeatedly
  phase: number; // 0..1 offset within the round-trip cycle
  type: VehicleType;
  seats: number;
  capacity: number;
  accessibility: Accessibility;
  hasOccupancySensor: boolean;
  baseLoad: number;
  loadSeed: number;
}

export interface Disruption {
  id: string;
  titleTh: string;
  detailTh: string;
  affectedRouteIds: string[];
  segmentStopIds: [string, string];
  extraDelayMin: number;
  alternativeHintTh: string;
}

export interface ServiceNotice {
  id: string;
  severity: 'info' | 'warning' | 'disruption';
  routeIds: string[];
  titleTh: string;
  detailTh: string;
}

export interface ScenarioConfig {
  id: ScenarioId;
  labelTh: string;
  descriptionTh: string;
  staleVehicleSec: Record<string, number>;
  unavailableVehicleIds: string[];
  crowdRatioByRoute: Record<string, number>;
  disruption: Disruption | null;
  notices: ServiceNotice[];
}

export interface StopPrediction {
  stopId: string;
  stopIndex: number;
  etaSec: number | null;
  mayHavePassed: boolean;
  crossesDisruption: boolean;
}

export interface VehicleLiveState {
  vehicleId: string;
  routeId: string;
  variantId: string;
  direction: Direction;
  status: VehicleStatus;
  position: LatLng;
  bearingDeg: number;
  distanceAlongM: number;
  nextStopIndex: number;
  atStopIndex: number | null;
  layoverRemainingSec: number;
  passengers: number | null;
  crowd: CrowdLevel;
  quality: DataQuality;
  lastUpdatedMs: number;
  staleSec: number;
  predictions: StopPrediction[];
}

export interface LiveSnapshot {
  generatedAtMs: number;
  scenarioId: ScenarioId;
  vehicles: VehicleLiveState[];
  notices: ServiceNotice[];
  disruption: Disruption | null;
}

export interface EtaRange {
  minMin: number;
  maxMin: number;
  arriving: boolean;
}

export interface Arrival {
  vehicleId: string;
  routeId: string;
  variantId: string;
  direction: Direction;
  stopId: string;
  stopIndex: number;
  stopsAway: number;
  etaSec: number | null;
  etaRange: EtaRange | null;
  mayHavePassed: boolean;
  crossesDisruption: boolean;
  crowd: CrowdLevel;
  passengers: number | null;
  capacity: number;
  quality: DataQuality;
  lastUpdatedMs: number;
  staleSec: number;
  status: VehicleStatus;
}

export interface TransitNetwork {
  stops: Stop[];
  routes: Route[];
  variants: RouteVariant[];
  vehicles: Vehicle[];
  places: Place[];
  stopById: Record<string, Stop>;
  routeById: Record<string, Route>;
  variantById: Record<string, RouteVariant>;
  vehicleById: Record<string, Vehicle>;
  placeById: Record<string, Place>;
  variantIdsByStop: Record<string, string[]>;
}