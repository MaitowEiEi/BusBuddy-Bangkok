import {
  AlertOctagon, AlertTriangle, Banknote, CalendarClock, ChevronRight, Footprints, ShieldCheck, Shuffle, Users,
  type LucideIcon,
} from 'lucide-react';
import { useId } from 'react';
import type { Itinerary } from '../../domain/planner';
import { formatClockRange, formatDistance, formatFareRange } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { CrowdBadge, InfoChip, RouteBadge } from '../ui/Badges';
import { ItinerarySteps } from './ItinerarySteps';
import { routesForLeg } from './planUi';

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
  const detailsId = useId();
  const clock = formatClockRange(nowMs, it.range);

  const notes: { key: string; Icon: LucideIcon; cls: string; text: string }[] = [];
  if (it.mode === 'comfort') {
    notes.push({
      key: 'comfort', Icon: Users, cls: 'text-emerald-800',
      text: it.comfortExtraMin
        ? `รอคันที่แน่นน้อยกว่า (ถึงช้ากว่าคันแรกประมาณ ${it.comfortExtraMin} นาที)`
        : 'เลือกคันที่แน่นน้อยกว่า',
    });
  }
  if (it.usesSchedule) {
    notes.push({ key: 'schedule', Icon: CalendarClock, cls: 'text-ink-soft', text: 'บางช่วงไม่มีข้อมูลรถสด ใช้ความถี่ตามตารางประมาณเวลา' });
  }
  if (it.catchFeasibility === 'tight' || it.catchFeasibility === 'miss') {
    notes.push({ key: 'catch', Icon: AlertTriangle, cls: 'text-amber-800', text: 'คันแรกอาจเดินไปไม่ทัน' });
  }
  if (it.tightTransfer) {
    notes.push({ key: 'transfer', Icon: AlertTriangle, cls: 'text-amber-800', text: 'เวลาต่อรถกระชั้น' });
  }

  return (
    <article
      aria-label={`ทางเลือก: ถึงประมาณ ${clock} น.`}
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
                เลี่ยงจุดขัดข้อง
              </span>
            )}
            {disruptionTag === 'affected' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800 ring-1 ring-red-200">
                <AlertOctagon aria-hidden className="h-3.5 w-3.5" />
                ผ่านช่วงที่มีเหตุขัดข้อง
              </span>
            )}
          </span>
        )}

        <span className="flex flex-wrap items-center gap-1">
          {it.access.distanceM > 0 && <Footprints aria-hidden className="h-4 w-4 text-ink-muted" />}
          {it.legs.map((leg, i) => (
            <span key={`${leg.boardStopId}-${i}`} className="flex items-center gap-1">
              {(i > 0 || it.access.distanceM > 0) && <ChevronRight aria-hidden className="h-4 w-4 text-slate-400" />}
              {routesForLeg(network, leg).map((r, k) => (
                <span key={r.id} className="flex items-center gap-1">
                  {k > 0 && <span className="text-xs text-ink-muted">หรือ</span>}
                  <RouteBadge route={r} size="sm" />
                </span>
              ))}
            </span>
          ))}
          {it.egress.distanceM > 0 && (
            <>
              <ChevronRight aria-hidden className="h-4 w-4 text-slate-400" />
              <Footprints aria-hidden className="h-4 w-4 text-ink-muted" />
            </>
          )}
        </span>

        <span className="mt-2 block text-xl font-bold">ถึงประมาณ {clock} น.</span>
        <span className="block text-sm text-ink-soft">ใช้เวลาประมาณ {it.range.minMin}–{it.range.maxMin} นาที</span>

        <span className="mt-2 flex flex-wrap gap-1.5">
          <InfoChip icon={Shuffle}>{it.transfers === 0 ? 'ไม่ต้องเปลี่ยนรถ' : `เปลี่ยนรถ ${it.transfers} ครั้ง`}</InfoChip>
          <InfoChip icon={Footprints}>{it.walkM === 0 ? 'แทบไม่ต้องเดิน' : `เดินรวม ${formatDistance(it.walkM)}`}</InfoChip>
          <InfoChip icon={Banknote}>~{formatFareRange(it.fare)}</InfoChip>
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
          {expanded ? 'ซ่อนขั้นตอน' : 'ดูขั้นตอนการเดินทาง'}
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