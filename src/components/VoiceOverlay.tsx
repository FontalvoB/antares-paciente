import { type CSSProperties } from 'react'
import { IonButton, IonIcon, IonModal } from '@ionic/react'
import { call, mic, micOff, volumeHigh } from 'ionicons/icons'
import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'
import { buildSosDataBlock } from '../utils/sosMessage'

const SOS_VITALS = { heartRate: 140, spo2: 94, bloodPressure: '160/110' } as const

export function VoiceOverlay() {
  const { voiceOpen, closeVoice, showToast, sosActive, sosCoords, user } = useApp()
  const { t, lang } = useI18n()
  const [muted, setMuted] = useState(false)

  const sosMessageText = sosActive
    ? buildSosDataBlock(user, sosCoords, SOS_VITALS, lang)
    : null

  const speakSosMessage = () => {
    if (typeof speechSynthesis === 'undefined' || !window.speechSynthesis) {
      showToast(t('Tu dispositivo no soporta lectura de voz.'), 'warn')
      return
    }
    speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(sosMessageText ?? '')
    utter.lang = lang === 'es' ? 'es-ES' : 'en-US'
    speechSynthesis.speak(utter)
  }

  return (
    <IonModal isOpen={voiceOpen} onDidDismiss={closeVoice} className="voice-modal">
      <div className="overlay overlay-voice">
        <div className="voice-orb">
          <IonIcon icon={mic} style={{ fontSize: 56, color: 'var(--ice)' }} />
        </div>
        <div className="display" style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>
          {sosActive ? t('Alerta SOS activa') : t('Agente de voz ANTARES')}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
          {sosActive
            ? t('Mensaje de emergencia listo para reproducir.')
            : t('Habla con naturalidad sobre síntomas, citas, medicamentos o tu plan nutricional.')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ice)', fontSize: 13 }}>
          <div className="waves">
            <span className="wave" />
            <span className="wave" />
            <span className="wave" />
            <span className="wave" />
            <span className="wave" />
          </div>
          {muted ? t('Micrófono silenciado') : t('Escuchando…')}
        </div>
        <div
          style={{
            background: 'rgba(255,255,255,.07)',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 14,
            padding: 14,
            width: '100%',
            fontSize: 13,
            color: 'rgba(255,255,255,.78)',
            lineHeight: 1.65,
          }}
        >
          {sosActive && sosMessageText
            ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{sosMessageText}</pre>
            : t('Hola María, soy tu agente de salud ANTARES. ¿Cómo te sientes hoy? Puedes preguntarme sobre síntomas, tu plan nutricional o agendar una cita.')}
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {sosActive && (
            <IonButton
              className="bt bt-round-lg"
              style={{ '--background': 'var(--panic)', '--color': '#fff' } as CSSProperties}
              onClick={speakSosMessage}
              aria-label={t('Reproducir mensaje')}
            >
              <IonIcon icon={volumeHigh} style={{ fontSize: 24 }} />
            </IonButton>
          )}
          <IonButton
            className="bt bt-round-lg"
            style={{ '--background': 'rgba(255,255,255,.12)', '--color': '#fff', '--border-color': 'rgba(255,255,255,.2)', '--border-width': '1px', '--border-style': 'solid' } as CSSProperties}
            onClick={() => setMuted((m) => !m)}
          >
            <IonIcon icon={muted ? micOff : mic} style={{ fontSize: 24 }} />
          </IonButton>
          <IonButton
            className="bt bt-round-lg"
            style={{ '--background': 'var(--panic)', '--color': '#fff' } as CSSProperties}
            onClick={() => {
              closeVoice()
              showToast(t('Llamada de voz finalizada'), 'ok')
            }}
          >
            <IonIcon icon={call} style={{ fontSize: 24 }} />
          </IonButton>
        </div>
      </div>
    </IonModal>
  )
}
