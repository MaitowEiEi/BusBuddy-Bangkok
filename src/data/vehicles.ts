import type { Accessibility, Vehicle } from '../types/transit';

const EV_ACCESS: Accessibility = { lowFloor: true, ramp: true, wheelchairSpaces: 1, audioAnnouncements: true, visualDisplay: true };
const AC_ACCESS: Accessibility = { lowFloor: false, ramp: false, wheelchairSpaces: 0, audioAnnouncements: true, visualDisplay: true };
const FAN_ACCESS: Accessibility = { lowFloor: false, ramp: false, wheelchairSpaces: 0, audioAnnouncements: false, visualDisplay: false };

type Spec = Pick<Vehicle, 'type' | 'seats' | 'capacity' | 'accessibility'>;
const EV: Spec = { type: 'ev_low_floor', seats: 30, capacity: 65, accessibility: EV_ACCESS };
const AC: Spec = { type: 'ac_standard', seats: 36, capacity: 70, accessibility: AC_ACCESS };
const FAN: Spec = { type: 'non_ac_standard', seats: 38, capacity: 75, accessibility: FAN_ACCESS };

function vehicle(
  id: string, fleetCode: string, routeId: string, variantKey: string, phase: number,
  spec: Spec, baseLoad: number, loadSeed: number, hasOccupancySensor = true,
): Vehicle {
  return {
    id, fleetCode, routeId, phase, baseLoad, loadSeed, hasOccupancySensor, ...spec,
    blockVariantIds: [`${variantKey}-O`, `${variantKey}-I`],
  };
}

// Fleet codes are fictional demo IDs, not registration numbers.
export const VEHICLES: Vehicle[] = [
  vehicle('V01', 'BB-101', 'D10', 'D10', 0.05, EV, 0.5, 1.3),
  vehicle('V02', 'BB-102', 'D10', 'D10', 0.38, EV, 0.55, 2.9),
  vehicle('V03', 'BB-103', 'D10', 'D10', 0.71, AC, 0.45, 4.1),
  vehicle('V04', 'BB-211', 'D21', 'D21', 0.12, AC, 0.6, 0.7),
  vehicle('V05', 'BB-212', 'D21', 'D21', 0.62, EV, 0.55, 3.6),
  vehicle('V06', 'BB-219', 'D21', 'D21S', 0.3, EV, 0.5, 5.2),
  vehicle('V07', 'BB-351', 'D35', 'D35', 0.18, FAN, 0.35, 1.9),
  vehicle('V08', 'BB-352', 'D35', 'D35', 0.68, FAN, 0.35, 2.4, false), // no occupancy sensor → unknown crowding
  vehicle('V09', 'BB-401', 'D40', 'D40', 0.22, EV, 0.4, 3.3),
  vehicle('V10', 'BB-402', 'D40', 'D40', 0.72, EV, 0.45, 0.4),
  vehicle('V11', 'BB-521', 'D52', 'D52', 0.04, FAN, 0.3, 4.7),
  vehicle('V12', 'BB-522', 'D52', 'D52', 0.54, FAN, 0.3, 1.1),
];