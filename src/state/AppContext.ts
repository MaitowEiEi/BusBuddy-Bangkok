import { createContext, useContext } from 'react';
import type { LiveSnapshot, ScenarioId, TransitNetwork } from '../types/transit';
import type { Origin, PanelView } from '../types/ui';

export interface AppContextValue {
  network: TransitNetwork;
  snapshot: LiveSnapshot | null;
  liveError: string | null;
  refreshLive: () => void;
  now: number;
  scenarioId: ScenarioId;
  setScenarioId: (id: ScenarioId) => void;
  view: PanelView;
  canGoBack: boolean;
  navigate: (view: PanelView) => void;
  goBack: () => void;
  goHome: () => void;
  origin: Origin | null;
  setOrigin: (origin: Origin | null) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppContext.Provider');
  return ctx;
}