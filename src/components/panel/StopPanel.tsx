import { Footprints, Navigation } from 'lucide-react';
import { useMemo } from 'react';
import { arrivalsForStop } from '../../domain/arrivals';
import { boardingGuidance } from '../../domain/boarding';
import { boardableVariants, routeIdsAtStop, terminatingVariants } from '../../domain/lookup';
import { walkingDistanceM, walkingMinutes } from '../../domain/walking';
import { formatDistance } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { FavoriteButton } from '../FavoriteButton';
import { LiveStatus } from '../LiveStatus';
import { NoticeList } from '../NoticeList';
import { DirectionBadge, RouteBadge, ShortTurnBadge } from '../ui/Badges';
import { Section } from '../ui/Section';
import { ArrivalCard } from './ArrivalCard';
import { NotFoundPanel, PanelHeader } from './PanelHeader';
import { StopAlertsSection } from '../alerts/AlertSections';
import { StopTimetableSection } from '../schedule/TimetableSections';

export function StopPanel({ stopId }: { stopId: string }) {
  const { network, snapshot, origin, navigate } = useApp();
  const stop = network.stopById[stopId];
  const arrivals = useMemo(
    () => (stop && snapshot ? arrivalsForStop(network, snapshot, stop.id) : []),
    [network, snapshot, stop],
  );

  if (!stop) return <NotFoundPanel title="ไม่พบป้ายนี้" />;

  const boardable = boardableVariants(network, stop.id);
  const terminating = terminatingVariants(network, stop.id);
  const walkM = origin ? walkingDistanceM(origin.position, stop.position) : null;

  return (
    <div className="space-y-5 pb-8">
      <PanelHeader
        title={stop.nameTh}
        subtitle={`ป้ายรถเมล์ · รหัส ${stop.code} (จำลอง) · ${stop.areaTh}`}
        actions={<FavoriteButton kind="stop" id={stop.id} labelTh={`ป้าย${stop.nameTh}`} />}
      />

      {origin && walkM !== null && (
        <p className="flex items-center gap-2 px-4 text-sm text-ink-soft">
          <Footprints aria-hidden className="h-4 w-4 shrink-0" />
          เดินจาก{origin.labelTh} ประมาณ {formatDistance(walkM)} (~{walkingMinutes(walkM)} นาที)
        </p>
      )}

      <NoticeList routeIds={routeIdsAtStop(network, stop.id)} />

      <Section title="รถที่กำลังมาถึงป้ายนี้">
        <LiveStatus qualities={arrivals.map((a) => a.quality)} />
        {!snapshot ? (
          <p className="px-4 text-sm text-ink-muted">กำลังโหลดข้อมูลรถ…</p>
        ) : arrivals.length === 0 ? (
          <p className="px-4 text-sm text-ink-soft">
            ไม่มีรถที่คาดว่าจะถึงป้ายนี้ภายใน 60 นาที ดูความถี่ตามตารางได้จากรายการสายด้านล่าง
          </p>
        ) : (
          <ul className="space-y-3 px-4">
            {arrivals.map((a) => <li key={a.vehicleId}><ArrivalCard arrival={a} /></li>)}
          </ul>
        )}
      </Section>

      <Section title="สายที่ขึ้นได้ และฝั่งที่ควรรอ">
        {boardable.length === 0 ? (
          <p className="px-4 text-sm text-ink-soft">ไม่มีสายที่รับผู้โดยสารขึ้นที่ป้ายนี้</p>
        ) : (
          <ul className="space-y-2 px-4">
            {boardable.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => navigate({ kind: 'route', variantId: v.id })}
                  className="block w-full rounded-xl p-3 text-left ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <RouteBadge route={network.routeById[v.routeId]} size="sm" />
                    <span className="font-medium">{v.headsignTh}</span>
                    <DirectionBadge direction={v.direction} />
                    {v.isShortTurn && <ShortTurnBadge />}
                  </span>
                  <span className="mt-1 flex items-start gap-1.5 text-sm text-ink-soft">
                    <Navigation aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                    {boardingGuidance(network, v, v.stopIds.indexOf(stop.id))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="px-4 text-xs text-ink-muted">
          ฝั่งที่ควรรอคำนวณจากทิศทางของเส้นทางจำลอง โปรดดูป้ายหน้ารถและป้ายจริงประกอบด้วย
        </p>
        {terminating.length > 0 && (
          <p className="px-4 text-sm text-ink-soft">
            <strong>สิ้นสุดที่ป้ายนี้ (ลงได้อย่างเดียว):</strong>{' '}
            {terminating.map((v) => `${network.routeById[v.routeId].shortName} ${v.headsignTh}`).join(', ')}
          </p>
        )}
      </Section>
    <StopAlertsSection stopId={stopId} />
    <StopTimetableSection stopId={stopId} />
    </div>
  );
}