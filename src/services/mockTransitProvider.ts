import { STATIC_NOTICES } from '../data/notices';
import { PLACES } from '../data/places';
import { ROUTES, VARIANT_DEFS } from '../data/routes';
import { SCENARIOS } from '../data/scenarios';
import { STOPS } from '../data/stops';
import { VEHICLES } from '../data/vehicles';
import { buildNetwork } from '../domain/network';
import { computeSnapshot } from '../sim/simulation';
import type { TransitNetwork } from '../types/transit';
import type { TransitDataProvider } from './transitProvider';

let cachedNetwork: TransitNetwork | null = null;

function getNetwork(): TransitNetwork {
  if (!cachedNetwork) {
    cachedNetwork = buildNetwork({ stops: STOPS, routes: ROUTES, variantDefs: VARIANT_DEFS, vehicles: VEHICLES, places: PLACES });
  }
  return cachedNetwork;
}

export const mockTransitProvider: TransitDataProvider = {
  id: 'mock',
  isSimulated: true,
  loadNetwork: async () => getNetwork(),
  getLiveSnapshot: async (nowMs, scenarioId) =>
    computeSnapshot(getNetwork(), SCENARIOS[scenarioId] ?? SCENARIOS.normal, nowMs, STATIC_NOTICES),
};