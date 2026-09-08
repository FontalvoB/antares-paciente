import {
  barbell,
  flask,
  happy,
  headset,
  nutrition,
  pulse,
} from 'ionicons/icons'
import type { ProgramTaskId } from '../../types'

export const TASK_ICONS: Record<ProgramTaskId, string> = {
  podcast: headset,
  vitals: pulse,
  nut: nutrition,
  ejercicio: barbell,
  nutraceutico: flask,
  emocional: happy,
}

export const tabEase = [0.22, 1, 0.36, 1] as const

export const paneMotion = {
  initial: { opacity: 0, y: 14, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -10, filter: 'blur(4px)' },
  transition: { duration: 0.32, ease: tabEase },
}
