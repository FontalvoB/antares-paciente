import { motion } from 'framer-motion'
import type { ReactNode, Ref } from 'react'
import { BottomNav } from './BottomNav'

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
  return (
    <motion.div
      className={`screen${className ? ` ${className}` : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
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
