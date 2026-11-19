import { ArrowLeftRight, Bus, CalendarClock, GitBranch } from 'lucide-react';
import { useMemo } from 'react';
import { estimateEtaRange } from '../../domain/eta';
import { shortTurnSkippedStops } from '../../domain/lookup';
import { frequencyAt, isInServiceHours } from '../../domain/schedule';
import { bangkokMinutesOfDay, formatEtaRange } from '../../lib/format';
import { pickName, useLang, useT, type Lang } from '../../lib/i18n';
import { crowdLabel, qualityLabel, statusLabel } from '../../lib/labels';
import { useApp } from '../../state/AppContext';
import type { Route, VehicleLiveState } from '../../types/transit';
import { FavoriteButton } from '../FavoriteButton';
import { NoticeList } from '../NoticeList';
import { RouteTimetableSection } from '../schedule/TimetableSections';
import { DirectionBadge, RouteBadge, ServiceBadge, ShortTurnBadge } from '../ui/Badges';
import { Banner } from '../ui/Banner';
import { btn } from '../ui/buttonStyles';
import { Section } from '../ui/Section';
import { NotFoundPanel, PanelHeader } from './PanelHeader';

function fareText(route: Route, lang: Lang): string {
  const f = route.fare;
  if (lang === 'en') {
    return f.kind === 'flat'
      ? `฿${f.amountThb} flat fare`
      : `฿${f.baseThb}–${f.maxThb} by distance`;
  }
  return f.kind === 'flat'
    ? `${f.amountThb} บาทตลอดสาย`
    : `${f.baseThb}–${f.maxThb} บาท ตามระยะทาง`;
}

function VehicleChip({ vs, note }: { vs: VehicleLiveState; note: string }) {
  const { network, navigate } = useApp();
  useLang();
  const vehicle = network.vehicleById[vs.vehicleId];
  const crowdText = crowdLabel(vs.crowd).short;
  const qualityText = qualityLabel(vs.quality).short;

  return (
    <button
      type="button"
      onClick={() => navigate({ kind: 'vehicle', vehicleId: vs.vehicleId })}
      className="my-1 flex min-h-11 w-full items-center gap-2 rounded-xl bg-brand-50 px-3 py-1.5 text-left text-sm ring-1 ring-brand-200 hover:bg-brand-100"
    >
      <Bus aria-hidden className="h-4 w-4 shrink-0 text-brand-700" />
      <span>
        <strong className="font-mono">{vehicle.fleetCode}</strong> · {note} · {crowdText}
        {vs.quality !== 'live' && ` · ${qualityText}`}
      </span>
    </button>
  );
}

