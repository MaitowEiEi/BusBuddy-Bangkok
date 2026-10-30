import { ChevronRight, Footprints, MapPin } from 'lucide-react';
import { useMemo } from 'react';
import { arrivalsForStop } from '../../domain/arrivals';
import { routeIdsAtStop } from '../../domain/lookup';
import { formatDistance, formatEtaRange } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import type { Stop } from '../../types/transit';
import { RouteBadge } from '../ui/Badges';

export function StopRow({ stop, distanceM, walkMin }: { stop: Stop; distanceM?: number; walkMin?: number }) {
  const { network, snapshot, navigate } = useApp();
  const routeIds = routeIdsAtStop(network, stop.id);
  const next = useMemo(() => (snapshot ? arrivalsForStop(network, snapshot, stop.id)[0] : undefined), [network, snapshot, stop.id]);

  return (
    <li>
      <button type="button" onClick={() => navigate({ kind: 'stop', stopId: stop.id })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
          <MapPin aria-hidden className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{stop.nameTh}</span>
          <span className="mt-1 flex flex-wrap gap-1">
            {routeIds.map((id) => <RouteBadge key={id} route={network.routeById[id]} size="sm" />)}
          </span>
          <span className="mt-1 block text-xs text-ink-muted">
            {next
              ? `คันถัดไป: ${network.routeById[next.routeId].shortName} ${formatEtaRange(next.etaRange)}`
              : snapshot
                ? 'ไม่มีรถที่คาดว่าจะถึงใน 60 นาที'
                : 'กำลังโหลดข้อมูลรถ…'}
          </span>
        </span>
        {distanceM !== undefined && (
          <span className="shrink-0 text-right text-xs text-ink-soft">
            <Footprints aria-hidden className="ml-auto h-4 w-4" />
            {formatDistance(distanceM)}
            {walkMin !== undefined && <span className="block">~{walkMin} นาที</span>}
          </span>
        )}
        <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-slate-400" />
      </button>
    </li>
  );
}