import { ArrowDownUp, Footprints, Lightbulb } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PLAN_CRITERIA, bestByCriterion, planTrip, sortItineraries, type PlanCriterion } from '../../domain/planner';
import { formatDistance, formatMinutes } from '../../lib/format';
import { pickName, useLang, useT } from '../../lib/i18n';
import { useApp } from '../../state/AppContext';
import { setPlanPreview } from '../../state/planPreview';
import type { DataQuality, LatLng } from '../../types/transit';
import { LiveStatus } from '../LiveStatus';
import { NoticeList } from '../NoticeList';
import { PanelHeader } from '../panel/PanelHeader';
import { Banner } from '../ui/Banner';
import { btn } from '../ui/buttonStyles';
import { Section } from '../ui/Section';
import { EndpointSelect } from './EndpointSelect';
import { ItineraryCard } from './ItineraryCard';
import { CRITERION_META, criterionLabel, criterionTag, planMemory, resolveEndpoint } from './planUi';

const MAX_SHOWN = 6;
const QUICK_PLACES = ['P01', 'P02', 'P05', 'P10'];

export function PlanPanel({ toStopId, toPlaceId }: { toStopId?: string; toPlaceId?: string }) {
  const { network, snapshot, origin } = useApp();
  const lang = useLang();
  const tr = useT();
  const [fromValue, setFromValue] = useState(() => planMemory.fromValue || (origin ? 'origin' : ''));
  const [toValue, setToValue] = useState(() =>
    toStopId ? `stop:${toStopId}` : toPlaceId ? `place:${toPlaceId}` : planMemory.toValue,
  );
  const [criterion, setCriterion] = useState<PlanCriterion>(planMemory.criterion);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    planMemory.fromValue = fromValue;
    planMemory.toValue = toValue;
    planMemory.criterion = criterion;
  }, [fromValue, toValue, criterion]);

  const from = useMemo(() => resolveEndpoint(network, origin, fromValue, lang), [network, origin, fromValue, lang]);
  const to = useMemo(() => resolveEndpoint(network, origin, toValue, lang), [network, origin, toValue, lang]);
  const same =
    from !== null && to !== null &&
    (fromValue === toValue || (from.point.stopId !== undefined && from.point.stopId === to.point.stopId));

  const plan = useMemo(
    () => (from && to && snapshot && !same ? planTrip(network, snapshot, from.point, to.point) : null),
    [network, snapshot, from, to, same],
  );
  const sorted = useMemo(() => (plan ? sortItineraries(plan.itineraries, criterion).slice(0, MAX_SHOWN) : []), [plan, criterion]);
  const winners = useMemo(() => (plan ? bestByCriterion(plan.itineraries) : null), [plan]);
  const active = sorted.find((it) => it.id === selectedId) ?? sorted[0] ?? null;
  const disruption = snapshot?.disruption ?? null;
  const disruptionActive = plan?.itineraries.some((i) => i.affectedByDisruption) ?? false;

  const qualities = useMemo(() => {
    const byVehicle = new Map<string, DataQuality>();
    sorted.forEach((it) => it.legs.forEach((l) => { if (l.vehicleId && l.quality) byVehicle.set(l.vehicleId, l.quality); }));
    return [...byVehicle.values()];
  }, [sorted]);

  // Busiest real stops by name, so the example works with both demo and Namtang data.
  const example = useMemo(() => {
    const busiest = (name: string) =>
      network.stops
        .filter((s) => s.nameTh.includes(name))
        .sort((a, b) => (network.variantIdsByStop[b.id]?.length ?? 0) - (network.variantIdsByStop[a.id]?.length ?? 0))[0];
    const a = busiest('อนุสาวรีย์ชัย');
    const b = busiest('สยาม');
    return a && b ? { from: a.id, to: b.id } : null;
  }, [network]);

  // Show the selected (or top) itinerary on the map.
  useEffect(() => {
    if (!from || !to || same) {
      setPlanPreview(null);
      return;
    }
    const legs = (active?.legs ?? []).map((l) => ({
      variantId: l.chosen.variantId,
      fromStopIndex: l.chosen.boardIndex,
      toStopIndex: l.chosen.alightIndex,
    }));
    const stopPoints = (active?.legs ?? []).flatMap((l) => [
      network.stopById[l.boardStopId].position,
      network.stopById[l.alightStopId].position,
    ]);
    const walks: LatLng[][] = [];
    if (active) {
      const pos = (id: string) => network.stopById[id]?.position;
      const first = pos(active.access.stopId);
      if (first && active.access.distanceM > 0) walks.push([from.point.position, first]);
      for (const l of active.legs) {
        const a = l.transferWalk ? pos(l.transferWalk.fromStopId) : undefined;
        const b = pos(l.boardStopId);
        if (a && b) walks.push([a, b]);
      }
      const last = pos(active.egress.stopId);
      if (last && active.egress.distanceM > 0) walks.push([last, to.point.position]);
    }
    const base = `${from.point.position.join(',')}>${to.point.position.join(',')}|${active?.id ?? 'none'}`;
    setPlanPreview({
      key: `${base}|${legs.map((l) => l.variantId).join(',')}`,
      fitKey: base,
      legs,
      walks,
      fitPoints: [from.point.position, ...stopPoints, to.point.position],
      destination: { position: to.point.position, labelTh: to.labelTh },
      boardStopId: active?.legs[0]?.boardStopId ?? null,
    });
  }, [network, from, to, same, active]);

  useEffect(() => () => setPlanPreview(null), []);

  const swap = () => {
    setFromValue(toValue);
    setToValue(fromValue);
    setSelectedId(null);
  };

  const quickPlaces = QUICK_PLACES.flatMap((id) => (network.placeById[id] ? [network.placeById[id]] : []));
  const total = plan?.itineraries.length ?? 0;

  return (
    <div className="space-y-5 pb-8">
      <PanelHeader
        title={tr('วางแผนการเดินทาง', 'Plan a trip')}
        subtitle={tr('เปรียบเทียบรถเมล์และรถไฟฟ้า · ตำแหน่งรถเป็นข้อมูลจำลอง', 'Buses and BTS/MRT compared · bus positions are simulated')}
      />

      <div className="space-y-1 px-4">
        <EndpointSelect label={tr('จาก', 'From')} value={fromValue} onChange={(v) => { setFromValue(v); setSelectedId(null); }} />
        <div className="flex justify-center">
          <button type="button" onClick={swap} aria-label={tr('สลับจุดเริ่มต้นกับปลายทาง', 'Swap start and destination')} className={btn.ghost}>
            <ArrowDownUp aria-hidden className="h-4 w-4" />
            {tr('สลับ', 'Swap')}
          </button>
        </div>
        <EndpointSelect label={tr('ไป', 'To')} value={toValue} onChange={(v) => { setToValue(v); setSelectedId(null); }} />
      </div>

      {!from && (
        <div className="px-4">
          <Banner tone="info" title={tr('เลือกจุดเริ่มต้น', 'Choose a starting point')}>
            {tr(
              'เลือกจากรายการด้านบน หรือกลับไปหน้าหลักเพื่อใช้ตำแหน่งของคุณหรือตำแหน่งจำลอง',
              'Pick one above, or go back to the home screen to use your location.',
            )}
          </Banner>
        </div>
      )}

      {!to && (
        <Section title={tr('ไปที่ไหนดี', 'Where to?')}>
          <div className="flex flex-wrap gap-2 px-4">
            {quickPlaces.map((p) => (
              <button key={p.id} type="button" onClick={() => setToValue(`place:${p.id}`)} className={btn.secondary}>
                {pickName(lang, p.nameTh, p.nameEn)}
              </button>
            ))}
          </div>
          {example && (
            <div className="px-4">
              <button
                type="button"
                onClick={() => { setFromValue(`stop:${example.from}`); setToValue(`stop:${example.to}`); setSelectedId(null); }}
                className={btn.ghost}
              >
                <Lightbulb aria-hidden className="h-4 w-4" />
                {tr('ลองตัวอย่าง: อนุสาวรีย์ชัยฯ → สยาม', 'Try: Victory Monument → Siam')}
              </button>
            </div>
          )}
        </Section>
      )}

      {same && (
        <div className="px-4">
          <Banner tone="neutral" title={tr('จุดเริ่มต้นและปลายทางเป็นที่เดียวกัน', 'Start and destination are the same')}>
            {tr('เลือกปลายทางอื่นเพื่อดูทางเลือก', 'Choose another destination.')}
          </Banner>
        </div>
      )}

      {from && to && !same && (
        <>
          <NoticeList includeInfo={false} />
          <Section title={tr(`จาก${from.labelTh} ไป${to.labelTh}`, `${from.labelTh} → ${to.labelTh}`)}>
            <LiveStatus qualities={qualities} />

            {!plan ? (
              <p className="px-4 text-sm text-ink-muted">{tr('กำลังโหลดข้อมูลรถ…', 'Loading bus data…')}</p>
            ) : (
              <>
                <fieldset className="px-4">
                  <legend className="mb-2 text-sm font-semibold">{tr('เรียงทางเลือกตาม', 'Sort by')}</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {PLAN_CRITERIA.map((c) => {
                      const meta = CRITERION_META[c];
                      const checked = c === criterion;
                      return (
                        <label
                          key={c}
                          className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ring-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink has-[:focus-visible]:ring-offset-2 ${
                            checked ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-ink ring-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="plan-criterion"
                            value={c}
                            checked={checked}
                            onChange={() => { setCriterion(c); setSelectedId(null); }}
                            className="sr-only"
                          />
                          <meta.Icon aria-hidden className="h-4 w-4 shrink-0" />
                          {criterionLabel(c, lang)}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                {disruptionActive && disruption && (
                  <div className="px-4">
                    <Banner tone="disruption" title={disruption.titleTh}>
                      {plan.itineraries.some((i) => !i.affectedByDisruption)
                        ? tr(
                            'ทางเลือกที่มีแท็ก “เลี่ยงจุดขัดข้อง” ไม่ผ่านช่วงนี้ ส่วนเวลาของทางเลือกที่ผ่านช่วงนี้รวมความล่าช้าโดยประมาณแล้ว',
                            'Options tagged “Avoids disruption” skip this section. Times for the others include the estimated delay.',
                          )
                        : `${tr('ทุกทางเลือกผ่านช่วงนี้', 'Every option passes this section.')} ${disruption.alternativeHintTh}`}
                    </Banner>
                  </div>
                )}

                {plan.walkOnly && (
                  <div className="mx-4 flex items-start gap-3 rounded-2xl bg-white p-3 text-sm ring-1 ring-slate-200">
                    <Footprints aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
                    <p>
                      <strong>{tr('หรือเดินไปเลย:', 'Or just walk:')}</strong> {tr('ประมาณ', 'about')}{' '}
                      {formatDistance(plan.walkOnly.distanceM)} · ~{formatMinutes(plan.walkOnly.walkMin)}
                      {sorted[0] && plan.walkOnly.walkMin <= sorted[0].range.minMin
                        ? tr(' — อาจเร็วกว่านั่งรถ', ' — may be faster than riding')
                        : ''}
                    </p>
                  </div>
                )}

                {plan.accessCount === 0 ? (
                  <div className="px-4">
                    <Banner tone="neutral" title={tr('ไม่มีป้ายในระยะเดิน 900 ม. จากจุดเริ่มต้น', 'No stop within 900 m of the start')}>
                      {tr(
                        'ต้นแบบนี้มีข้อมูลเฉพาะย่านใจกลางกรุงเทพฯ ลองเลือกป้ายเป็นจุดเริ่มต้นแทน',
                        'This prototype covers central Bangkok only. Try choosing a stop as the start.',
                      )}
                    </Banner>
                  </div>
                ) : plan.egressCount === 0 ? (
                  <div className="px-4">
                    <Banner tone="neutral" title={tr('ไม่มีป้ายในระยะเดิน 900 ม. จากปลายทาง', 'No stop within 900 m of the destination')}>
                      {tr('ต้นแบบนี้มีข้อมูลเฉพาะย่านใจกลางกรุงเทพฯ', 'This prototype covers central Bangkok only.')}
                    </Banner>
                  </div>
                ) : sorted.length === 0 ? (
                  <p className="px-4 text-sm text-ink-soft">
                    {tr(
                      'ไม่พบเส้นทางที่ไปถึงได้โดยเปลี่ยนรถไม่เกิน 1 ครั้ง ลองเลือกป้ายหรือสถานีที่ใกล้ปลายทางกว่านี้',
                      'No route with at most 1 transfer. Try a stop or station closer to your destination.',
                    )}
                  </p>
                ) : (
                  <>
                    <p role="status" className="px-4 text-sm text-ink-soft">
                      {tr(
                        `พบ ${total} ทางเลือก${total > MAX_SHOWN ? ` (แสดง ${MAX_SHOWN} อันดับแรก)` : ''} · แตะเพื่อดูขั้นตอนและแสดงบนแผนที่`,
                        `${total} options${total > MAX_SHOWN ? ` (top ${MAX_SHOWN} shown)` : ''} · tap one for steps and to show it on the map`,
                      )}
                    </p>
                    <ul className="space-y-3 px-4">
                      {sorted.map((it) => (
                        <li key={it.id}>
                          <ItineraryCard
                            itinerary={it}
                            nowMs={plan.computedAtMs}
                            expanded={it.id === selectedId}
                            onToggle={() => setSelectedId((cur) => (cur === it.id ? null : it.id))}
                            tags={winners && total > 1 ? PLAN_CRITERIA.filter((c) => winners[c] === it.id).map((c) => criterionTag(c, lang)) : []}
                            disruptionTag={disruptionActive ? (it.affectedByDisruption ? 'affected' : 'avoids') : null}
                            destinationLabel={to.labelTh}
                          />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </Section>

          <p className="mx-4 rounded-xl bg-slate-50 p-3 text-xs text-ink-soft ring-1 ring-slate-200">
            {tr(
              'เวลาเป็นช่วงประมาณการจากตำแหน่งรถจำลองและตารางเดินรถ เผื่อเวลาเปลี่ยนรถ 2 นาที เปลี่ยนรถได้ไม่เกิน 1 ครั้ง และเดินไปต่อรถที่ป้ายหรือสถานีใกล้ ๆ ได้ไม่เกิน 400 ม. ค่าโดยสารรวมคิดแยกแต่ละช่วง (ไม่รวมส่วนลดเปลี่ยนสาย)',
              'Times are estimated ranges from simulated bus positions and timetables, with 2 minutes added per transfer. At most 1 transfer, walking up to 400 m to a nearby stop or station. Fares are added up per ride (no transfer discounts).',
            )}
          </p>
        </>
      )}
    </div>
  );
}