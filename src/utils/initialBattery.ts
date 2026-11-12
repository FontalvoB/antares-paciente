import type { MeAssignment } from './healthTestsApi';

/** El catálogo y la cohorte definen la completitud, sin contar seguimientos ni omitir requeridos ausentes. */
export function isInitialBatteryComplete(rows: readonly MeAssignment[]): boolean {
  const required = rows.filter(row => row.isRequired !== false);
  const cohort = required[0]?.batteryAssignmentId;
  const expected = required[0]?.batteryRequiredCount;
  return !!cohort && typeof expected === 'number' && Number.isInteger(expected) && expected > 0
    && required.length === expected
    && rows.every(row => row.batteryAssignmentId === cohort && row.batteryRequiredCount === expected)
    && required.every(row => row.status === 'completed');
}
