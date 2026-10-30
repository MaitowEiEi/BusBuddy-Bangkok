import { Star } from 'lucide-react';
import { useFavorites } from '../hooks/useFavorites';
import { useApp } from '../state/AppContext';
import type { RouteVariant, Stop } from '../types/transit';
import { StopRow } from './panel/StopRow';
import { DirectionBadge, RouteBadge, ShortTurnBadge } from './ui/Badges';
import { Section } from './ui/Section';

export function FavoritesSection() {
  const { network, navigate } = useApp();
  const { favorites } = useFavorites();
  const stops = favorites.stopIds.map((id) => network.stopById[id]).filter((s): s is Stop => Boolean(s));
  const variants = favorites.variantIds.map((id) => network.variantById[id]).filter((v): v is RouteVariant => Boolean(v));

  return (
    <Section title="รายการโปรด">
      {stops.length === 0 && variants.length === 0 ? (
        <p className="px-4 text-sm text-ink-muted">
          ยังไม่มีรายการโปรด กดปุ่ม “บันทึก” ในหน้าป้ายหรือหน้าเส้นทางเพื่อเก็บไว้ที่นี่ (เก็บเฉพาะในเบราว์เซอร์นี้)
        </p>
      ) : (
        <div className="space-y-2">
          {stops.length > 0 && (
            <ul aria-label="ป้ายโปรด" className="divide-y divide-slate-100">
              {stops.map((s) => <StopRow key={s.id} stop={s} />)}
            </ul>
          )}
          {variants.length > 0 && (
            <ul aria-label="สายโปรด" className="space-y-2 px-4">
              {variants.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => navigate({ kind: 'route', variantId: v.id })}
                    className="flex min-h-12 w-full flex-wrap items-center gap-2 rounded-xl p-3 text-left ring-1 ring-slate-200 hover:bg-slate-50"
                  >
                    <Star aria-hidden className="h-4 w-4 fill-amber-400 text-amber-500" />
                    <RouteBadge route={network.routeById[v.routeId]} size="sm" />
                    <span className="font-medium">{v.headsignTh}</span>
                    <DirectionBadge direction={v.direction} />
                    {v.isShortTurn && <ShortTurnBadge />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Section>
  );
}