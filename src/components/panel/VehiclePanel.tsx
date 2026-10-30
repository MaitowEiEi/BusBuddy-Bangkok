import { Check, ShieldCheck, X } from 'lucide-react';
import { estimateEtaRange } from '../../domain/eta';
import { formatAgo, formatEtaRange, formatTimeWithSeconds } from '../../lib/format';
import { STATUS_LABEL, VEHICLE_TYPE_LABEL } from '../../lib/labels';
import { useApp } from '../../state/AppContext';
import { DirectionBadge, QualityBadge, RouteBadge, ServiceBadge, ShortTurnBadge } from '../ui/Badges';
import { Banner } from '../ui/Banner';
import { OccupancyMeter } from '../ui/OccupancyMeter';
import { Section } from '../ui/Section';
import { NotFoundPanel, PanelHeader } from './PanelHeader';

export function VehiclePanel({ vehicleId }: { vehicleId: string }) {
  const { network, snapshot, now, navigate } = useApp();
  const vehicle = network.vehicleById[vehicleId];
  if (!vehicle) return <NotFoundPanel title="ไม่พบรถคันนี้" />;

  const route = network.routeById[vehicle.routeId];
  const vs = snapshot?.vehicles.find((v) => v.vehicleId === vehicleId);
  const variant = vs ? network.variantById[vs.variantId] : null;
  const a = vehicle.accessibility;
  const features: [string, boolean][] = [
    ['พื้นต่ำ ขึ้นลงสะดวก', a.lowFloor],
    ['ทางลาดสำหรับรถเข็น', a.ramp],
    [a.wheelchairSpaces > 0 ? `พื้นที่จอดรถเข็น ${a.wheelchairSpaces} ที่` : 'พื้นที่จอดรถเข็น', a.wheelchairSpaces > 0],
    ['ประกาศชื่อป้ายด้วยเสียง', a.audioAnnouncements],
    ['จอแสดงชื่อป้ายถัดไป', a.visualDisplay],
  ];

  return (
    <div className="space-y-5 pb-8">
      <PanelHeader
        leading={<RouteBadge route={route} size="md" />}
        title={`รถ ${vehicle.fleetCode}`}
        subtitle="รหัสรถสมมติสำหรับต้นแบบ ไม่ใช่ทะเบียนรถจริง"
      />

      {!vs || !variant ? (
        <p className="px-4 text-sm text-ink-muted">กำลังโหลดข้อมูลรถ…</p>
      ) : (
        <>
          <div className="space-y-3 px-4">
            <button
              type="button"
              onClick={() => navigate({ kind: 'route', variantId: variant.id })}
              className="block w-full rounded-xl p-3 text-left ring-1 ring-slate-200 hover:bg-slate-50"
            >
              <span className="block text-xs text-ink-muted">กำลังให้บริการ</span>
              <span className="block font-semibold">{route.shortName} {variant.headsignTh}</span>
              <span className="mt-1 flex flex-wrap gap-1">
                <DirectionBadge direction={variant.direction} />
                {variant.isShortTurn && <ShortTurnBadge />}
                <ServiceBadge type={route.serviceType} />
              </span>
            </button>

            <dl className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
              <div>
                <dt className="inline font-medium">สถานะ: </dt>
                <dd className="inline">
                  {STATUS_LABEL[vs.status]}
                  {vs.status === 'layover' && ` (ออกประมาณอีก ${Math.max(1, Math.ceil(vs.layoverRemainingSec / 60))} นาที)`}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium">ป้ายถัดไป: </dt>
                <dd className="inline">{network.stopById[variant.stopIds[vs.nextStopIndex]].nameTh}</dd>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <dt className="font-medium">ข้อมูลตำแหน่ง:</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <QualityBadge quality={vs.quality} />
                  <span>อัปเดต {formatTimeWithSeconds(vs.lastUpdatedMs)} น. ({formatAgo(now, vs.lastUpdatedMs)})</span>
                </dd>
              </div>
            </dl>

            {vs.quality === 'delayed' && (
              <Banner tone="warning" title="ตำแหน่งรถไม่ได้อัปเดตสักพัก">ตำแหน่งบนแผนที่และเวลาถึงอาจคลาดเคลื่อน</Banner>
            )}
            {vs.quality === 'unavailable' && (
              <Banner tone="neutral" title="ไม่ได้รับสัญญาณจากรถ">
                ตำแหน่งที่แสดงคือตำแหน่งล่าสุดที่ได้รับ ระบบจึงประมาณเวลาถึงและความหนาแน่นไม่ได้
              </Banner>
            )}

            <OccupancyMeter passengers={vs.passengers} seats={vehicle.seats} capacity={vehicle.capacity} crowd={vs.crowd} />
          </div>

          <Section title="ป้ายถัดไปของรถคันนี้">
            <ul className="space-y-1 px-4">
              {vs.predictions.slice(0, 6).map((p) => (
                <li key={p.stopId}>
                  <button
                    type="button"
                    onClick={() => navigate({ kind: 'stop', stopId: p.stopId })}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium">{network.stopById[p.stopId].nameTh}</span>
                    <span className="text-ink-soft">{formatEtaRange(estimateEtaRange(p.etaSec, vs.quality, vs.staleSec, p.crossesDisruption))}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}

      <Section title="ประเภทรถและสิ่งอำนวยความสะดวก (จำลอง)">
        <div className="space-y-2 px-4 text-sm">
          <p>{VEHICLE_TYPE_LABEL[vehicle.type]} · ที่นั่ง {vehicle.seats} ที่ · ความจุ {vehicle.capacity} คน</p>
          <ul className="grid gap-1">
            {features.map(([label, has]) => (
              <li key={label} className="flex items-center gap-2">
                {has ? <Check aria-hidden className="h-4 w-4 text-emerald-700" /> : <X aria-hidden className="h-4 w-4 text-slate-500" />}
                <span>{has ? 'มี' : 'ไม่มี'}: {label}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-muted">ข้อมูลสิ่งอำนวยความสะดวกเป็นข้อมูลสมมติ ไม่ใช่ข้อมูลรถจริง</p>
        </div>
      </Section>

      <p className="mx-4 flex gap-2 rounded-xl bg-slate-50 p-3 text-xs text-ink-soft ring-1 ring-slate-200">
        <ShieldCheck aria-hidden className="h-4 w-4 shrink-0 text-brand-700" />
        หน้านี้ไม่แสดงข้อมูลพนักงานขับรถ ข้อมูลติดต่อพนักงาน ทะเบียนรถ หรือภาพจากกล้องใด ๆ ค่าความหนาแน่นเป็นค่าจำลอง ไม่ได้มาจากกล้องหรือโมเดล AI
      </p>
    </div>
  );
}