import { ArrowLeftRight, Bus, CalendarClock, GitBranch } from 'lucide-react';
import { useMemo } from 'react';
import { estimateEtaRange } from '../../domain/eta';
import { shortTurnSkippedStops } from '../../domain/lookup';
import { frequencyAt, isInServiceHours } from '../../domain/schedule';
import { bangkokMinutesOfDay, formatEtaRange } from '../../lib/format';
import { CROWD_LABEL, QUALITY_LABEL, STATUS_LABEL } from '../../lib/labels';
import { useApp } from '../../state/AppContext';
import type { Route, VehicleLiveState } from '../../types/transit';
import { FavoriteButton } from '../FavoriteButton';
import { NoticeList } from '../NoticeList';
import { DirectionBadge, RouteBadge, ServiceBadge, ShortTurnBadge } from '../ui/Badges';
import { Banner } from '../ui/Banner';
import { btn } from '../ui/buttonStyles';
import { Section } from '../ui/Section';
import { NotFoundPanel, PanelHeader } from './PanelHeader';
import { RouteTimetableSection } from '../schedule/TimetableSections';

function fareText(route: Route): string {
  const f = route.fare;
  return f.kind === 'flat' ? `${f.amountThb} บาทตลอดสาย` : `${f.baseThb}–${f.maxThb} บาท ตามระยะทาง`;
}

function VehicleChip({ vs, note }: { vs: VehicleLiveState; note: string }) {
  const { network, navigate } = useApp();
  const vehicle = network.vehicleById[vs.vehicleId];
  return (
    <button
      type="button"
      onClick={() => navigate({ kind: 'vehicle', vehicleId: vs.vehicleId })}
      className="my-1 flex min-h-11 w-full items-center gap-2 rounded-xl bg-brand-50 px-3 py-1.5 text-left text-sm ring-1 ring-brand-200 hover:bg-brand-100"
    >
      <Bus aria-hidden className="h-4 w-4 shrink-0 text-brand-700" />
      <span>
        <strong className="font-mono">{vehicle.fleetCode}</strong> · {note} · {CROWD_LABEL[vs.crowd].short}
        {vs.quality !== 'live' && ` · ${QUALITY_LABEL[vs.quality].short}`}
      </span>
    </button>
  );
}

