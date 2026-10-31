import { Bell, BellRing, X } from 'lucide-react';
import { useState } from 'react';
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
  const [choosing, setChoosing] = useState(false);

  const id = alertId(vehicleId, stopId);
  const active = alerts.find((a) => a.id === id);
  const variant = network.variantById[variantId];
  const route = variant ? network.routeById[variant.routeId] : undefined;
  const stop = network.stopById[stopId];
  if (!variant || !route || !stop) return null;

  if (active) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800">
          <BellRing aria-hidden className="h-4 w-4" />
          จะแจ้งเตือนเมื่อเหลือประมาณ {active.thresholdMin} นาที
        </span>
        <button
          type="button"
          onClick={() => {
            removeAlert(id);
            toast('ยกเลิกการแจ้งเตือนแล้ว', 'success');
          }}
          className={btn.ghost}
        >
          <X aria-hidden className="h-4 w-4" />
          ยกเลิก
        </button>
      </div>
    );
  }

  const options = etaSec === null ? THRESHOLDS : THRESHOLDS.filter((m) => m * 60 < etaSec);
  if (options.length === 0) {
    return <p className="text-sm font-medium text-ink-soft">รถใกล้ถึงแล้ว เตรียมตัวขึ้นได้เลย</p>;
  }

  const create = async (min: number) => {
    addAlert({ vehicleId, stopId, variantId, thresholdMin: min });
    setChoosing(false);
    const permission = await requestNotifyPermission();
    toast(
      permission === 'granted'
        ? `ตั้งแจ้งเตือนแล้ว: เมื่อสาย ${route.shortName} เหลืออีกประมาณ ${min} นาทีจะถึงป้าย${stop.nameTh}`
        : `ตั้งแจ้งเตือนในแอปแล้ว (ต้องเปิดหน้านี้ค้างไว้)`,
      'success',
    );
  };

  if (!choosing) {
    return (
      <button type="button" onClick={() => setChoosing(true)} aria-expanded={false} className={btn.secondary}>
        <Bell aria-hidden className="h-4 w-4" />
        แจ้งเตือนเมื่อใกล้ถึง
      </button>
    );
  }

  return (
    <div role="group" aria-label={`ตั้งเวลาแจ้งเตือนสาย ${route.shortName}`} className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink-soft">แจ้งเมื่อเหลือ</span>
      {options.map((m) => (
        <button key={m} type="button" onClick={() => void create(m)} className={btn.secondary}>
          {m} นาที
        </button>
      ))}
      <button type="button" onClick={() => setChoosing(false)} className={btn.ghost}>
        ไม่ตั้ง
      </button>
    </div>
  );
}