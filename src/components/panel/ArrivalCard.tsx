import {
  AlertTriangle, Banknote, CheckCircle2, Footprints, MapPin, Route as RouteIcon, Signpost, XCircle, type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import { findLessCrowdedAlternative } from '../../domain/alternatives';
import { arrivalsForStop } from '../../domain/arrivals';
import { fareRangeFromStop } from '../../domain/fare';
import type { WalkFeasibility } from '../../domain/nearby';
import { formatAgo, formatClockRange, formatDistance, formatEtaRange, formatFareRange, formatTime } from '../../lib/format';
import { CROWD_LABEL } from '../../lib/labels';
import { useApp } from '../../state/AppContext';
import type { Arrival } from '../../types/transit';
import { CrowdBadge, DirectionBadge, InfoChip, QualityBadge, RouteBadge, ServiceBadge, ShortTurnBadge } from '../ui/Badges';
import { Banner } from '../ui/Banner';
import { btn } from '../ui/buttonStyles';
import { AmenityBadges } from '../ui/AmenityBadges';

interface ArrivalCardProps {
  arrival: Arrival;
  walk?: { distanceM: number; walkMin: number };
  feasibility?: WalkFeasibility;
  showStopName?: boolean;
}

const FEASIBILITY: Record<Exclude<WalkFeasibility, 'unknown'>, { text: string; cls: string; Icon: LucideIcon }> = {
  ok: { text: 'เดินไปทัน', cls: 'text-emerald-800', Icon: CheckCircle2 },
  tight: { text: 'อาจเดินไปไม่ทัน', cls: 'text-amber-800', Icon: AlertTriangle },
  miss: { text: 'น่าจะเดินไปไม่ทัน ลองรอคันถัดไป', cls: 'text-red-800', Icon: XCircle },
};

function etaContext(a: Arrival): string | null {
  if (a.mayHavePassed) return 'ข้อมูลล่าช้า รถอาจผ่านป้ายนี้ไปแล้ว';
  if (!a.etaRange) return 'ไม่ได้รับสัญญาณจากรถ ดูความถี่ตามตารางในหน้าเส้นทาง';
  if (a.status === 'layover') return 'รถยังรออยู่ที่ต้นทาง เวลาอาจเปลี่ยนตามเวลาออกรถจริง';
  if (a.etaRange.arriving) return null;
  if (a.stopsAway <= 0) return 'ป้ายนี้คือป้ายถัดไปของรถคันนี้';
  return `อีก ${a.stopsAway} ป้าย`;
}

export function ArrivalCard({ arrival: a, walk, feasibility, showStopName = false }: ArrivalCardProps) {
  const { network, snapshot, now, navigate } = useApp();
  const route = network.routeById[a.routeId];
  const variant = network.variantById[a.variantId];
  const stop = network.stopById[a.stopId];
  const fare = fareRangeFromStop(route, variant, a.stopIndex);

  const alternative = useMemo(() => {
    if (a.crowd !== 'crowded' || !snapshot) return null;
    return findLessCrowdedAlternative(network, arrivalsForStop(network, snapshot, a.stopId), a);
  }, [network, snapshot, a]);

  const alt = alternative && {
    route: network.routeById[alternative.arrival.routeId],
    variant: network.variantById[alternative.arrival.variantId],
    lastShared: network.stopById[alternative.sharedStopIds[alternative.sharedStopIds.length - 1]],
  };

  const context = etaContext(a);
  const feas = feasibility && feasibility !== 'unknown' ? FEASIBILITY[feasibility] : null;
  const clock = a.etaRange && !a.etaRange.arriving ? formatClockRange(now, a.etaRange) : null;

  return (
    <article aria-label={`สาย ${route.shortName} ${variant.headsignTh}`} className="rounded-2xl bg-white ring-1 ring-slate-200">
      <button
        type="button"
        onClick={() => navigate({ kind: 'vehicle', vehicleId: a.vehicleId })}
        className="block w-full rounded-2xl p-4 text-left hover:bg-slate-50"
      >
        <span className="flex items-start gap-3">
          <RouteBadge route={route} size="lg" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold leading-snug">{variant.headsignTh}</span>
            <span className="mt-1 flex flex-wrap gap-1">
              <DirectionBadge direction={a.direction} />
              {variant.isShortTurn && <ShortTurnBadge />}
              <ServiceBadge type={route.serviceType} />
            </span>
          </span>
        </span>

        <span className="mt-3 block">
          <span className="text-xl font-bold">{formatEtaRange(a.etaRange)}</span>
          {clock && <span className="ml-2 text-sm text-ink-muted">({clock} น.)</span>}
          {context && <span className="block text-sm text-ink-soft">{context}</span>}
        </span>

        <span className="mt-3 flex flex-wrap gap-1.5">
          <CrowdBadge level={a.crowd} passengers={a.passengers} capacity={a.capacity} />
          <InfoChip icon={Banknote}>ค่าโดยสาร ~{formatFareRange(fare)}</InfoChip>
          {walk && <InfoChip icon={Footprints}>เดิน {formatDistance(walk.distanceM)} · ~{walk.walkMin} นาที</InfoChip>}
        </span>

        {showStopName && (
          <span className="mt-2 flex items-center gap-1.5 text-sm">
            <MapPin aria-hidden className="h-4 w-4 text-brand-700" />
            ขึ้นที่ป้าย{stop.nameTh}
          </span>
        )}
        {feas && (
          <span className={`mt-1 flex items-center gap-1.5 text-sm font-medium ${feas.cls}`}>
            <feas.Icon aria-hidden className="h-4 w-4" />
            {feas.text}
          </span>
        )}

        <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <QualityBadge quality={a.quality} />
          <span>อัปเดต {formatTime(a.lastUpdatedMs)} น. ({formatAgo(now, a.lastUpdatedMs)})</span>
        </span>
        <span className="sr-only">แตะเพื่อดูรายละเอียดรถคันนี้</span>
      </button>
      
      <div className="px-4 pb-3">
        <AmenityBadges vehicleId={a.vehicleId} size="sm" />
      </div>

      {(a.crowd === 'crowded' || a.crossesDisruption) && (
        <div className="space-y-2 px-4 pb-3">
          {a.crowd === 'crowded' &&
            (alt && alternative ? (
              <Banner tone="warning" title="รถคันนี้แน่นมาก มีทางเลือกที่แน่นน้อยกว่า">
                <p>
                  สาย {alt.route.shortName} {alt.variant.headsignTh} · {formatEtaRange(alternative.arrival.etaRange)} ·{' '}
                  {CROWD_LABEL[alternative.arrival.crowd].short}
                </p>
                <p>
                  {alternative.coversAll
                    ? 'จอดทุกป้ายที่เหลือของคันนี้'
                    : `ไปทางเดียวกันถึงป้าย${alt.lastShared.nameTh} จากนั้นแยกไปคนละทาง โปรดตรวจว่าป้ายที่จะลงอยู่ในช่วงนี้`}
                </p>
                <button
                  type="button"
                  onClick={() => navigate({ kind: 'vehicle', vehicleId: alternative.arrival.vehicleId })}
                  className="mt-1 min-h-9 font-semibold underline"
                >
                  ดูรถทางเลือกคันนี้
                </button>
              </Banner>
            ) : (
              <Banner tone="warning" title="รถคันนี้แน่นมาก">
                ตอนนี้ยังไม่พบรถคันอื่นที่ไปทางเดียวกันและแน่นน้อยกว่า ลองรอคันถัดไป
              </Banner>
            ))}
          {a.crossesDisruption && (
            <Banner tone="disruption" title="เส้นทางข้างหน้ามีเหตุขัดข้อง">
              {snapshot?.disruption?.alternativeHintTh ?? 'เวลาเดินทางอาจนานกว่าปกติ'}
            </Banner>
          )}
        </div>
      )}

      <div className="flex flex-wrap border-t border-slate-100 px-1">
        <button type="button" onClick={() => navigate({ kind: 'route', variantId: a.variantId })} className={btn.ghost}>
          <RouteIcon aria-hidden className="h-4 w-4" />
          ดูเส้นทางและป้ายทั้งหมด
        </button>
        {showStopName && (
          <button type="button" onClick={() => navigate({ kind: 'stop', stopId: a.stopId })} className={btn.ghost}>
            <Signpost aria-hidden className="h-4 w-4" />
            ดูป้ายนี้
          </button>
        )}
      </div>
    </article>
  );
}