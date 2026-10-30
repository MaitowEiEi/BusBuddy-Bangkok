import { useApp } from '../../state/AppContext';
import { STATUS_LABEL } from '../../lib/labels';
import { LiveStatus } from '../LiveStatus';
import { CrowdBadge, DirectionBadge, QualityBadge, ShortTurnBadge } from '../ui/Badges';
import { Section } from '../ui/Section';
import { PanelHeader } from './PanelHeader';

/** Text alternative to the map: every simulated vehicle, grouped by route. */
export function VehiclesPanel() {
  const { network, snapshot, navigate } = useApp();

  return (
    <div className="space-y-5 pb-8">
      <PanelHeader title="รถทั้งหมด (มุมมองรายการ)" subtitle="ข้อมูลชุดเดียวกับแผนที่ ในรูปแบบข้อความ" />
      <LiveStatus qualities={snapshot?.vehicles.map((v) => v.quality) ?? []} />
      {!snapshot ? (
        <p className="px-4 text-sm text-ink-muted">กำลังโหลดข้อมูลรถ…</p>
      ) : (
        network.routes.map((route) => {
          const list = snapshot.vehicles.filter((v) => v.routeId === route.id);
          return (
            <Section key={route.id} title={`สาย ${route.shortName} · ${route.nameTh}`}>
              <ul className="space-y-2 px-4">
                {list.map((vs) => {
                  const variant = network.variantById[vs.variantId];
                  return (
                    <li key={vs.vehicleId}>
                      <button
                        type="button"
                        onClick={() => navigate({ kind: 'vehicle', vehicleId: vs.vehicleId })}
                        className="block w-full rounded-xl p-3 text-left ring-1 ring-slate-200 hover:bg-slate-50"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold">{network.vehicleById[vs.vehicleId].fleetCode}</span>
                          <span className="font-medium">{variant.headsignTh}</span>
                          <DirectionBadge direction={vs.direction} />
                          {variant.isShortTurn && <ShortTurnBadge />}
                        </span>
                        <span className="mt-1 block text-sm text-ink-soft">
                          {STATUS_LABEL[vs.status]} · ป้ายถัดไป: {network.stopById[variant.stopIds[vs.nextStopIndex]].nameTh}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          <CrowdBadge level={vs.crowd} />
                          <QualityBadge quality={vs.quality} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Section>
          );
        })
      )}
    </div>
  );
}