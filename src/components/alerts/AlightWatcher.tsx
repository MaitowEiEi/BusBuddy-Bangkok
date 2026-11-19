import { AlarmClock, AlertTriangle, BellRing, CheckCircle2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { alightProgress } from '../../domain/alight';
import { useWatchPosition } from '../../hooks/useGeolocation';
import { formatDistance } from '../../lib/format';
import { pickName, useLang, useT } from '../../lib/i18n';
import { showSystemNotification, speak } from '../../lib/notify';
import { useApp } from '../../state/AppContext';
import {
  ALIGHT_MAX_AGE_MS,
  ALIGHT_PREPARE_STOPS,
  setAlightAlarm,
  setAlightStage,
  useAlightAlarm,
  type AlightStage,
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
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
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
  const lang = useLang();
  const tr = useT();
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
    const isEn = lang === 'en';

    if (Date.now() - alarm.createdAtMs > ALIGHT_MAX_AGE_MS) {
      setAlightAlarm(null);
      toast(
        isEn
          ? 'Get-off alarm was automatically cancelled after 3 hours'
          : 'ยกเลิกการปลุกอัตโนมัติ เพราะตั้งไว้นานเกิน 3 ชั่วโมง',
        'warning',
      );
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
    const stopName = pickName(lang, stop.nameTh, stop.nameEn);
    const stopsWord = progress.stopsLeft === 1 ? 'stop' : 'stops';

    const text =
      next === 'prepare'
        ? isEn
          ? `${progress.stopsLeft} ${stopsWord} to ${stopName}. Prepare to press the bell or tell the conductor.`
          : `อีก ${progress.stopsLeft} ป้ายถึงป้าย${stopName} เตรียมกดกริ่งหรือบอกพนักงาน`
        : next === 'arrived'
          ? isEn
            ? `Approaching ${stopName}. Get off at this stop.`
            : `รถกำลังเข้าป้าย${stopName} ลงป้ายนี้`
          : isEn
            ? `You passed ${stopName}. Get off at the next stop and walk back.`
            : `เลยป้าย${stopName}มาแล้ว ลงป้ายถัดไปแล้วเดินย้อนกลับ`;

    const title =
      next === 'prepare'
        ? isEn
          ? 'Almost at your stop'
          : 'ใกล้ถึงป้ายลงแล้ว'
        : next === 'arrived'
          ? isEn
            ? 'Arriving at your stop'
            : 'ถึงป้ายลงแล้ว'
          : isEn
            ? 'Missed your stop'
            : 'เลยป้ายลงแล้ว';

    showSystemNotification(title, text, 'bb-alight');
    if ('vibrate' in navigator) navigator.vibrate(next === 'prepare' ? [300, 150, 300] : [600, 200, 600, 200, 600]);
    speak(text, lang);
    setAnnouncement(text);
    toast(text, next === 'passed' ? 'warning' : 'success');
  }, [alarm, stop, progress, onRoute, toast, lang]);

  if (!alarm || !variant || !stop) return null;

  const { cls, Icon } = STAGE_STYLE[alarm.stage];
  const nextStop = progress?.nextStopId ? network.stopById[progress.nextStopId] : undefined;
  const stopName = pickName(lang, stop.nameTh, stop.nameEn);
  const nextStopName = nextStop ? pickName(lang, nextStop.nameTh, nextStop.nameEn) : '';

  let title = tr(`ปลุกก่อนถึงป้าย${stopName}`, `Get-off alarm for ${stopName}`);
  let detail: string;

  if (alarm.stage === 'arrived') {
    title = tr(`ถึงป้าย${stopName}แล้ว`, `Arrived at ${stopName}`);
    detail = tr('ลงรถได้เลย', 'Get off at this stop');
  } else if (alarm.stage === 'passed') {
    title = tr(`เลยป้าย${stopName}มาแล้ว`, `Passed ${stopName}`);
    detail = tr('ลงป้ายถัดไป แล้วเดินย้อนกลับ', 'Get off at the next stop and walk back');
  } else if (status === 'denied' || status === 'unsupported') {
    detail = tr('ใช้ตำแหน่งไม่ได้ จึงปลุกไม่ได้', 'Location unavailable — alarm cannot track your stop');
  } else if (!fix) {
    detail = tr('กำลังหาตำแหน่งของคุณ…', 'Locating your GPS position…');
  } else if (!accurate) {
    detail = tr(
      `สัญญาณ GPS ยังไม่แม่น (±${fix.accuracyM} ม.) รอสักครู่`,
      `Weak GPS signal (±${fix.accuracyM} m), please wait…`,
    );
  } else if (!onRoute) {
    detail = tr(
      `ยังไม่อยู่บนเส้นทางสาย ${route?.shortName ?? ''} จะเริ่มนับเมื่อขึ้นรถ`,
      `Not on Route ${route?.shortName ?? ''} yet — tracking starts once on board`,
    );
  } else {
    const stopsLeft = progress?.stopsLeft ?? '-';
    const stopsLabel = progress?.stopsLeft === 1 ? 'stop' : 'stops';
    const distText = formatDistance(progress?.metersLeft ?? 0);
    detail = tr(
      `อีก ${stopsLeft} ป้าย · ประมาณ ${distText}`,
      `${stopsLeft} ${stopsLabel} left · ~${distText}`,
    );
    if (alarm.stage === 'prepare') {
      title = tr(`ใกล้ถึงป้าย${stopName}แล้ว`, `Almost at ${stopName}`);
    }
  }

  const done = alarm.stage === 'arrived' || alarm.stage === 'passed';

  return (
    <div className="pointer-events-none fixed inset-x-2 top-2 z-[1400] flex justify-center lg:inset-x-auto lg:right-4 lg:top-4">
      <section
        aria-label={tr('ปลุกก่อนถึงป้ายลง', 'Get-off alarm')}
        className={`pointer-events-auto w-full max-w-md rounded-2xl p-3 shadow-xl ${cls}`}
      >
        <div className="flex items-start gap-3">
          <Icon aria-hidden className="mt-0.5 h-6 w-6 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">{title}</p>
            <p className="text-sm">{detail}</p>
            {!done && onRoute && nextStop && nextStop.id !== stop.id && (
              <p className="text-sm opacity-90">
                {tr(`ป้ายถัดไป: ${nextStopName}`, `Next stop: ${nextStopName}`)}
              </p>
            )}
            {!done && (
              <p className="mt-1 text-xs opacity-80">
                {tr(
                  'เปิดหน้าจอค้างไว้ ถ้าสลับไปแอปอื่น การปลุกอาจหยุดทำงาน',
                  'Keep this screen open — switching apps may pause the alarm',
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setAlightAlarm(null)}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl bg-white/90 px-3 text-sm font-semibold text-ink ring-1 ring-black/10 hover:bg-white"
          >
            <X aria-hidden className="h-4 w-4" />
            {done ? tr('ปิด', 'Close') : tr('ยกเลิก', 'Cancel')}
          </button>
        </div>
        <p aria-live="assertive" className="sr-only">
          {announcement}
        </p>
      </section>
    </div>
  );
}
