import { useEffect, useState } from 'react'
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from 'framer-motion'

export function CountUp({
  to,
  duration = 0.9,
  decimals = 0,
}: {
  to: number
  duration?: number
  decimals?: number
}) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(reduce ? to : 0)
  const [n, setN] = useState(reduce ? to : 0)

  useMotionValueEvent(mv, 'change', (v) => setN(v))

  useEffect(() => {
    if (reduce) {
      mv.set(to)
      return
    }
    const ctrl = animate(mv, to, { duration, ease: [0.22, 1, 0.36, 1] })
    return () => ctrl.stop()
  }, [to, duration, reduce, mv])

  if (decimals > 0) return <>{n.toFixed(decimals)}</>
  return <>{Math.round(n).toLocaleString('es-ES')}</>
}

export function Sparkline({
  points,
  color = 'var(--teal)',
  height = 64,
}: {
  points: number[]
  color?: string
  height?: number
}) {
  const reduce = useReducedMotion()
  const w = 320
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const coords = points.map((p, i) => {
    const x = (i / Math.max(1, points.length - 1)) * w
    const y = height - ((p - min) / span) * (height - 10) - 5
    return `${x},${y}`
  })
  const line = `M${coords.join(' L')}`
  const last = coords[coords.length - 1]?.split(',') ?? ['0', '0']
  const area = `${line} L${w},${height} L0,${height} Z`

  return (
    <svg className="pg-spark" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="pgSparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill="url(#pgSparkFill)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduce ? 0 : 0.6 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.circle
        cx={Number(last[0])}
        cy={Number(last[1])}
        r="4.5"
        fill={color}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: reduce ? 0 : 0.9, type: 'spring', stiffness: 260, damping: 16 }}
      />
    </svg>
  )
}
