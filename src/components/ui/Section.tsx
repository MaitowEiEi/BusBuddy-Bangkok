import { useId, type ReactNode } from 'react';

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-4">
        <h3 id={id} className="text-base font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}