import { List, Navigation, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { arrivalsNearOrigin } from '../../domain/nearby';
import { nearbyStops } from '../../domain/walking';
import { formatDistance } from '../../lib/format';
import { pickName, useLang, useT } from '../../lib/i18n';
import { useApp } from '../../state/AppContext';
import { ActiveAlertsSection } from '../alerts/AlertSections';
import { FavoritesSection } from '../FavoritesSection';
import { LiveStatus } from '../LiveStatus';
import { LocationControl } from '../LocationControl';
import { NoticeList } from '../NoticeList';
import { Banner } from '../ui/Banner';
import { btn } from '../ui/buttonStyles';
import { Section } from '../ui/Section';
import { ArrivalCard } from './ArrivalCard';
import { StopRow } from './StopRow';

const INITIAL_CARDS = 5;

export function HomePanel() {
  const { network, snapshot, origin, navigate } = useApp();
  const lang = useLang();
  const tr = useT();
  const [showAll, setShowAll] = useState(false);

  const nearby = useMemo(() => (origin ? nearbyStops(network, origin.position) : []), [network, origin]);
  const closest = useMemo(
    () => (origin && nearby.length === 0 ? nearbyStops(network, origin.position, Infinity, 1)[0] : undefined),
    [network, origin, nearby.length],
  );
  const arrivals = useMemo(
    () => (snapshot && nearby.length > 0 ? arrivalsNearOrigin(network, snapshot, nearby) : []),
    [network, snapshot, nearby],
  );

  const visible = showAll ? arrivals : arrivals.slice(0, INITIAL_CARDS);
  const closestName = closest ? pickName(lang, closest.stop.nameTh, closest.stop.nameEn) : '';

  return (
    <div className="space-y-5 pb-8 pt-1 lg:pt-4">
      <h2 className="sr-only">
        {tr('หน้าหลัก: รถที่กำลังมาใกล้คุณ', 'Home: Approaching buses near you')}
      </h2>

      <LocationControl />

      <div className="px-4">
        <button
          type="button"
          onClick={() => navigate({ kind: 'plan' })}
          className={`${btn.primary} w-full`}
        >
          <Navigation aria-hidden className="h-4 w-4" />
          {tr('วางแผนการเดินทาง', 'Plan a trip')}
        </button>
      </div>

      <ActiveAlertsSection />
      <NoticeList includeInfo={false} />

      {origin && (
        <>
          <Section title={tr('รถที่กำลังมาใกล้คุณ', 'Approaching buses near you')}>
            <LiveStatus qualities={arrivals.map((n) => n.arrival.quality)} />

            {nearby.length === 0 ? (
              <div className="space-y-2 px-4">
                <Banner
                  tone="neutral"
                  title={tr('ไม่มีป้ายในระยะเดิน 900 ม.', 'No stops within a 900 m walk')}
                >
                  {closest
                    ? tr(
                        `ป้ายที่ใกล้ที่สุดในข้อมูลจำลองคือ ${closestName} (ประมาณ ${formatDistance(closest.distanceM)}) ต้นแบบนี้มีข้อมูลเฉพาะย่านใจกลางกรุงเทพฯ`,
                        `The closest stop in this dataset is ${closestName} (~${formatDistance(closest.distanceM)}). This prototype currently covers central Bangkok only.`,
                      )
                    : tr(
                        'ต้นแบบนี้มีข้อมูลเฉพาะย่านใจกลางกรุงเทพฯ',
                        'This prototype currently covers central Bangkok only.',
                      )}
                </Banner>
                {closest && (
                  <button
                    type="button"
                    onClick={() => navigate({ kind: 'stop', stopId: closest.stop.id })}
                    className={btn.secondary}
                  >
                    {tr(`ดูป้าย${closestName}`, `View ${closestName}`)}
                  </button>
                )}
              </div>
            ) : !snapshot ? (
              <p className="px-4 text-sm text-ink-muted">
                {tr('กำลังโหลดข้อมูลรถ…', 'Loading live vehicle data…')}
              </p>
            ) : arrivals.length === 0 ? (
              <p className="px-4 text-sm text-ink-soft">
                {tr(
                  'ไม่มีรถที่คาดว่าจะถึงป้ายใกล้คุณภายใน 60 นาที ลองเปิดหน้าป้ายเพื่อดูสายที่จอดและความถี่ตามตาราง',
                  'No buses expected at nearby stops within 60 minutes. Open a stop below to check routes and scheduled frequencies.',
                )}
              </p>
            ) : (
              <ul className="space-y-3 px-4">
                {visible.map((n) => (
                  <li key={n.arrival.vehicleId}>
                    <ArrivalCard
                      arrival={n.arrival}
                      walk={n.walk}
                      feasibility={n.feasibility}
                      showStopName
                    />
                  </li>
                ))}
              </ul>
            )}

            {arrivals.length > INITIAL_CARDS && (
              <div className="px-4">
                <button
                  type="button"
                  onClick={() => setShowAll((s) => !s)}
                  aria-expanded={showAll}
                  className={btn.ghost}
                >
                  {showAll
                    ? tr('แสดงน้อยลง', 'Show fewer')
                    : tr(`แสดงทั้งหมด (${arrivals.length} คัน)`, `Show all (${arrivals.length} vehicles)`)}
                </button>
              </div>
            )}
          </Section>

          {nearby.length > 0 && (
            <Section title={tr('ป้ายใกล้คุณ', 'Nearby stops')}>
              <ul className="divide-y divide-slate-100">
                {nearby.map((n) => (
                  <StopRow key={n.stop.id} stop={n.stop} distanceM={n.distanceM} walkMin={n.walkMin} />
                ))}
              </ul>
              <p className="px-4 text-xs text-ink-muted">
                {tr(
                  'ระยะเดินประมาณจากระยะเส้นตรง × 1.25 อาจต่างจากทางเดินจริง',
                  'Walking distance is estimated as straight-line distance × 1.25 and may differ from actual footpaths.',
                )}
              </p>
            </Section>
          )}
        </>
      )}

      <FavoritesSection />

      <div className="grid gap-2 px-4">
        <button
          type="button"
          onClick={() => navigate({ kind: 'vehicles' })}
          className={`${btn.secondary} w-full`}
        >
          <List aria-hidden className="h-4 w-4" />
          {tr('ดูรถทั้งหมดเป็นรายการ (แทนแผนที่)', 'View all vehicles as a list (text alternative)')}
        </button>
        <button
          type="button"
          onClick={() => navigate({ kind: 'privacy' })}
          className={`${btn.ghost} w-full`}
        >
          <ShieldCheck aria-hidden className="h-4 w-4" />
          {tr('ความเป็นส่วนตัวและข้อมูลในเครื่อง', 'Privacy & on-device data')}
        </button>
      </div>
    </div>
  );
}
