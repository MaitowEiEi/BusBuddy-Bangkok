import type { CrowdLevel, DataQuality, Direction, ServiceType, VehicleStatus, VehicleType } from '../types/transit';
import { getLang } from './i18n';

const en = () => getLang() === 'en';

interface Label {
  short: string;
  detail: string;
  shortEn: string;
  detailEn: string;
}

export const CROWD_LABEL: Record<CrowdLevel, Label> = {
  seats: { short: 'มีที่นั่งว่าง', detail: 'ประมาณการว่ายังมีที่นั่งว่าง', shortEn: 'Seats free', detailEn: 'Estimated: seats still free' },
  standing: { short: 'มีที่ยืน', detail: 'ที่นั่งน่าจะเต็มแล้ว แต่ยังมีที่ยืน', shortEn: 'Standing room', detailEn: 'Seats probably full, standing room left' },
  crowded: { short: 'แน่นมาก', detail: 'รถหนาแน่นมาก อาจขึ้นไม่ได้', shortEn: 'Very crowded', detailEn: 'Very crowded, you may not get on' },
  unknown: { short: 'ไม่ทราบความหนาแน่น', detail: 'ไม่มีข้อมูลประมาณการจำนวนผู้โดยสาร', shortEn: 'Crowding unknown', detailEn: 'No passenger estimate' },
};

export const QUALITY_LABEL: Record<DataQuality, Label> = {
  live: { short: 'ข้อมูลล่าสุด', detail: 'ได้รับตำแหน่งรถเมื่อไม่นานมานี้', shortEn: 'Live', detailEn: 'Bus position received recently' },
  delayed: { short: 'ข้อมูลล่าช้า', detail: 'ตำแหน่งรถไม่ได้อัปเดตเกิน 1.5 นาที เวลาที่แสดงอาจคลาดเคลื่อน', shortEn: 'Delayed data', detailEn: 'No position update for over 1.5 min, times may be off' },
  unavailable: { short: 'ไม่มีข้อมูลสด', detail: 'ไม่ได้รับสัญญาณจากรถ จึงประมาณเวลาถึงไม่ได้', shortEn: 'No live data', detailEn: 'No signal from the bus, so no arrival estimate' },
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

const SERVICE_EN: Record<ServiceType, string> = { ac: 'Air-conditioned', non_ac: 'Non-AC (fan)' };
const DIRECTION_EN: Record<Direction, string> = { outbound: 'Outbound', inbound: 'Inbound' };
const STATUS_EN: Record<VehicleStatus, string> = { layover: 'Waiting at the terminus', moving: 'On the move', at_stop: 'At a stop' };
const VEHICLE_TYPE_EN: Record<VehicleType, string> = {
  ev_low_floor: 'Low-floor electric bus, air-con',
  ac_standard: 'Air-con bus (with steps)',
  non_ac_standard: 'Non-AC bus (with steps)',
};

// ---------- text in the current language ----------
const pick = (l: Label) => (en() ? { short: l.shortEn, detail: l.detailEn } : { short: l.short, detail: l.detail });

export const crowdLabel = (level: CrowdLevel) => pick(CROWD_LABEL[level]);
export const qualityLabel = (quality: DataQuality) => pick(QUALITY_LABEL[quality]);
export const serviceLabel = (t: ServiceType) => (en() ? SERVICE_EN[t] : SERVICE_LABEL[t]);
export const directionLabel = (d: Direction) => (en() ? DIRECTION_EN[d] : DIRECTION_LABEL[d]);
export const statusLabel = (s: VehicleStatus) => (en() ? STATUS_EN[s] : STATUS_LABEL[s]);
export const vehicleTypeLabel = (t: VehicleType) => (en() ? VEHICLE_TYPE_EN[t] : VEHICLE_TYPE_LABEL[t]);