import { FlaskConical, List, LocateFixed, MapPin } from 'lucide-react';
import { useId, useState } from 'react';
import { DEMO_USER_LOCATION } from '../data/places';
import { useGeolocation, type GeoStatus } from '../hooks/useGeolocation';
import { useApp } from '../state/AppContext';
import type { OriginKind } from '../types/ui';
import { Banner } from './ui/Banner';
import { btn } from './ui/buttonStyles';
import { useToast } from './ui/Toast';

const KIND_TAG: Record<OriginKind, string> = {
  gps: 'ตำแหน่งจริงจากอุปกรณ์ (ไม่ถูกบันทึก)',
  demo: 'ตำแหน่งจำลองสำหรับเดโม',
  stop: 'เลือกเอง',
  place: 'เลือกเอง',
};

const GEO_MESSAGE: Partial<Record<GeoStatus, { title: string; body: string }>> = {
  denied: {
    title: 'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง',
    body: 'ไม่เป็นไร คุณเลือกป้ายหรือสถานที่เองได้ หรือใช้ตำแหน่งจำลอง หากต้องการอนุญาตภายหลัง ให้เปิดสิทธิ์ในการตั้งค่าเบราว์เซอร์',
  },
  timeout: { title: 'หาตำแหน่งไม่ทันเวลา', body: 'ลองอีกครั้งในที่โล่ง หรือเลือกป้ายเอง' },
  unavailable: { title: 'ระบุตำแหน่งไม่ได้ในขณะนี้', body: 'ลองอีกครั้งภายหลัง หรือเลือกป้ายหรือสถานที่เอง' },
  unsupported: {
    title: 'อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง',
    body: 'การระบุตำแหน่งต้องเปิดแอปผ่าน https หรือ localhost กรุณาเลือกป้ายเองหรือใช้ตำแหน่งจำลอง',
  },
};

export function LocationControl() {
  const { network, origin, setOrigin } = useApp();
  const geo = useGeolocation();
  const toast = useToast();
  const [expanded, setExpanded] = useState(origin === null);
  const [picking, setPicking] = useState(false);
  const selectId = useId();
  const headingId = useId();

  const requestGps = async () => {
    const fix = await geo.request();
    if (!fix) {
      setPicking(true);
      return;
    }
    setOrigin({ kind: 'gps', position: fix.position, accuracyM: fix.accuracyM, labelTh: 'ตำแหน่งปัจจุบันของคุณ' });
    setExpanded(false);
    toast('ใช้ตำแหน่งปัจจุบันแล้ว ตำแหน่งนี้ใช้ในเครื่องเท่านั้น', 'success');
  };

  const chooseDemo = () => {
    setOrigin({ kind: 'demo', position: DEMO_USER_LOCATION.position, labelTh: DEMO_USER_LOCATION.labelTh });
    setExpanded(false);
    setPicking(false);
    toast('ใช้ตำแหน่งจำลองใกล้อนุสาวรีย์ชัยฯ แล้ว', 'success');
  };

  const pick = (value: string) => {
    const [kind, id] = value.split(':');
    if (kind === 'stop' && network.stopById[id]) {
      const s = network.stopById[id];
      setOrigin({ kind: 'stop', refId: s.id, position: s.position, labelTh: `ป้าย${s.nameTh}` });
    } else if (kind === 'place' && network.placeById[id]) {
      const p = network.placeById[id];
      setOrigin({ kind: 'place', refId: p.id, position: p.position, labelTh: p.nameTh });
    } else return;
    setPicking(false);
    setExpanded(false);
    toast('ตั้งจุดเริ่มต้นแล้ว', 'success');
  };

  const message = GEO_MESSAGE[geo.status];

  return (
    <section aria-labelledby={headingId} className="mx-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <h3 id={headingId} className="text-sm font-semibold text-ink-soft">จุดเริ่มต้นของคุณ</h3>
      {origin ? (
        <div className="mt-2 flex items-center gap-3">
          <MapPin aria-hidden className="h-5 w-5 shrink-0 text-brand-700" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{origin.labelTh}</p>
            <p className="text-xs text-ink-muted">
              {KIND_TAG[origin.kind]}
              {origin.accuracyM ? ` · ความแม่นยำประมาณ ${origin.accuracyM} ม.` : ''}
            </p>
          </div>
          <button type="button" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} className={btn.ghost}>
            {expanded ? 'ปิด' : 'เปลี่ยน'}
          </button>
        </div>
      ) : (
        <p className="mt-1 text-sm text-ink-soft">เลือกจุดเริ่มต้นเพื่อดูป้ายใกล้เคียงและรถที่กำลังมา</p>
      )}

      {expanded && (
        <div className="mt-3 grid gap-2">
          <button type="button" onClick={requestGps} disabled={geo.status === 'requesting'} className={btn.primary}>
            <LocateFixed aria-hidden className="h-4 w-4" />
            {geo.status === 'requesting' ? 'กำลังขอตำแหน่ง…' : 'ใช้ตำแหน่งของฉัน'}
          </button>
          <button type="button" onClick={chooseDemo} className={btn.secondary}>
            <FlaskConical aria-hidden className="h-4 w-4" />
            ใช้ตำแหน่งจำลอง (เดโม ใกล้อนุสาวรีย์ชัยฯ)
          </button>
          <button type="button" onClick={() => setPicking((p) => !p)} aria-expanded={picking} className={btn.secondary}>
            <List aria-hidden className="h-4 w-4" />
            เลือกป้ายหรือสถานที่เอง
          </button>

          {picking && (
            <div>
              <label htmlFor={selectId} className="text-sm font-medium">เลือกจุดเริ่มต้น</label>
              <select id={selectId} value="" onChange={(e) => pick(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3">
                <option value="" disabled>— เลือกป้ายหรือสถานที่ —</option>
                <optgroup label="ป้ายรถเมล์">
                  {network.stops.map((s) => <option key={s.id} value={`stop:${s.id}`}>{s.nameTh}</option>)}
                </optgroup>
                <optgroup label="สถานที่">
                  {network.places.map((p) => <option key={p.id} value={`place:${p.id}`}>{p.nameTh}</option>)}
                </optgroup>
              </select>
            </div>
          )}

          {message && <Banner tone="warning" title={message.title}>{message.body}</Banner>}

          <p className="text-xs text-ink-muted">
            แอปจะขอสิทธิ์ตำแหน่งเมื่อคุณกดปุ่ม “ใช้ตำแหน่งของฉัน” เท่านั้น ตำแหน่งจริงใช้ในเครื่องนี้และไม่ถูกบันทึก
          </p>
        </div>
      )}
    </section>
  );
}