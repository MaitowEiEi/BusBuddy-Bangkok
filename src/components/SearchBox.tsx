import { Bus, MapPin, Search, Signpost, TrainFront, X } from 'lucide-react';
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { searchNetwork, type SearchResult } from '../domain/search';
import { useApp } from '../state/AppContext';
import { useLang, useT } from '../lib/i18n';

const KIND_META = {
  route: { label: 'สาย', labelEn: 'Route', Icon: Bus },
  stop: { label: 'ป้าย', labelEn: 'Stop', Icon: Signpost },
  place: { label: 'สถานที่', labelEn: 'Place', Icon: MapPin },
} as const;

export function SearchBox() {
  const { network, navigate } = useApp();
  const lang = useLang();
  const tr = useT();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const listId = useId();

  const results = useMemo(() => searchNetwork(network, query, { lang }), [network, query, lang]);
  const example = useMemo(() => {
    const r = network.routes.find((x) => x.legacyName && x.mode === 'bus') ?? network.routes[0];
    return { short: r?.shortName ?? '', legacy: r?.legacyName };
  }, [network]);
  const hint = example.legacy
    ? tr(`${example.short} หรือเลขเดิม ${example.legacy}`, `${example.short} or the old number ${example.legacy}`)
    : example.short;

  const trimmed = query.trim();
  const showPanel = open && trimmed.length > 0;

  const choose = (r: SearchResult) => {
    if (r.kind === 'route') navigate({ kind: 'route', variantId: r.variantId });
    else if (r.kind === 'stop') navigate({ kind: 'stop', stopId: r.id });
    else navigate({ kind: 'place', placeId: r.id });
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && showPanel && results[active]) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <label htmlFor={inputId} className="sr-only">{tr('ค้นหาสาย ป้าย หรือสถานที่', 'Search routes, stops or places')}</label>
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && results[active] ? `${listId}-${active}` : undefined}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={tr(`ค้นหาสาย (เช่น ${example.short}) ป้าย หรือสถานที่`, `Search a route (e.g. ${example.short}), stop or place`)}
        autoComplete="off"
        className="h-12 w-full rounded-2xl bg-slate-100 pl-10 pr-11 text-base placeholder:text-ink-muted focus:bg-white"
      />
      {query && (
        <button
          type="button"
          aria-label={tr('ล้างคำค้นหา', 'Clear search')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { setQuery(''); inputRef.current?.focus(); }}
          className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl hover:bg-slate-200"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      )}
      {showPanel && (
        <div className="absolute inset-x-0 top-full mt-2 max-h-[60vh] overflow-y-auto rounded-2xl bg-white p-1 shadow-xl ring-1 ring-slate-200">
          {results.length === 0 ? (
            <p role="status" className="p-4 text-sm text-ink-soft">
              {tr('ไม่พบผลลัพธ์สำหรับ', 'No results for')} “{trimmed}”
              <br />
              {tr(`ลองพิมพ์ชื่อป้าย เลขสาย (เช่น ${hint}) หรือสถานที่ เช่น สยาม จุฬา อารีย์`, `Try a stop name, route number (e.g. ${hint}) or a place such as Siam or Chula`)}
            </p>
          ) : (
            <ul id={listId} role="listbox" aria-label={tr('ผลการค้นหา', 'Search results')}>
              {results.map((r, i) => {
                const rail = r.kind !== 'place' && r.rail;
                const Icon = rail ? TrainFront : KIND_META[r.kind].Icon;
                const label = rail
                  ? r.kind === 'route' ? tr('รถไฟฟ้า', 'Rail') : tr('สถานี', 'Station')
                  : tr(KIND_META[r.kind].label, KIND_META[r.kind].labelEn);
                return (
                  <li
                    key={`${r.kind}:${r.id}`}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(r)}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ${i === active ? 'bg-brand-50' : ''}`}
                  >
                    <Icon aria-hidden className="h-5 w-5 shrink-0 text-brand-700" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{r.titleTh}</span>
                      <span className="block text-xs text-ink-muted">{r.subtitleTh}</span>
                    </span>
                    <span className="text-xs text-ink-muted">{label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}