import { Footprints, Navigation } from 'lucide-react';
import { useMemo } from 'react';
import { arrivalsForStop } from '../../domain/arrivals';
import { boardingGuidance } from '../../domain/boarding';
import { boardableVariants, routeIdsAtStop, terminatingVariants } from '../../domain/lookup';
import { walkingDistanceM, walkingMinutes } from '../../domain/walking';
import { formatDistance } from '../../lib/format';
import { pickName, useLang, useT } from '../../lib/i18n';
import { useApp } from '../../state/AppContext';
import { StopAlertsSection } from '../alerts/AlertSections';
import { FavoriteButton } from '../FavoriteButton';
import { LiveStatus } from '../LiveStatus';
import { NoticeList } from '../NoticeList';
import { StopTimetableSection } from '../schedule/TimetableSections';
import { DirectionBadge, RouteBadge, ShortTurnBadge } from '../ui/Badges';
import { Section } from '../ui/Section';
import { ArrivalCard } from './ArrivalCard';
import { NotFoundPanel, PanelHeader } from './PanelHeader';

export function StopPanel({ stopId }: { stopId: string }) {
  const { network, snapshot, origin, navigate } = useApp();
  const lang = useLang();
  const tr = useT();
  const stop = network.stopById[stopId];

  const arrivals = useMemo(
    () => (stop && snapshot ? arrivalsForStop(network, snapshot, stop.id) : []),
    [network, snapshot, stop],
  );

  if (!stop) return <NotFoundPanel title={tr('ไม่พบป้ายนี้', 'Stop not found')} />;

  const stopName = pickName(lang, stop.nameTh, stop.nameEn);
  const area = pickName(lang, stop.areaTh, (stop as { areaEn?: string }).areaEn);
  const originLabel = origin ? pickName(lang, origin.labelTh, (origin as { labelEn?: string }).labelEn) : '';

  const boardable = boardableVariants(network, stop.id);
  const terminating = terminatingVariants(network, stop.id);
  const walkM = origin ? walkingDistanceM(origin.position, stop.position) : null;
  const walkMin = walkM !== null ? walkingMinutes(walkM) : 0;

  return (
    <div className="space-y-5 pb-8">
      <PanelHeader
        title={stopName}
        subtitle={tr(
          `ป้ายรถเมล์ · รหัส ${stop.code} (จำลอง) · ${area}`,
          `Bus stop · Code ${stop.code} (simulated) · ${area}`,
        )}
        actions={
          <FavoriteButton
            kind="stop"
            id={stop.id}
            labelTh={`ป้าย${stop.nameTh}`}
            labelEn={stopName}
          />
        }
      />

      {origin && walkM !== null && (
        <p className="flex items-center gap-2 px-4 text-sm text-ink-soft">
          <Footprints aria-hidden className="h-4 w-4 shrink-0" />
          {tr(
            `เดินจาก${originLabel} ประมาณ ${formatDistance(walkM)} (~${walkMin} นาที)`,
            `Walk from ${originLabel}: ~${formatDistance(walkM)} (~${walkMin} min)`,
          )}
        </p>
      )}

      <NoticeList routeIds={routeIdsAtStop(network, stop.id)} />

      <Section title={tr('รถที่กำลังมาถึงป้ายนี้', 'Approaching vehicles')}>
        <LiveStatus qualities={arrivals.map((a) => a.quality)} />
        {!snapshot ? (
          <p className="px-4 text-sm text-ink-muted">
            {tr('กำลังโหลดข้อมูลรถ…', 'Loading live vehicle data…')}
          </p>
        ) : arrivals.length === 0 ? (
          <p className="px-4 text-sm text-ink-soft">
            {tr(
              'ไม่มีรถที่คาดว่าจะถึงป้ายนี้ภายใน 60 นาที ดูความถี่ตามตารางได้จากรายการสายด้านล่าง',
              'No buses expected within 60 minutes. Check scheduled frequencies in the routes below.',
            )}
          </p>
        ) : (
          <ul className="space-y-3 px-4">
            {arrivals.map((a) => (
              <li key={a.vehicleId}>
                <ArrivalCard arrival={a} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={tr('สายที่ขึ้นได้ และฝั่งที่ควรรอ', 'Routes serving this stop & waiting side')}>
        {boardable.length === 0 ? (
          <p className="px-4 text-sm text-ink-soft">
            {tr('ไม่มีสายที่รับผู้โดยสารขึ้นที่ป้ายนี้', 'No routes pick up passengers at this stop')}
          </p>
        ) : (
          <ul className="space-y-2 px-4">
            {boardable.map((v) => {
              const headsign = pickName(lang, v.headsignTh, v.headsignEn);
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => navigate({ kind: 'route', variantId: v.id })}
                    className="block w-full rounded-xl p-3 text-left ring-1 ring-slate-200 hover:bg-slate-50"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <RouteBadge route={network.routeById[v.routeId]} size="sm" />
                      <span className="font-medium">{headsign}</span>
                      <DirectionBadge direction={v.direction} />
                      {v.isShortTurn && <ShortTurnBadge />}
                    </span>
                    <span className="mt-1 flex items-start gap-1.5 text-sm text-ink-soft">
                      <Navigation aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                      {boardingGuidance(network, v, v.stopIds.indexOf(stop.id))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="px-4 text-xs text-ink-muted">
          {tr(
            'ฝั่งที่ควรรอคำนวณจากทิศทางของเส้นทางจำลอง โปรดดูป้ายหน้ารถและป้ายจริงประกอบด้วย',
            'Waiting side is estimated from route geometry. Please also verify the bus destination sign and street signs.',
          )}
        </p>

        {terminating.length > 0 && (
          <p className="px-4 text-sm text-ink-soft">
            <strong>{tr('สิ้นสุดที่ป้ายนี้ (ลงได้อย่างเดียว):', 'Terminates here (drop-off only):')}</strong>{' '}
            {terminating
              .map((v) => `${network.routeById[v.routeId].shortName} ${pickName(lang, v.headsignTh, v.headsignEn)}`)
              .join(', ')}
          </p>
        )}
      </Section>

      <StopAlertsSection stopId={stopId} />
      <StopTimetableSection stopId={stopId} />
    </div>
  );
}
