import type { LatLng, Place } from '../types/transit';

export const PLACES: Place[] = [
  { id: 'P01', nameTh: 'สยามพารากอน', categoryTh: 'ศูนย์การค้า', position: [13.7462, 100.5347], keywords: ['siam paragon', 'paragon', 'พารากอน', 'สยาม'] },
  { id: 'P02', nameTh: 'จุฬาลงกรณ์มหาวิทยาลัย', categoryTh: 'มหาวิทยาลัย', position: [13.7384, 100.532], keywords: ['chula', 'chulalongkorn', 'จุฬา', 'มหาวิทยาลัย'] },
  { id: 'P03', nameTh: 'เซ็นทรัลเวิลด์', categoryTh: 'ศูนย์การค้า', position: [13.7466, 100.5393], keywords: ['centralworld', 'central world', 'เซ็นทรัล', 'ราชประสงค์'] },
  { id: 'P04', nameTh: 'สวนลุมพินี', categoryTh: 'สวนสาธารณะ', position: [13.7314, 100.5416], keywords: ['lumphini park', 'lumpini', 'ลุมพินี', 'สวน'] },
  { id: 'P05', nameTh: 'ตลาดนัดจตุจักร', categoryTh: 'ตลาด', position: [13.7999, 100.55], keywords: ['chatuchak', 'jatujak', 'จตุจักร', 'หมอชิต'] },
  { id: 'P06', nameTh: 'MBK เซ็นเตอร์', categoryTh: 'ศูนย์การค้า', position: [13.7446, 100.53], keywords: ['mbk', 'มาบุญครอง', 'เอ็มบีเค'] },
  { id: 'P07', nameTh: 'สามย่านมิตรทาวน์', categoryTh: 'ศูนย์การค้า', position: [13.734, 100.5283], keywords: ['samyan mitrtown', 'สามย่าน'] },
  { id: 'P08', nameTh: 'อนุสาวรีย์ชัยสมรภูมิ', categoryTh: 'สถานที่สำคัญ', position: [13.7649, 100.5383], keywords: ['victory monument', 'victory', 'อนุสาวรีย์', 'ชัยฯ'] },
  { id: 'P09', nameTh: 'ย่านอารีย์', categoryTh: 'ย่านร้านอาหาร', position: [13.7795, 100.544], keywords: ['ari', 'aree', 'อารีย์'] },
  { id: 'P10', nameTh: 'ย่านสีลม (ศาลาแดง)', categoryTh: 'ย่านสำนักงาน', position: [13.7275, 100.5345], keywords: ['silom', 'sala daeng', 'สีลม', 'ศาลาแดง'] },
];

export const DEMO_USER_LOCATION: { position: LatLng; labelTh: string } = {
  position: [13.7641, 100.5366],
  labelTh: 'ตำแหน่งจำลอง: ใกล้อนุสาวรีย์ชัยสมรภูมิ',
};