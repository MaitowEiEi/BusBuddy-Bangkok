import type { EtaRange } from '../types/transit';

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Bangkok, no DST
const pad = (n: number) => String(n).padStart(2, '0');

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
  return `${amount} บาท`;
}

export function formatFareRange([min, max]: [number, number]): string {
  return min === max ? `${min} บาท` : `${min}–${max} บาท`;
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} ม.`;
  return `${(m / 1000).toFixed(1)} กม.`;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} นาที`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} ชม. ${r} นาที` : `${h} ชม.`;
}

export function formatEtaRange(r: EtaRange | null): string {
  if (!r) return 'ไม่ทราบเวลาถึง';
  if (r.arriving) return 'กำลังเข้าป้าย';
  if (r.minMin <= 0) return `ภายใน ${r.maxMin} นาที`;
  return `ประมาณ ${r.minMin}–${r.maxMin} นาที`;
}

export function formatClockRange(nowMs: number, r: EtaRange): string {
  return `${formatTime(nowMs + r.minMin * 60_000)}–${formatTime(nowMs + r.maxMin * 60_000)}`;
}

export function formatAgo(nowMs: number, thenMs: number): string {
  const s = Math.max(0, Math.round((nowMs - thenMs) / 1000));
  if (s < 10) return 'เมื่อสักครู่';
  if (s < 60) return `${s} วินาทีที่แล้ว`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} นาทีที่แล้ว`;
  return `${Math.floor(m / 60)} ชม. ที่แล้ว`;
}

/** Total fare for an itinerary. Rides without fare data count as 0, so say so instead of showing a too-low total. */
export function formatFareEstimate(fare: [number, number], known: boolean): string {
  if (known) return `~${formatFareRange(fare)}`;
  if (fare[1] > 0) return `${fare[0]} บาทขึ้นไป (บางช่วงไม่มีข้อมูลราคา)`;
  return 'ไม่มีข้อมูลค่าโดยสาร';
}
