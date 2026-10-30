import type { CrowdLevel, DataQuality, Direction, ServiceType, VehicleStatus, VehicleType } from '../types/transit';

export const CROWD_LABEL: Record<CrowdLevel, { short: string; detail: string }> = {
  seats: { short: 'มีที่นั่งว่าง', detail: 'ประมาณการว่ายังมีที่นั่งว่าง' },
  standing: { short: 'มีที่ยืน', detail: 'ที่นั่งน่าจะเต็มแล้ว แต่ยังมีที่ยืน' },
  crowded: { short: 'แน่นมาก', detail: 'รถหนาแน่นมาก อาจขึ้นไม่ได้' },
  unknown: { short: 'ไม่ทราบความหนาแน่น', detail: 'ไม่มีข้อมูลประมาณการจำนวนผู้โดยสาร' },
};

export const QUALITY_LABEL: Record<DataQuality, { short: string; detail: string }> = {
  live: { short: 'ข้อมูลล่าสุด', detail: 'ได้รับตำแหน่งรถเมื่อไม่นานมานี้' },
  delayed: { short: 'ข้อมูลล่าช้า', detail: 'ตำแหน่งรถไม่ได้อัปเดตเกิน 1.5 นาที เวลาที่แสดงอาจคลาดเคลื่อน' },
  unavailable: { short: 'ไม่มีข้อมูลสด', detail: 'ไม่ได้รับสัญญาณจากรถ จึงประมาณเวลาถึงไม่ได้' },
};

export const SERVICE_LABEL: Record<ServiceType, string> = {
  ac: 'รถปรับอากาศ',
  non_ac: 'รถธรรมดา (ไม่มีแอร์)',
};

export const DIRECTION_LABEL: Record<Direction, string> = {
  outbound: 'เที่ยวไป',
  inbound: 'เที่ยวกลับ',
};

export const STATUS_LABEL: Record<VehicleStatus, string> = {
  layover: 'รอออกจากต้นทาง',
  moving: 'กำลังวิ่ง',
  at_stop: 'จอดรับส่งที่ป้าย',
};

export const VEHICLE_TYPE_LABEL: Record<VehicleType, string> = {
  ev_low_floor: 'รถไฟฟ้าชานต่ำ ปรับอากาศ',
  ac_standard: 'รถปรับอากาศ (มีขั้นบันได)',
  non_ac_standard: 'รถธรรมดา (มีขั้นบันได)',
};