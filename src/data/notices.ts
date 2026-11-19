import type { ServiceNotice } from '../types/transit';

export const STATIC_NOTICES: ServiceNotice[] = [
  {
    id: 'N-D21S',
    severity: 'info',
    routeIds: ['D21'],
    titleTh: 'D21 มีเที่ยวสั้นที่สิ้นสุดที่สยาม',
    detailTh: 'เที่ยวสั้นไม่ไปราชประสงค์ ลุมพินี และสีลม โปรดดูป้ายหน้ารถหรือรายละเอียดเที่ยวก่อนขึ้น (ประกาศจำลอง)',
  },
  {
    id: 'N-D40-STOP',
    severity: 'info',
    routeIds: ['D40'],
    titleTh: 'ย้ายจุดจอดชั่วคราวที่ราชประสงค์',
    detailTh: 'จุดจอดของสาย D40 ขยับไปทางทิศเหนือประมาณ 50 ม. (ประกาศจำลอง)',
  },
];

/** English translations keyed by notice ID so ServiceNotice type stays backward-compatible. */
export const NOTICE_EN_BY_ID: Record<string, { titleEn: string; detailEn: string }> = {
  'N-D21S': {
    titleEn: 'D21 operates short-turn trips terminating at Siam',
    detailEn:
      'Short-turn trips do not continue to Ratchaprasong, Lumphini, or Silom. Please check the destination sign or trip details before boarding (simulated notice).',
  },
  'N-D40-STOP': {
    titleEn: 'Temporary stop relocation at Ratchaprasong',
    detailEn: 'The stop for Route D40 has moved approximately 50 m north (simulated notice).',
  },
};
