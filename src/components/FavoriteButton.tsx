import { Star } from 'lucide-react';
import { useFavorites } from '../hooks/useFavorites';
import { pickName, useLang, useT } from '../lib/i18n';
import { useToast } from './ui/Toast';

export function FavoriteButton({
  kind,
  id,
  labelTh,
  labelEn,
}: {
  kind: 'stop' | 'variant';
  id: string;
  labelTh: string;
  labelEn?: string;
}) {
  const fav = useFavorites();
  const toast = useToast();
  const lang = useLang();
  const tr = useT();
  const active = kind === 'stop' ? fav.isStopFavorite(id) : fav.isVariantFavorite(id);
  const label = pickName(lang, labelTh, labelEn);

  const onClick = () => {
    if (kind === 'stop') fav.toggleStop(id);
    else fav.toggleVariant(id);

    toast(
      active
        ? tr(`นำ${labelTh}ออกจากรายการโปรดแล้ว`, `Removed ${label} from favorites`)
        : tr(
            `บันทึก${labelTh}ในรายการโปรดแล้ว (เก็บในเครื่องนี้)`,
            `Saved ${label} to favorites (stored on this device)`,
          ),
      'success',
    );
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={
        active
          ? tr(`นำ${labelTh}ออกจากรายการโปรด`, `Remove ${label} from favorites`)
          : tr(`บันทึก${labelTh}เป็นรายการโปรด`, `Save ${label} to favorites`)
      }
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-medium ring-1 ring-slate-300 hover:bg-slate-50"
    >
      <Star aria-hidden className={`h-4 w-4 ${active ? 'fill-amber-400 text-amber-500' : 'text-ink-muted'}`} />
      {active ? tr('บันทึกแล้ว', 'Saved') : tr('บันทึก', 'Save')}
    </button>
  );
}
