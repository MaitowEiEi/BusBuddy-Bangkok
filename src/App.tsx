import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { MapView } from './components/map/MapView';
import { PanelRouter } from './components/panel/PanelRouter';
import { Sheet } from './components/panel/Sheet';
import { ToastProvider } from './components/ui/Toast';
import { isScenarioId } from './data/scenarios';
import { validateNetwork } from './domain/validate';
import { useLiveSnapshot } from './hooks/useLiveSnapshot';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useNetwork } from './hooks/useNetwork';
import { useNow } from './hooks/useNow';
import { usePreferences } from './hooks/usePreferences';
import { STORAGE_KEYS } from './lib/storage';
import { mockTransitProvider } from './services/mockTransitProvider';
import { AppContext, type AppContextValue } from './state/AppContext';
import type { ScenarioId, TransitNetwork } from './types/transit';
import { viewKey, type Origin, type PanelView } from './types/ui';

const HOME: PanelView = { kind: 'home' };
const MAX_HISTORY = 20;

function FullScreenMessage({ text, isError = false }: { text: string; isError?: boolean }) {
  return (
    <div className="grid h-dvh place-items-center p-6 text-center">
      <p role={isError ? 'alert' : 'status'} className={isError ? 'text-red-700' : 'text-ink-soft'}>{text}</p>
    </div>
  );
}

export default function App() {
  const { network, error } = useNetwork(mockTransitProvider);
  if (error) return <FullScreenMessage text={error} isError />;
  if (!network) return <FullScreenMessage text="กำลังโหลดข้อมูลเส้นทางจำลอง…" />;
  return (
    <ToastProvider>
      <AppShell network={network} />
    </ToastProvider>
  );
}

function AppShell({ network }: { network: TransitNetwork }) {
  const [scenarioId, setScenarioId] = useLocalStorage<ScenarioId>(STORAGE_KEYS.scenario, 'normal', isScenarioId);
  const { snapshot, error: liveError, refresh } = useLiveSnapshot(mockTransitProvider, scenarioId, true);
  const now = useNow(1000);
  const [prefs, setPrefs] = usePreferences();
  const [gpsOrigin, setGpsOrigin] = useState<Origin | null>(null);
  const [history, setHistory] = useState<PanelView[]>([HOME]);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const insetRef = useRef(0);
  const panelScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const issues = validateNetwork(network);
    if (issues.length > 0) console.warn('[BusBuddy] ข้อมูลจำลองไม่สอดคล้อง', issues);
  }, [network]);

  const view = history[history.length - 1];
  const key = viewKey(view);

  const navigate = useCallback(
    (next: PanelView) =>
      setHistory((h) => (viewKey(h[h.length - 1]) === viewKey(next) ? h : [...h, next].slice(-MAX_HISTORY))),
    [],
  );
  const goBack = useCallback(() => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h)), []);
  const goHome = useCallback(() => setHistory([HOME]), []);

  // GPS origins stay in memory only; manual and demo origins are saved locally.
  const origin = gpsOrigin ?? prefs.origin;
  const setOrigin = useCallback(
    (o: Origin | null) => {
      if (o?.kind === 'gps') {
        setGpsOrigin(o);
        return;
      }
      setGpsOrigin(null);
      setPrefs((p) => ({ ...p, origin: o }));
    },
    [setPrefs],
  );

  useEffect(() => {
    panelScrollRef.current?.scrollTo({ top: 0 });
  }, [key]);

  const value = useMemo<AppContextValue>(
    () => ({
      network, snapshot, liveError, refreshLive: refresh, now, scenarioId, setScenarioId,
      view, canGoBack: history.length > 1, navigate, goBack, goHome, origin, setOrigin,
    }),
    [network, snapshot, liveError, refresh, now, scenarioId, setScenarioId, view, history.length, navigate, goBack, goHome, origin, setOrigin],
  );

  return (
    <AppContext.Provider value={value}>
      <a
        href="#bb-panel"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[1500] focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:shadow-lg"
      >
        ข้ามไปที่ข้อมูลการเดินทาง
      </a>
      {isDesktop ? (
        <div className="flex h-dvh">
          <div className="flex w-[26rem] shrink-0 flex-col border-r border-slate-200 bg-white xl:w-[28rem]">
            <AppHeader />
            <main id="bb-panel" tabIndex={-1} ref={panelScrollRef} className="min-h-0 flex-1 overflow-y-auto">
              <PanelRouter />
            </main>
          </div>
          <section aria-label="แผนที่" className="relative min-w-0 flex-1">
            <MapView insetRef={insetRef} />
          </section>
        </div>
      ) : (
        <div className="flex h-dvh flex-col">
          <AppHeader />
          <main className="relative min-h-0 flex-1 overflow-hidden">
            <MapView insetRef={insetRef} />
            <Sheet viewKey={key} insetRef={insetRef}>
              <div id="bb-panel" tabIndex={-1}>
                <PanelRouter />
              </div>
            </Sheet>
          </main>
        </div>
      )}
    </AppContext.Provider>
  );
}