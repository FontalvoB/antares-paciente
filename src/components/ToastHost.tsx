import { AnimatePresence, motion } from 'framer-motion'
import { useApp } from '../context/AppContext'

export function ToastHost() {
  const { toast } = useApp()
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          className="toast"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
        >
          <span>{toast.kind === 'err' ? '⚠️' : toast.kind === 'warn' ? '🔔' : '✓'}</span>
          <span>{toast.message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
