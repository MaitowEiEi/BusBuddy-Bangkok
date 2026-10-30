import type { FrequencyPeriod, PathPoint, Route, RouteVariantDef } from '../types/transit';

const s = (stopId: string): PathPoint => ({ stopId });
const via = (lat: number, lng: number): PathPoint => ({ via: [lat, lng] });

function frequency(peak: [number, number], offPeak: [number, number], night: [number, number]): FrequencyPeriod[] {
  return [
    { labelTh: 'เช้าตรู่', from: '05:00', to: '06:30', headwayMin: night },
    { labelTh: 'ชั่วโมงเร่งด่วนเช้า', from: '06:30', to: '09:30', headwayMin: peak },
    { labelTh: 'ช่วงกลางวัน', from: '09:30', to: '16:30', headwayMin: offPeak },
    { labelTh: 'ชั่วโมงเร่งด่วนเย็น', from: '16:30', to: '19:30', headwayMin: peak },
    { labelTh: 'ช่วงค่ำ', from: '19:30', to: '23:00', headwayMin: night },
  ];
}

// All route codes ("D" = demo), timetables and fares are fictional.
export const ROUTES: Route[] = [
  {
    id: 'D10', shortName: 'D10', nameTh: 'หมอชิต – สามย่าน', serviceType: 'ac', color: '#0f766e', avgSpeedKmh: 17,
    fare: { kind: 'distance', baseThb: 15, stepThb: 5, stopsPerStep: 4, maxThb: 25 },
    firstDeparture: '05:00', lastDeparture: '22:30', frequency: frequency([20, 25], [22, 28], [28, 35]),
  },
  {
    id: 'D21', shortName: 'D21', nameTh: 'อนุสาวรีย์ชัยฯ – สีลม', serviceType: 'ac', color: '#1d4ed8', avgSpeedKmh: 16,
    fare: { kind: 'distance', baseThb: 15, stepThb: 5, stopsPerStep: 3, maxThb: 25 },
    firstDeparture: '05:30', lastDeparture: '22:00', frequency: frequency([12, 18], [15, 20], [25, 30]),
  },
  {
    id: 'D35', shortName: 'D35', nameTh: 'อนุสาวรีย์ชัยฯ – อโศก', serviceType: 'non_ac', color: '#7c3aed', avgSpeedKmh: 15,
    fare: { kind: 'flat', amountThb: 10 },
    firstDeparture: '05:00', lastDeparture: '21:30', frequency: frequency([22, 28], [25, 30], [30, 40]),
  },
  {
    id: 'D40', shortName: 'D40', nameTh: 'ปทุมวัน – มักกะสัน', serviceType: 'ac', color: '#c2410c', avgSpeedKmh: 16,
    fare: { kind: 'distance', baseThb: 15, stepThb: 5, stopsPerStep: 3, maxThb: 20 },
    firstDeparture: '05:30', lastDeparture: '22:00', frequency: frequency([16, 20], [18, 22], [25, 30]),
  },
  {
    id: 'D52', shortName: 'D52', nameTh: 'สะพานควาย – สวนลุมพินี', serviceType: 'non_ac', color: '#0369a1', avgSpeedKmh: 15,
    fare: { kind: 'flat', amountThb: 10 },
    firstDeparture: '05:00', lastDeparture: '21:00', frequency: frequency([30, 36], [32, 40], [40, 45]),
  },
];

function variantPair(
  routeId: string,
  path: PathPoint[],
  headsignOut: string,
  headsignIn: string,
  opts: { key?: string; shortTurn?: boolean } = {},
): RouteVariantDef[] {
  const key = opts.key ?? routeId;
  const isShortTurn = opts.shortTurn ?? false;
  const variantLabelTh = isShortTurn ? 'เที่ยวสั้น' : 'เที่ยวปกติ';
  return [
    { id: `${key}-O`, routeId, direction: 'outbound', isShortTurn, variantLabelTh, headsignTh: headsignOut, path },
    { id: `${key}-I`, routeId, direction: 'inbound', isShortTurn, variantLabelTh, headsignTh: headsignIn, path: [...path].reverse() },
  ];
}

const VICTORY_TO_RATCHAPRAROP: PathPoint[] = [s('S01'), via(13.7645, 100.542), s('S20')];

export const VARIANT_DEFS: RouteVariantDef[] = [
  // D10 and D21 share Victory → Pathumwan, then diverge (D10 south to Samyan, D21 east to Siam).
  ...variantPair('D10', [s('S17'), s('S16'), s('S15'), s('S14'), s('S01'), s('S02'), s('S03'), s('S05'), s('S19'), s('S06')], 'ไปสามย่าน', 'ไปหมอชิต'),
  ...variantPair('D21', [s('S01'), s('S02'), s('S03'), s('S05'), s('S04'), s('S10'), s('S08'), s('S07')], 'ไปสีลม (ศาลาแดง)', 'ไปอนุสาวรีย์ชัยฯ'),
  // Same route number, different journey: the short-turn ends at Siam.
  ...variantPair('D21', [s('S01'), s('S02'), s('S03'), s('S05'), s('S04')], 'ไปสยาม (เที่ยวสั้น)', 'ไปอนุสาวรีย์ชัยฯ (เที่ยวสั้น)', { key: 'D21S', shortTurn: true }),
  // D35 and D52 share Victory → Ratchaprasong, then diverge (D35 east, D52 south).
  ...variantPair('D35', [...VICTORY_TO_RATCHAPRAROP, s('S09'), s('S10'), s('S11'), s('S12'), via(13.7405, 100.555), s('S13')], 'ไปอโศก', 'ไปอนุสาวรีย์ชัยฯ'),
  ...variantPair('D40', [s('S05'), s('S04'), s('S10'), s('S09'), s('S18')], 'ไปมักกะสัน', 'ไปปทุมวัน (MBK)'),
  ...variantPair('D52', [s('S16'), s('S15'), s('S14'), ...VICTORY_TO_RATCHAPRAROP, s('S09'), s('S10'), s('S08')], 'ไปสวนลุมพินี', 'ไปสะพานควาย'),
];