export function RoutePanel({ variantId }: { variantId: string }) {
  const { network, snapshot, now, navigate } = useApp();
  const lang = useLang();
  const tr = useT();
  const variant = network.variantById[variantId];
  const onVariant = useMemo(
    () => snapshot?.vehicles.filter((v) => v.variantId === variantId) ?? [],
    [snapshot, variantId],
  );

  if (!variant) return <NotFoundPanel title={tr('ไม่พบเส้นทางนี้', 'Route not found')} />;

  const route = network.routeById[variant.routeId];
  const twin = network.variants.find(
    (v) => v.routeId === route.id && v.isShortTurn === variant.isShortTurn && v.direction !== variant.direction,
  );
  const otherPattern = network.variants.find(
    (v) => v.routeId === route.id && v.isShortTurn !== variant.isShortTurn && v.direction === variant.direction,
  );

  const skipped = shortTurnSkippedStops(network, variant);
  const period = frequencyAt(route, bangkokMinutesOfDay(now));
  const inService = isInServiceHours(route, now);
  const lastIndex = variant.stopIds.length - 1;

  const headsign = pickName(lang, variant.headsignTh, variant.headsignEn);
  const routeName = pickName(lang, route.nameTh, (route as { nameEn?: string }).nameEn);
  const variantLabel = pickName(
    lang,
    variant.variantLabelTh,
    (variant as { variantLabelEn?: string }).variantLabelEn,
  );
  const twinHeadsign = twin ? pickName(lang, twin.headsignTh, twin.headsignEn) : '';
  const periodLabel = period
    ? pickName(lang, period.labelTh, (period as { labelEn?: string }).labelEn)
    : '';

  const soonestAt = (stopIndex: number) => {
    let best: { etaSec: number; vs: VehicleLiveState; crosses: boolean } | null = null;
    for (const vs of onVariant) {
      const p = vs.predictions.find((x) => x.stopIndex === stopIndex);
      if (p && p.etaSec !== null && (!best || p.etaSec < best.etaSec)) {
        best = { etaSec: p.etaSec, vs, crosses: p.crossesDisruption };
      }
    }
    return best;
  };

  return (
    <div className="space-y-5 pb-8">
      <PanelHeader
        leading={<RouteBadge route={route} size="md" />}
        title={headsign}
        subtitle={`${routeName} · ${variantLabel}`}
        actions={
          <FavoriteButton
            kind="variant"
            id={variant.id}
            labelTh={`สาย ${route.shortName} ${variant.headsignTh}`}
            labelEn={`Route ${route.shortName} ${headsign}`}
          />
        }
      />

      <div className="flex flex-wrap gap-1.5 px-4">
        <DirectionBadge direction={variant.direction} />
        {variant.isShortTurn && <ShortTurnBadge />}
        <ServiceBadge type={route.serviceType} />
      </div>

      <div className="flex flex-wrap gap-2 px-4">
        {twin && (
          <button
            type="button"
            onClick={() => navigate({ kind: 'route', variantId: twin.id })}
            className={btn.secondary}
          >
            <ArrowLeftRight aria-hidden className="h-4 w-4" />
            {tr(`ทิศทางตรงข้าม: ${twinHeadsign}`, `Opposite direction: ${twinHeadsign}`)}
          </button>
        )}
        {otherPattern && (
          <button
            type="button"
            onClick={() => navigate({ kind: 'route', variantId: otherPattern.id })}
            className={btn.secondary}
          >
            <GitBranch aria-hidden className="h-4 w-4" />
            {otherPattern.isShortTurn
              ? tr('ดูเที่ยวสั้นของสายนี้', 'View short-turn pattern')
              : tr('ดูเที่ยวปกติ (เต็มสาย)', 'View full-route pattern')}
          </button>
        )}
      </div>

      {skipped.length > 0 && (
        <div className="px-4">
          <Banner
            tone="info"
            title={tr('เที่ยวสั้น: ไม่ได้วิ่งเต็มสาย', 'Short-turn trip: Does not run full route')}
          >
            {tr(
              `ไม่จอดที่ ${skipped.map((s) => pickName(lang, s.nameTh, s.nameEn)).join(', ')} ถ้าจะไปป้ายเหล่านี้ให้รอสาย ${route.shortName} เที่ยวปกติ`,
              `Skips ${skipped.map((s) => pickName(lang, s.nameTh, s.nameEn)).join(', ')}. To reach those stops, wait for a full-route Route ${route.shortName} bus.`,
            )}
          </Banner>
        </div>
      )}

      <NoticeList routeIds={[route.id]} />

      <section
        aria-label={tr('ตารางเดินรถ', 'Timetable')}
        className="mx-4 space-y-1 rounded-2xl bg-slate-50 p-3 text-sm ring-1 ring-slate-200"
      >
        <p className="flex items-center gap-1.5 font-semibold">
          <CalendarClock aria-hidden className="h-4 w-4" />
          {tr('ตามตารางเดินรถ (จำลอง)', 'Scheduled service (simulated)')}
        </p>
        <p>
          {tr(
            `เที่ยวแรก ${route.firstDeparture} น. · เที่ยวสุดท้าย ${route.lastDeparture} น.`,
            `First bus ${route.firstDeparture} · Last bus ${route.lastDeparture}`,
          )}
        </p>
        <p>
          {tr('ความถี่ช่วงนี้:', 'Current frequency:')}{' '}
          {period
            ? lang === 'en'
              ? `${periodLabel ? `${periodLabel} · ` : ''}every ${period.headwayMin[0]}–${period.headwayMin[1]} min`
              : `${periodLabel} ทุก ${period.headwayMin[0]}–${period.headwayMin[1]} นาที`
            : tr('นอกช่วงเวลาให้บริการตามตาราง', 'Outside scheduled service hours')}
        </p>
        <p>
          {tr('ค่าโดยสาร:', 'Fare:')} {fareText(route, lang)}
        </p>
        <p className="text-xs text-ink-muted">
          {tr(
            'ตารางเดินรถคือแผนที่วางไว้ ส่วนเวลาในรายการป้ายด้านล่างเป็นค่าประมาณจากตำแหน่งรถ',
            'Timetable shows planned service; ETAs in the stop list below are estimated from vehicle positions.',
          )}
        </p>
      </section>

      {!inService && (
        <div className="px-4">
          <Banner
            tone="neutral"
            title={tr('ขณะนี้อยู่นอกเวลาให้บริการตามตาราง', 'Currently outside scheduled service hours')}
          >
            {tr(
              'ในต้นแบบ รถจำลองยังวิ่งตลอดเวลาเพื่อให้ทดสอบหน้าจอได้ บริการจริงอาจไม่มีรถในช่วงนี้',
              'In this prototype, simulated vehicles run 24/7 so you can test the UI. Real-world service may not run at this hour.',
            )}
          </Banner>
        </div>
      )}

      <Section
        title={tr(
          `ป้ายทั้งหมด ${variant.stopIds.length} ป้าย (เรียงตามทิศทางรถ)`,
          `All ${variant.stopIds.length} stops (in travel order)`,
        )}
      >
        {snapshot && onVariant.length === 0 && (
          <p className="px-4 text-sm text-ink-soft">
            {tr(
              'ขณะนี้ไม่มีรถจำลองวิ่งในทิศทางนี้ ดูความถี่ตามตารางด้านบน',
              'No simulated vehicles currently running in this direction. Check scheduled frequency above.',
            )}
          </p>
        )}

        <ol className="ml-7 mr-4 border-l-4" style={{ borderColor: route.color }}>
          {variant.stopIds.map((sid, i) => {
            const stop = network.stopById[sid];
            const stopName = pickName(lang, stop.nameTh, stop.nameEn);
            const between = onVariant.filter((v) => v.status === 'moving' && v.nextStopIndex === i);
            const atStop = onVariant.filter((v) => v.atStopIndex === i);
            const soonest = soonestAt(i);
            const range = soonest
              ? estimateEtaRange(soonest.etaSec, soonest.vs.quality, soonest.vs.staleSec, soonest.crosses)
              : null;

            return (
              <li key={sid} className="relative py-1 pl-5">
                {between.map((v) => (
                  <VehicleChip
                    key={v.vehicleId}
                    vs={v}
                    note={tr(`กำลังวิ่งมาป้าย${stopName}`, `Approaching ${stopName}`)}
                  />
                ))}
                <span
                  aria-hidden
                  className="absolute -left-[0.7rem] top-[1.1rem] h-4 w-4 rounded-full border-4 bg-white"
                  style={{
                    borderColor: route.color,
                    marginTop: between.length ? `${between.length * 3.25}rem` : undefined,
                  }}
                />
                <button
                  type="button"
                  onClick={() => navigate({ kind: 'stop', stopId: sid })}
                  className="block min-h-11 w-full rounded-lg py-1 text-left hover:bg-slate-50"
                >
                  <span className="block font-medium">
                    {stopName}
                    {i === 0 && (
                      <span className="ml-2 text-xs font-normal text-ink-muted">
                        {tr('(ต้นทาง)', '(Origin)')}
                      </span>
                    )}
                    {i === lastIndex && (
                      <span className="ml-2 text-xs font-normal text-ink-muted">
                        {tr('(ปลายทาง)', '(Terminal)')}
                      </span>
                    )}
                  </span>
                  {i < lastIndex && range && (
                    <span className="block text-xs text-ink-soft">
                      {i === 0
                        ? tr(
                            `คันถัดไป ออกจากต้นทาง ${formatEtaRange(range)} (ประมาณการ)`,
                            `Next bus departs in ${formatEtaRange(range)} (est.)`,
                          )
                        : tr(
                            `คันถัดไป ถึง ${formatEtaRange(range)} (ประมาณการ)`,
                            `Next bus arrives ${formatEtaRange(range)} (est.)`,
                          )}
                    </span>
                  )}
                </button>
                {atStop.map((v) => (
                  <VehicleChip key={v.vehicleId} vs={v} note={statusLabel(v.status)} />
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
