import { Star } from 'lucide-react';
import { useFavorites } from '../hooks/useFavorites';
import { useToast } from './ui/Toast';

export function FavoriteButton({ kind, id, labelTh }: { kind: 'stop' | 'variant'; id: string; labelTh: string }) {
  const fav = useFavorites();
  const toast = useToast();
  const active = kind === 'stop' ? fav.isStopFavorite(id) : fav.isVariantFavorite(id);

  const onClick = () => {
    if (kind === 'stop') fav.toggleStop(id);
    else fav.toggleVariant(id);
    toast(active ? `นำ${labelTh}ออกจากรายการโปรดแล้ว` : `บันทึก${labelTh}ในรายการโปรดแล้ว (เก็บในเครื่องนี้)`, 'success');
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? `นำ${labelTh}ออกจากรายการโปรด` : `บันทึก${labelTh}เป็นรายการโปรด`}
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-medium ring-1 ring-slate-300 hover:bg-slate-50"
    >
      <Star aria-hidden className={`h-4 w-4 ${active ? 'fill-amber-400 text-amber-500' : 'text-ink-muted'}`} />
      {active ? 'บันทึกแล้ว' : 'บันทึก'}
    </button>
  );
}