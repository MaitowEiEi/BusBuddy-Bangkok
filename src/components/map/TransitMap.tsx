import { Box, Map as MapIcon } from 'lucide-react';
import { lazy, Suspense, useState, type ComponentProps } from 'react';
import { useT } from '../../lib/i18n';
import { LeafletMap } from './LeafletMap';
import { useWalkingPaths } from './walkingRoute';

// Loaded only when someone turns on 3D, so 2D users never download MapLibre.
const MapLibreMap = lazy(() => import('./MapLibreMap').then((m) => ({ default: m.MapLibreMap })));

type Props = ComponentProps<typeof LeafletMap>;
const KEY = 'busbuddy.map3d';

function webglSupported(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
const CAN_3D = typeof document !== 'undefined' && webglSupported();

function initial3d(): boolean {
  try {
    return CAN_3D && localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function TransitMap(props: Props) {
  const tr = useT();
  const [is3d, setIs3d] = useState(initial3d);
  const walks = useWalkingPaths(props.scene.walks);
  const mapProps = { ...props, scene: { ...props.scene, walks } };

  const toggle = () => {
    const next = !is3d;
    setIs3d(next);
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      // Not saved; still switches now.
    }
  };

  return (
    <div className="relative h-full w-full">
      {is3d ? (
        <Suspense
          fallback={
            <div className="grid h-full w-full place-items-center bg-slate-100 text-sm text-ink-soft">
              {tr('กำลังโหลดแผนที่ 3 มิติ…', 'Loading 3D map…')}
            </div>
          }
        >
          <MapLibreMap {...mapProps} />
        </Suspense>
      ) : (
        <LeafletMap {...mapProps} />
      )}
      {CAN_3D && (
        <button
          type="button"
          onClick={toggle}
          aria-pressed={is3d}
          aria-label={is3d ? tr('กลับไปแผนที่ 2 มิติ', 'Back to 2D map') : tr('แสดงแผนที่ 3 มิติ', 'Show 3D map')}
          className="absolute right-3 top-10 z-[1100] inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-semibold text-ink shadow-md ring-1 ring-slate-200 hover:bg-slate-50"
        >
          {is3d ? <MapIcon aria-hidden className="h-4 w-4" /> : <Box aria-hidden className="h-4 w-4" />}
          {is3d ? '2D' : '3D'}
        </button>
      )}
    </div>
  );
}