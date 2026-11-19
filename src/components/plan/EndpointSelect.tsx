import { LocateFixed, MapPin, Search, Signpost, TrainFront, X, type LucideIcon } from 'lucide-react';
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { searchNetwork } from '../../domain/search';
import { useApp } from '../../state/AppContext';
import { resolveEndpoint } from './planUi';
import { pickName, useLang, useT } from '../../lib/i18n';

interface Option {
  value: string; // "origin" | "stop:<id>" | "place:<id>"
  titleTh: string;
  subtitleTh: string;
  kindTh: string;
  Icon: LucideIcon;
}

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const SUGGESTED_PLACES = 6;
const MAX_RESULTS = 8;

/** Type-to-search picker for stops, stations and places. */
export function EndpointSelect({ label, value, onChange }: Props) {
  const { network, origin } = useApp();
  const lang = useLang();
  const tr = useT();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const listId = useId();

  const current = useMemo(() => resolveEndpoint(network, origin, value, lang), [network, origin, value, lang]);
  const q = query.trim();

  const options = useMemo<Option[]>(() => {
    const en = lang === 'en';
    const out: Option[] = [];
    const originLabel = resolveEndpoint(network, origin, 'origin', lang)?.labelTh;
    const ql = q.toLowerCase();
    if (origin && originLabel && (!q || originLabel.toLowerCase().includes(ql) || 'ตำแหน่งของฉัน'.includes(q) || 'my location'.includes(ql))) {
      out.push({
        value: 'origin',
        titleTh: originLabel,
        subtitleTh: en ? 'Start point set on the home screen' : 'จุดเริ่มต้นที่ตั้งไว้ในหน้าหลัก',
        kindTh: en ? 'Location' : 'ตำแหน่ง',
        Icon: LocateFixed,
      });
    }
    if (!q) {
      for (const p of network.places.slice(0, SUGGESTED_PLACES)) {
        out.push({
          value: `place:${p.id}`,
          titleTh: pickName(lang, p.nameTh, p.nameEn),
          subtitleTh: pickName(lang, p.categoryTh, p.categoryEn),
          kindTh: en ? 'Place' : 'สถานที่',
          Icon: MapPin,
        });
      }
      return out;
    }
    for (const r of searchNetwork(network, q, { limit: MAX_RESULTS, kinds: ['stop', 'place'], lang })) {
      if (r.kind === 'route') continue;
      const rail = r.kind === 'stop' && r.rail;
      out.push({
        value: `${r.kind}:${r.id}`,
        titleTh: r.titleTh,
        subtitleTh: r.subtitleTh,
        kindTh: r.kind === 'place' ? (en ? 'Place' : 'สถานที่') : rail ? (en ? 'Station' : 'สถานี') : en ? 'Stop' : 'ป้าย',
        Icon: r.kind === 'place' ? MapPin : rail ? TrainFront : Signpost,
      });
    }
    return out;
  }, [network, origin, q, lang]);

  const choose = (o: Option) => {
    onChange(o.value);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && open && options[active]) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showClear = open ? query.length > 0 : value.length > 0;

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm font-semibold text-ink">{label}</label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          value={open ? query : current?.labelTh ?? ''}
          placeholder={open && current ? current.labelTh : tr('พิมพ์ชื่อป้าย สถานี หรือสถานที่', 'Type a stop, station or place')}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
            setActive(0);
            // Keep the box visible above the on-screen keyboard on phones.
            window.setTimeout(() => inputRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 250);
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          className="h-12 w-full rounded-2xl bg-slate-100 pl-10 pr-11 text-base placeholder:text-ink-muted focus:bg-white"
        />
        {showClear && (
          <button
            type="button"
            aria-label={open ? tr('ล้างคำค้นหา', 'Clear search') : tr(`ล้างช่อง${label}`, `Clear ${label}`)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (open ? setQuery('') : onChange(''))}
            className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl hover:bg-slate-200"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 rounded-2xl bg-white p-1 shadow-lg ring-1 ring-slate-200">
          {options.length === 0 ? (
            <p role="status" className="p-3 text-sm text-ink-soft">
              {tr(`ไม่พบ “${q}” ลองพิมพ์สั้นลง เช่น สยาม อโศก สีลม หรือชื่อสถานี BTS/MRT`, `No match for “${q}”. Try a shorter name such as Siam, Asok or Silom`)}
            </p>
          ) : (
            <>
              {!q && <p className="px-3 pt-2 text-xs text-ink-muted">{tr('พิมพ์เพื่อค้นหา หรือเลือกจากรายการ', 'Type to search, or pick one below')}</p>}
              <ul id={listId} role="listbox" aria-label={tr(`ตัวเลือกสำหรับช่อง${label}`, `Options for ${label}`)}>
                {options.map((o, i) => (
                  <li
                    key={o.value}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o)}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ${i === active ? 'bg-brand-50' : ''}`}
                  >
                    <o.Icon aria-hidden className="h-5 w-5 shrink-0 text-brand-700" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{o.titleTh}</span>
                      <span className="block text-xs text-ink-muted">{o.subtitleTh}</span>
                    </span>
                    <span className="text-xs text-ink-muted">{o.kindTh}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}