import { AlertTriangle, CheckCircle2, Info, X, type LucideIcon } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type ToastTone = 'info' | 'success' | 'warning';
type ShowToast = (message: string, tone?: ToastTone) => void;

interface ToastItem { id: number; message: string; tone: ToastTone }

const ToastContext = createContext<ShowToast>(() => undefined);
export const useToast = () => useContext(ToastContext);

const TONE: Record<ToastTone, { Icon: LucideIcon; cls: string }> = {
  info: { Icon: Info, cls: 'text-sky-700' },
  success: { Icon: CheckCircle2, cls: 'text-emerald-700' },
  warning: { Icon: AlertTriangle, cls: 'text-amber-700' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, number>());
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback<ShowToast>(
    (message, tone = 'info') => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-2), { id, message, tone }]);
      timers.current.set(id, window.setTimeout(() => dismiss(id), 4500));
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => window.clearTimeout(t));
      map.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 top-3 z-[1400] flex flex-col items-center gap-2 px-3">
        {items.map((t) => {
          const { Icon, cls } = TONE[t.tone];
          return (
            <div key={t.id} className="pointer-events-auto flex w-full max-w-md items-start gap-2 rounded-2xl bg-white p-3 text-sm shadow-lg ring-1 ring-slate-200">
              <Icon aria-hidden className={`mt-0.5 h-5 w-5 shrink-0 ${cls}`} />
              <p className="flex-1">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="ปิดข้อความ" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100">
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}