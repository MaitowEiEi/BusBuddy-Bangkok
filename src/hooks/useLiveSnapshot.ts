import { useCallback, useEffect, useState } from 'react';
import type { TransitDataProvider } from '../services/transitProvider';
import type { LiveSnapshot, ScenarioId } from '../types/transit';

export const LIVE_REFRESH_MS = 5000;

/** Polls live data. Holds no selection state, so refreshes never reset what the user selected. */
export function useLiveSnapshot(provider: TransitDataProvider, scenarioId: ScenarioId, enabled: boolean, intervalMs = LIVE_REFRESH_MS) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const tick = () => {
      provider
        .getLiveSnapshot(Date.now(), scenarioId)
        .then((s) => { if (!cancelled) { setSnapshot(s); setError(null); } })
        .catch(() => { if (!cancelled) setError('โหลดข้อมูลรถไม่สำเร็จ'); });
    };
    tick();
    const id = window.setInterval(() => { if (!document.hidden) tick(); }, intervalMs);
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [provider, scenarioId, enabled, intervalMs, nonce]);

  return { snapshot, error, refresh };
}