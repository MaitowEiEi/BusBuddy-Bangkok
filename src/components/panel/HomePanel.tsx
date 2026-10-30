import { List, Navigation } from 'lucide-react';
import { useMemo, useState } from 'react';
import { arrivalsNearOrigin } from '../../domain/nearby';
import { nearbyStops } from '../../domain/walking';
import { formatDistance } from '../../lib/format';
import { useApp } from '../../state/AppContext';
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

  return (
    <div className="space-y-5 pb-8 pt-1 lg:pt-4">
      <h2 className="sr-only">หน้าหลัก: รถที่กำลังมาใกล้คุณ</h2>
      <LocationControl />

      <div className="px-4">
        <button type="button" onClick={() => navigate({ kind: 'plan' })} className={`${btn.primary} w-full`}>
          <Navigation aria-hidden className="h-4 w-4" />
          วางแผนการเดินทาง
        </button>
      </div>

      <NoticeList includeInfo={false} />

      {origin && (
        <>
          <Section title="รถที่กำลังมาใกล้คุณ">
            <LiveStatus qualities={arrivals.map((n) => n.arrival.quality)} />
            {nearby.length === 0 ? (
              <div className="space-y-2 px-4">
                <Banner tone="neutral" title="ไม่มีป้ายในระยะเดิน 900 ม.">
                  {closest
                    ? `ป้ายที่ใกล้ที่สุดในข้อมูลจำลองคือ ${closest.stop.nameTh} (ประมาณ ${formatDistance(closest.distanceM)}) ต้นแบบนี้มีข้อมูลเฉพาะย่านใจกลางกรุงเทพฯ`
                    : 'ต้นแบบนี้มีข้อมูลเฉพาะย่านใจกลางกรุงเทพฯ'}
                </Banner>
                {closest && (
                  <button type="button" onClick={() => navigate({ kind: 'stop', stopId: closest.stop.id })} className={btn.secondary}>
                    ดูป้าย{closest.stop.nameTh}
                  </button>
                )}
              </div>
            ) : !snapshot ? (
              <p className="px-4 text-sm text-ink-muted">กำลังโหลดข้อมูลรถ…</p>
            ) : arrivals.length === 0 ? (
              <p className="px-4 text-sm text-ink-soft">
                ไม่มีรถที่คาดว่าจะถึงป้ายใกล้คุณภายใน 60 นาที ลองเปิดหน้าป้ายเพื่อดูสายที่จอดและความถี่ตามตาราง
              </p>
            ) : (
              <ul className="space-y-3 px-4">
                {visible.map((n) => (
                  <li key={n.arrival.vehicleId}>
                    <ArrivalCard arrival={n.arrival} walk={n.walk} feasibility={n.feasibility} showStopName />
                  </li>
                ))}
              </ul>
            )}
            {arrivals.length > INITIAL_CARDS && (
              <div className="px-4">
                <button type="button" onClick={() => setShowAll((s) => !s)} aria-expanded={showAll} className={btn.ghost}>
                  {showAll ? 'แสดงน้อยลง' : `แสดงทั้งหมด (${arrivals.length} คัน)`}
                </button>
              </div>
            )}
          </Section>

          {nearby.length > 0 && (
            <Section title="ป้ายใกล้คุณ">
              <ul className="divide-y divide-slate-100">
                {nearby.map((n) => <StopRow key={n.stop.id} stop={n.stop} distanceM={n.distanceM} walkMin={n.walkMin} />)}
              </ul>
              <p className="px-4 text-xs text-ink-muted">ระยะเดินประมาณจากระยะเส้นตรง × 1.25 อาจต่างจากทางเดินจริง</p>
            </Section>
          )}
        </>
      )}

      <FavoritesSection />

      <div className="px-4">
        <button type="button" onClick={() => navigate({ kind: 'vehicles' })} className={`${btn.secondary} w-full`}>
          <List aria-hidden className="h-4 w-4" />
          ดูรถทั้งหมดเป็นรายการ (แทนแผนที่)
        </button>
      </div>
    </div>
  );
}