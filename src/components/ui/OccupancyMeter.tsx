import { occupancyPercent } from '../../domain/crowding';
import { useT } from '../../lib/i18n';
import type { CrowdLevel } from '../../types/transit';
import { CrowdBadge } from './Badges';

const BAR: Record<CrowdLevel, string> = {
  seats: 'bg-emerald-600',
  standing: 'bg-amber-500',
  crowded: 'bg-red-600',
  unknown: 'bg-slate-400',
};

export function OccupancyMeter({ passengers, seats, capacity, crowd }: { passengers: number | null; seats: number; capacity: number; crowd: CrowdLevel }) {
  const tr = useT();
  const pct = occupancyPercent(passengers, capacity);
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{tr('ความหนาแน่นโดยประมาณ', 'Estimated crowding')}</span>
        <CrowdBadge level={crowd} />
      </div>
      {pct === null ? (
        <p className="mt-2 text-sm text-ink-soft">
          {tr(
            'ไม่มีข้อมูลประมาณการ (รถคันนี้ไม่มีเซนเซอร์นับผู้โดยสาร หรือไม่ได้ส่งสัญญาณ)',
            'No estimate (this bus has no passenger counter, or it isn’t sending data)',
          )}
        </p>
      ) : (
        <>
          <div
            role="meter"
            aria-label={tr('ความหนาแน่นโดยประมาณเทียบกับความจุรถ', 'Estimated crowding compared with bus capacity')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-valuetext={tr(`ประมาณ ${pct}% ของความจุ`, `About ${pct}% of capacity`)}
            className="relative mt-3 h-3 rounded-full bg-slate-200"
          >
            <div className={`h-full rounded-full ${BAR[crowd]}`} style={{ width: `${Math.min(100, pct)}%` }} />
            <div aria-hidden className="absolute -top-1 h-5 w-0.5 bg-ink" style={{ left: `${(seats / capacity) * 100}%` }} />
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            {tr(
              `ประมาณ ${passengers} คน จากความจุ ${capacity} คน (${pct}%) · ที่นั่ง ${seats} ที่ (เส้นดำบนแถบ)`,
              `About ${passengers} of ${capacity} people (${pct}%) · ${seats} seats (black line on the bar)`,
            )}
          </p>
        </>
      )}
      <p className="mt-2 text-xs text-ink-muted">
        {tr('ค่าประมาณจำลองในต้นแบบ ไม่ได้มาจากกล้องหรือโมเดล AI', 'Simulated estimate for this prototype, not from cameras or AI')}
      </p>
    </div>
  );
}