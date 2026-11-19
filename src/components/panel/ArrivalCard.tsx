import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Footprints,
  MapPin,
  Route as RouteIcon,
  Signpost,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import { findLessCrowdedAlternative } from '../../domain/alternatives';
import { arrivalsForStop } from '../../domain/arrivals';
import { fareRangeFromStop } from '../../domain/fare';
import type { WalkFeasibility } from '../../domain/nearby';
import { formatAgo, formatClockRange, formatDistance, formatEtaRange, formatFareRange, formatTime } from '../../lib/format';
import { pickName, useLang, useT, type Lang } from '../../lib/i18n';
import { crowdLabel } from '../../lib/labels';
import { useApp } from '../../state/AppContext';
import type { Arrival } from '../../types/transit';
import { AmenityBadges } from '../ui/AmenityBadges';
import { CrowdBadge, DirectionBadge, InfoChip, QualityBadge, RouteBadge, ServiceBadge, ShortTurnBadge } from '../ui/Badges';
import { Banner } from '../ui/Banner';
import { btn } from '../ui/buttonStyles';

interface ArrivalCardProps {
  arrival: Arrival;
  walk?: { distanceM: number; walkMin: number };
  feasibility?: WalkFeasibility;
  showStopName?: boolean;
}

const FEASIBILITY: Record<
  Exclude<WalkFeasibility, 'unknown'>,
  { th: string; en: string; cls: string; Icon: LucideIcon }
> = {
  ok: { th: 'เดินไปทัน', en: 'Enough time to walk there', cls: 'text-emerald-800', Icon: CheckCircle2 },
  tight: { th: 'อาจเดินไปไม่ทัน', en: 'Tight walk — might miss it', cls: 'text-amber-800', Icon: AlertTriangle },
  miss: {
    th: 'น่าจะเดินไปไม่ทัน ลองรอคันถัดไป',
    en: 'Unlikely to make it — try the next bus',
    cls: 'text-red-800',
    Icon: XCircle,
  },
};

function etaContext(a: Arrival, lang: Lang): string | null {
  const isEn = lang === 'en';
  if (a.mayHavePassed) {
    return isEn
      ? 'Delayed signal — this bus may have already passed'
      : 'ข้อมูลล่าช้า รถอาจผ่านป้ายนี้ไปแล้ว';
  }
  if (!a.etaRange) {
    return isEn
      ? 'No live signal — check scheduled frequency on the route page'
      : 'ไม่ได้รับสัญญาณจากรถ ดูความถี่ตามตารางในหน้าเส้นทาง';
  }
  if (a.status === 'layover') {
    return isEn
      ? 'Waiting at terminal — ETA depends on actual departure'
      : 'รถยังรออยู่ที่ต้นทาง เวลาอาจเปลี่ยนตามเวลาออกรถจริง';
  }
  if (a.etaRange.arriving) return null;
  if (a.stopsAway <= 0) {
    return isEn ? 'This is the next stop for this bus' : 'ป้ายนี้คือป้ายถัดไปของรถคันนี้';
  }
  const stopsWord = a.stopsAway === 1 ? 'stop' : 'stops';
  return isEn ? `${a.stopsAway} ${stopsWord} away` : `อีก ${a.stopsAway} ป้าย`;
}

