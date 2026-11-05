import { AlarmClock, AlertTriangle, BellRing, CheckCircle2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { alightProgress } from '../../domain/alight';
import { useWatchPosition } from '../../hooks/useGeolocation';
import { formatDistance } from '../../lib/format';
import { showSystemNotification, speak } from '../../lib/notify';
import { useApp } from '../../state/AppContext';
import {
  ALIGHT_MAX_AGE_MS, ALIGHT_PREPARE_STOPS, setAlightAlarm, setAlightStage, useAlightAlarm, type AlightStage,
} from '../../state/alightAlarm';
import { useToast } from '../ui/Toast';

const PREPARE_M = 700;
const ARRIVE_M = 150;
const ON_ROUTE_M = 120;
const MAX_ACCURACY_M = 150;

type WakeLockLike = { release: () => Promise<void> };

/** Keeps the screen on while the alarm runs; browsers pause GPS when the screen turns off. */
function useWakeLock(enabled: boolean) {
  useEffect(() => {
    const api = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockLike> } }).wakeLock;
    if (!enabled || !api) return;
    let lock: WakeLockLike | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const next = await api.request('screen');
        if (cancelled) {
          void next.release();
          return;
        }
        void lock?.release();
        lock = next;
      } catch {
        // Not allowed (battery saver, hidden tab): the alarm still works while the screen is on.
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void acquire(); };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [enabled]);
}

const STAGE_STYLE: Record<AlightStage, { cls: string; Icon: typeof AlarmClock }> = {
  watching: { cls: 'bg-white text-ink ring-1 ring-slate-300', Icon: AlarmClock },
  prepare: { cls: 'bg-amber-300 text-ink', Icon: BellRing },
  arrived: { cls: 'bg-emerald-700 text-white', Icon: CheckCircle2 },
  passed: { cls: 'bg-red-700 text-white', Icon: AlertTriangle },
};

