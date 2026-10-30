import type { TransitNetwork } from '../types/transit';

/** Consistency checks between routes, variants, stops and vehicles. Returns Thai issue descriptions. */
export function validateNetwork(net: TransitNetwork): string[] {
  const issues: string[] = [];

  for (const v of net.variants) {
    if (!net.routeById[v.routeId]) issues.push(`${v.id}: ไม่พบสาย ${v.routeId}`);
    if (v.stopIds.length < 2) issues.push(`${v.id}: มีป้ายน้อยกว่า 2 ป้าย`);
    if (new Set(v.stopIds).size !== v.stopIds.length) issues.push(`${v.id}: มีป้ายซ้ำในเที่ยวเดียวกัน`);
    for (let i = 1; i < v.stopDistancesM.length; i++) {
      if (v.stopDistancesM[i] <= v.stopDistancesM[i - 1]) issues.push(`${v.id}: ระยะทางไม่เพิ่มขึ้นที่ป้ายลำดับ ${i + 1}`);
    }
    if (v.direction === 'outbound') {
      const twin = net.variantById[v.id.replace(/-O$/, '-I')];
      if (!twin) issues.push(`${v.id}: ไม่พบเที่ยวกลับ`);
      else if (twin.stopIds.join(',') !== [...v.stopIds].reverse().join(',')) issues.push(`${v.id}: ลำดับป้ายเที่ยวกลับไม่ตรงกับเที่ยวไป`);
    }
  }

  for (const veh of net.vehicles) {
    const route = net.routeById[veh.routeId];
    if (!route) {
      issues.push(`${veh.id}: ไม่พบสาย ${veh.routeId}`);
      continue;
    }
    const legs = veh.blockVariantIds.map((id) => net.variantById[id]);
    legs.forEach((leg, i) => {
      if (!leg) issues.push(`${veh.id}: ไม่พบเที่ยว ${veh.blockVariantIds[i]}`);
      else if (leg.routeId !== veh.routeId) issues.push(`${veh.id}: เที่ยว ${leg.id} ไม่ใช่ของสาย ${veh.routeId}`);
    });
    if (legs[0] && legs[1] && legs[0].direction === legs[1].direction) issues.push(`${veh.id}: เที่ยวไปและกลับมีทิศทางเดียวกัน`);
    const isAcVehicle = veh.type !== 'non_ac_standard';
    if (isAcVehicle !== (route.serviceType === 'ac')) issues.push(`${veh.id}: ประเภทรถไม่ตรงกับประเภทบริการของสาย`);
    if (veh.seats > veh.capacity) issues.push(`${veh.id}: จำนวนที่นั่งมากกว่าความจุ`);
  }

  return issues;
}