export function RoutePanel({ variantId }: { variantId: string }) {
  const { network, snapshot, now, navigate } = useApp();
  const variant = network.variantById[variantId];
  const onVariant = useMemo(() => snapshot?.vehicles.filter((v) => v.variantId === variantId) ?? [], [snapshot, variantId]);

  if (!variant) return <NotFoundPanel title="ไม่พบเส้นทางนี้" />;

  const route = network.routeById[variant.routeId];
  const twin = network.variants.find((v) => v.routeId === route.id && v.isShortTurn === variant.isShortTurn && v.direction !== variant.direction);
  const otherPattern = network.variants.find((v) => v.routeId === route.id && v.isShortTurn !== variant.isShortTurn && v.direction === variant.direction);
  const skipped = shortTurnSkippedStops(network, variant);
  const period = frequencyAt(route, bangkokMinutesOfDay(now));
  const inService = isInServiceHours(route, now);
  const lastIndex = variant.stopIds.length - 1;

  const soonestAt = (stopIndex: number) => {
    let best: { etaSec: number; vs: VehicleLiveState; crosses: boolean } | null = null;
    for (const vs of onVariant) {
      const p = vs.predictions.find((x) => x.stopIndex === stopIndex);
      if (p && p.etaSec !== null && (!best || p.etaSec < best.etaSec)) best = { etaSec: p.etaSec, vs, crosses: p.crossesDisruption };
    }
    return best;
  };

  return (
    <div className="space-y-5 pb-8">
      <PanelHeader
        leading={<RouteBadge route={route} size="md" />}
        title={variant.headsignTh}
        subtitle={`${route.nameTh} · ${variant.variantLabelTh}`}
        actions={<FavoriteButton kind="variant" id={variant.id} labelTh={`สาย ${route.shortName} ${variant.headsignTh}`} />}
      />

      <div className="flex flex-wrap gap-1.5 px-4">
        <DirectionBadge direction={variant.direction} />
        {variant.isShortTurn && <ShortTurnBadge />}
        <ServiceBadge type={route.serviceType} />
      </div>

      <div className="flex flex-wrap gap-2 px-4">
        {twin && (
          <button type="button" onClick={() => navigate({ kind: 'route', variantId: twin.id })} className={btn.secondary}>
            <ArrowLeftRight aria-hidden className="h-4 w-4" />
            ทิศทางตรงข้าม: {twin.headsignTh}
          </button>
        )}
        {otherPattern && (
          <button type="button" onClick={() => navigate({ kind: 'route', variantId: otherPattern.id })} className={btn.secondary}>
            <GitBranch aria-hidden className="h-4 w-4" />
            {otherPattern.isShortTurn ? 'ดูเที่ยวสั้นของสายนี้' : 'ดูเที่ยวปกติ (เต็มสาย)'}
          </button>
        )}
      </div>

      {skipped.length > 0 && (
        <div className="px-4">
          <Banner tone="info" title="เที่ยวสั้น: ไม่ได้วิ่งเต็มสาย">
            ไม่จอดที่ {skipped.map((s) => s.nameTh).join(', ')} ถ้าจะไปป้ายเหล่านี้ให้รอสาย {route.shortName} เที่ยวปกติ
          </Banner>
        </div>
      )}

      <NoticeList routeIds={[route.id]} />

      <section aria-label="ตารางเดินรถ" className="mx-4 space-y-1 rounded-2xl bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
        <p className="flex items-center gap-1.5 font-semibold">
          <CalendarClock aria-hidden className="h-4 w-4" />
          ตามตารางเดินรถ (จำลอง)
        </p>
        <p>เที่ยวแรก {route.firstDeparture} น. · เที่ยวสุดท้าย {route.lastDeparture} น.</p>
        <p>
          ความถี่ช่วงนี้:{' '}
          {period ? `${period.labelTh} ทุก ${period.headwayMin[0]}–${period.headwayMin[1]} นาที` : 'นอกช่วงเวลาให้บริการตามตาราง'}
        </p>
        <p>ค่าโดยสาร: {fareText(route)}</p>
        <p className="text-xs text-ink-muted">
          ตารางเดินรถคือแผนที่วางไว้ ส่วนเวลาในรายการป้ายด้านล่างเป็นค่าประมาณจากตำแหน่งรถ
        </p>
      </section>

      {!inService && (
        <div className="px-4">
          <Banner tone="neutral" title="ขณะนี้อยู่นอกเวลาให้บริการตามตาราง">
            ในต้นแบบ รถจำลองยังวิ่งตลอดเวลาเพื่อให้ทดสอบหน้าจอได้ บริการจริงอาจไม่มีรถในช่วงนี้
          </Banner>
        </div>
      )}

      <Section title={`ป้ายทั้งหมด ${variant.stopIds.length} ป้าย (เรียงตามทิศทางรถ)`}>
        {snapshot && onVariant.length === 0 && (
          <p className="px-4 text-sm text-ink-soft">ขณะนี้ไม่มีรถจำลองวิ่งในทิศทางนี้ ดูความถี่ตามตารางด้านบน</p>
        )}
        <ol className="ml-7 mr-4 border-l-4" style={{ borderColor: route.color }}>
          {variant.stopIds.map((sid, i) => {
            const stop = network.stopById[sid];
            const between = onVariant.filter((v) => v.status === 'moving' && v.nextStopIndex === i);
            const atStop = onVariant.filter((v) => v.atStopIndex === i);
            const soonest = soonestAt(i);
            const range = soonest ? estimateEtaRange(soonest.etaSec, soonest.vs.quality, soonest.vs.staleSec, soonest.crosses) : null;
            return (
              <li key={sid} className="relative py-1 pl-5">
                {between.map((v) => <VehicleChip key={v.vehicleId} vs={v} note={`กำลังวิ่งมาป้าย${stop.nameTh}`} />)}
                <span
                  aria-hidden
                  className="absolute -left-[0.7rem] top-[1.1rem] h-4 w-4 rounded-full border-4 bg-white"
                  style={{ borderColor: route.color, marginTop: between.length ? `${between.length * 3.25}rem` : undefined }}
                />
                <button
                  type="button"
                  onClick={() => navigate({ kind: 'stop', stopId: sid })}
                  className="block min-h-11 w-full rounded-lg py-1 text-left hover:bg-slate-50"
                >
                  <span className="block font-medium">
                    {stop.nameTh}
                    {i === 0 && <span className="ml-2 text-xs font-normal text-ink-muted">(ต้นทาง)</span>}
                    {i === lastIndex && <span className="ml-2 text-xs font-normal text-ink-muted">(ปลายทาง)</span>}
                  </span>
                  {i < lastIndex && range && (
                    <span className="block text-xs text-ink-soft">
                      คันถัดไป {i === 0 ? 'ออกจากต้นทาง' : 'ถึง'} {formatEtaRange(range)} (ประมาณการ)
                    </span>
                  )}
                </button>
                {atStop.map((v) => (
                  <VehicleChip key={v.vehicleId} vs={v} note={STATUS_LABEL[v.status]} />
                ))}
              </li>
            );
          })}
        </ol>
      </Section>
    <RouteTimetableSection variantId={variantId} />
    </div>
  );
}