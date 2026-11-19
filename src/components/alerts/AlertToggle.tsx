import { Bell, BellRing, X } from 'lucide-react';
import { useState } from 'react';
import { stopLabel } from '../../domain/lookup';
import { useLang, useT } from '../../lib/i18n';
import { requestNotifyPermission } from '../../lib/notify';
import { useApp } from '../../state/AppContext';
import { addAlert, alertId, removeAlert, useArrivalAlerts } from '../../state/arrivalAlerts';
import { btn } from '../ui/buttonStyles';
import { useToast } from '../ui/Toast';

const THRESHOLDS = [2, 5, 10];

interface Props {
  vehicleId: string;
  stopId: string;
  variantId: string;
  etaSec: number | null;
}

export function AlertToggle({ vehicleId, stopId, variantId, etaSec }: Props) {
  const { network } = useApp();
  const toast = useToast();
  const alerts = useArrivalAlerts();
  const lang = useLang();
  const tr = useT();
  const [choosing, setChoosing] = useState(false);

  const id = alertId(vehicleId, stopId);
  const active = alerts.find((a) => a.id === id);
  const variant = network.variantById[variantId];
  const route = variant ? network.routeById[variant.routeId] : undefined;
  const stop = network.stopById[stopId];
  if (!variant || !route || !stop) return null;
  const stopName = stopLabel(network, stop, lang);

  if (active) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800">
          <BellRing aria-hidden className="h-4 w-4" />
          {tr(
            `จะแจ้งเตือนเมื่อเหลือประมาณ ${active.thresholdMin} นาที`,
            `You’ll get an alert about ${active.thresholdMin} min before it arrives`,
          )}
        </span>
        <button
          type="button"
          onClick={() => {
            removeAlert(id);
            toast(tr('ยกเลิกการแจ้งเตือนแล้ว', 'Alert cancelled'), 'success');
          }}
          className={btn.ghost}
        >
          <X aria-hidden className="h-4 w-4" />
          {tr('ยกเลิก', 'Cancel')}
        </button>
      </div>
    );
  }

  const options = etaSec === null ? THRESHOLDS : THRESHOLDS.filter((m) => m * 60 < etaSec);
  if (options.length === 0) {
    return (
      <p className="text-sm font-medium text-ink-soft">
        {tr('รถใกล้ถึงแล้ว เตรียมตัวขึ้นได้เลย', 'The bus is almost here. Get ready to board.')}
      </p>
    );
  }

  const create = async (min: number) => {
    addAlert({ vehicleId, stopId, variantId, thresholdMin: min });
    setChoosing(false);
    const permission = await requestNotifyPermission();
    toast(
      permission === 'granted'
        ? tr(
            `ตั้งแจ้งเตือนแล้ว: เมื่อสาย ${route.shortName} เหลืออีกประมาณ ${min} นาทีจะถึง${stopName}`,
            `Alert set: when route ${route.shortName} is about ${min} min from ${stopName}`,
          )
        : tr('ตั้งแจ้งเตือนในแอปแล้ว (ต้องเปิดหน้านี้ค้างไว้)', 'In-app alert set (keep this page open)'),
      'success',
    );
  };

  if (!choosing) {
    return (
      <button type="button" onClick={() => setChoosing(true)} aria-expanded={false} className={btn.secondary}>
        <Bell aria-hidden className="h-4 w-4" />
        {tr('แจ้งเตือนเมื่อใกล้ถึง', 'Alert me when it’s near')}
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={tr(`ตั้งเวลาแจ้งเตือนสาย ${route.shortName}`, `Set an alert for route ${route.shortName}`)}
      className="flex flex-wrap items-center gap-2"
    >
      <span className="text-sm text-ink-soft">{tr('แจ้งเมื่อเหลือ', 'Alert me')}</span>
      {options.map((m) => (
        <button key={m} type="button" onClick={() => void create(m)} className={btn.secondary}>
          {tr(`${m} นาที`, `${m} min before`)}
        </button>
      ))}
      <button type="button" onClick={() => setChoosing(false)} className={btn.ghost}>
        {tr('ไม่ตั้ง', 'Not now')}
      </button>
    </div>
  );
}