export function ArrivalCard({ arrival: a, walk, feasibility, showStopName = false }: ArrivalCardProps) {
  const { network, snapshot, now, navigate } = useApp();
  const lang = useLang();
  const tr = useT();

  const route = network.routeById[a.routeId];
  const variant = network.variantById[a.variantId];
  const stop = network.stopById[a.stopId];
  const fare = fareRangeFromStop(route, variant, a.stopIndex);

  const headsign = pickName(lang, variant.headsignTh, variant.headsignEn);
  const stopName = pickName(lang, stop.nameTh, stop.nameEn);

  const alternative = useMemo(() => {
    if (a.crowd !== 'crowded' || !snapshot) return null;
    return findLessCrowdedAlternative(network, arrivalsForStop(network, snapshot, a.stopId), a);
  }, [network, snapshot, a]);

  const alt = alternative && {
    route: network.routeById[alternative.arrival.routeId],
    variant: network.variantById[alternative.arrival.variantId],
    lastShared: network.stopById[alternative.sharedStopIds[alternative.sharedStopIds.length - 1]],
  };

  const context = etaContext(a, lang);
  const feas = feasibility && feasibility !== 'unknown' ? FEASIBILITY[feasibility] : null;
  const clock = a.etaRange && !a.etaRange.arriving ? formatClockRange(now, a.etaRange) : null;

  const altHeadsign = alt ? pickName(lang, alt.variant.headsignTh, alt.variant.headsignEn) : '';
  const altLastSharedName = alt ? pickName(lang, alt.lastShared.nameTh, alt.lastShared.nameEn) : '';
  const altCrowdText = alternative ? crowdLabel(alternative.arrival.crowd).short : '';

  const disruption = snapshot?.disruption as { alternativeHintTh?: string; alternativeHintEn?: string } | undefined;
  const disruptionHint = disruption
    ? pickName(
        lang,
        disruption.alternativeHintTh ?? 'เวลาเดินทางอาจนานกว่าปกติ',
        disruption.alternativeHintEn ?? 'Travel time may take longer than usual',
      )
    : tr('เวลาเดินทางอาจนานกว่าปกติ', 'Travel time may take longer than usual');

  return (
    <article
      aria-label={tr(`สาย ${route.shortName} ${headsign}`, `Route ${route.shortName} ${headsign}`)}
      className="rounded-2xl bg-white ring-1 ring-slate-200"
    >
      <button
        type="button"
        onClick={() => navigate({ kind: 'vehicle', vehicleId: a.vehicleId })}
        className="block w-full rounded-2xl p-4 text-left hover:bg-slate-50"
      >
        <span className="flex items-start gap-3">
          <RouteBadge route={route} size="lg" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold leading-snug">{headsign}</span>
            <span className="mt-1 flex flex-wrap gap-1">
              <DirectionBadge direction={a.direction} />
              {variant.isShortTurn && <ShortTurnBadge />}
              <ServiceBadge type={route.serviceType} />
            </span>
          </span>
        </span>

        <span className="mt-3 block">
          <span className="text-xl font-bold">{formatEtaRange(a.etaRange)}</span>
          {clock && (
            <span className="ml-2 text-sm text-ink-muted">
              {tr(`(${clock} น.)`, `(${clock})`)}
            </span>
          )}
          {context && <span className="block text-sm text-ink-soft">{context}</span>}
        </span>

        <span className="mt-3 flex flex-wrap gap-1.5">
          <CrowdBadge level={a.crowd} passengers={a.passengers} capacity={a.capacity} />
          <InfoChip icon={Banknote}>
            {tr(`ค่าโดยสาร ~${formatFareRange(fare)}`, `Fare ~${formatFareRange(fare)}`)}
          </InfoChip>
          {walk && (
            <InfoChip icon={Footprints}>
              {tr(
                `เดิน ${formatDistance(walk.distanceM)} · ~${walk.walkMin} นาที`,
                `Walk ${formatDistance(walk.distanceM)} · ~${walk.walkMin} min`,
              )}
            </InfoChip>
          )}
        </span>

        {showStopName && (
          <span className="mt-2 flex items-center gap-1.5 text-sm">
            <MapPin aria-hidden className="h-4 w-4 text-brand-700" />
            {tr(`ขึ้นที่ป้าย${stopName}`, `Board at ${stopName}`)}
          </span>
        )}

        {feas && (
          <span className={`mt-1 flex items-center gap-1.5 text-sm font-medium ${feas.cls}`}>
            <feas.Icon aria-hidden className="h-4 w-4" />
            {lang === 'en' ? feas.en : feas.th}
          </span>
        )}

        <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <QualityBadge quality={a.quality} />
          <span>
            {tr(
              `อัปเดต ${formatTime(a.lastUpdatedMs)} น. (${formatAgo(now, a.lastUpdatedMs)})`,
              `Updated ${formatTime(a.lastUpdatedMs)} (${formatAgo(now, a.lastUpdatedMs)})`,
            )}
          </span>
        </span>

        <span className="sr-only">
          {tr('แตะเพื่อดูรายละเอียดรถคันนี้', 'Tap to view details for this vehicle')}
        </span>
      </button>

      <div className="px-4 pb-3">
        <AmenityBadges vehicleId={a.vehicleId} size="sm" />
      </div>

      {(a.crowd === 'crowded' || a.crossesDisruption) && (
        <div className="space-y-2 px-4 pb-3">
          {a.crowd === 'crowded' &&
            (alt && alternative ? (
              <Banner
                tone="warning"
                title={tr(
                  'รถคันนี้แน่นมาก มีทางเลือกที่แน่นน้อยกว่า',
                  'This bus is very crowded — less crowded option available',
                )}
              >
                <p>
                  {tr(
                    `สาย ${alt.route.shortName} ${altHeadsign} · ${formatEtaRange(alternative.arrival.etaRange)} · ${altCrowdText}`,
                    `Route ${alt.route.shortName} ${altHeadsign} · ${formatEtaRange(alternative.arrival.etaRange)} · ${altCrowdText}`,
                  )}
                </p>
                <p>
                  {alternative.coversAll
                    ? tr('จอดทุกป้ายที่เหลือของคันนี้', 'Serves all remaining stops of this bus')
                    : tr(
                        `ไปทางเดียวกันถึงป้าย${altLastSharedName} จากนั้นแยกไปคนละทาง โปรดตรวจว่าป้ายที่จะลงอยู่ในช่วงนี้`,
                        `Shares the same stops up to ${altLastSharedName}, then diverges. Check that your stop is along this section.`,
                      )}
                </p>
                <button
                  type="button"
                  onClick={() => navigate({ kind: 'vehicle', vehicleId: alternative.arrival.vehicleId })}
                  className="mt-1 min-h-9 font-semibold underline"
                >
                  {tr('ดูรถทางเลือกคันนี้', 'View alternative vehicle')}
                </button>
              </Banner>
            ) : (
              <Banner tone="warning" title={tr('รถคันนี้แน่นมาก', 'This bus is very crowded')}>
                {tr(
                  'ตอนนี้ยังไม่พบรถคันอื่นที่ไปทางเดียวกันและแน่นน้อยกว่า ลองรอคันถัดไป',
                  'No less-crowded alternative along this route right now — consider waiting for the next bus.',
                )}
              </Banner>
            ))}

          {a.crossesDisruption && (
            <Banner
              tone="disruption"
              title={tr('เส้นทางข้างหน้ามีเหตุขัดข้อง', 'Service disruption ahead')}
            >
              {disruptionHint}
            </Banner>
          )}
        </div>
      )}

      <div className="flex flex-wrap border-t border-slate-100 px-1">
        <button
          type="button"
          onClick={() => navigate({ kind: 'route', variantId: a.variantId })}
          className={btn.ghost}
        >
          <RouteIcon aria-hidden className="h-4 w-4" />
          {tr('ดูเส้นทางและป้ายทั้งหมด', 'View full route & stops')}
        </button>
        {showStopName && (
          <button
            type="button"
            onClick={() => navigate({ kind: 'stop', stopId: a.stopId })}
            className={btn.ghost}
          >
            <Signpost aria-hidden className="h-4 w-4" />
            {tr('ดูป้ายนี้', 'View this stop')}
          </button>
        )}
      </div>
    </article>
  );
}
