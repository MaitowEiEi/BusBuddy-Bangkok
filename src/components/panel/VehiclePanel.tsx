import { ShieldCheck } from 'lucide-react';
import { estimateEtaRange } from '../../domain/eta';
import { formatAgo, formatEtaRange, formatTimeWithSeconds } from '../../lib/format';
import { pickName, useLang, useT } from '../../lib/i18n';
import { statusLabel } from '../../lib/labels';
import { useApp } from '../../state/AppContext';
import { AmenityBadges } from '../ui/AmenityBadges';
import { DirectionBadge, QualityBadge, RouteBadge, ServiceBadge, ShortTurnBadge } from '../ui/Badges';
import { Banner } from '../ui/Banner';
import { OccupancyMeter } from '../ui/OccupancyMeter';
import { Section } from '../ui/Section';
import { NotFoundPanel, PanelHeader } from './PanelHeader';

export function VehiclePanel({ vehicleId }: { vehicleId: string }) {
  const { network, snapshot, now, navigate } = useApp();
  const lang = useLang();
  const tr = useT();
  const vehicle = network.vehicleById[vehicleId];
  if (!vehicle) return <NotFoundPanel title={tr('ไม่พบรถคันนี้', 'Bus not found')} />;

  const route = network.routeById[vehicle.routeId];
  const vs = snapshot?.vehicles.find((v) => v.vehicleId === vehicleId);
  const variant = vs ? network.variantById[vs.variantId] : null;
  const stopName = (id: string | undefined) => {
    const s = id ? network.stopById[id] : undefined;
    return s ? pickName(lang, s.nameTh, s.nameEn) : '-';
  };
  const layoverMin = vs ? Math.max(1, Math.ceil(vs.layoverRemainingSec / 60)) : 0;

  return (
    <div className="space-y-5 pb-8">
      <PanelHeader
        leading={<RouteBadge route={route} size="md" />}
        title={tr(`รถ ${vehicle.fleetCode}`, `Bus ${vehicle.fleetCode}`)}
        subtitle={tr('รหัสรถสมมติสำหรับต้นแบบ ไม่ใช่ทะเบียนรถจริง', 'Made-up ID for this prototype, not a real licence plate')}
      />
      <div className="px-4">
        <AmenityBadges vehicleId={vehicleId} />
      </div>

      {!vs || !variant ? (
        <p className="px-4 text-sm text-ink-muted">{tr('กำลังโหลดข้อมูลรถ…', 'Loading bus data…')}</p>
      ) : (
        <>
          <div className="space-y-3 px-4">
            <button
              type="button"
              onClick={() => navigate({ kind: 'route', variantId: variant.id })}
              className="block w-full rounded-xl p-3 text-left ring-1 ring-slate-200 hover:bg-slate-50"
            >
              <span className="block text-xs text-ink-muted">{tr('กำลังให้บริการ', 'Now running')}</span>
              <span className="block font-semibold">
                {route.shortName} {pickName(lang, variant.headsignTh, variant.headsignEn)}
              </span>
              <span className="mt-1 flex flex-wrap gap-1">
                <DirectionBadge direction={variant.direction} />
                {variant.isShortTurn && <ShortTurnBadge />}
                <ServiceBadge type={route.serviceType} />
              </span>
            </button>

            <dl className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
              <div>
                <dt className="inline font-medium">{tr('สถานะ: ', 'Status: ')}</dt>
                <dd className="inline">
                  {statusLabel(vs.status)}
                  {vs.status === 'layover' &&
                    tr(` (ออกประมาณอีก ${layoverMin} นาที)`, ` (leaves in about ${layoverMin} min)`)}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium">{tr('ป้ายถัดไป: ', 'Next stop: ')}</dt>
                <dd className="inline">{stopName(variant.stopIds[vs.nextStopIndex])}</dd>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <dt className="font-medium">{tr('ข้อมูลตำแหน่ง:', 'Position data:')}</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <QualityBadge quality={vs.quality} />
                  <span>
                    {tr(
                      `อัปเดต ${formatTimeWithSeconds(vs.lastUpdatedMs)} น. (${formatAgo(now, vs.lastUpdatedMs)})`,
                      `Updated ${formatTimeWithSeconds(vs.lastUpdatedMs)} (${formatAgo(now, vs.lastUpdatedMs)})`,
                    )}
                  </span>
                </dd>
              </div>
            </dl>

            {vs.quality === 'delayed' && (
              <Banner tone="warning" title={tr('ตำแหน่งรถไม่ได้อัปเดตสักพัก', 'Bus position hasn’t updated for a while')}>
                {tr('ตำแหน่งบนแผนที่และเวลาถึงอาจคลาดเคลื่อน', 'The map position and arrival times may be off.')}
              </Banner>
            )}
            {vs.quality === 'unavailable' && (
              <Banner tone="neutral" title={tr('ไม่ได้รับสัญญาณจากรถ', 'No signal from this bus')}>
                {tr(
                  'ตำแหน่งที่แสดงคือตำแหน่งล่าสุดที่ได้รับ ระบบจึงประมาณเวลาถึงและความหนาแน่นไม่ได้',
                  'This is the last position received, so arrival times and crowding can’t be estimated.',
                )}
              </Banner>
            )}

            <OccupancyMeter passengers={vs.passengers} seats={vehicle.seats} capacity={vehicle.capacity} crowd={vs.crowd} />
          </div>

          <Section title={tr('ป้ายถัดไปของรถคันนี้', 'Upcoming stops')}>
            <ul className="space-y-1 px-4">
              {vs.predictions.slice(0, 6).map((p) => (
                <li key={p.stopId}>
                  <button
                    type="button"
                    onClick={() => navigate({ kind: 'stop', stopId: p.stopId })}
                    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium">{stopName(p.stopId)}</span>
                    <span className="shrink-0 text-ink-soft">
                      {formatEtaRange(estimateEtaRange(p.etaSec, vs.quality, vs.staleSec, p.crossesDisruption))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}

      <p className="mx-4 flex gap-2 rounded-xl bg-slate-50 p-3 text-xs text-ink-soft ring-1 ring-slate-200">
        <ShieldCheck aria-hidden className="h-4 w-4 shrink-0 text-brand-700" />
        {tr(
          'หน้านี้ไม่แสดงข้อมูลพนักงานขับรถ ข้อมูลติดต่อพนักงาน ทะเบียนรถ หรือภาพจากกล้องใด ๆ ค่าความหนาแน่นเป็นค่าจำลอง ไม่ได้มาจากกล้องหรือโมเดล AI',
          'This page shows no driver details, staff contacts, licence plates or camera images. Crowding is simulated, not taken from cameras or AI.',
        )}
      </p>
    </div>
  );
}