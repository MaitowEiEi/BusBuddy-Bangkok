import { AlertOctagon, AlertTriangle, Info, XCircle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type BannerTone = 'info' | 'warning' | 'error' | 'disruption' | 'neutral';

const STYLE: Record<BannerTone, { cls: string; Icon: LucideIcon; role?: 'alert' }> = {
  info: { cls: 'bg-sky-50 text-sky-900 ring-sky-200', Icon: Info },
  warning: { cls: 'bg-amber-50 text-amber-950 ring-amber-300', Icon: AlertTriangle },
  error: { cls: 'bg-red-50 text-red-900 ring-red-200', Icon: XCircle, role: 'alert' },
  disruption: { cls: 'bg-red-50 text-red-900 ring-red-300', Icon: AlertOctagon, role: 'alert' },
  neutral: { cls: 'bg-slate-100 text-slate-800 ring-slate-200', Icon: Info },
};

export function Banner({ tone, title, children }: { tone: BannerTone; title?: string; children?: ReactNode }) {
  const { cls, Icon, role } = STYLE[tone];
  return (
    <div role={role} className={`flex gap-2 rounded-xl px-3 py-2 text-sm ring-1 ${cls}`}>
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}