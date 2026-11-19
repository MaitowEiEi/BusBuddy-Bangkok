import { getLang, pickName, type Lang } from '../lib/i18n';
import { compassTh, pointAlong } from '../sim/geo';
import type { RouteVariant, TransitNetwork } from '../types/transit';

const COMPASS_EN = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
] as const;

function compassEn(bearingDeg: number): string {
  const normalized = ((bearingDeg % 360) + 360) % 360;
  const idx = Math.round(normalized / 45) % 8;
  return COMPASS_EN[idx];
}

/** Generated boarding-side hint from the direction the bus leaves this stop. */
export function boardingGuidance(
  net: TransitNetwork,
  variant: RouteVariant,
  stopIndex: number,
  lang: Lang = getLang(),
): string {
  const lastIndex = variant.stopIds.length - 1;
  const isEn = lang === 'en';

  if (stopIndex >= lastIndex) {
    return isEn
      ? 'This trip terminates here — drop-off only'
      : 'รถเที่ยวนี้สิ้นสุดที่ป้ายนี้ ไม่รับผู้โดยสารเดินทางต่อ';
  }

  const next = net.stopById[variant.stopIds[stopIndex + 1]];
  const terminal = net.stopById[variant.stopIds[lastIndex]];
  const nextName = pickName(lang, next.nameTh, next.nameEn);
  const terminalName = pickName(lang, terminal.nameTh, terminal.nameEn);
  const { bearingDeg } = pointAlong(variant.shape, variant.shapeCumM, variant.stopDistancesM[stopIndex] + 30);

  if (isEn) {
    return `Wait on the side heading ${compassEn(bearingDeg)} · Next stop: ${nextName} · Terminal: ${terminalName}`;
  }
  return `รอฝั่งถนนที่รถวิ่งไป${compassTh(bearingDeg)} · ป้ายถัดไป: ${nextName} · ปลายทาง: ${terminalName}`;
}
