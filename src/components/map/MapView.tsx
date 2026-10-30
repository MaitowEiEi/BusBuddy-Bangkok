import { List, Map as MapIcon, Network } from 'lucide-react';
import { useCallback, useMemo, useState, type MutableRefObject } from 'react';
import { useApp } from '../../state/AppContext';
import { usePlanPreview } from '../../state/planPreview';
import { viewKey } from '../../types/ui';
import { useToast } from '../ui/Toast';
import { LeafletMap } from './LeafletMap';
import { buildScene, type MapTarget } from './mapModel';
import { SchematicMap } from './SchematicMap';
import './map.css';

const CONTROL_BTN =
  'inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-medium text-ink shadow-md ring-1 ring-slate-300 hover:bg-slate-50';

export function MapView({ insetRef }: { insetRef: MutableRefObject<number> }) {
  const { network, snapshot, view, origin, navigate } = useApp();
  const toast = useToast();
  const preview = usePlanPreview();
  const [mode, setMode] = useState<'map' | 'schematic'>(() => (navigator.onLine ? 'map' : 'schematic'));
  const [tilesFailed, setTilesFailed] = useState(() => !navigator.onLine);

  const planPreview = view.kind === 'plan' ? preview : null;
  const scene = useMemo(
    () => buildScene(network, view, snapshot, origin, planPreview),
    [network, view, snapshot, origin, planPreview],
  );
  const fitKey = `${viewKey(view)}|${origin ? origin.position.join(',') : '-'}|${planPreview?.fitKey ?? ''}`;

  const onSelect = useCallback(
    (t: MapTarget) => {
      if (t.kind === 'stop') navigate({ kind: 'stop', stopId: t.id });
      else if (t.kind === 'variant') navigate({ kind: 'route', variantId: t.id });
      else navigate({ kind: 'vehicle', vehicleId: t.id });
    },
    [navigate],
  );

  const onTilesFailed = useCallback(() => {
    setTilesFailed(true);
    setMode('schematic');
    toast('โหลดแผนที่ไม่สำเร็จ จึงแสดงแผนผังเส้นทางแบบย่อแทน', 'warning');
  }, [toast]);

  const toggleMode = () => {
    if (mode === 'schematic') {
      setTilesFailed(false);
      setMode('map');
    } else {
      setMode('schematic');
    }
  };

  return (
    <div className="absolute inset-0">
      {mode === 'map' ? (
        <LeafletMap
          network={network}
          snapshot={snapshot}
          scene={scene}
          fitKey={fitKey}
          origin={origin}
          insetRef={insetRef}
          onSelect={onSelect}
          onTilesFailed={onTilesFailed}
        />
      ) : (
        <SchematicMap network={network} snapshot={snapshot} scene={scene} origin={origin} insetRef={insetRef} onSelect={onSelect} />
      )}

      <div className={`absolute left-2.5 z-[1000] flex flex-col items-start gap-2 ${mode === 'map' ? 'top-[5.5rem]' : 'top-2.5'}`}>
        <button type="button" onClick={toggleMode} className={CONTROL_BTN}>
          {mode === 'map' ? <Network aria-hidden className="h-4 w-4" /> : <MapIcon aria-hidden className="h-4 w-4" />}
          {mode === 'map' ? 'แผนผังแบบย่อ' : tilesFailed ? 'ลองโหลดแผนที่อีกครั้ง' : 'แสดงแผนที่'}
        </button>
        <button type="button" onClick={() => navigate({ kind: 'vehicles' })} className={CONTROL_BTN}>
          <List aria-hidden className="h-4 w-4" />
          รายการรถ
        </button>
      </div>

      {mode === 'schematic' && (
        <p className="absolute right-2.5 top-2.5 z-[1000] max-w-[55%] rounded-xl bg-white/95 px-3 py-2 text-xs text-ink-soft shadow ring-1 ring-slate-200">
          {tilesFailed ? 'โหลดแผนที่ไม่ได้ จึงแสดงแผนผังแบบย่อ' : 'มุมมองแผนผังแบบย่อ'} — ตำแหน่งโดยประมาณ ไม่ใช่แผนที่จริง
        </p>
      )}
    </div>
  );
}