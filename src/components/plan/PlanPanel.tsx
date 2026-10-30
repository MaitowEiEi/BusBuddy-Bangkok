import { ArrowDownUp, Footprints, Lightbulb } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PLAN_CRITERIA, bestByCriterion, planTrip, sortItineraries, type PlanCriterion } from '../../domain/planner';
import { formatDistance } from '../../lib/format';
import { useApp } from '../../state/AppContext';
import { setPlanPreview } from '../../state/planPreview';
import type { DataQuality } from '../../types/transit';
import { LiveStatus } from '../LiveStatus';
import { NoticeList } from '../NoticeList';
import { PanelHeader } from '../panel/PanelHeader';
import { Banner } from '../ui/Banner';
import { btn } from '../ui/buttonStyles';
import { Section } from '../ui/Section';
import { EndpointSelect } from './EndpointSelect';
import { ItineraryCard } from './ItineraryCard';
import { CRITERION_META, planMemory, resolveEndpoint } from './planUi';

const MAX_SHOWN = 6;
const QUICK_PLACES = ['P01', 'P02', 'P05', 'P10'];

export function PlanPanel({ toStopId, toPlaceId }: { toStopId?: string; toPlaceId?: string }) {
  const { network, snapshot, origin } = useApp();
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

  const from = useMemo(() => resolveEndpoint(network, origin, fromValue), [network, origin, fromValue]);
  const to = useMemo(() => resolveEndpoint(network, origin, toValue), [network, origin, toValue]);
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
    const base = `${from.point.position.join(',')}>${to.point.position.join(',')}|${active?.id ?? 'none'}`;
    setPlanPreview({
      key: `${base}|${legs.map((l) => l.variantId).join(',')}`,
      fitKey: base,
      legs,
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

  return (
    <div className="space-y-5 pb-8">
      <PanelHeader title="วางแผนการเดินทาง" subtitle="เปรียบเทียบทางเลือกจากข้อมูลรถจำลองล่าสุด" />

      <div className="space-y-1 px-4">
        <EndpointSelect label="จาก" value={fromValue} onChange={(v) => { setFromValue(v); setSelectedId(null); }} />
        <div className="flex justify-center">
          <button type="button" onClick={swap} aria-label="สลับจุดเริ่มต้นกับปลายทาง" className={btn.ghost}>
            <ArrowDownUp aria-hidden className="h-4 w-4" />
            สลับ
          </button>
        </div>
        <EndpointSelect label="ไป" value={toValue} onChange={(v) => { setToValue(v); setSelectedId(null); }} />
      </div>

      {!from && (
        <div className="px-4">
          <Banner tone="info" title="เลือกจุดเริ่มต้น">
            เลือกจากรายการด้านบน หรือกลับไปหน้าหลักเพื่อใช้ตำแหน่งของคุณหรือตำแหน่งจำลอง
          </Banner>
        </div>
      )}

      {!to && (
        <Section title="ไปที่ไหนดี">
          <div className="flex flex-wrap gap-2 px-4">
            {quickPlaces.map((p) => (
              <button key={p.id} type="button" onClick={() => setToValue(`place:${p.id}`)} className={btn.secondary}>
                {p.nameTh}
              </button>
            ))}
          </div>
          <div className="px-4">
            <button
              type="button"
              onClick={() => { setFromValue('stop:S01'); setToValue('stop:S04'); setSelectedId(null); }}
              className={btn.ghost}
            >
              <Lightbulb aria-hidden className="h-4 w-4" />
              ลองตัวอย่าง: อนุสาวรีย์ชัยฯ → สยาม
            </button>
          </div>
        </Section>
      )}

      {same && (
        <div className="px-4">
          <Banner tone="neutral" title="จุดเริ่มต้นและปลายทางเป็นที่เดียวกัน">เลือกปลายทางอื่นเพื่อดูทางเลือก</Banner>
        </div>
      )}

      {from && to && !same && (
        <>
          <NoticeList includeInfo={false} />
          <Section title={`จาก${from.labelTh} ไป${to.labelTh}`}>
            <LiveStatus qualities={qualities} />

            {!plan ? (
              <p className="px-4 text-sm text-ink-muted">กำลังโหลดข้อมูลรถ…</p>
            ) : (
              <>
                <fieldset className="px-4">
                  <legend className="mb-2 text-sm font-semibold">เรียงทางเลือกตาม</legend>
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
                          {meta.label}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                {disruptionActive && disruption && (
                  <div className="px-4">
                    <Banner tone="disruption" title={disruption.titleTh}>
                      {plan.itineraries.some((i) => !i.affectedByDisruption)
                        ? 'ทางเลือกที่มีแท็ก “เลี่ยงจุดขัดข้อง” ไม่ผ่านช่วงนี้ ส่วนเวลาของทางเลือกที่ผ่านช่วงนี้รวมความล่าช้าโดยประมาณแล้ว'
                        : `ทุกทางเลือกผ่านช่วงนี้ ${disruption.alternativeHintTh}`}
                    </Banner>
                  </div>
                )}

                {plan.walkOnly && (
                  <div className="mx-4 flex items-start gap-3 rounded-2xl bg-white p-3 text-sm ring-1 ring-slate-200">
                    <Footprints aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
                    <p>
                      <strong>หรือเดินไปเลย:</strong> ประมาณ {formatDistance(plan.walkOnly.distanceM)} · ~{plan.walkOnly.walkMin} นาที
                      {sorted[0] && plan.walkOnly.walkMin <= sorted[0].range.minMin ? ' — อาจเร็วกว่านั่งรถ' : ''}
                    </p>
                  </div>
                )}

                {plan.accessCount === 0 ? (
                  <div className="px-4">
                    <Banner tone="neutral" title="ไม่มีป้ายในระยะเดิน 900 ม. จากจุดเริ่มต้น">
                      ต้นแบบนี้มีข้อมูลเฉพาะย่านใจกลางกรุงเทพฯ ลองเลือกป้ายเป็นจุดเริ่มต้นแทน
                    </Banner>
                  </div>
                ) : plan.egressCount === 0 ? (
                  <div className="px-4">
                    <Banner tone="neutral" title="ไม่มีป้ายในระยะเดิน 900 ม. จากปลายทาง">
                      ต้นแบบนี้มีข้อมูลเฉพาะย่านใจกลางกรุงเทพฯ
                    </Banner>
                  </div>
                ) : sorted.length === 0 ? (
                  <p className="px-4 text-sm text-ink-soft">
                    ไม่พบเส้นทางรถเมล์ในข้อมูลจำลองที่ไปถึงได้โดยเปลี่ยนรถไม่เกิน 1 ครั้ง
                  </p>
                ) : (
                  <>
                    <p role="status" className="px-4 text-sm text-ink-soft">
                      พบ {plan.itineraries.length} ทางเลือก
                      {plan.itineraries.length > MAX_SHOWN ? ` (แสดง ${MAX_SHOWN} อันดับแรก)` : ''} · แตะเพื่อดูขั้นตอนและแสดงบนแผนที่
                    </p>
                    <ul className="space-y-3 px-4">
                      {sorted.map((it) => (
                        <li key={it.id}>
                          <ItineraryCard
                            itinerary={it}
                            nowMs={plan.computedAtMs}
                            expanded={it.id === selectedId}
                            onToggle={() => setSelectedId((cur) => (cur === it.id ? null : it.id))}
                            tags={winners && plan.itineraries.length > 1 ? PLAN_CRITERIA.filter((c) => winners[c] === it.id).map((c) => CRITERION_META[c].tag) : []}
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
            เวลาเป็นช่วงประมาณการจากตำแหน่งรถจำลองและตารางเดินรถ คิดเวลาเผื่อเปลี่ยนรถ 2 นาที รองรับการเปลี่ยนรถไม่เกิน 1 ครั้งที่ป้ายเดียวกัน
            ค่าโดยสารรวมคิดแยกแต่ละคัน (ต้นแบบไม่มีส่วนลดเปลี่ยนสาย)
          </p>
        </>
      )}
    </div>
  );
}