/** Follows the rider's GPS during a bus ride and warns before the alighting stop. */
export function AlightWatcher() {
  const { network } = useApp();
  const toast = useToast();
  const alarm = useAlightAlarm();
  const watching = alarm !== null && (alarm.stage === 'watching' || alarm.stage === 'prepare');
  const { fix, status } = useWatchPosition(watching);
  const [announcement, setAnnouncement] = useState('');
  useWakeLock(watching);

  const variant = alarm ? network.variantById[alarm.variantId] : undefined;
  const route = variant ? network.routeById[variant.routeId] : undefined;
  const stop = variant && alarm ? network.stopById[variant.stopIds[alarm.alightIndex]] : undefined;

  const progress = useMemo(
    () => (alarm && variant && fix ? alightProgress(variant, alarm.boardIndex, alarm.alightIndex, fix.position) : null),
    [alarm, variant, fix],
  );
  const accurate = !!fix && fix.accuracyM <= MAX_ACCURACY_M;
  const onRoute = !!progress && accurate && progress.offRouteM <= Math.max(ON_ROUTE_M, fix?.accuracyM ?? 0);

  useEffect(() => {
    if (!alarm || !stop) return;
    if (Date.now() - alarm.createdAtMs > ALIGHT_MAX_AGE_MS) {
      setAlightAlarm(null);
      toast('ยกเลิกการปลุกอัตโนมัติ เพราะตั้งไว้นานเกิน 3 ชั่วโมง', 'warning');
      return;
    }
    if (!progress || !onRoute) return;

    let next: AlightStage = alarm.stage;
    if (progress.passed) next = 'passed';
    else if (progress.stopsLeft === 0 || progress.metersLeft <= ARRIVE_M) next = 'arrived';
    else if (alarm.stage === 'watching' && (progress.stopsLeft <= ALIGHT_PREPARE_STOPS || progress.metersLeft <= PREPARE_M)) {
      next = 'prepare';
    }
    if (next === alarm.stage) return;
    setAlightStage(next);

    const name = `ป้าย${stop.nameTh}`;
    const text =
      next === 'prepare'
        ? `อีก ${progress.stopsLeft} ป้ายถึง${name} เตรียมกดกริ่งหรือบอกพนักงาน`
        : next === 'arrived'
          ? `รถกำลังเข้า${name} ลงป้ายนี้`
          : `เลย${name}มาแล้ว ลงป้ายถัดไปแล้วเดินย้อนกลับ`;
    const title = next === 'prepare' ? 'ใกล้ถึงป้ายลงแล้ว' : next === 'arrived' ? 'ถึงป้ายลงแล้ว' : 'เลยป้ายลงแล้ว';
    showSystemNotification(title, text, 'bb-alight');
    if ('vibrate' in navigator) navigator.vibrate(next === 'prepare' ? [300, 150, 300] : [600, 200, 600, 200, 600]);
    speak(text);
    setAnnouncement(text);
    toast(text, next === 'passed' ? 'warning' : 'success');
  }, [alarm, stop, progress, onRoute, toast]);

  if (!alarm || !variant || !stop) return null;

  const { cls, Icon } = STAGE_STYLE[alarm.stage];
  const nextStop = progress?.nextStopId ? network.stopById[progress.nextStopId] : undefined;

  let title = `ปลุกก่อนถึงป้าย${stop.nameTh}`;
  let detail: string;
  if (alarm.stage === 'arrived') {
    title = `ถึงป้าย${stop.nameTh}แล้ว`;
    detail = 'ลงรถได้เลย';
  } else if (alarm.stage === 'passed') {
    title = `เลยป้าย${stop.nameTh}มาแล้ว`;
    detail = 'ลงป้ายถัดไป แล้วเดินย้อนกลับ';
  } else if (status === 'denied' || status === 'unsupported') {
    detail = 'ใช้ตำแหน่งไม่ได้ จึงปลุกไม่ได้';
  } else if (!fix) {
    detail = 'กำลังหาตำแหน่งของคุณ…';
  } else if (!accurate) {
    detail = `สัญญาณ GPS ยังไม่แม่น (±${fix.accuracyM} ม.) รอสักครู่`;
  } else if (!onRoute) {
    detail = `ยังไม่อยู่บนเส้นทางสาย ${route?.shortName ?? ''} จะเริ่มนับเมื่อขึ้นรถ`;
  } else {
    detail = `อีก ${progress?.stopsLeft ?? '-'} ป้าย · ประมาณ ${formatDistance(progress?.metersLeft ?? 0)}`;
    if (alarm.stage === 'prepare') title = `ใกล้ถึงป้าย${stop.nameTh}แล้ว`;
  }
  const done = alarm.stage === 'arrived' || alarm.stage === 'passed';

  return (
    <div className="pointer-events-none fixed inset-x-2 top-2 z-[1400] flex justify-center lg:inset-x-auto lg:right-4 lg:top-4">
      <section aria-label="ปลุกก่อนถึงป้ายลง" className={`pointer-events-auto w-full max-w-md rounded-2xl p-3 shadow-xl ${cls}`}>
        <div className="flex items-start gap-3">
          <Icon aria-hidden className="mt-0.5 h-6 w-6 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">{title}</p>
            <p className="text-sm">{detail}</p>
            {!done && onRoute && nextStop && nextStop.id !== stop.id && (
              <p className="text-sm opacity-90">ป้ายถัดไป: {nextStop.nameTh}</p>
            )}
            {!done && <p className="mt-1 text-xs opacity-80">เปิดหน้าจอค้างไว้ ถ้าสลับไปแอปอื่น การปลุกอาจหยุดทำงาน</p>}
          </div>
          <button
            type="button"
            onClick={() => setAlightAlarm(null)}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl bg-white/90 px-3 text-sm font-semibold text-ink ring-1 ring-black/10 hover:bg-white"
          >
            <X aria-hidden className="h-4 w-4" />
            {done ? 'ปิด' : 'ยกเลิก'}
          </button>
        </div>
        <p aria-live="assertive" className="sr-only">{announcement}</p>
      </section>
    </div>
  );
}