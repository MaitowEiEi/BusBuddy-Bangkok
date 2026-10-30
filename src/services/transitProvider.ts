import type { LiveSnapshot, ScenarioId, TransitNetwork } from '../types/transit';

/**
 * Boundary between UI and data. A real implementation would load static network data
 * (e.g. GTFS) and poll a realtime feed (e.g. GTFS-Realtime) returning the same shapes.
 */
export interface TransitDataProvider {
  readonly id: string;
  readonly isSimulated: boolean;
  loadNetwork(): Promise<TransitNetwork>;
  getLiveSnapshot(nowMs: number, scenarioId: ScenarioId): Promise<LiveSnapshot>;
}