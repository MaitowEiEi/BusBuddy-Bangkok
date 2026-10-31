import { BellRing, X } from 'lucide-react';
import { useMemo } from 'react';
import { arrivalsForStop } from '../../domain/arrivals';
import { formatEtaRange } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { removeAlert, useArrivalAlerts } from '../../state/arrivalAlerts';
import { RouteBadge, ShortTurnBadge } from '../ui/Badges';
import { btn } from '../ui/buttonStyles';
import { Section } from '../ui/Section';
import { AlertToggle } from './AlertToggle';

const MAX_ARRIVALS = 6;

/** For the stop page: pick a bus and get notified before it arrives. */
export function StopAlertsSection({ stopId }: { stopId: string }) {
  const { network, snapshot } = useApp();
  const stop = network.stopById[stopId];
  const arrivals = useMemo(
    () =>
      snapshot && stop
        ? arrivalsForStop(network, snapshot, stop.id, 60)
            .filter((a) => a.etaSec !== null && !a.mayHavePassed)
            .slice(0, MAX_ARRIVALS)
        : [],
    [network, snapshot, stop],
  );

  if (!stop) return null;

  return (
    <Section title="แจ้งเตือนเมื่อรถใกล้ถึง">
      {arrivals.length === 0 ? (
        <p className="px-4 text-sm text-ink-soft">ยังไม่มีรถที่คาดว่าจะถึงป้ายนี้ภายใน 60 นาที</p>
      ) : (
        <ul className="space-y-2 px-4">
          {arrivals.map((a) => {
            const variant = network.variantById[a.variantId];
            const route = network.routeById[variant.routeId];
            return (
              <li key={a.vehicleId} className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-slate-200">
                <p className="flex flex-wrap items-center gap-1.5 text-sm">
                  <RouteBadge route={route} size="sm" />
                  <span className="font-medium text-ink">{variant.headsignTh}</span>
                  {variant.isShortTurn && <ShortTurnBadge />}
                  <span className="text-ink-soft">· {formatEtaRange(a.etaRange)}</span>
                </p>
                <AlertToggle vehicleId={a.vehicleId} stopId={stop.id} variantId={a.variantId} etaSec={a.etaSec} />
              </li>
            );
          })}
        </ul>
      )}
      <p className="px-4 text-xs text-ink-muted">
        ต้นแบบนี้แจ้งเตือนได้เฉพาะตอนเปิดแอปค้างไว้ ถ้าย่อแท็บไว้นาน เบราว์เซอร์อาจแจ้งเตือนช้ากว่าปกติ
      </p>
    </Section>
  );
}

/** For the home page: alerts that are currently set. */
export function ActiveAlertsSection() {
  const { network } = useApp();
  const alerts = useArrivalAlerts();
  if (alerts.length === 0) return null;

  return (
    <Section title="การแจ้งเตือนที่ตั้งไว้">
      <ul className="space-y-2 px-4">
        {alerts.map((a) => {
          const variant = network.variantById[a.variantId];
          const route = variant ? network.routeById[variant.routeId] : undefined;
          const stop = network.stopById[a.stopId];
          if (!variant || !route || !stop) return null;
          return (
            <li key={a.id} className="flex items-center gap-2 rounded-xl bg-white p-3 text-sm ring-1 ring-slate-200">
              <BellRing aria-hidden className="h-4 w-4 shrink-0 text-emerald-700" />
              <RouteBadge route={route} size="sm" />
              <span className="min-w-0 flex-1 text-ink">
                ที่ป้าย{stop.nameTh} · เมื่อเหลือ ~{a.thresholdMin} นาที
              </span>
              <button
                type="button"
                onClick={() => removeAlert(a.id)}
                aria-label={`ยกเลิกการแจ้งเตือนสาย ${route.shortName} ที่ป้าย${stop.nameTh}`}
                className={btn.ghost}
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}