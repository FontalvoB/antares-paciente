import { IonIcon } from '@ionic/react'
import { motion, useReducedMotion } from 'framer-motion'
import { checkmark, gift, play, trophy } from 'ionicons/icons'
import { PROGRAM_TASKS } from '../data/program'
import { TASK_ICONS } from '../pages/program/ui'
import type { ProgramDay, ProgramTaskId } from '../types'

/* --------------------------------------------------------------------------
   Geometría, en unidades del viewBox (240). Las proporciones vienen del
   diseño de referencia del protocolo: banda = 34 % del radio exterior.
   -------------------------------------------------------------------------- */
const VIEW = 240
const C = VIEW / 2
const R_OUT = 112
const R_IN = 74
/** Línea media de la banda: ahí van los iconos de cada misión. */
const R_MID = (R_OUT + R_IN) / 2
/** Anillo de puntos que rodea el núcleo y marca el progreso en fino. */
const R_DOTS = 62
const DOT_COUNT = 44
/** Hueco angular entre segmentos, en grados. */
const GAP_DEG = 2.4

/** Segmentos: las 6 misiones del día más el cofre que las corona. */
const SEGMENT_KEYS: (ProgramTaskId | 'chest')[] = [
  ...PROGRAM_TASKS.map((task) => task.id),
  'chest',
]
const SLICE = 360 / SEGMENT_KEYS.length

/**
 * Un color sólido por segmento, recorriendo el arcoíris en sentido del reloj
 * desde arriba. Son identidad visual del protocolo, no tokens de marca: cada
 * misión se reconoce por su color y el anillo deja de ser un degradado.
 * El amarillo y el naranja van oscurecidos para que el icono blanco se lea.
 */
const RAINBOW = [
  '#e0342f', // rojo
  '#ee7a21', // naranja
  '#d89b0c', // amarillo
  '#2fa24e', // verde
  '#14a0a8', // turquesa
  '#2160c4', // azul
  '#7b3fb5', // violeta
]

/** Color asignado a cada misión. */
export const WHEEL_COLORS = Object.fromEntries(
  SEGMENT_KEYS.map((key, i) => [key, RAINBOW[i % RAINBOW.length]]),
) as Record<ProgramTaskId | 'chest', string>

/**
 * Anillo con paradas duras: cada segmento ocupa exactamente su porción y no
 * hay mezcla entre vecinos. El primero está centrado arriba, así que se parte
 * en dos tramos (el final del círculo y el principio).
 */
const RING_GRADIENT = `conic-gradient(${[
  `${RAINBOW[0]} 0deg ${SLICE / 2}deg`,
  ...SEGMENT_KEYS.slice(1).map(
    (_, i) =>
      `${RAINBOW[i + 1]} ${(i + 1) * SLICE - SLICE / 2}deg ${(i + 1) * SLICE + SLICE / 2}deg`,
  ),
  `${RAINBOW[0]} ${360 - SLICE / 2}deg 360deg`,
].join(', ')})`

/** Punto del anillo en coordenadas del viewBox (0° = arriba). */
function point(deg: number, radius: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: C + radius * Math.cos(rad), y: C + radius * Math.sin(rad) }
}

/**
 * Cuña radial que separa dos segmentos. Se dibuja encima del degradado (en el
 * color de la tarjeta) para que el hueco crezca con el radio, como pasa en un
 * corte radial real; una línea de grosor fijo se vería más ancha por dentro.
 */
function gapPath(deg: number) {
  const half = GAP_DEG / 2
  const p = [
    point(deg - half, R_IN - 0.8),
    point(deg - half, R_OUT + 0.8),
    point(deg + half, R_OUT + 0.8),
    point(deg + half, R_IN - 0.8),
  ]
  return `M${p.map((q) => `${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join('L')}Z`
}

const EASE = [0.22, 1, 0.36, 1] as const

/**
 * Anillo de progreso del protocolo diario: 7 segmentos = las 6 misiones del
 * día más el cofre que se desbloquea al completarlas todas.
 */
export function ProtocolWheel({
  program,
  chestClaimed = false,
  title,
  count,
  total,
  caption,
  actionLabel,
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
  const progress = total > 0 ? count / total : 0
  const complete = count >= total

  return (
    <div className="wheel">
      <motion.div
        className="wheel-ring-wrap"
        initial={reduce ? false : { rotate: -16, scale: 0.9, opacity: 0 }}
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        transition={{ duration: 0.85, ease: EASE }}
      >
        <div className="wheel-ring" style={{ background: RING_GRADIENT }} />
        <svg className="wheel-svg" viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden="true">
          {/* Huecos entre segmentos */}
          {segments.map((seg) => (
            <path key={seg.key} d={gapPath(seg.center - SLICE / 2)} className="wheel-gap" />
          ))}
          {/* Bisel: luz en el canto interior, sombra en el exterior */}
          <circle cx={C} cy={C} r={R_IN + 1} className="wheel-edge-in" />
          <circle cx={C} cy={C} r={R_OUT - 1.4} className="wheel-edge-out" />
        </svg>
      </motion.div>

      <svg className="wheel-svg wheel-dots" viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden="true">
        {Array.from({ length: DOT_COUNT }, (_, i) => {
          const { x, y } = point((i * 360) / DOT_COUNT, R_DOTS)
          const filled = (i + 1) / DOT_COUNT <= progress
          return (
            <motion.circle
              key={i}
              cx={x}
              cy={y}
              r={1.9}
              className={filled ? 'wheel-dot on' : 'wheel-dot'}
              initial={reduce ? false : { opacity: 0, scale: 0.2 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: reduce ? 0 : 0.35 + i * 0.012, duration: 0.3 }}
              style={{ transformOrigin: `${x}px ${y}px` }}
            />
          )
        })}
      </svg>

      {segments.map((seg, i) => {
        const { x, y } = point(seg.center, R_MID)
        return (
          <motion.span
            key={seg.key}
            className={`wheel-badge${seg.done ? ' done' : ''}`}
            style={{ left: `${(x / VIEW) * 100}%`, top: `${(y / VIEW) * 100}%` }}
            initial={false}
            animate={reduce ? { opacity: 1, scale: 1 } : { opacity: 1, scale: [1, 1.2, 1] }}
            transition={{ delay: reduce ? 0 : 0.5 + i * 0.4, duration: 0.65, ease: EASE }}
          >
            <IonIcon icon={seg.done ? checkmark : seg.icon} />
          </motion.span>
        )
      })}

      <div className={`wheel-core${complete ? ' complete' : ''}`}>
        <span className="wheel-core-title">{title}</span>
        <strong className="wheel-core-count">
          {count}
          <span>/{total}</span>
        </strong>
        <span className="wheel-core-caption">{caption}</span>
        {/* El play pertenece al botón contenedor; no anidar controles. */}
        <span className="wheel-play" aria-hidden="true"><IonIcon icon={play} /></span>
        <span className="wheel-action-label">{actionLabel}</span>
      </div>
    </div>
  )
}
