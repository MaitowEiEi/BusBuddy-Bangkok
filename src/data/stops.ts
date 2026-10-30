import type { Stop } from '../types/transit';

// Coordinates are approximate real locations; stop codes and services are fictional.
export const STOPS: Stop[] = [
  { id: 'S01', code: 'BB01', nameTh: 'อนุสาวรีย์ชัยสมรภูมิ', areaTh: 'ราชเทวี', position: [13.765, 100.5378], keywords: ['victory monument', 'victory', 'อนุสาวรีย์', 'ชัยฯ'] },
  { id: 'S02', code: 'BB02', nameTh: 'พญาไท', areaTh: 'ราชเทวี', position: [13.7568, 100.534], keywords: ['phaya thai', 'phayathai', 'พญาไท'] },
  { id: 'S03', code: 'BB03', nameTh: 'ราชเทวี', areaTh: 'ราชเทวี', position: [13.7517, 100.5317], keywords: ['ratchathewi', 'ราชเทวี'] },
  { id: 'S04', code: 'BB04', nameTh: 'สยาม', areaTh: 'ปทุมวัน', position: [13.7459, 100.534], keywords: ['siam', 'สยาม', 'สยามสแควร์'] },
  { id: 'S05', code: 'BB05', nameTh: 'ปทุมวัน (MBK)', areaTh: 'ปทุมวัน', position: [13.7462, 100.53], keywords: ['pathumwan', 'mbk', 'เอ็มบีเค', 'สนามกีฬาแห่งชาติ'] },
  { id: 'S06', code: 'BB06', nameTh: 'สามย่าน', areaTh: 'บางรัก', position: [13.733, 100.529], keywords: ['samyan', 'sam yan', 'สามย่าน'] },
  { id: 'S07', code: 'BB07', nameTh: 'ศาลาแดง (สีลม)', areaTh: 'บางรัก', position: [13.7288, 100.536], keywords: ['sala daeng', 'silom', 'สีลม', 'ศาลาแดง'] },
  { id: 'S08', code: 'BB08', nameTh: 'สวนลุมพินี (ถ.ราชดำริ)', areaTh: 'ปทุมวัน', position: [13.734, 100.5392], keywords: ['lumphini', 'lumpini', 'ลุมพินี', 'ราชดำริ'] },
  { id: 'S09', code: 'BB09', nameTh: 'ประตูน้ำ', areaTh: 'ราชเทวี', position: [13.751, 100.5418], keywords: ['pratunam', 'ประตูน้ำ'] },
  { id: 'S10', code: 'BB10', nameTh: 'ราชประสงค์', areaTh: 'ปทุมวัน', position: [13.7468, 100.5398], keywords: ['ratchaprasong', 'ราชประสงค์'] },
  { id: 'S11', code: 'BB11', nameTh: 'ชิดลม', areaTh: 'ปทุมวัน', position: [13.7441, 100.5435], keywords: ['chit lom', 'chidlom', 'ชิดลม'] },
  { id: 'S12', code: 'BB12', nameTh: 'เพลินจิต', areaTh: 'ปทุมวัน', position: [13.743, 100.549], keywords: ['ploenchit', 'phloen chit', 'เพลินจิต'] },
  { id: 'S13', code: 'BB13', nameTh: 'อโศก', areaTh: 'วัฒนา', position: [13.7373, 100.5603], keywords: ['asok', 'asoke', 'อโศก', 'สุขุมวิท'] },
  { id: 'S14', code: 'BB14', nameTh: 'สนามเป้า', areaTh: 'พญาไท', position: [13.7726, 100.5421], keywords: ['sanam pao', 'สนามเป้า'] },
  { id: 'S15', code: 'BB15', nameTh: 'อารีย์', areaTh: 'พญาไท', position: [13.7797, 100.5446], keywords: ['ari', 'aree', 'อารีย์'] },
  { id: 'S16', code: 'BB16', nameTh: 'สะพานควาย', areaTh: 'พญาไท', position: [13.7937, 100.5497], keywords: ['saphan khwai', 'สะพานควาย'] },
  { id: 'S17', code: 'BB17', nameTh: 'หมอชิต', areaTh: 'จตุจักร', position: [13.8025, 100.5535], keywords: ['mo chit', 'mochit', 'หมอชิต', 'จตุจักร'] },
  { id: 'S18', code: 'BB18', nameTh: 'มักกะสัน', areaTh: 'ราชเทวี', position: [13.7507, 100.5608], keywords: ['makkasan', 'มักกะสัน'] },
  { id: 'S19', code: 'BB19', nameTh: 'จุฬาลงกรณ์ (ถ.พญาไท)', areaTh: 'ปทุมวัน', position: [13.7398, 100.5296], keywords: ['chula', 'chulalongkorn', 'จุฬา'] },
  { id: 'S20', code: 'BB20', nameTh: 'ราชปรารภ', areaTh: 'ราชเทวี', position: [13.7575, 100.542], keywords: ['ratchaprarop', 'ราชปรารภ'] },
];