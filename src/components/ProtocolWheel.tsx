import { IonIcon } from '@ionic/react'
import { motion, useReducedMotion } from 'framer-motion'
import { checkmark, gift, trophy } from 'ionicons/icons'
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

/**
 * Espectro cromático del anillo. Es identidad visual del protocolo, no tokens
 * de marca: el tono avanza por la derecha (violeta → azul → verde → amarillo
 * → naranja) y regresa por la izquierda (verde → azul → púrpura → magenta),
 * igual que en el diseño de referencia. 0° = arriba, sentido del reloj.
 */
const SPECTRUM: { at: number; color: string }[] = [
  { at: 0, color: '#6a45a8' },
  { at: 22, color: '#2b4a9e' },
  { at: 45, color: '#1f7f92' },
  { at: 68, color: '#4fa663' },
  { at: 88, color: '#94b83c' },
  { at: 106, color: '#eec12f' },
  { at: 140, color: '#f2ab2c' },
  { at: 166, color: '#e3b830' },
  { at: 182, color: '#c6b535' },
  { at: 200, color: '#86ab48' },
  { at: 216, color: '#46937a' },
  { at: 240, color: '#1e7392' },
  { at: 262, color: '#3a5eae' },
  { at: 284, color: '#6a4aa4' },
  { at: 306, color: '#8b4ea6' },
  { at: 326, color: '#a4479a' },
  { at: 344, color: '#953d8d' },
  { at: 360, color: '#6a45a8' },
]

function lerpHex(from: string, to: string, ratio: number) {
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const a = parse(from)
  const b = parse(to)
  return `#${a
    .map((v, i) => Math.round(v + (b[i] - v) * ratio).toString(16).padStart(2, '0'))
    .join('')}`
}

/** Color del espectro en un ángulo dado (0° = arriba, sentido del reloj). */
function wheelColorAt(deg: number) {
  const d = ((deg % 360) + 360) % 360
  for (let i = 1; i < SPECTRUM.length; i++) {
    const prev = SPECTRUM[i - 1]
    const next = SPECTRUM[i]
    if (d <= next.at) return lerpHex(prev.color, next.color, (d - prev.at) / (next.at - prev.at))
  }
  return SPECTRUM[0].color
}

/** Degradado cónico del anillo: CSS también arranca arriba y gira al reloj. */
const RING_GRADIENT = `conic-gradient(${SPECTRUM.map((s) => `${s.color} ${s.at}deg`).join(', ')})`

/** Segmentos: las 6 misiones del día más el cofre que las corona. */
const SEGMENT_KEYS: (ProgramTaskId | 'chest')[] = [
  ...PROGRAM_TASKS.map((task) => task.id),
  'chest',
]
const SLICE = 360 / SEGMENT_KEYS.length

/** Color asignado a cada misión: el del centro de su segmento. */
export const WHEEL_COLORS = Object.fromEntries(
  SEGMENT_KEYS.map((key, i) => [key, wheelColorAt(i * SLICE)]),
) as Record<ProgramTaskId | 'chest', string>

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
}: {
  program: ProgramDay
  chestClaimed?: boolean
  title: string
  count: number
  total: number
  caption: string
}) {
  const reduce = useReducedMotion()

  const segments = SEGMENT_KEYS.map((key, i) => ({
    key,
    color: WHEEL_COLORS[key],
    icon: key === 'chest' ? (chestClaimed ? trophy : gift) : TASK_ICONS[key],
    done: key === 'chest' ? chestClaimed : Boolean(program[key]),
    center: i * SLICE,
  }))
  /** Primera misión pendiente: su icono late para invitar a tocarla. */
  const nextKey = segments.find((seg) => !seg.done)?.key
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
        const isNext = seg.key === nextKey
        return (
          <motion.span
            key={seg.key}
            className={`wheel-badge${seg.done ? ' done' : ''}`}
            style={{ left: `${(x / VIEW) * 100}%`, top: `${(y / VIEW) * 100}%` }}
            initial={reduce ? false : { opacity: 0, scale: 0.3 }}
            animate={
              isNext && !reduce
                ? { opacity: 1, scale: [1, 1.14, 1] }
                : { opacity: 1, scale: 1 }
            }
            transition={
              isNext && !reduce
                ? {
                    opacity: { delay: 0.45 + i * 0.06, duration: 0.3 },
                    scale: { repeat: Infinity, repeatDelay: 1.1, duration: 1.5, ease: 'easeInOut' },
                  }
                : { delay: reduce ? 0 : 0.45 + i * 0.06, duration: 0.45, ease: EASE }
            }
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
      </div>
    </div>
  )
}
