import {
  AlertOctagon, AlertTriangle, Banknote, CalendarClock, ChevronRight, Footprints, ShieldCheck, Shuffle, Users,
  type LucideIcon,
} from 'lucide-react';
import { useId } from 'react';
import type { Itinerary } from '../../domain/planner';
import { formatClockRange, formatDistance, formatFareEstimate } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { CrowdBadge, InfoChip, RouteBadge } from '../ui/Badges';
import { ItinerarySteps } from './ItinerarySteps';
import { routesForLeg } from './planUi';
import { useT } from '../../lib/i18n';

export type DisruptionTag = 'affected' | 'avoids' | null;

interface Props {
  itinerary: Itinerary;
  nowMs: number;
  expanded: boolean;
  onToggle: () => void;
  tags: string[];
  disruptionTag: DisruptionTag;
  destinationLabel: string;
}

export function ItineraryCard({ itinerary: it, nowMs, expanded, onToggle, tags, disruptionTag, destinationLabel }: Props) {
  const { network } = useApp();
  const tr = useT();
  const detailsId = useId();
  const clock = formatClockRange(nowMs, it.range);

  const notes: { key: string; Icon: LucideIcon; cls: string; text: string }[] = [];
  if (it.mode === 'comfort') {
    notes.push({
      key: 'comfort', Icon: Users, cls: 'text-emerald-800',
      text: it.comfortExtraMin
        ? tr(`รอคันที่แน่นน้อยกว่า (ถึงช้ากว่าคันแรกประมาณ ${it.comfortExtraMin} นาที)`, `Waits for a less crowded bus (about ${it.comfortExtraMin} min later)`)
        : tr('เลือกคันที่แน่นน้อยกว่า', 'Picks a less crowded bus'),
    });
  }
  if (it.usesSchedule) {
    notes.push({ key: 'schedule', Icon: CalendarClock, cls: 'text-ink-soft', text: tr('บางช่วงไม่มีข้อมูลรถสด ใช้ความถี่ตามตารางประมาณเวลา', 'No live data for some parts; times use timetable frequency') });
  }
  if (it.catchFeasibility === 'tight' || it.catchFeasibility === 'miss') {
    notes.push({ key: 'catch', Icon: AlertTriangle, cls: 'text-amber-800', text: tr('คันแรกอาจเดินไปไม่ทัน', 'You may miss the first bus')});
  }
  if (it.tightTransfer) {
    notes.push({ key: 'transfer', Icon: AlertTriangle, cls: 'text-amber-800', text: tr('เวลาต่อรถกระชั้น', 'Tight transfer') });
  }

  return (
    <article
      aria-label={tr(`ทางเลือก: ถึงประมาณ ${clock} น.`, `Option: arrive about ${clock}`)}
      className={`rounded-2xl bg-white ${expanded ? 'ring-2 ring-brand-600' : 'ring-1 ring-slate-200'}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={expanded ? detailsId : undefined}
        className="block w-full rounded-2xl p-4 text-left hover:bg-slate-50"
      >
        {(tags.length > 0 || disruptionTag) && (
          <span className="mb-2 flex flex-wrap gap-1">
            {tags.map((t) => (
              <span key={t} className="rounded-full bg-brand-700 px-2.5 py-0.5 text-xs font-semibold text-white">{t}</span>
            ))}
            {disruptionTag === 'avoids' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
                {tr('เลี่ยงจุดขัดข้อง', 'Avoids disruption')}
              </span>
            )}
            {disruptionTag === 'affected' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800 ring-1 ring-red-200">
                <AlertOctagon aria-hidden className="h-3.5 w-3.5" />
                {tr('ผ่านช่วงที่มีเหตุขัดข้อง', 'Passes disruption')}
              </span>
            )}
          </span>
        )}

        <span className="flex flex-wrap items-center gap-1">
          {it.access.distanceM > 0 && <Footprints aria-hidden className="h-4 w-4 text-ink-muted" />}
          {it.legs.map((leg, i) => {
            const routes = routesForLeg(network, leg);
            const shown = routes.slice(0, 3);
            return (
              <span key={`${leg.boardStopId}-${i}`} className="flex items-center gap-1">
                {leg.transferWalk && (
                  <>
                    <ChevronRight aria-hidden className="h-4 w-4 text-slate-400" />
                    <Footprints aria-hidden className="h-4 w-4 text-ink-muted" />
                  </>
                )}
                {(i > 0 || it.access.distanceM > 0) && <ChevronRight aria-hidden className="h-4 w-4 text-slate-400" />}
                {shown.map((r, k) => (
                  <span key={r.id} className="flex items-center gap-1">
                    {k > 0 && <span className="text-xs text-ink-muted">{tr('หรือ', 'or')}</span>}
                    <RouteBadge route={r} size="sm" />
                  </span>
                ))}
                {routes.length > shown.length && (
                  <span className="text-xs text-ink-muted">{tr(`+${routes.length - shown.length} สาย`, `+${routes.length - shown.length} more`)}</span>
                )}
              </span>
            );
          })}
          {it.egress.distanceM > 0 && (
            <>
              <ChevronRight aria-hidden className="h-4 w-4 text-slate-400" />
              <Footprints aria-hidden className="h-4 w-4 text-ink-muted" />
            </>
          )}
        </span>

        <span className="mt-2 block text-xl font-bold">{tr(`ถึงประมาณ ${clock} น.`, `Arrive about ${clock}`)}</span>
        <span className="block text-sm text-ink-soft">{tr(`ใช้เวลาประมาณ ${it.range.minMin}–${it.range.maxMin} นาที`, `About ${it.range.minMin}–${it.range.maxMin} min`)}</span>

        <span className="mt-2 flex flex-wrap gap-1.5">
          <InfoChip icon={Shuffle}>{it.transfers === 0 ? tr('ไม่ต้องเปลี่ยนรถ', 'No transfers') : tr(`เปลี่ยนรถ ${it.transfers} ครั้ง`, `${it.transfers} transfer${it.transfers > 1 ? 's' : ''}`)}</InfoChip>
          <InfoChip icon={Footprints}>{it.walkM === 0 ? tr('แทบไม่ต้องเดิน', 'Almost no walking') : tr(`เดินรวม ${formatDistance(it.walkM)}`, `Walk ${formatDistance(it.walkM)}`)}</InfoChip>
          <InfoChip icon={Banknote}>{formatFareEstimate(it.fare, it.fareKnown)}</InfoChip>
          <CrowdBadge level={it.crowd} />
        </span>

        {notes.length > 0 && (
          <span className="mt-2 block space-y-0.5">
            {notes.map((n) => (
              <span key={n.key} className={`flex items-center gap-1.5 text-sm font-medium ${n.cls}`}>
                <n.Icon aria-hidden className="h-4 w-4 shrink-0" />
                {n.text}
              </span>
            ))}
          </span>
        )}

        <span className="mt-2 block text-sm font-medium text-brand-700">
          {expanded ? tr('ซ่อนขั้นตอน', 'Hide steps') : tr('ดูขั้นตอนการเดินทาง', 'Show steps')}
        </span>
      </button>

      {expanded && (
        <div id={detailsId}>
          <ItinerarySteps itinerary={it} destinationLabel={destinationLabel} />
        </div>
      )}
    </article>
  );
}