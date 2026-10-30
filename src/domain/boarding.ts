import { compassTh, pointAlong } from '../sim/geo';
import type { RouteVariant, TransitNetwork } from '../types/transit';

/** Generated boarding-side hint from the direction the bus leaves this stop. */
export function boardingGuidance(net: TransitNetwork, variant: RouteVariant, stopIndex: number): string {
  const lastIndex = variant.stopIds.length - 1;
  if (stopIndex >= lastIndex) return 'รถเที่ยวนี้สิ้นสุดที่ป้ายนี้ ไม่รับผู้โดยสารเดินทางต่อ';
  const next = net.stopById[variant.stopIds[stopIndex + 1]];
  const terminal = net.stopById[variant.stopIds[lastIndex]];
  const { bearingDeg } = pointAlong(variant.shape, variant.shapeCumM, variant.stopDistancesM[stopIndex] + 30);
  return `รอฝั่งถนนที่รถวิ่งไป${compassTh(bearingDeg)} · ป้ายถัดไป: ${next.nameTh} · ปลายทาง: ${terminal.nameTh}`;
}