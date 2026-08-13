import { AnimatePresence, motion } from 'framer-motion'
import { IonIcon } from '@ionic/react'
import { call, checkmarkCircle, close, medkit } from 'ionicons/icons'
import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'

export function PanicOverlay() {
  const { panicOpen, sosActive, closePanic, activateSos, showToast } = useApp()
  const [count, setCount] = useState(5)

  useEffect(() => {
    if (!panicOpen || sosActive) return
    setCount(5)
    const id = window.setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          window.clearInterval(id)
          activateSos()
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [panicOpen, sosActive, activateSos])

  return (
    <AnimatePresence>
      {panicOpen && (
        <motion.div
          className="overlay overlay-panic"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              className="display"
              style={{ fontSize: 52, fontWeight: 800, color: 'var(--panic)', lineHeight: 1 }}
            >
              {sosActive ? '🚨' : count}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 4 }}>
              {sosActive ? 'Protocolo SOS activado' : 'segundos para activar SOS'}
            </div>
          </div>

          <button className="panic-ring" onClick={activateSos} style={{ border: '6px solid rgba(255,45,85,.35)' }}>
            <IonIcon icon={medkit} style={{ fontSize: 64, color: '#fff' }} />
          </button>

          <div className="display" style={{ fontSize: 22, fontWeight: 800, color: '#fff', textAlign: 'center' }}>
            Botón de pánico ANTARES
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', textAlign: 'center', maxWidth: 300, lineHeight: 1.55 }}>
            {sosActive
              ? 'Ambulancia, familia y equipo médico están siendo notificados con tu GPS y signos vitales.'
              : 'Mantén presionado o espera el conteo para enviar alerta de emergencia.'}
          </div>

          <div
            style={{
              background: 'rgba(255,255,255,.08)',
              border: '1px solid rgba(255,255,255,.14)',
              borderRadius: 14,
              padding: 14,
              width: '100%',
              fontSize: 12,
              color: '#fff',
              lineHeight: 1.9,
            }}
          >
            <div>🚑 Ambulancia: {sosActive ? 'Llamando 911…' : 'En espera'}</div>
            <div>👨‍👩‍👧 Familia: Pedro González · +1 (786) 555-0192</div>
            <div>👨‍⚕️ Dr. Ramírez · Equipo COPP-ADRESD</div>
            <div>📍 GPS: enviando ubicación</div>
            <div>❤️ FC 140 · SpO2 94% · TA 160/110</div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>
            <button className="btn btn-panic" style={{ flex: 1 }} onClick={activateSos}>
              <IonIcon icon={medkit} /> 911
            </button>
            <button
              className="btn"
              style={{ flex: 1, background: 'rgba(255,255,255,.12)', color: '#fff', border: '1px solid rgba(255,255,255,.2)' }}
              onClick={() => showToast('Llamando a Pedro González…', 'info')}
            >
              <IonIcon icon={call} /> Familia
            </button>
          </div>
          <button
            className="btn"
            style={{ background: 'var(--safe)', color: '#052e16' }}
            onClick={() => {
              closePanic()
              showToast('Alerta cancelada. Quédate en observación.', 'ok')
            }}
          >
            <IonIcon icon={sosActive ? checkmarkCircle : close} /> Estoy bien
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
