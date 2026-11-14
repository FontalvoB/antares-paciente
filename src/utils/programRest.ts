import type { TodayTaskDto } from '../services/program/types'

/** El descanso explícito excluye ejercicio; una lista vacía del servidor sigue vacía. */
export function scheduledDayTasks(tasks?: readonly TodayTaskDto[], rest?: boolean | null): TodayTaskDto[] | undefined {
  return tasks?.filter(task => rest !== true || task.taskCode !== 'ejercicio')
}
