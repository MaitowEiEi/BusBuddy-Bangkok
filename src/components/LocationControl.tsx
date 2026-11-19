import { FlaskConical, List, LocateFixed, MapPin } from 'lucide-react';
import { useId, useState } from 'react';
import { DEMO_USER_LOCATION } from '../data/places';
import { useGeolocation, type GeoStatus } from '../hooks/useGeolocation';
import { pickName, useLang, useT, type Lang } from '../lib/i18n';
import { useApp } from '../state/AppContext';
import type { TransitNetwork } from '../types/transit';
import type { OriginKind } from '../types/ui';
import { Banner } from './ui/Banner';
import { btn } from './ui/buttonStyles';
import { useToast } from './ui/Toast';

const KIND_TAG: Record<OriginKind, { th: string; en: string }> = {
  gps: { th: 'ตำแหน่งจริงจากอุปกรณ์ (ไม่ถูกบันทึก)', en: 'Live device GPS (not stored)' },
  demo: { th: 'ตำแหน่งจำลองสำหรับเดโม', en: 'Simulated demo location' },
  stop: { th: 'เลือกเอง', en: 'Selected manually' },
  place: { th: 'เลือกเอง', en: 'Selected manually' },
};

const GEO_MESSAGE: Partial<Record<GeoStatus, { titleTh: string; titleEn: string; bodyTh: string; bodyEn: string }>> = {
  denied: {
    titleTh: 'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง',
    titleEn: 'Location permission denied',
    bodyTh:
      'ไม่เป็นไร คุณเลือกป้ายหรือสถานที่เองได้ หรือใช้ตำแหน่งจำลอง หากต้องการอนุญาตภายหลัง ให้เปิดสิทธิ์ในการตั้งค่าเบราว์เซอร์',
    bodyEn:
      'No problem — you can pick a stop or landmark manually, or use the demo location. To enable GPS later, allow location access in your browser settings.',
  },
  timeout: {
    titleTh: 'หาตำแหน่งไม่ทันเวลา',
    titleEn: 'Location request timed out',
    bodyTh: 'ลองอีกครั้งในที่โล่ง หรือเลือกป้ายเอง',
    bodyEn: 'Try again outdoors with a clearer sky view, or select a stop manually.',
  },
  unavailable: {
    titleTh: 'ระบุตำแหน่งไม่ได้ในขณะนี้',
    titleEn: 'Location currently unavailable',
    bodyTh: 'ลองอีกครั้งภายหลัง หรือเลือกป้ายหรือสถานที่เอง',
    bodyEn: 'Please try again later, or select a stop or landmark manually.',
  },
  unsupported: {
    titleTh: 'อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง',
    titleEn: 'Geolocation not supported on this browser',
    bodyTh: 'การระบุตำแหน่งต้องเปิดแอปผ่าน https หรือ localhost กรุณาเลือกป้ายเองหรือใช้ตำแหน่งจำลอง',
    bodyEn: 'Geolocation requires HTTPS or localhost. Please select a stop manually or use the demo location.',
  },
};

function resolveOriginLabel(
  origin: { kind: OriginKind; refId?: string; labelTh: string; labelEn?: string },
  network: TransitNetwork,
  lang: Lang,
): string {
  if (lang !== 'en') return origin.labelTh;
  if (origin.labelEn) return origin.labelEn;
  if (origin.kind === 'gps') return 'Your current location';
  if (origin.kind === 'demo') {
    return (DEMO_USER_LOCATION as { labelEn?: string }).labelEn ?? 'Near Victory Monument (Demo)';
  }
  if (origin.kind === 'stop' && origin.refId && network.stopById[origin.refId]) {
    const s = network.stopById[origin.refId];
    return pickName(lang, s.nameTh, s.nameEn);
  }
  if (origin.kind === 'place' && origin.refId && network.placeById[origin.refId]) {
    const p = network.placeById[origin.refId];
    return pickName(lang, p.nameTh, (p as { nameEn?: string }).nameEn);
  }
  return origin.labelTh;
}

