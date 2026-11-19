import {
  AlertTriangle, Armchair, ArrowDownLeft, ArrowUpRight, Clock, CornerDownRight, Fan, HelpCircle,
  Radio, Snowflake, Users, WifiOff, type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useLang, useT } from '../../lib/i18n';
import { crowdLabel, directionLabel, qualityLabel } from '../../lib/labels';
import type { CrowdLevel, DataQuality, Direction, Route, ServiceType } from '../../types/transit';

const PILL = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset';

export function RouteBadge({ route, size = 'md' }: { route: Route; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'min-w-[2.5rem] px-1.5 py-0.5 text-xs',
    md: 'min-w-[3rem] px-2 py-0.5 text-sm',
    lg: 'min-w-[3.5rem] px-2.5 py-1 text-lg',
  };
  return (
    <span className={`inline-flex items-center justify-center rounded-lg font-bold text-white ${sizes[size]}`} style={{ backgroundColor: route.color }}>
      {route.shortName}
    </span>
  );
}

const CROWD_STYLE: Record<CrowdLevel, { cls: string; Icon: LucideIcon }> = {
  seats: { cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200', Icon: Armchair },
  standing: { cls: 'bg-amber-50 text-amber-900 ring-amber-200', Icon: Users },
  crowded: { cls: 'bg-red-50 text-red-800 ring-red-200', Icon: AlertTriangle },
  unknown: { cls: 'bg-slate-100 text-slate-700 ring-slate-200', Icon: HelpCircle },
};

export function CrowdBadge({ level, passengers, capacity }: { level: CrowdLevel; passengers?: number | null; capacity?: number }) {
  const tr = useT();
  const { cls, Icon } = CROWD_STYLE[level];
  const label = crowdLabel(level);
  return (
    <span className={`${PILL} ${cls}`} title={label.detail}>
      <Icon aria-hidden className="h-3.5 w-3.5" />
      <span className="sr-only">{tr('ความหนาแน่นโดยประมาณ: ', 'Estimated crowding: ')}</span>
      {label.short}
      {passengers != null && capacity ? (
        <span className="font-normal">
          · ~{passengers}/{capacity} {tr('คน', 'people')}
        </span>
      ) : null}
    </span>
  );
}

const QUALITY_STYLE: Record<DataQuality, { cls: string; Icon: LucideIcon }> = {
  live: { cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200', Icon: Radio },
  delayed: { cls: 'bg-amber-50 text-amber-900 ring-amber-300', Icon: Clock },
  unavailable: { cls: 'bg-slate-100 text-slate-700 ring-slate-300', Icon: WifiOff },
};

export function QualityBadge({ quality }: { quality: DataQuality }) {
  useLang(); // re-render when the language changes
  const { cls, Icon } = QUALITY_STYLE[quality];
  const label = qualityLabel(quality);
  return (
    <span className={`${PILL} ${cls}`} title={label.detail}>
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {label.short}
    </span>
  );
}

export function ServiceBadge({ type }: { type: ServiceType }) {
  const tr = useT();
  return type === 'ac' ? (
    <span className={`${PILL} bg-sky-50 text-sky-800 ring-sky-200`}>
      <Snowflake aria-hidden className="h-3.5 w-3.5" />
      {tr('รถแอร์', 'Air-con')}
    </span>
  ) : (
    <span className={`${PILL} bg-slate-100 text-slate-700 ring-slate-200`}>
      <Fan aria-hidden className="h-3.5 w-3.5" />
      {tr('รถธรรมดา ไม่มีแอร์', 'No air-con')}
    </span>
  );
}

export function DirectionBadge({ direction }: { direction: Direction }) {
  useLang();
  const Icon = direction === 'outbound' ? ArrowUpRight : ArrowDownLeft;
  return (
    <span className={`${PILL} bg-white text-ink-soft ring-slate-300`}>
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {directionLabel(direction)}
    </span>
  );
}

export function ShortTurnBadge() {
  const tr = useT();
  return (
    <span className={`${PILL} bg-violet-50 text-violet-800 ring-violet-200`}>
      <CornerDownRight aria-hidden className="h-3.5 w-3.5" />
      {tr('เที่ยวสั้น', 'Short trip')}
    </span>
  );
}

export function InfoChip({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className={`${PILL} bg-white font-medium text-ink-soft ring-slate-200`}>
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}