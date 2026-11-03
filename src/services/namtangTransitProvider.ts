import { SCENARIOS } from '../data/scenarios';
import { getNamtangSourceInfo, loadNamtangNetwork } from '../data/namtangAdapter';
import { computeSnapshot } from '../sim/simulation';
import type { LiveSnapshot, ScenarioId, TransitNetwork } from '../types/transit';
import type { TransitDataProvider } from './transitProvider';

let cachedNetwork: TransitNetwork | null = null;

function getNetwork(): TransitNetwork {
  if (!cachedNetwork) cachedNetwork = loadNamtangNetwork();
  return cachedNetwork!;
}

export const namtangTransitProvider: TransitDataProvider = {
  id: 'namtang-gtfs',
  isSimulated: true,
  loadNetwork: async () => getNetwork(),
  getLiveSnapshot: async (nowMs, _scenarioId: ScenarioId): Promise<LiveSnapshot> =>
    computeSnapshot(getNetwork(), SCENARIOS.normal, nowMs, []),
};

export { getNamtangSourceInfo };