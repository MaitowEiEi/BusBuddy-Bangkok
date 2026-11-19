import { Accessibility, ArrowDownToLine, Snowflake, Zap, type LucideIcon } from 'lucide-react';
import { useLang, useT } from '../../lib/i18n';
import { useApp } from '../../state/AppContext';
import type { FeatureSource, Vehicle } from '../../types/transit';

/** Shown for simulated features instead of a guess. */
const UNKNOWN = { th: 'ไม่มีข้อมูล', en: 'No data' };

interface Feature {
  key: string;
  Icon: LucideIcon;
  has: boolean;
  nameTh: string;
  nameEn: string;
  yesTh: string;
  yesEn: string;
  noTh: string;
  noEn: string;
  source: FeatureSource;
}

export function vehicleFeatures(v: Vehicle): Feature[] {
  const src = v.featureSource;
  return [
    {
      key: 'wheelchair',
      Icon: Accessibility,
      has: v.accessibility.ramp || v.accessibility.wheelchairSpaces > 0,
      nameTh: 'รถเข็น',
      nameEn: 'Wheelchair',
      yesTh: 'รถเข็นขึ้นได้',
      yesEn: 'Wheelchair access',
      noTh: 'รถเข็นขึ้นไม่ได้',
      noEn: 'No wheelchair access',
      source: src?.wheelchair ?? 'sim',
    },
    {
      key: 'ac',
      Icon: Snowflake,
      has: v.type !== 'non_ac_standard',
      nameTh: 'แอร์',
      nameEn: 'Air-con',
      yesTh: 'รถแอร์',
      yesEn: 'Air-con',
      noTh: 'รถร้อน ไม่มีแอร์',
      noEn: 'No air-con',
      source: src?.ac ?? 'sim',
    },
    {
      key: 'lowFloor',
      Icon: ArrowDownToLine,
      has: v.accessibility.lowFloor,
      nameTh: 'ชานต่ำ',
      nameEn: 'Low floor',
      yesTh: 'ชานต่ำ ไม่มีขั้นบันได',
      yesEn: 'Low floor, no steps',
      noTh: 'มีขั้นบันได',
      noEn: 'Has steps',
      source: 'sim',
    },
    {
      key: 'ev',
      Icon: Zap,
      has: v.type === 'ev_low_floor',
      nameTh: 'รถไฟฟ้า EV',
      nameEn: 'Electric (EV)',
      yesTh: 'รถไฟฟ้า EV',
      yesEn: 'Electric (EV)',
      noTh: 'รถเครื่องยนต์',
      noEn: 'Diesel / engine',
      source: 'sim',
    },
  ];
}

const TONE = {
  yes: 'bg-emerald-700 text-white ring-1 ring-emerald-800',
  no: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  unknown: 'bg-slate-50 text-slate-500 ring-1 ring-slate-200',
};

interface Props {
  vehicleId: string;
  size?: 'lg' | 'sm';
}

export function AmenityBadges({ vehicleId, size = 'lg' }: Props) {
  const { network } = useApp();
  const lang = useLang();
  const tr = useT();
  const vehicle = network.vehicleById[vehicleId];
  if (!vehicle) return null;

  const en = lang === 'en';
  const lg = size === 'lg';
  const all = vehicleFeatures(vehicle);
  // Small cards: confirmed features the bus has, plus wheelchair either way because it decides whether someone can board.
  const features = lg ? all : all.filter((f) => f.key === 'wheelchair' || (f.source === 'gtfs' && f.has));

  return (
    <div className={lg ? 'space-y-2' : undefined}>
      <ul
        aria-label={tr('สิ่งอำนวยความสะดวกของรถคันนี้', 'Features of this bus')}
        className={lg ? 'grid grid-cols-2 gap-2 sm:grid-cols-4' : 'flex flex-wrap gap-1.5'}
      >
        {features.map((f) => {
          const known = f.source === 'gtfs';
          const tone = !known ? TONE.unknown : f.has ? TONE.yes : TONE.no;
          const name = !known ? (en ? f.nameEn : f.nameTh) : f.has ? (en ? f.yesEn : f.yesTh) : en ? f.noEn : f.noTh;
          return (
            <li
              key={f.key}
              className={`flex items-center rounded-xl font-semibold ${tone} ${
                lg ? 'min-h-20 flex-col justify-center gap-1 p-2 text-center text-sm' : 'gap-1 px-2 py-1 text-xs'
              }`}
            >
              <span aria-hidden className="relative inline-flex">
                <f.Icon className={lg ? 'h-8 w-8' : 'h-4 w-4'} />
                {known && !f.has && (
                  <span className="absolute left-1/2 top-1/2 h-0.5 w-[130%] -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded bg-current" />
                )}
              </span>
              <span>
                {name}
                {!known && (
                  <span className={lg ? 'block text-[11px] font-medium' : 'font-normal'}>
                    {lg ? '' : ': '}
                    {en ? UNKNOWN.en : UNKNOWN.th}
                  </span>
                )}
              </span>
              {known && <span className="sr-only">{tr(' (ข้อมูลจาก สนข.)', ' (from OTP data)')}</span>}
            </li>
          );
        })}
      </ul>
      {lg && (
        <p className="text-xs text-ink-muted">
          {tr(
            'พื้นเขียวเข้ม = ยืนยันจากข้อมูล สนข. · สีเทา “ไม่มีข้อมูล” = ยังไม่ทราบ ผู้ใช้รถเข็นควรสอบถามพนักงานก่อนขึ้นรถ',
            'Dark green = confirmed by OTP data · Grey “No data” = not known. Wheelchair users should ask staff before boarding.',
          )}
        </p>
      )}
    </div>
  );
}