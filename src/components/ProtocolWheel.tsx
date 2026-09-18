import type { CSSProperties } from 'react'
import logoIcon from '../assets/LogoIndividual.png'
import { IonIcon } from '@ionic/react'
import { motion, useReducedMotion } from 'framer-motion'
import { checkmark, gift, play, trophy } from 'ionicons/icons'
import { PROGRAM_TASKS } from '../data/program'
import { TASK_ICONS } from '../pages/program/ui'
import type { ProgramDay, ProgramTaskId } from '../types'

const VIEW = 240
const C = VIEW / 2
const R_ORBIT = 96
const SEGMENT_KEYS: (ProgramTaskId | 'chest')[] = [
  ...PROGRAM_TASKS.map((task) => task.id),
  'chest',
]
const SLICE = 360 / SEGMENT_KEYS.length

/** Identidad de las misiones; nutrición comparte el naranja solicitado. */
export const WHEEL_COLORS: Record<ProgramTaskId | 'chest', string> = {
  podcast: '#e0342f',
  vitals: '#ee7a21',
  nut: '#ee7a21',
  ejercicio: '#2fa24e',
  nutraceutico: '#14a0a8',
  emocional: '#2160c4',
  chest: '#7b3fb5',
}

function point(deg: number, radius: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: C + radius * Math.cos(rad), y: C + radius * Math.sin(rad) }
}

function arc(center: number) {
  const start = point(center - SLICE / 2 + 3, R_ORBIT)
  const end = point(center + SLICE / 2 - 3, R_ORBIT)
  return `M ${start.x} ${start.y} A ${R_ORBIT} ${R_ORBIT} 0 0 1 ${end.x} ${end.y}`
}

/** Gráfico de dominio sin equivalente Ionic: órbitas inspiradas en Copp Adresd.
 * El botón del home contiene toda la rueda; sus nodos son decorativos.
 * El estado proviene del protocolo, nunca de una animación ni de estado local.
 */
export function ProtocolWheel({
  program, chestClaimed = false, title, count, total, caption, actionLabel,
}: {
  program: ProgramDay
  chestClaimed?: boolean
  title: string
  count: number
  total: number
  caption: string
  actionLabel: string
}) {
  const reduce = useReducedMotion()
  const segments = SEGMENT_KEYS.map((key, i) => ({
    key,
    color: WHEEL_COLORS[key],
    icon: key === 'chest' ? (chestClaimed ? trophy : gift) : TASK_ICONS[key],
    done: key === 'chest' ? chestClaimed : Boolean(program[key]),
    center: i * SLICE,
  }))
  const complete = total > 0 && count >= total

  return (
    <div className="wheel-layout"><div className="wheel">
      <svg className="wheel-svg" viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden="true">
        <circle cx={C} cy={C} r={R_ORBIT} className="wheel-orbit" />
        <circle cx={C} cy={C} r={77} className="wheel-orbit wheel-orbit-dashed" />
        <circle cx={C} cy={C} r={54} className="wheel-orbit" />
        {segments.map((seg) => {
          const start = point(seg.center, 48)
          const end = point(seg.center, R_ORBIT)
          return (
            <g key={seg.key} style={{ color: seg.color }}>
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                className={`wheel-spoke${seg.done ? ' done' : ''}`} />
              <motion.path d={arc(seg.center)} className="wheel-progress-arc"
                initial={false} animate={{ pathLength: seg.done ? 1 : 0, opacity: seg.done ? 1 : 0 }}
                transition={{ duration: reduce ? 0 : 0.6 }} />
            </g>
          )
        })}
      </svg>

      {segments.map((seg, i) => {
        const { x, y } = point(seg.center, R_ORBIT)
        return (
          <span key={seg.key} className={`wheel-badge${seg.done ? ' done' : ''}`}
            data-task={seg.key} aria-hidden="true"
            style={{ '--wheel-accent': seg.color, left: `${x / VIEW * 100}%`, top: `${y / VIEW * 100}%` } as CSSProperties}>
            <IonIcon icon={seg.icon} />
            <span className="wheel-number">
              {seg.done ? <IonIcon icon={checkmark} /> : String(i + 1).padStart(2, '0')}
            </span>
          </span>
        )
      })}

      <div className={`wheel-core${complete ? ' complete' : ''}`}>
        <img className="wheel-logo" src={logoIcon} alt="" aria-hidden="true" />
        <strong className="wheel-core-count">{count}<span>/{total}</span></strong>
        <span className="wheel-core-title">{title}</span>
        <span className="wheel-core-dots" aria-hidden="true"><i /><i /><i /></span>
      </div>
      <span className="wheel-speck wheel-speck-one" aria-hidden="true" />
      <span className="wheel-speck wheel-speck-two" aria-hidden="true" />
      </div>
      <div className="wheel-selection">
        <span className="wheel-play" aria-hidden="true"><IonIcon icon={play} /></span>
        <span className="wheel-selection-copy">
          <span className="wheel-core-caption">{caption}</span>
          <span className="wheel-action-label">{actionLabel}</span>
        </span>
      </div>
    </div>
  )
}