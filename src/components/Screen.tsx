import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode, Ref } from 'react'
import { BottomNav } from './BottomNav'
import '../theme/wellness-premium.css'

export function Screen({
  children,
  darkNav = false,
  hideNav = false,
  className,
}: {
  children: ReactNode
  darkNav?: boolean
  hideNav?: boolean
  className?: string
}) {
  const reducedMotion = useReducedMotion()
  return (
    <motion.div
      className={`screen${className ? ` ${className}` : ''}`}
      initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.2, ease: 'easeOut' }}
    >
      {children}
      {!hideNav && <BottomNav dark={darkNav} />}
    </motion.div>
  )
}

export function Scroll({
  children,
  noNav = false,
  ref,
  className,
}: {
  children: ReactNode
  noNav?: boolean
  ref?: Ref<HTMLDivElement>
  className?: string
}) {
  return (
    <div ref={ref} className={`screen-scroll ${noNav ? 'no-nav' : ''}${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  )
}
