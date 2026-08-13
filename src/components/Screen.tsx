import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { BottomNav } from './BottomNav'

export function Screen({
  children,
  darkNav = false,
  hideNav = false,
}: {
  children: ReactNode
  darkNav?: boolean
  hideNav?: boolean
}) {
  return (
    <motion.div
      className="screen"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
      {!hideNav && <BottomNav dark={darkNav} />}
    </motion.div>
  )
}

export function Scroll({ children, noNav = false }: { children: ReactNode; noNav?: boolean }) {
  return <div className={`screen-scroll ${noNav ? 'no-nav' : ''}`}>{children}</div>
}
