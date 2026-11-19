import { setLang, useLang, type Lang } from '../lib/i18n';

const OPTIONS: { value: Lang; label: string }[] = [
  { value: 'th', label: 'ไทย' },
  { value: 'en', label: 'EN' },
];

export function LangToggle() {
  const current = useLang();
  return (
    <div role="group" aria-label="ภาษา / Language" className="inline-flex rounded-xl bg-slate-100 p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          lang={o.value}
          aria-pressed={current === o.value}
          onClick={() => setLang(o.value)}
          className={`min-h-10 min-w-11 rounded-lg px-2 text-sm font-semibold ${
            current === o.value ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-soft hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}