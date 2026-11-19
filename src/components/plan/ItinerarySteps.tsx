import {
  AlertTriangle, Bus, CheckCircle2, Flag, Footprints, GitFork, MapPin, Navigation, Shuffle, TrainFront, XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { boardingGuidance } from '../../domain/boarding';
import { stopLabel } from '../../domain/lookup';
import type { Itinerary, ItineraryLeg } from '../../domain/planner';
import { formatDistance, formatEtaRange, formatFareRange, formatMinutes } from '../../lib/format';
import { pickName, useLang, useT } from '../../lib/i18n';
import { useApp } from '../../state/AppContext';
import type { Route, RouteVariant } from '../../types/transit';
import { AlertToggle } from '../alerts/AlertToggle';
import { AlightAlarmToggle } from '../alerts/AlightAlarmToggle';
import { CrowdBadge, QualityBadge, RouteBadge, ShortTurnBadge } from '../ui/Badges';
import { Banner } from '../ui/Banner';
import { btn } from '../ui/buttonStyles';
import { ConductorCard } from './ConductorCard';

type Tr = (th: string, en: string) => string;

const CATCH: Record<'ok' | 'tight' | 'miss', { th: string; en: string; cls: string; Icon: LucideIcon }> = {
  ok: { th: 'เดินไปทันคันนี้ (ประมาณการ)', en: 'You should make this one (estimate)', cls: 'text-emerald-800', Icon: CheckCircle2 },
  tight: { th: 'อาจเดินไปไม่ทันคันนี้ ถ้าพลาดให้รอคันถัดไป', en: 'You might miss this one. If so, take the next.', cls: 'text-amber-800', Icon: AlertTriangle },
  miss: { th: 'น่าจะเดินไปไม่ทันคันนี้', en: 'You probably won’t make this one', cls: 'text-red-800', Icon: XCircle },
};

const isRail = (route: Route | undefined): boolean => !!route?.mode && route.mode !== 'bus';

function scheduleText(route: Route, tr: Tr): string {
  switch (route.scheduleSource) {
    case 'today':
      return tr('ตามตารางเดินรถของ สนข. สำหรับวันนี้', 'OTP timetable for today');
    case 'other_day':
      return tr('ตามตารางเดินรถของ สนข. (วันนี้ไม่มีตาราง จึงใช้ของวันอื่น)', 'OTP timetable (none for today, using another day)');
    case 'estimated':
      return tr('ตามตารางเดินรถโดยประมาณ', 'Estimated timetable');
    default:
      return tr('ตามตารางเดินรถ (จำลอง)', 'Timetable (simulated)');
  }
}

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

function divergenceText(leg: ItineraryLeg, alightLabel: string, splitLabel: string, tr: Tr): string {
  if (!leg.divergence) return '';
  if (leg.divergence.beforeAlight) {
    return tr(
      `แต่ละสายแยกเส้นทางกันหลัง${splitLabel} แต่ไปถึง${alightLabel}เหมือนกัน เวลาเดินทางอาจต่างกัน`,
      `These routes split after ${splitLabel} but all reach ${alightLabel}. Travel times may differ.`,
    );
  }
  if (leg.divergence.stopId === leg.alightStopId) {
    return tr(
      `ลงที่${alightLabel}ให้ตรงจุด หลังจากนี้แต่ละคันจะไปคนละทาง`,
      `Get off exactly at ${alightLabel}. After that, each one goes a different way.`,
    );
  }
  return tr(
    `ทุกคันในรายการนี้วิ่งเส้นทางเดียวกันจนถึง${splitLabel} แล้วจึงแยกกัน จุดที่คุณลงอยู่ก่อนจุดแยก`,
    `All of these follow the same road until ${splitLabel}. Your stop comes before they split.`,
  );
}

function LegSteps({ itinerary: it, leg, index }: { itinerary: Itinerary; leg: ItineraryLeg; index: number }) {
  const { network, snapshot, navigate } = useApp();
  const lang = useLang();
  const tr = useT();
  const en = lang === 'en';
  const board = network.stopById[leg.boardStopId];
  const alight = network.stopById[leg.alightStopId];
  const variant = network.variantById[leg.chosen.variantId];
  const route = network.routeById[variant.routeId];
  const rail = isRail(route);
  const labelOf = (id: string) => {
    const s = network.stopById[id];
    return s ? stopLabel(network, s, lang) : '';
  };
  const headsign = (v: RouteVariant) => pickName(lang, v.headsignTh, v.headsignEn);
  const boardLabel = stopLabel(network, board, lang);
  const alightLabel = stopLabel(network, alight, lang);
  const unitTh = rail ? 'สถานี' : 'ป้าย';
  const rideTh = rail ? 'รถไฟฟ้า' : 'รถ';
  const rideEn = rail ? 'train' : 'bus';
  const vehTh = rail ? 'ขบวน' : 'คัน';
  const stopsEn = `${leg.stopsCount} ${rail ? 'station' : 'stop'}${leg.stopsCount === 1 ? '' : 's'}`;

  const prev = index > 0 ? it.legs[index - 1] : null;
  const walk = leg.transferWalk;
  const walkFromLabel = walk ? labelOf(walk.fromStopId) : '';
  const vehicleId = leg.vehicleId;
  const waitMin = Math.max(0, Math.round(leg.waitSec / 60));
  const rideMin = Math.max(1, Math.round(leg.rideSec / 60));
  const headwayMin = Math.round(leg.headwayMin);
  const avoid = leg.avoidVariantIds.map((id) => network.variantById[id]).filter(Boolean);
  const transferGapSec = prev ? leg.boardAtSec - prev.alightAtSec - (walk?.walkMin ?? 0) * 60 : null;
  const transferWaitMin = Math.max(0, Math.round((transferGapSec ?? 0) / 60));
  const catchInfo = index === 0 && it.catchFeasibility !== 'unknown' ? CATCH[it.catchFeasibility] : null;
  const leaveWithinMin =
    index === 0 && it.access.distanceM > 0 && leg.vehicleEta && !leg.vehicleEta.arriving
      ? leg.vehicleEta.minMin - it.access.walkMin - 1
      : null;

  const boardTitle =
    index === 0
      ? tr(`ขึ้น${rideTh}ที่${boardLabel}`, `Board the ${rideEn} at ${boardLabel}`)
      : walk
        ? tr(`ขึ้น${rideTh}ต่อที่${boardLabel}`, `Board the next ${rideEn} at ${boardLabel}`)
        : tr(`เปลี่ยนรถที่${boardLabel}`, `Change at ${boardLabel}`);

  return (
    <>
      {walk && (
        <Step icon={Footprints} title={tr(`ลงแล้วเดินไป${boardLabel}`, `Get off and walk to ${boardLabel}`)}>
          <p>
            {walkFromLabel ? `${tr('จาก', 'From ')}${walkFromLabel} · ` : ''}
            {formatDistance(walk.distanceM)} · {tr('ประมาณ', 'about')} {formatMinutes(walk.walkMin)}
          </p>
          {rail && (
            <p>{tr('เผื่อเวลาขึ้นบันไดหรือลิฟต์ และแตะบัตรเข้าสถานีด้วย', 'Allow time for stairs or lifts and the ticket gates.')}</p>
          )}
        </Step>
      )}

      <Step icon={rail ? TrainFront : index === 0 ? MapPin : Shuffle} title={boardTitle}>
        <p>
          {leg.options.length > 1
            ? tr(
                `ขึ้น${vehTh}ไหนก็ได้ในรายการนี้ ทุก${vehTh}ไปถึง${alightLabel}`,
                `Any of these ${rail ? 'trains' : 'buses'} will take you to ${alightLabel}`,
              )
            : tr('สายที่ต้องขึ้น', rail ? 'Line to take' : 'Route to take')}
        </p>
        <ul className="space-y-1">
          {leg.options.map((o) => {
            const v = network.variantById[o.variantId];
            return (
              <li key={o.variantId} className="flex flex-wrap items-center gap-1.5 text-ink">
                <RouteBadge route={network.routeById[v.routeId]} size="sm" />
                <span>{rail ? tr(`มุ่งหน้า${headsign(v)}`, `towards ${headsign(v)}`) : headsign(v)}</span>
                {v.isShortTurn && <ShortTurnBadge />}
              </li>
            );
          })}
        </ul>

        {leg.divergence && (
          <p className="flex items-start gap-1.5">
            <GitFork aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            {divergenceText(leg, alightLabel, labelOf(leg.divergence.stopId), tr)}
          </p>
        )}

        {avoid.length > 0 && (
          <Banner
            tone="warning"
            title={rail ? tr('ระวังขึ้นผิดขบวน', 'Don’t take the wrong train') : tr('ระวังขึ้นผิดคัน', 'Don’t take the wrong bus')}
          >
            {avoid.map((v) => `${network.routeById[v.routeId].shortName} ${headsign(v)}`).join(', ')}{' '}
            {tr(`ไม่ไปถึง${alightLabel}`, `does not go to ${alightLabel}.`)}{' '}
            {rail
              ? tr('ดูจอบอกปลายทางที่ชานชาลาก่อนขึ้น', 'Check the destination screen on the platform.')
              : tr('ดูป้ายหน้ารถก่อนขึ้น', 'Check the sign on the front of the bus.')}
          </Banner>
        )}

        {leg.source === 'live' && vehicleId ? (
          <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <p className="text-ink">
              <strong>{tr('คันที่แนะนำ:', 'Suggested bus:')}</strong>{' '}
              {tr(
                `${route.shortName} รถ ${network.vehicleById[vehicleId]?.fleetCode ?? '-'}`,
                `${route.shortName} #${network.vehicleById[vehicleId]?.fleetCode ?? '-'}`,
              )}{' '}
              · {formatEtaRange(leg.vehicleEta)}
            </p>
            <p>
              {index === 0
                ? tr(`ไปถึงป้ายแล้วรอประมาณ ${waitMin} นาที`, `Wait about ${waitMin} min at the stop`)
                : walk
                  ? tr(`เดินถึงแล้วรอต่อรถประมาณ ${transferWaitMin} นาที`, `After the walk, wait about ${transferWaitMin} min`)
                  : tr(`ลงจากคันแรกแล้วรอต่อรถประมาณ ${transferWaitMin} นาที`, `After getting off, wait about ${transferWaitMin} min`)}
            </p>
            <span className="flex flex-wrap gap-1.5">
              <CrowdBadge level={leg.crowd} />
              {leg.quality && <QualityBadge quality={leg.quality} />}
            </span>
            <button type="button" onClick={() => navigate({ kind: 'vehicle', vehicleId })} className={btn.ghost}>
              {tr('ดูรถคันนี้บนแผนที่', 'Show this bus on the map')}
            </button>
            <AlertToggle vehicleId={vehicleId} stopId={leg.boardStopId} variantId={leg.chosen.variantId} etaSec={leg.boardAtSec} />
          </div>
        ) : (
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <p className="font-semibold text-ink">
              {rail
                ? tr('ยังไม่มีตำแหน่งขบวนรถไฟฟ้าแบบสด', 'No live train positions')
                : tr('ยังไม่มีข้อมูลรถสดที่ทันในช่วงนี้', 'No live bus you can catch right now')}
            </p>
            <p>
              {tr(
                `${scheduleText(route, tr)} ${rideTh}มาทุกประมาณ ${headwayMin} นาที จึงคิดเวลารอเฉลี่ย ~${waitMin} นาที`,
                `${scheduleText(route, tr)}: a ${rideEn} about every ${headwayMin} min, so the average wait is ~${waitMin} min.`,
              )}
            </p>
          </div>
        )}

        {catchInfo && (
          <p className={`flex items-center gap-1.5 font-medium ${catchInfo.cls}`}>
            <catchInfo.Icon aria-hidden className="h-4 w-4 shrink-0" />
            {tr(catchInfo.th, catchInfo.en)}
          </p>
        )}
        {leaveWithinMin !== null && leaveWithinMin >= 2 && (
          <p>
            {tr(
              `ยังไม่ต้องรีบ: ออกเดินภายในประมาณ ${leaveWithinMin} นาทีก็น่าจะทัน`,
              `No rush: leaving within about ${leaveWithinMin} min should be fine.`,
            )}
          </p>
        )}
        {transferGapSec !== null && leg.source === 'live' && transferGapSec < 240 && (
          <Banner tone="warning" title={tr('เวลาต่อรถกระชั้น', 'Tight transfer')}>
            {tr(
              `ถ้าคันแรกช้ากว่าที่คาด อาจพลาดคันนี้ ตามตารางคันถัดไปมาประมาณทุก ${headwayMin} นาที`,
              `If the first ride runs late you may miss this one. The next comes about every ${headwayMin} min.`,
            )}
          </Banner>
        )}
        <p className="flex items-start gap-1.5">
          <Navigation aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {rail
            ? tr(`ไปที่ชานชาลาฝั่งขบวนมุ่งหน้า${headsign(variant)}`, `Go to the platform for trains towards ${headsign(variant)}`)
            : en
              ? `Check that the front of the bus shows ${route.shortName} to ${headsign(variant)}`
              : boardingGuidance(network, variant, leg.chosen.boardIndex)}
        </p>
      </Step>

      <Step
        icon={rail ? TrainFront : Bus}
        title={tr(`นั่ง ${leg.stopsCount} ${unitTh} แล้วลงที่${alightLabel}`, `Ride ${stopsEn}, get off at ${alightLabel}`)}
      >
        <p>
          {tr(`อยู่บน${rideTh}ประมาณ ${rideMin} นาที`, `About ${rideMin} min on the ${rideEn}`)} ·{' '}
          {leg.fareKnown
            ? tr(`ค่าโดยสาร ~${formatFareRange(leg.fare)}`, `Fare ~${formatFareRange(leg.fare)}`)
            : tr('ไม่มีข้อมูลค่าโดยสาร', 'Fare unknown')}
        </p>
        {!rail && (
          <div className="flex flex-wrap items-start gap-2">
            <AlightAlarmToggle variantId={variant.id} boardIndex={leg.chosen.boardIndex} alightIndex={leg.chosen.alightIndex} />
            <ConductorCard
              routeShortName={route.shortName}
              stopName={alight.nameTh}
              stopNameEn={alight.nameEn}
              fare={leg.fareKnown ? leg.fare : null}
            />
          </div>
        )}

        {leg.crossesDisruption && (
          <Banner tone="disruption" title={tr('ช่วงนี้มีเหตุขัดข้อง', 'Disruption on this section')}>
            {en ? 'May take longer than usual' : snapshot?.disruption?.titleTh ?? 'อาจใช้เวลานานกว่าปกติ'} ·{' '}
            {tr('เวลาที่แสดงรวมความล่าช้าโดยประมาณแล้ว', 'times shown include the estimated delay')}
          </Banner>
        )}
        <button type="button" onClick={() => navigate({ kind: 'route', variantId: variant.id })} className={btn.ghost}>
          {tr(`ดู${unitTh}ทั้งหมดของสาย ${route.shortName}`, `All ${rail ? 'stations' : 'stops'} on ${route.shortName}`)}
        </button>
      </Step>
    </>
  );
}

export function ItinerarySteps({ itinerary: it, destinationLabel }: { itinerary: Itinerary; destinationLabel: string }) {
  const { network } = useApp();
  const lang = useLang();
  const tr = useT();
  const accessStop = network.stopById[it.access.stopId];
  const accessLabel = accessStop ? stopLabel(network, accessStop, lang) : '';

  return (
    <div className="border-t border-slate-100 p-4">
      <h4 className="sr-only">{tr('ขั้นตอนการเดินทาง', 'Trip steps')}</h4>
      <ol className="space-y-4 text-sm">
        {it.access.distanceM > 0 && (
          <Step icon={Footprints} title={tr(`เดินไป${accessLabel}`, `Walk to ${accessLabel}`)}>
            <p>
              {formatDistance(it.access.distanceM)} · {tr('ประมาณ', 'about')} {formatMinutes(it.access.walkMin)}
            </p>
          </Step>
        )}
        {it.legs.map((leg, i) => (
          <LegSteps key={`${leg.boardStopId}-${i}`} itinerary={it} leg={leg} index={i} />
        ))}
        {it.egress.distanceM > 0 ? (
          <Step icon={Footprints} title={tr(`เดินต่อไป${destinationLabel}`, `Walk to ${destinationLabel}`)}>
            <p>
              {formatDistance(it.egress.distanceM)} · {tr('ประมาณ', 'about')} {formatMinutes(it.egress.walkMin)}
            </p>
          </Step>
        ) : (
          <Step icon={Flag} title={tr(`ถึง${destinationLabel}`, `Arrive at ${destinationLabel}`)} />
        )}
      </ol>
      <p className="mt-3 text-xs text-ink-muted">
        {tr(
          'ระยะเดินประมาณจากระยะเส้นตรง × 1.25 อาจต่างจากทางเดินจริง',
          'Walking distance is the straight-line distance × 1.25 and may differ from the real path.',
        )}
      </p>
    </div>
  );
}