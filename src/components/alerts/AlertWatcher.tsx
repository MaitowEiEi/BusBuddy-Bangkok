import { useEffect } from 'react';
import { arrivalsForStop } from '../../domain/arrivals';
import { formatEtaRange } from '../../lib/format';
import { showSystemNotification } from '../../lib/notify';
import { useApp } from '../../state/AppContext';
import { ALERT_MAX_AGE_MS, getAlerts, removeAlert } from '../../state/arrivalAlerts';
import { useToast } from '../ui/Toast';

const ALERT_HORIZON_MIN = 120;
// Module-level so an alert never fires twice (StrictMode or a second mount).
const handled = new Set<string>();

/** Checks every live update whether an alerted bus is close enough. Renders nothing. */
export function AlertWatcher() {
  const { network, snapshot } = useApp();
  const toast = useToast();

  useEffect(() => {
    if (!snapshot) return;
    for (const alert of getAlerts()) {
      const key = `${alert.id}|${alert.createdAtMs}`;
      if (handled.has(key)) continue;

      const finish = (message: string | null, tone: 'success' | 'warning') => {
        handled.add(key);
        removeAlert(alert.id);
        if (message) toast(message, tone);
      };

      const variant = network.variantById[alert.variantId];
      const route = variant ? network.routeById[variant.routeId] : undefined;
      const stop = network.stopById[alert.stopId];
      if (!variant || !route || !stop) {
        finish(null, 'warning');
        continue;
      }
      const label = `สาย ${route.shortName} ${variant.headsignTh}`;

      if (Date.now() - alert.createdAtMs > ALERT_MAX_AGE_MS) {
        finish(`ยกเลิกการแจ้งเตือน${label}อัตโนมัติ เพราะตั้งไว้นานเกิน 90 นาที`, 'warning');
        continue;
      }

      const arrival = arrivalsForStop(network, snapshot, stop.id, ALERT_HORIZON_MIN).find(
        (a) => a.vehicleId === alert.vehicleId,
      );
      if (!arrival) {
        finish(`ไม่พบข้อมูล${label}ที่จะมาป้าย${stop.nameTh}แล้ว (อาจผ่านไปแล้ว) จึงยกเลิกการแจ้งเตือน`, 'warning');
        continue;
      }

      const near = arrival.mayHavePassed || (arrival.etaSec !== null && arrival.etaSec <= alert.thresholdMin * 60);
      if (!near) continue;

      const body = arrival.mayHavePassed
        ? `${label} อาจถึงป้าย${stop.nameTh}แล้ว`
        : `${label} จะถึงป้าย${stop.nameTh} ${formatEtaRange(arrival.etaRange)}`;
      showSystemNotification('รถใกล้ถึงแล้ว', body, alert.id);
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      finish(body, 'success');
    }
  }, [network, snapshot, toast]);

  return null;
}