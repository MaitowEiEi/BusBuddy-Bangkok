import { RefreshCw } from 'lucide-react';
import { formatAgo, formatTimeWithSeconds } from '../lib/format';
import { useApp } from '../state/AppContext';
import type { DataQuality } from '../types/transit';
import { Banner } from './ui/Banner';
import { useToast } from './ui/Toast';

export function LiveStatus({ qualities = [] }: { qualities?: DataQuality[] }) {
  const { snapshot, liveError, refreshLive, now } = useApp();
  const toast = useToast();
  const delayed = qualities.filter((q) => q === 'delayed').length;
  const unavailable = qualities.filter((q) => q === 'unavailable').length;
  const ageSec = snapshot ? (now - snapshot.generatedAtMs) / 1000 : 0;

  return (
    <div className="space-y-2 px-4">
      <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
        <span>
          {snapshot
            ? `รับข้อมูลรถล่าสุด ${formatTimeWithSeconds(snapshot.generatedAtMs)} น. · อัปเดตทุก 5 วินาที`
            : 'กำลังโหลดข้อมูลรถ…'}
        </span>
        <button
          type="button"
          onClick={() => { refreshLive(); toast('ขอข้อมูลรถจำลองล่าสุดแล้ว', 'info'); }}
          className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 font-medium text-brand-700 hover:bg-brand-50"
        >
          <RefreshCw aria-hidden className="h-3.5 w-3.5" />
          รีเฟรช
        </button>
      </div>
      {liveError && <Banner tone="error" title={liveError}>เวลาที่แสดงอาจไม่เป็นปัจจุบัน ลองกดรีเฟรช</Banner>}
      {snapshot && ageSec > 20 && (
        <Banner tone="warning" title="ข้อมูลไม่ได้อัปเดต">
          ได้รับข้อมูลล่าสุดเมื่อ {formatAgo(now, snapshot.generatedAtMs)} เวลาที่แสดงอาจคลาดเคลื่อน
        </Banner>
      )}
      {delayed > 0 && (
        <Banner tone="warning" title={`ข้อมูลตำแหน่งรถล่าช้า ${delayed} คัน`}>
          ช่วงเวลาถึงของรถเหล่านี้จึงกว้างกว่าปกติ และรถอาจผ่านป้ายไปแล้ว
        </Banner>
      )}
      {unavailable > 0 && (
        <Banner tone="neutral" title={`ไม่ได้รับสัญญาณจากรถ ${unavailable} คัน`}>
          จึงไม่ทราบเวลาถึงและความหนาแน่นของรถเหล่านั้น ดูความถี่ตามตารางในหน้าเส้นทางประกอบการตัดสินใจ
        </Banner>
      )}
    </div>
  );
}