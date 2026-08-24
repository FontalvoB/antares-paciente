import { type ReactNode, useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * Primitive: anillo SVG de progreso.
 * Ionic 8 solo ofrece IonProgressBar lineal — no hay equivalente circular.
 */
export function RingProgress({
  value,
  size = 72,
  stroke = 8,
  trackColor = 'rgba(255,255,255,0.14)',
  color = 'var(--cyan)',
  gradient,
  children,
  glow = false,
}: {
  value: number
  size?: number
  stroke?: number
  trackColor?: string
  color?: string
  gradient?: [string, string]
  children?: ReactNode
  glow?: boolean
}) {
  const reduce = useReducedMotion()
  const gid = useId().replace(/:/g, '')
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.min(1, Math.max(0, value))
  const strokePaint = gradient ? `url(#${gid})` : color

  return (
    <div
      className={`pg-ring${glow ? ' glow' : ''}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {gradient && (
          <defs>
            <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={gradient[0]} />
              <stop offset="100%" stopColor={gradient[1]} />
            </linearGradient>
          </defs>
        )}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={strokePaint}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={reduce ? { duration: 0 } : { duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="pg-ring-center">{children}</div>
    </div>
  )
}
