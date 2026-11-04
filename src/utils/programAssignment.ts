import type { MeAssignment, MeBattery } from './healthTestsApi'

// Catálogo v1 de los nueve ítems required de bateria-inicial.
const REQUIRED_CODES = ['historia-clinica', 'temperamento', 'nutricional', 'movimiento', 'sueno', 'iac-adresd', 'orp', 'ers', 'bateria-antares']
const INITIAL_BATTERY_ID = '0d0198a4-ade2-50af-a6d4-e5fe29096d41'

export function initialBatteryCompletedCount(batteries: MeBattery[], assignments: MeAssignment[]): number {
  const initial = batteries.filter(b => b.batteryId === INITIAL_BATTERY_ID || b.batteryName === 'Batería de evaluación inicial Copp Adresd')
  // Una batería posterior de re-test no borra la completitud inicial.
  return Math.max(0, ...initial.map(b => new Set(assignments.filter(a =>
    a.batteryAssignmentId === b.id && a.status === 'completed' && REQUIRED_CODES.includes(a.testCode ?? '')
  ).map(a => a.testCode)).size))
}
