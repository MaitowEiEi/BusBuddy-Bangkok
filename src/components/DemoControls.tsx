import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { SCENARIO_LIST, SCENARIOS } from '../data/scenarios';
import { useApp } from '../state/AppContext';
import { useToast } from './ui/Toast';

export function DemoControls() {
  const { scenarioId, setScenarioId } = useApp();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLInputElement>('input:checked')?.focus();
    const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 max-w-[12rem] items-center gap-1.5 rounded-xl bg-amber-50 px-3 text-sm font-medium text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
      >
        <SlidersHorizontal aria-hidden className="h-4 w-4 shrink-0" />
        <span className="truncate">เดโม: {SCENARIOS[scenarioId].labelTh}</span>
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="แผงควบคุมเดโม"
          className="absolute right-0 top-full z-[1300] mt-2 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200"
        >
          <fieldset>
            <legend className="font-semibold">จำลองสถานการณ์การเดินรถ</legend>
            <p className="text-xs text-ink-muted">ใช้ทดสอบหน้าจอเท่านั้น ข้อมูลทั้งหมดเป็นข้อมูลจำลอง</p>
            <div className="mt-3 space-y-2">
              {SCENARIO_LIST.map((sc) => {
                const checked = sc.id === scenarioId;
                return (
                  <label key={sc.id} className={`flex cursor-pointer gap-3 rounded-xl p-3 ring-1 ${checked ? 'bg-brand-50 ring-brand-600' : 'ring-slate-200 hover:bg-slate-50'}`}>
                    <input
                      type="radio"
                      name="demo-scenario"
                      value={sc.id}
                      checked={checked}
                      onChange={() => {
                        setScenarioId(sc.id);
                        toast(`เปลี่ยนสถานการณ์จำลองเป็น “${sc.labelTh}”`, 'info');
                      }}
                      className="mt-1 h-4 w-4 accent-brand-700"
                    />
                    <span>
                      <span className="block text-sm font-medium">{sc.labelTh}</span>
                      <span className="block text-xs text-ink-muted">{sc.descriptionTh}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}