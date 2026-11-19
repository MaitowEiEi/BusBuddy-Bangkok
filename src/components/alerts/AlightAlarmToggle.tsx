import { AlarmClock, Loader2, X } from 'lucide-react';
import { stopLabel } from '../../domain/lookup';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useLang, useT } from '../../lib/i18n';
import { requestNotifyPermission, unlockSpeech } from '../../lib/notify';
import { useApp } from '../../state/AppContext';
import { ALIGHT_PREPARE_STOPS, setAlightAlarm, useAlightAlarm } from '../../state/alightAlarm';
import { btn } from '../ui/buttonStyles';
import { useToast } from '../ui/Toast';

interface Props {
  variantId: string;
  boardIndex: number;
  alightIndex: number;
}

export function AlightAlarmToggle({ variantId, boardIndex, alightIndex }: Props) {
  const { network } = useApp();
  const toast = useToast();
  const alarm = useAlightAlarm();
  const { status, request } = useGeolocation();
  const lang = useLang();
  const tr = useT();

  const variant = network.variantById[variantId];
  const stop = variant ? network.stopById[variant.stopIds[alightIndex]] : undefined;
  if (!variant || !stop) return null;
  const stopName = stopLabel(network, stop, lang);
  const stopsEn = `${ALIGHT_PREPARE_STOPS} stop${Number(ALIGHT_PREPARE_STOPS) === 1 ? '' : 's'}`;

  const mine = alarm !== null && alarm.variantId === variantId && alarm.alightIndex === alightIndex;
  if (mine) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800">
          <AlarmClock aria-hidden className="h-4 w-4" />
          {tr(`เปิดปลุกก่อนถึง${stopName}แล้ว`, `Alarm on for ${stopName}`)}
        </span>
        <button type="button" onClick={() => setAlightAlarm(null)} className={btn.ghost}>
          <X aria-hidden className="h-4 w-4" />
          {tr('ยกเลิก', 'Cancel')}
        </button>
      </div>
    );
  }

  const start = async () => {
    // Both must start inside the tap, before any await, or browsers ignore them.
    const notify = requestNotifyPermission();
    unlockSpeech();
    const fix = await request();
    await notify;
    if (!fix) {
      toast(
        tr(
          'ใช้ตำแหน่งของคุณไม่ได้ จึงตั้งปลุกไม่ได้ ตรวจว่าอนุญาตให้เว็บนี้ใช้ตำแหน่งแล้ว',
          'Couldn’t get your location, so the alarm can’t be set. Check that this site is allowed to use your location.',
        ),
        'warning',
      );
      return;
    }
    setAlightAlarm({ variantId, boardIndex, alightIndex });
    toast(
      tr(
        `ตั้งปลุกแล้ว: จะเตือนเมื่ออีก ${ALIGHT_PREPARE_STOPS} ป้ายถึง${stopName} เปิดหน้าจอค้างไว้ระหว่างนั่งรถ`,
        `Alarm set: you’ll be warned ${stopsEn} before ${stopName}. Keep the screen on while you ride.`,
      ),
      'success',
    );
  };

  const busy = status === 'requesting';
  return (
    <div className="space-y-1">
      <button type="button" onClick={() => void start()} disabled={busy} className={btn.secondary}>
        {busy ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <AlarmClock aria-hidden className="h-4 w-4" />}
        {busy ? tr('กำลังหาตำแหน่ง…', 'Finding your location…') : tr('ปลุกฉันก่อนถึงป้ายลง', 'Wake me before my stop')}
      </button>
      {alarm && !mine && (
        <p className="text-xs text-ink-muted">{tr('จะใช้แทนการปลุกที่ตั้งไว้ก่อนหน้า', 'This replaces your earlier alarm')}</p>
      )}
    </div>
  );
}