import { Clock } from 'lucide-react';
import { useMemo } from 'react';
import { boardableVariants } from '../../domain/lookup';
import { frequencyAt } from '../../domain/schedule';
import {
  bandsInService,
  formatMinutesOfDay,
  headwayText,
  minutesFromOrigin,
  serviceBands,
  serviceSpan,
} from '../../domain/timetable';
import { bangkokMinutesOfDay } from '../../lib/format';
import { pickName, useLang, useT } from '../../lib/i18n';
import { useApp } from '../../state/AppContext';
import { RouteBadge, ShortTurnBadge } from '../ui/Badges';
import { btn } from '../ui/buttonStyles';
import { Section } from '../ui/Section';

/** For the route page. */
export function RouteTimetableSection({ variantId }: { variantId: string }) {
  const { network, snapshot } = useApp();
  const lang = useLang();
  const tr = useT();
  const variant = network.variantById[variantId];
  const route = variant ? network.routeById[variant.routeId] : undefined;
  const bands = useMemo(() => (route ? serviceBands(route) : []), [route]);

  if (!variant || !route) return null;

  const span = serviceSpan(bands);
  const shown = bandsInService(bands, span);
  const nowMin = bangkokMinutesOfDay(snapshot?.generatedAtMs ?? Date.now());
  const tripMin = minutesFromOrigin(route, variant, variant.stopIds.length - 1);
  const firstStop = network.stopById[variant.stopIds[0]];
  const firstStopName = firstStop
    ? pickName(lang, firstStop.nameTh, firstStop.nameEn)
    : tr('ต้นสาย', 'origin');

  return (
    <Section title={tr('ตารางเดินรถทั้งวัน (จำลอง)', 'Full-day timetable (simulated)')}>
      {!span ? (
        <p className="px-4 text-sm text-ink-soft">
          {tr('ไม่มีข้อมูลตารางเดินรถของสายนี้', 'No timetable data available for this route')}
        </p>
      ) : (
        <div className="space-y-3 px-4 text-sm">
          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <dt className="text-ink-muted">
                {tr(`ออกจากป้าย${firstStopName}`, `Departs ${firstStopName}`)}
              </dt>
              <dd className="font-semibold text-ink">
                {tr(
                  `${formatMinutesOfDay(span.firstMin)}–${formatMinutesOfDay(span.lastMin)} น.`,
                  `${formatMinutesOfDay(span.firstMin)}–${formatMinutesOfDay(span.lastMin)}`,
                )}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <dt className="text-ink-muted">
                {tr('นั่งตลอดสายประมาณ', 'End-to-end ride')}
              </dt>
              <dd className="font-semibold text-ink">
                {tr(`${tripMin} นาที`, `~${tripMin} min`)}
              </dd>
            </div>
          </dl>

          <table className="w-full text-left">
            <caption className="sr-only">
              {tr(
                `ความถี่ของรถสาย ${route.shortName} ตามช่วงเวลา`,
                `Service frequency by time period for Route ${route.shortName}`,
              )}
            </caption>
            <thead>
              <tr className="text-ink-muted">
                <th scope="col" className="py-1.5 pl-2 font-medium">
                  {tr('ช่วงเวลา', 'Time period')}
                </th>
                <th scope="col" className="py-1.5 font-medium">
                  {tr('รถมาทุก', 'Every')}
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((band) => {
                const current = nowMin >= band.startMin && nowMin < band.endMin;
                return (
                  <tr
                    key={band.startMin}
                    aria-current={current ? 'true' : undefined}
                    className={`border-t border-slate-100 ${
                      current ? 'bg-slate-100 font-semibold text-ink' : 'text-ink-soft'
                    }`}
                  >
                    <td className="py-2 pl-2">
                      {formatMinutesOfDay(band.startMin)}–{formatMinutesOfDay(band.endMin)}
                      {current && (
                        <span className="ml-2 rounded-full bg-brand-700 px-2 py-0.5 text-xs font-semibold text-white">
                          {tr('ตอนนี้', 'Now')}
                        </span>
                      )}
                    </td>
                    <td className="py-2">{headwayText(band.headwayMin, lang)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="flex items-start gap-1.5 text-xs text-ink-muted">
            <Clock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {tr(
              `ความถี่รวมทุกเที่ยวของสาย ${route.shortName} (รวมเที่ยวสั้น) เป็นข้อมูลจำลองเพื่อทดสอบ ไม่ใช่ตารางจริงของผู้ให้บริการ`,
              `Combined frequency across all trips of Route ${route.shortName} (including short-turn trips). Simulated data for testing, not an official operator schedule.`,
            )}
          </p>
        </div>
      )}
    </Section>
  );
}

/** For the stop page. */
export function StopTimetableSection({ stopId }: { stopId: string }) {
  const { network, snapshot, navigate } = useApp();
  const lang = useLang();
  const tr = useT();
  const stop = network.stopById[stopId];

  const rows = useMemo(() => {
    if (!stop) return [];
    return boardableVariants(network, stop.id).map((variant) => {
      const route = network.routeById[variant.routeId];
      return {
        variant,
        route,
        span: serviceSpan(serviceBands(route)),
        offsetMin: minutesFromOrigin(route, variant, variant.stopIds.indexOf(stop.id)),
      };
    });
  }, [network, stop]);

  if (!stop) return null;

  const nowMin = bangkokMinutesOfDay(snapshot?.generatedAtMs ?? Date.now());

  return (
    <Section title={tr('ตารางเดินรถที่ป้ายนี้ (จำลอง)', 'Timetable at this stop (simulated)')}>
      {rows.length === 0 ? (
        <p className="px-4 text-sm text-ink-soft">
          {tr('ไม่มีสายที่ขึ้นได้จากป้ายนี้', 'No routes pick up passengers at this stop')}
        </p>
      ) : (
        <ul className="space-y-2 px-4">
          {rows.map(({ variant, route, span, offsetMin }) => {
            const period = frequencyAt(route, nowMin);
            const headsign = pickName(lang, variant.headsignTh, variant.headsignEn);
            const hw = period ? headwayText([period.headwayMin[0], period.headwayMin[1]], lang) : '';
            return (
              <li key={variant.id} className="space-y-1.5 rounded-xl bg-white p-3 text-sm ring-1 ring-slate-200">
                <p className="flex flex-wrap items-center gap-1.5">
                  <RouteBadge route={route} size="sm" />
                  <span className="font-medium text-ink">{headsign}</span>
                  {variant.isShortTurn && <ShortTurnBadge />}
                </p>
                <p className="text-ink-soft">
                  {period
                    ? tr(`ตอนนี้: รถมาทุก ${hw}`, `Now: Every ${hw}`)
                    : tr('ตอนนี้: ไม่มีบริการในช่วงนี้', 'Now: No service at this time')}
                </p>
                {span && (
                  <p className="text-ink-soft">
                    {tr(
                      `คันแรกถึงป้ายนี้ ~${formatMinutesOfDay(span.firstMin + offsetMin)} น. · คันสุดท้าย ~${formatMinutesOfDay(span.lastMin + offsetMin)} น.`,
                      `First bus ~${formatMinutesOfDay(span.firstMin + offsetMin)} · Last bus ~${formatMinutesOfDay(span.lastMin + offsetMin)}`,
                    )}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => navigate({ kind: 'route', variantId: variant.id })}
                  className={btn.ghost}
                >
                  {tr(
                    `ดูตารางทั้งวันของสาย ${route.shortName}`,
                    `View full-day timetable for Route ${route.shortName}`,
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="px-4 text-xs text-ink-muted">
        {tr(
          'เวลาคันแรกและคันสุดท้ายคำนวณจากเวลาออกต้นสายบวกเวลาเดินทางตามตาราง อาจคลาดเคลื่อนตามสภาพจราจร',
          'First and last bus times are estimated from origin departure plus scheduled travel time and may vary with traffic.',
        )}
      </p>
    </Section>
  );
}
