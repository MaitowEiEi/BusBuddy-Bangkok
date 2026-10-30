import type { Disruption, ScenarioConfig, ScenarioId } from '../types/transit';

const PHAYA_THAI_DISRUPTION: Disruption = {
  id: 'DIS-PHAYATHAI',
  titleTh: 'การจราจรติดขัดหนัก ถ.พญาไท ช่วงราชเทวี–ปทุมวัน',
  detailTh: 'เหตุการณ์จำลอง: รถสาย D10 และ D21 (ทุกเที่ยว) อาจล่าช้าเพิ่มประมาณ 10–20 นาที',
  affectedRouteIds: ['D10', 'D21'],
  segmentStopIds: ['S03', 'S05'],
  extraDelayMin: 15,
  alternativeHintTh: 'ลองใช้สาย D35 หรือ D52 ไปราชประสงค์ แล้วเดินต่อหรือต่อสาย D40',
};

const BASE: Omit<ScenarioConfig, 'id' | 'labelTh' | 'descriptionTh'> = {
  staleVehicleSec: {},
  unavailableVehicleIds: [],
  crowdRatioByRoute: {},
  disruption: null,
  notices: [],
};

export const SCENARIOS: Record<ScenarioId, ScenarioConfig> = {
  normal: {
    ...BASE, id: 'normal', labelTh: 'บริการปกติ',
    descriptionTh: 'รถทุกคันส่งข้อมูลตามปกติ (รถ BB-352 ไม่มีเซนเซอร์นับผู้โดยสาร)',
  },
  delayed_data: {
    ...BASE, id: 'delayed_data', labelTh: 'ข้อมูลรถล่าช้า',
    descriptionTh: 'ตำแหน่งรถบางคันไม่ได้อัปเดต 2–4 นาที',
    staleVehicleSec: { V01: 210, V04: 180, V09: 150 },
    notices: [{
      id: 'N-DELAYED', severity: 'warning', routeIds: ['D10', 'D21', 'D40'],
      titleTh: 'ข้อมูลตำแหน่งรถบางคันล่าช้า',
      detailTh: 'เวลาถึงที่แสดงอาจคลาดเคลื่อนมากกว่าปกติ (สถานการณ์จำลอง)',
    }],
  },
  crowded: {
    ...BASE, id: 'crowded', labelTh: 'รถแน่นมาก',
    descriptionTh: 'สาย D10 และ D21 หนาแน่นมาก',
    crowdRatioByRoute: { D10: 0.95, D21: 0.96 },
    notices: [{
      id: 'N-CROWDED', severity: 'warning', routeIds: ['D10', 'D21'],
      titleTh: 'รถสาย D10 และ D21 หนาแน่นมาก',
      detailTh: 'ลองพิจารณาสาย D35 หรือ D52 ที่หนาแน่นน้อยกว่า หรือรอคันถัดไป (สถานการณ์จำลอง)',
    }],
  },
  unknown_eta: {
    ...BASE, id: 'unknown_eta', labelTh: 'ไม่ทราบเวลาถึง',
    descriptionTh: 'รถบางคันไม่ส่งสัญญาณ จึงประมาณเวลาถึงและความหนาแน่นไม่ได้',
    unavailableVehicleIds: ['V02', 'V05', 'V07', 'V10'],
    notices: [{
      id: 'N-UNKNOWN', severity: 'warning', routeIds: ['D10', 'D21', 'D35', 'D40'],
      titleTh: 'ไม่ได้รับสัญญาณจากรถบางคัน',
      detailTh: 'รถยังอาจให้บริการตามตารางเดินรถ แต่ระบบประมาณเวลาถึงไม่ได้ (สถานการณ์จำลอง)',
    }],
  },
  disruption: {
    ...BASE, id: 'disruption', labelTh: 'เหตุขัดข้องบนเส้นทาง',
    descriptionTh: PHAYA_THAI_DISRUPTION.titleTh,
    disruption: PHAYA_THAI_DISRUPTION,
    notices: [{
      id: 'N-DISRUPTION', severity: 'disruption', routeIds: PHAYA_THAI_DISRUPTION.affectedRouteIds,
      titleTh: PHAYA_THAI_DISRUPTION.titleTh,
      detailTh: `${PHAYA_THAI_DISRUPTION.detailTh} — ${PHAYA_THAI_DISRUPTION.alternativeHintTh}`,
    }],
  },
};

export const SCENARIO_LIST: ScenarioConfig[] = Object.values(SCENARIOS);

export function isScenarioId(value: unknown): value is ScenarioId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SCENARIOS, value);
}