export function LocationControl() {
  const { network, origin, setOrigin } = useApp();
  const lang = useLang();
  const tr = useT();
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
    toast(
      tr(
        'ใช้ตำแหน่งปัจจุบันแล้ว ตำแหน่งนี้ใช้ในเครื่องเท่านั้น',
        'Using your current location (processed on this device only)',
      ),
      'success',
    );
  };

  const chooseDemo = () => {
    setOrigin({ kind: 'demo', position: DEMO_USER_LOCATION.position, labelTh: DEMO_USER_LOCATION.labelTh });
    setExpanded(false);
    setPicking(false);
    toast(
      tr('ใช้ตำแหน่งจำลองใกล้อนุสาวรีย์ชัยฯ แล้ว', 'Using demo location near Victory Monument'),
      'success',
    );
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
    toast(tr('ตั้งจุดเริ่มต้นแล้ว', 'Starting point updated'), 'success');
  };

  const message = GEO_MESSAGE[geo.status];

  return (
    <section aria-labelledby={headingId} className="mx-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <h3 id={headingId} className="text-sm font-semibold text-ink-soft">
        {tr('จุดเริ่มต้นของคุณ', 'Your starting point')}
      </h3>

      {origin ? (
        <div className="mt-2 flex items-center gap-3">
          <MapPin aria-hidden className="h-5 w-5 shrink-0 text-brand-700" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{resolveOriginLabel(origin, network, lang)}</p>
            <p className="text-xs text-ink-muted">
              {lang === 'en' ? KIND_TAG[origin.kind].en : KIND_TAG[origin.kind].th}
              {origin.accuracyM
                ? tr(` · ความแม่นยำประมาณ ${origin.accuracyM} ม.`, ` · ~${origin.accuracyM} m accuracy`)
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            className={btn.ghost}
          >
            {expanded ? tr('ปิด', 'Close') : tr('เปลี่ยน', 'Change')}
          </button>
        </div>
      ) : (
        <p className="mt-1 text-sm text-ink-soft">
          {tr(
            'เลือกจุดเริ่มต้นเพื่อดูป้ายใกล้เคียงและรถที่กำลังมา',
            'Choose a starting point to see nearby stops and approaching buses',
          )}
        </p>
      )}

      {expanded && (
        <div className="mt-3 grid gap-2">
          <button
            type="button"
            onClick={requestGps}
            disabled={geo.status === 'requesting'}
            className={btn.primary}
          >
            <LocateFixed aria-hidden className="h-4 w-4" />
            {geo.status === 'requesting'
              ? tr('กำลังขอตำแหน่ง…', 'Requesting location…')
              : tr('ใช้ตำแหน่งของฉัน', 'Use my current location')}
          </button>

          <button type="button" onClick={chooseDemo} className={btn.secondary}>
            <FlaskConical aria-hidden className="h-4 w-4" />
            {tr(
              'ใช้ตำแหน่งจำลอง (เดโม ใกล้อนุสาวรีย์ชัยฯ)',
              'Use demo location (near Victory Monument)',
            )}
          </button>

          <button
            type="button"
            onClick={() => setPicking((p) => !p)}
            aria-expanded={picking}
            className={btn.secondary}
          >
            <List aria-hidden className="h-4 w-4" />
            {tr('เลือกป้ายหรือสถานที่เอง', 'Pick a stop or place manually')}
          </button>

          {picking && (
            <div>
              <label htmlFor={selectId} className="text-sm font-medium">
                {tr('เลือกจุดเริ่มต้น', 'Select starting point')}
              </label>
              <select
                id={selectId}
                value=""
                onChange={(e) => pick(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3"
              >
                <option value="" disabled>
                  {tr('— เลือกป้ายหรือสถานที่ —', '— Select a stop or place —')}
                </option>
                <optgroup label={tr('ป้ายรถเมล์', 'Bus stops')}>
                  {network.stops.map((s) => (
                    <option key={s.id} value={`stop:${s.id}`}>
                      {pickName(lang, s.nameTh, s.nameEn)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={tr('สถานที่', 'Places & landmarks')}>
                  {network.places.map((p) => (
                    <option key={p.id} value={`place:${p.id}`}>
                      {pickName(lang, p.nameTh, (p as { nameEn?: string }).nameEn)}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}

          {message && (
            <Banner tone="warning" title={lang === 'en' ? message.titleEn : message.titleTh}>
              {lang === 'en' ? message.bodyEn : message.bodyTh}
            </Banner>
          )}

          <p className="text-xs text-ink-muted">
            {tr(
              'แอปจะขอสิทธิ์ตำแหน่งเมื่อคุณกดปุ่ม “ใช้ตำแหน่งของฉัน” เท่านั้น ตำแหน่งจริงใช้ในเครื่องนี้และไม่ถูกบันทึก',
              'Location permission is only requested when you tap "Use my current location". Your GPS stays on this device and is never stored.',
            )}
          </p>
        </div>
      )}
    </section>
  );
}
