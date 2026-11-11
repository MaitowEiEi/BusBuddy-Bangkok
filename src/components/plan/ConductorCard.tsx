import { Hand, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatFareRange } from '../../lib/format';
import { btn } from '../ui/buttonStyles';

interface Props {
  routeShortName: string;
  stopName: string; // without the "ป้าย" prefix
  fare: [number, number] | null;
}

/** Full-screen card to show the conductor instead of asking out loud. */
export function ConductorCard({ routeShortName, stopName, fare }: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const opener = openerRef.current;
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [open]);

  return (
    <>
      <button ref={openerRef} type="button" onClick={() => setOpen(true)} className={btn.secondary}>
        <Hand aria-hidden className="h-4 w-4" />
        การ์ดยื่นให้พนักงาน
      </button>
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed inset-0 z-[2000] flex flex-col bg-white p-6 text-ink"
          >
            <div className="flex justify-end">
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-12 items-center gap-1.5 rounded-xl bg-slate-100 px-4 font-semibold hover:bg-slate-200"
              >
                <X aria-hidden className="h-5 w-5" />
                ปิด
              </button>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
              <p className="text-2xl text-ink-soft">ขอลงที่</p>
              <h2 id={titleId} className="break-words text-5xl font-bold leading-tight sm:text-6xl">
                ป้าย{stopName}
              </h2>
              <p className="rounded-2xl bg-brand-700 px-5 py-2 text-3xl font-bold text-white">สาย {routeShortName}</p>
              <p className="text-2xl">รบกวนบอกด้วยเมื่อถึงป้ายนี้</p>
              {fare && <p className="text-xl text-ink-soft">ค่าโดยสารประมาณ {formatFareRange(fare)}</p>}
            </div>
            <p className="text-center text-sm text-ink-muted">เพิ่มความสว่างหน้าจอ แล้วยื่นให้พนักงานดู</p>
          </div>,
          document.body,
        )}
    </>
  );
}