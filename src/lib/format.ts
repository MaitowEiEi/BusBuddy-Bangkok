import type { EtaRange } from '../types/transit';
import { getLang } from './i18n';

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Bangkok, no DST
const pad = (n: number) => String(n).padStart(2, '0');
/** Reads the current language directly; App re-renders everything when it changes. */
const en = () => getLang() === 'en';

export function bangkokMinutesOfDay(ms: number): number {
  const d = new Date(ms + BKK_OFFSET_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
}

export function formatTime(ms: number): string {
  const d = new Date(ms + BKK_OFFSET_MS);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function formatTimeWithSeconds(ms: number): string {
  const d = new Date(ms + BKK_OFFSET_MS);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

export function formatBaht(amount: number): string {
  return en() ? `${amount} THB` : `${amount} บาท`;
}

export function formatFareRange([min, max]: [number, number]): string {
  const unit = en() ? 'THB' : 'บาท';
  return min === max ? `${min} ${unit}` : `${min}–${max} ${unit}`;
}

/** Total fare for an itinerary. Rides without fare data count as 0, so say so instead of showing a too-low total. */
export function formatFareEstimate(fare: [number, number], known: boolean): string {
  if (known) return `~${formatFareRange(fare)}`;
  if (fare[1] > 0) return en() ? `From ${fare[0]} THB (some fares unknown)` : `${fare[0]} บาทขึ้นไป (บางช่วงไม่มีข้อมูลราคา)`;
  return en() ? 'Fare unknown' : 'ไม่มีข้อมูลค่าโดยสาร';
}

export function formatDistance(m: number): string {
  if (m < 1000) {
    const v = Math.max(10, Math.round(m / 10) * 10);
    return en() ? `${v} m` : `${v} ม.`;
  }
  const km = (m / 1000).toFixed(1);
  return en() ? `${km} km` : `${km} กม.`;
}

export function formatMinutes(min: number): string {
  if (min < 60) return en() ? `${min} min` : `${min} นาที`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  if (en()) return r ? `${h} h ${r} min` : `${h} h`;
  return r ? `${h} ชม. ${r} นาที` : `${h} ชม.`;
}

export function formatEtaRange(r: EtaRange | null): string {
  if (!r) return en() ? 'Arrival time unknown' : 'ไม่ทราบเวลาถึง';
  if (r.arriving) return en() ? 'Arriving now' : 'กำลังเข้าป้าย';
  if (r.minMin <= 0) return en() ? `Within ${r.maxMin} min` : `ภายใน ${r.maxMin} นาที`;
  return en() ? `About ${r.minMin}–${r.maxMin} min` : `ประมาณ ${r.minMin}–${r.maxMin} นาที`;
}

export function formatClockRange(nowMs: number, r: EtaRange): string {
  return `${formatTime(nowMs + r.minMin * 60_000)}–${formatTime(nowMs + r.maxMin * 60_000)}`;
}

export function formatAgo(nowMs: number, thenMs: number): string {
  const s = Math.max(0, Math.round((nowMs - thenMs) / 1000));
  if (s < 10) return en() ? 'just now' : 'เมื่อสักครู่';
  if (s < 60) return en() ? `${s} s ago` : `${s} วินาทีที่แล้ว`;
  const m = Math.floor(s / 60);
  if (m < 60) return en() ? `${m} min ago` : `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  return en() ? `${h} h ago` : `${h} ชม. ที่แล้ว`;
}