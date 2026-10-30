import type { ServiceNotice } from '../types/transit';

export const STATIC_NOTICES: ServiceNotice[] = [
  {
    id: 'N-D21S', severity: 'info', routeIds: ['D21'],
    titleTh: 'D21 มีเที่ยวสั้นที่สิ้นสุดที่สยาม',
    detailTh: 'เที่ยวสั้นไม่ไปราชประสงค์ ลุมพินี และสีลม โปรดดูป้ายหน้ารถหรือรายละเอียดเที่ยวก่อนขึ้น (ประกาศจำลอง)',
  },
  {
    id: 'N-D40-STOP', severity: 'info', routeIds: ['D40'],
    titleTh: 'ย้ายจุดจอดชั่วคราวที่ราชประสงค์',
    detailTh: 'จุดจอดของสาย D40 ขยับไปทางทิศเหนือประมาณ 50 ม. (ประกาศจำลอง)',
  },
];