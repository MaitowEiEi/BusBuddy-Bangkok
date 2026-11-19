import { pickName, useLang, useT } from '../../lib/i18n';
import { statusLabel } from '../../lib/labels';
import { useApp } from '../../state/AppContext';
import { LiveStatus } from '../LiveStatus';
import { CrowdBadge, DirectionBadge, QualityBadge, ShortTurnBadge } from '../ui/Badges';
import { Section } from '../ui/Section';
import { PanelHeader } from './PanelHeader';

/** Text alternative to the map: every simulated vehicle, grouped by route. */
export function VehiclesPanel() {
  const { network, snapshot, navigate } = useApp();
  const lang = useLang();
  const tr = useT();

  return (
    <div className="space-y-5 pb-8">
      <PanelHeader
        title={tr('รถทั้งหมด (มุมมองรายการ)', 'All vehicles (list view)')}
        subtitle={tr('ข้อมูลชุดเดียวกับแผนที่ ในรูปแบบข้อความ', 'Same live data as the map, presented as text')}
      />

      <LiveStatus qualities={snapshot?.vehicles.map((v) => v.quality) ?? []} />

      {!snapshot ? (
        <p className="px-4 text-sm text-ink-muted">
          {tr('กำลังโหลดข้อมูลรถ…', 'Loading vehicle data…')}
        </p>
      ) : (
        network.routes.map((route) => {
          const list = snapshot.vehicles.filter((v) => v.routeId === route.id);
          const routeName = pickName(lang, route.nameTh, (route as { nameEn?: string }).nameEn);

          return (
            <Section
              key={route.id}
              title={tr(`สาย ${route.shortName} · ${routeName}`, `Route ${route.shortName} · ${routeName}`)}
            >
              <ul className="space-y-2 px-4">
                {list.map((vs) => {
                  const variant = network.variantById[vs.variantId];
                  const headsign = pickName(lang, variant.headsignTh, variant.headsignEn);
                  const nextStop = network.stopById[variant.stopIds[vs.nextStopIndex]];
                  const nextStopName = pickName(lang, nextStop.nameTh, nextStop.nameEn);
                  const statusText = statusLabel(vs.status);

                  return (
                    <li key={vs.vehicleId}>
                      <button
                        type="button"
                        onClick={() => navigate({ kind: 'vehicle', vehicleId: vs.vehicleId })}
                        className="block w-full rounded-xl p-3 text-left ring-1 ring-slate-200 hover:bg-slate-50"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold">
                            {network.vehicleById[vs.vehicleId].fleetCode}
                          </span>
                          <span className="font-medium">{headsign}</span>
                          <DirectionBadge direction={vs.direction} />
                          {variant.isShortTurn && <ShortTurnBadge />}
                        </span>
                        <span className="mt-1 block text-sm text-ink-soft">
                          {tr(
                            `${statusText} · ป้ายถัดไป: ${nextStopName}`,
                            `${statusText} · Next stop: ${nextStopName}`,
                          )}
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
