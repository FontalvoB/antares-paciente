import { isComingSoonTask } from '../data/program'
import type { ProgramSnapshotDto, TodayTaskDto } from '../services/program/types'

/** Una lista vacía del servidor sigue vacía; el catálogo local solo se usa sin snapshot. */
export function requiredProtocolTasks(snapshot?: ProgramSnapshotDto | null): TodayTaskDto[] | undefined {
  return snapshot?.todayTasks.filter(task => !isComingSoonTask(task.taskCode)
    && (snapshot.rest !== true || task.taskCode !== 'ejercicio')
    && !snapshot.optionalTaskCodes?.includes(task.taskCode))
}

export function protocolDayXp(snapshot: ProgramSnapshotDto) {
  // El snapshot trae XP global y de racha, y solo puntos base por tarea.
  // Ajusta la vista del día sin reescribir los acumulados confirmados.
  let excludedMax = 0
  let excludedEarned = 0
  for (const task of snapshot.todayTasks) {
    if (!isComingSoonTask(task.taskCode)) continue
    excludedMax += task.points
    if (task.status === 'Completed') excludedEarned += task.points
  }
  return {
    points: Math.max(0, snapshot.todayPoints - excludedEarned),
    max: Math.max(0, snapshot.todayPointsMax - excludedMax),
  }
}
