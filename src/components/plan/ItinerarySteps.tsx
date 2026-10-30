import {
  AlertTriangle, Bus, CheckCircle2, Flag, Footprints, GitFork, MapPin, Navigation, Shuffle, XCircle, type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { boardingGuidance } from '../../domain/boarding';
import type { Itinerary, ItineraryLeg } from '../../domain/planner';
import { formatDistance, formatEtaRange, formatFareRange } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { CrowdBadge, QualityBadge, RouteBadge, ShortTurnBadge } from '../ui/Badges';
import { Banner } from '../ui/Banner';
import { btn } from '../ui/buttonStyles';

const CATCH: Record<'ok' | 'tight' | 'miss', { text: string; cls: string; Icon: LucideIcon }> = {
  ok: { text: 'เดินไปทันคันนี้ (ประมาณการ)', cls: 'text-emerald-800', Icon: CheckCircle2 },
  tight: { text: 'อาจเดินไปไม่ทันคันนี้ ถ้าพลาดให้รอคันถัดไป', cls: 'text-amber-800', Icon: AlertTriangle },
  miss: { text: 'น่าจะเดินไปไม่ทันคันนี้', cls: 'text-red-800', Icon: XCircle },
};

function Step({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-ink-soft">
        <Icon aria-hidden className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="font-semibold text-ink">{title}</p>
        {children && <div className="mt-1 space-y-1.5 text-ink-soft">{children}</div>}
      </div>
    </li>
  );
}

function divergenceText(leg: ItineraryLeg, alightName: string, splitName: string): string {
  if (!leg.divergence) return '';
  if (leg.divergence.beforeAlight) {
    return `แต่ละสายแยกเส้นทางกันหลังป้าย${splitName} แต่ไปถึงป้าย${alightName}เหมือนกัน เวลาเดินทางอาจต่างกัน`;
  }
  if (leg.divergence.stopId === leg.alightStopId) {
    return `ลงที่ป้าย${alightName}ให้ตรงป้าย หลังจากป้ายนี้รถแต่ละคันจะไปคนละทาง`;
  }
  return `รถทุกคันในรายการนี้วิ่งเส้นทางเดียวกันจนถึงป้าย${splitName} แล้วจึงแยกกัน ป้ายที่คุณลงอยู่ก่อนจุดแยก`;
}

function LegSteps({ itinerary: it, leg, index }: { itinerary: Itinerary; leg: ItineraryLeg; index: number }) {
  const { network, snapshot, navigate } = useApp();
  const board = network.stopById[leg.boardStopId];
  const alight = network.stopById[leg.alightStopId];
  const variant = network.variantById[leg.chosen.variantId];
  const route = network.routeById[variant.routeId];
  const vehicleId = leg.vehicleId;
  const waitMin = Math.max(0, Math.round(leg.waitSec / 60));
  const rideMin = Math.max(1, Math.round(leg.rideSec / 60));
  const avoid = leg.avoidVariantIds.map((id) => network.variantById[id]);
  const transferGapSec = index > 0 ? leg.boardAtSec - it.legs[index - 1].alightAtSec : null;
  const catchInfo = index === 0 && it.catchFeasibility !== 'unknown' ? CATCH[it.catchFeasibility] : null;
  const leaveWithinMin =
    index === 0 && it.access.distanceM > 0 && leg.vehicleEta && !leg.vehicleEta.arriving
      ? leg.vehicleEta.minMin - it.access.walkMin - 1
      : null;

  return (
    <>
      <Step icon={index === 0 ? MapPin : Shuffle} title={index === 0 ? `ขึ้นรถที่ป้าย${board.nameTh}` : `เปลี่ยนรถที่ป้าย${board.nameTh}`}>
        <p>{leg.options.length > 1 ? `ขึ้นคันไหนก็ได้ในรายการนี้ ทุกคันไปถึงป้าย${alight.nameTh}` : 'สายที่ต้องขึ้น'}</p>
        <ul className="space-y-1">
          {leg.options.map((o) => {
            const v = network.variantById[o.variantId];
            return (
              <li key={o.variantId} className="flex flex-wrap items-center gap-1.5 text-ink">
                <RouteBadge route={network.routeById[v.routeId]} size="sm" />
                <span>{v.headsignTh}</span>
                {v.isShortTurn && <ShortTurnBadge />}
              </li>
            );
          })}
        </ul>

        {leg.divergence && (
          <p className="flex items-start gap-1.5">
            <GitFork aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            {divergenceText(leg, alight.nameTh, network.stopById[leg.divergence.stopId].nameTh)}
          </p>
        )}

        {avoid.length > 0 && (
          <Banner tone="warning" title="ระวังขึ้นผิดคัน">
            {avoid.map((v) => `${network.routeById[v.routeId].shortName} ${v.headsignTh}`).join(', ')} ไม่ไปถึงป้าย
            {alight.nameTh} ดูป้ายหน้ารถก่อนขึ้น
          </Banner>
        )}

        {leg.source === 'live' && vehicleId ? (
          <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <p className="text-ink">
              <strong>คันที่แนะนำ:</strong> {route.shortName} รถ {network.vehicleById[vehicleId]?.fleetCode ?? '-'} ·{' '}
              {formatEtaRange(leg.vehicleEta)}
            </p>
            <p>
              {index === 0
                ? `ไปถึงป้ายแล้วรอประมาณ ${waitMin} นาที`
                : `ลงจากคันแรกแล้วรอต่อรถประมาณ ${Math.max(0, Math.round((transferGapSec ?? 0) / 60))} นาที`}
            </p>
            <span className="flex flex-wrap gap-1.5">
              <CrowdBadge level={leg.crowd} />
              {leg.quality && <QualityBadge quality={leg.quality} />}
            </span>
            <button type="button" onClick={() => navigate({ kind: 'vehicle', vehicleId })} className={btn.ghost}>
              ดูรถคันนี้บนแผนที่
            </button>
          </div>
        ) : (
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <p className="font-semibold text-ink">ยังไม่มีข้อมูลรถสดที่ทันในช่วงนี้</p>
            <p>
              ตามตารางเดินรถ (จำลอง) รถมาทุกประมาณ {Math.round(leg.headwayMin)} นาที จึงคิดเวลารอเฉลี่ย ~{waitMin} นาที
            </p>
          </div>
        )}

        {catchInfo && (
          <p className={`flex items-center gap-1.5 font-medium ${catchInfo.cls}`}>
            <catchInfo.Icon aria-hidden className="h-4 w-4 shrink-0" />
            {catchInfo.text}
          </p>
        )}
        {leaveWithinMin !== null && leaveWithinMin >= 2 && (
          <p>ยังไม่ต้องรีบ: ออกเดินภายในประมาณ {leaveWithinMin} นาทีก็น่าจะทัน</p>
        )}
        {transferGapSec !== null && leg.source === 'live' && transferGapSec < 240 && (
          <Banner tone="warning" title="เวลาต่อรถกระชั้น">
            ถ้าคันแรกช้ากว่าที่คาด อาจพลาดคันนี้ ตามตารางคันถัดไปมาประมาณทุก {Math.round(leg.headwayMin)} นาที
          </Banner>
        )}
        <p className="flex items-start gap-1.5">
          <Navigation aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {boardingGuidance(network, variant, leg.chosen.boardIndex)}
        </p>
      </Step>

      <Step icon={Bus} title={`นั่ง ${leg.stopsCount} ป้าย แล้วลงที่ป้าย${alight.nameTh}`}>
        <p>อยู่บนรถประมาณ {rideMin} นาที · ค่าโดยสาร ~{formatFareRange(leg.fare)}</p>
        {leg.crossesDisruption && (
          <Banner tone="disruption" title="ช่วงนี้มีเหตุขัดข้อง">
            {snapshot?.disruption?.titleTh ?? 'อาจใช้เวลานานกว่าปกติ'} · เวลาที่แสดงรวมความล่าช้าโดยประมาณแล้ว
          </Banner>
        )}
        <button type="button" onClick={() => navigate({ kind: 'route', variantId: variant.id })} className={btn.ghost}>
          ดูป้ายทั้งหมดของสาย {route.shortName}
        </button>
      </Step>
    </>
  );
}

export function ItinerarySteps({ itinerary: it, destinationLabel }: { itinerary: Itinerary; destinationLabel: string }) {
  const { network } = useApp();
  const accessStop = network.stopById[it.access.stopId];

  return (
    <div className="border-t border-slate-100 p-4">
      <h4 className="sr-only">ขั้นตอนการเดินทาง</h4>
      <ol className="space-y-4 text-sm">
        {it.access.distanceM > 0 && (
          <Step icon={Footprints} title={`เดินไปป้าย${accessStop.nameTh}`}>
            <p>{formatDistance(it.access.distanceM)} · ประมาณ {it.access.walkMin} นาที</p>
          </Step>
        )}
        {it.legs.map((leg, i) => (
          <LegSteps key={`${leg.boardStopId}-${i}`} itinerary={it} leg={leg} index={i} />
        ))}
        {it.egress.distanceM > 0 ? (
          <Step icon={Footprints} title={`เดินต่อไป${destinationLabel}`}>
            <p>{formatDistance(it.egress.distanceM)} · ประมาณ {it.egress.walkMin} นาที</p>
          </Step>
        ) : (
          <Step icon={Flag} title={`ถึง${destinationLabel}`} />
        )}
      </ol>
      <p className="mt-3 text-xs text-ink-muted">ระยะเดินประมาณจากระยะเส้นตรง × 1.25 อาจต่างจากทางเดินจริง</p>
    </div>
  );
}