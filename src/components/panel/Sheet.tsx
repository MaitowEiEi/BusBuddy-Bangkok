import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent, type ReactNode } from 'react';

const SNAPS = [0.32, 0.58, 0.92];
const SNAP_LABELS = ['ย่อ', 'ครึ่งจอ', 'เต็มจอ'];

interface DragState { startY: number; startFrac: number; height: number; frac: number; moved: boolean }

/** Mobile bottom sheet: tap the handle to cycle sizes, or drag it. */
export function Sheet({ children, viewKey, insetRef }: { children: ReactNode; viewKey: string; insetRef: MutableRefObject<number> }) {
  const ref = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState(1);
  const [dragFrac, setDragFrac] = useState<number | null>(null);
  const drag = useRef<DragState | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    if (viewKey !== 'home') setSnap((s) => Math.max(s, 1));
    scrollRef.current?.scrollTo({ top: 0 });
  }, [viewKey]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { insetRef.current = el.offsetHeight; });
    ro.observe(el);
    return () => { ro.disconnect(); insetRef.current = 0; };
  }, [insetRef]);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startFrac: SNAPS[snap], height: parent.clientHeight, frac: SNAPS[snap], moved: false };
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = d.startY - e.clientY;
    if (Math.abs(dy) > 6) d.moved = true;
    if (!d.moved) return;
    d.frac = Math.min(0.95, Math.max(0.2, d.startFrac + dy / d.height));
    setDragFrac(d.frac);
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      const nearest = SNAPS.reduce((best, s, i) => (Math.abs(s - d.frac) < Math.abs(SNAPS[best] - d.frac) ? i : best), 0);
      setSnap(nearest);
      suppressClick.current = true;
    }
    setDragFrac(null);
  };

  const onClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setSnap((s) => (s === SNAPS.length - 1 ? 0 : s + 1));
  };

  return (
    <section
      ref={ref}
      aria-label="แผงข้อมูลการเดินทาง"
      className={`absolute inset-x-0 bottom-0 z-[1100] flex flex-col rounded-t-3xl bg-white shadow-sheet ${dragFrac === null ? 'transition-[height] duration-200' : ''}`}
      style={{ height: `${(dragFrac ?? SNAPS[snap]) * 100}%` }}
    >
      <button
        type="button"
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label={`ขนาดแผงข้อมูล: ${SNAP_LABELS[snap]} — แตะเพื่อเปลี่ยนขนาด`}
        className="flex h-9 w-full shrink-0 touch-none items-center justify-center rounded-t-3xl"
      >
        <span aria-hidden className="h-1.5 w-12 rounded-full bg-slate-300" />
      </button>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        {children}
      </div>
    </section>
  );
}