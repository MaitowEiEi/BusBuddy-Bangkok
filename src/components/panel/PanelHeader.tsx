import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useT } from '../../lib/i18n';
import { useApp } from '../../state/AppContext';

export function PanelHeader({
  title,
  subtitle,
  leading,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
}) {
  const { canGoBack, goBack, goHome } = useApp();
  const tr = useT();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="flex items-start gap-2 border-b border-slate-100 px-2 pb-3 pt-1 lg:pt-3">
      <button
        type="button"
        onClick={canGoBack ? goBack : goHome}
        aria-label={tr('ย้อนกลับ', 'Back')}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-slate-100"
      >
        <ChevronLeft aria-hidden className="h-6 w-6" />
      </button>
      <div className="min-w-0 flex-1 pt-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {leading}
          <h2 ref={headingRef} tabIndex={-1} className="break-words text-lg font-bold leading-snug">
            {title}
          </h2>
        </div>
        {subtitle && <p className="text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="pt-0.5">{actions}</div>}
    </div>
  );
}

export function NotFoundPanel({ title }: { title: string }) {
  const tr = useT();
  return (
    <div>
      <PanelHeader title={title} />
      <p className="p-4 text-sm text-ink-muted">
        {tr(
          'ข้อมูลนี้อาจถูกเปลี่ยนหรือลบจากชุดข้อมูลจำลอง',
          'This item may have been updated or removed from the dataset.',
        )}
      </p>
    </div>
  );
}
