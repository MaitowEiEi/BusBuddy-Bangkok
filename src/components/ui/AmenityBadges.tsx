import { Accessibility, ArrowDownToLine, Snowflake, Zap, type LucideIcon } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import type { FeatureSource, Vehicle } from '../../types/transit';

interface Feature {
  key: string;
  Icon: LucideIcon;
  has: boolean;
  yesTh: string;
  noTh: string;
  source: FeatureSource;
}

export function vehicleFeatures(v: Vehicle): Feature[] {
  const src = v.featureSource;
  return [
    {
      key: 'wheelchair',
      Icon: Accessibility,
      has: v.accessibility.ramp || v.accessibility.wheelchairSpaces > 0,
      yesTh: 'รถเข็นขึ้นได้',
      noTh: 'รถเข็นขึ้นไม่ได้',
      source: src?.wheelchair ?? 'sim',
    },
    {
      key: 'ac',
      Icon: Snowflake,
      has: v.type !== 'non_ac_standard',
      yesTh: 'รถแอร์',
      noTh: 'รถร้อน ไม่มีแอร์',
      source: src?.ac ?? 'sim',
    },
    {
      key: 'lowFloor',
      Icon: ArrowDownToLine,
      has: v.accessibility.lowFloor,
      yesTh: 'ชานต่ำ ไม่มีขั้นบันได',
      noTh: 'มีขั้นบันได',
      source: 'sim',
    },
    {
      key: 'ev',
      Icon: Zap,
      has: v.type === 'ev_low_floor',
      yesTh: 'รถไฟฟ้า EV',
      noTh: 'รถเครื่องยนต์',
      source: 'sim',
    },
  ];
}

const TONE = {
  real: 'bg-emerald-700 text-white ring-1 ring-emerald-800',
  sim: 'border-2 border-dashed border-emerald-600 bg-emerald-50 text-emerald-900',
  no: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
};

interface Props {
  vehicleId: string;
  size?: 'lg' | 'sm';
}

export function AmenityBadges({ vehicleId, size = 'lg' }: Props) {
  const { network } = useApp();
  const vehicle = network.vehicleById[vehicleId];
  if (!vehicle) return null;

  const lg = size === 'lg';
  // Small cards show what the bus has, plus wheelchair either way because it decides whether someone can board.
  const features = vehicleFeatures(vehicle).filter((f) => lg || f.has || f.key === 'wheelchair');

  return (
    <div className={lg ? 'space-y-2' : undefined}>
      <ul
        aria-label="สิ่งอำนวยความสะดวกของรถคันนี้"
        className={lg ? 'grid grid-cols-2 gap-2 sm:grid-cols-4' : 'flex flex-wrap gap-1.5'}
      >
        {features.map((f) => {
          const tone = !f.has ? TONE.no : f.source === 'gtfs' ? TONE.real : TONE.sim;
          const label = f.has ? f.yesTh : f.noTh;
          return (
            <li
              key={f.key}
              className={`flex items-center rounded-xl font-semibold ${tone} ${
                lg ? 'min-h-20 flex-col justify-center gap-1 p-2 text-center text-sm' : 'gap-1 px-2 py-1 text-xs'
              }`}
            >
              <span aria-hidden className="relative inline-flex">
                <f.Icon className={lg ? 'h-8 w-8' : 'h-4 w-4'} />
                {!f.has && (
                  <span className="absolute left-1/2 top-1/2 h-0.5 w-[130%] -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded bg-current" />
                )}
              </span>
              <span>{label}</span>
              {lg && f.has && f.source === 'sim' && <span className="text-[11px] font-medium">(จำลอง)</span>}
              <span className="sr-only">{f.source === 'gtfs' ? ' (ข้อมูลจาก สนข.)' : ' (ข้อมูลจำลอง)'}</span>
            </li>
          );
        })}
      </ul>
      {lg && (
        <p className="text-xs text-ink-muted">
          พื้นเขียวเข้ม = ยืนยันจากข้อมูล สนข. · กรอบเส้นประ = ข้อมูลจำลอง ผู้ใช้รถเข็นควรสอบถามพนักงานก่อนขึ้นรถ
        </p>
      )}
    </div>
  );
}