import { RefreshCw } from 'lucide-react';
import { formatAgo, formatTimeWithSeconds } from '../lib/format';
import { useT } from '../lib/i18n';
import { useApp } from '../state/AppContext';
import type { DataQuality } from '../types/transit';
import { Banner } from './ui/Banner';
import { useToast } from './ui/Toast';

export function LiveStatus({ qualities = [] }: { qualities?: DataQuality[] }) {
  const { snapshot, liveError, refreshLive, now } = useApp();
  const toast = useToast();
  const tr = useT();
  const delayed = qualities.filter((q) => q === 'delayed').length;
  const unavailable = qualities.filter((q) => q === 'unavailable').length;
  const ageSec = snapshot ? (now - snapshot.generatedAtMs) / 1000 : 0;

  return (
    <div className="space-y-2 px-4">
      <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
        <span>
          {snapshot
            ? tr(
                `รับข้อมูลรถล่าสุด ${formatTimeWithSeconds(snapshot.generatedAtMs)} น. · อัปเดตทุก 5 วินาที`,
                `Bus data from ${formatTimeWithSeconds(snapshot.generatedAtMs)} · updates every 5 s`,
              )
            : tr('กำลังโหลดข้อมูลรถ…', 'Loading bus data…')}
        </span>
        <button
          type="button"
          onClick={() => {
            refreshLive();
            toast(tr('ขอข้อมูลรถจำลองล่าสุดแล้ว', 'Requested the latest simulated bus data'), 'info');
          }}
          className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 font-medium text-brand-700 hover:bg-brand-50"
        >
          <RefreshCw aria-hidden className="h-3.5 w-3.5" />
          {tr('รีเฟรช', 'Refresh')}
        </button>
      </div>
      {liveError && (
        <Banner tone="error" title={liveError}>
          {tr('เวลาที่แสดงอาจไม่เป็นปัจจุบัน ลองกดรีเฟรช', 'Times may be out of date. Try Refresh.')}
        </Banner>
      )}
      {snapshot && ageSec > 20 && (
        <Banner tone="warning" title={tr('ข้อมูลไม่ได้อัปเดต', 'Data is not updating')}>
          {tr(
            `ได้รับข้อมูลล่าสุดเมื่อ ${formatAgo(now, snapshot.generatedAtMs)} เวลาที่แสดงอาจคลาดเคลื่อน`,
            `Last update ${formatAgo(now, snapshot.generatedAtMs)}. Times may be off.`,
          )}
        </Banner>
      )}
      {delayed > 0 && (
        <Banner tone="warning" title={tr(`ข้อมูลตำแหน่งรถล่าช้า ${delayed} คัน`, `Delayed position for ${delayed} ${delayed === 1 ? 'bus' : 'buses'}`)}>
          {tr(
            'ช่วงเวลาถึงของรถเหล่านี้จึงกว้างกว่าปกติ และรถอาจผ่านป้ายไปแล้ว',
            'Their arrival ranges are wider than usual, and they may have already passed the stop.',
          )}
        </Banner>
      )}
      {unavailable > 0 && (
        <Banner tone="neutral" title={tr(`ไม่ได้รับสัญญาณจากรถ ${unavailable} คัน`, `No signal from ${unavailable} ${unavailable === 1 ? 'bus' : 'buses'}`)}>
          {tr(
            'จึงไม่ทราบเวลาถึงและความหนาแน่นของรถเหล่านั้น ดูความถี่ตามตารางในหน้าเส้นทางประกอบการตัดสินใจ',
            'Arrival times and crowding are unknown for them. Check the timetable on the route page.',
          )}
        </Banner>
      )}
    </div>
  );
}