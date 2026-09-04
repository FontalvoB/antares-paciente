import { type CSSProperties } from 'react'
import { IonButton, IonIcon, IonModal } from '@ionic/react'
import { call, mic, micOff } from 'ionicons/icons'
import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n/I18nContext'
import type { SosChannelStatus, SosDispatchResult } from '../utils/sosApi'

function channelBadge(status: SosChannelStatus, t: (s: string) => string): string {
  if (status === 'Sent') return t('Llamada con mensaje enviada')
  if (status === 'Failed') return t('Fallo de llamada')
  return t('Enviando…')
}

function voiceStatusSummary(d: SosDispatchResult, t: (s: string) => string): string {
  const v = d.channels.voice.status
  if (v === 'Sent') return t('Llamada con mensaje enviada')
  if (v === 'Failed') return t('Fallo de llamada')
  return t('Alerta enviada · despacho en curso')
}

export function VoiceOverlay() {
  const { voiceOpen, closeVoice, showToast, sosActive, sosDispatch } = useApp()
  const { t } = useI18n()
  const [muted, setMuted] = useState(false)

  return (
    <IonModal isOpen={voiceOpen} onDidDismiss={closeVoice} className="voice-modal">
      <div className="overlay overlay-voice">
        <div className="voice-orb">
          <IonIcon icon={mic} style={{ fontSize: 56, color: 'var(--ice)' }} />
        </div>
        <div className="display" style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>
          {sosActive ? t('Llamando a tu contacto de emergencia…') : t('Agente de voz ANTARES')}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
          {sosActive
            ? sosDispatch
              ? voiceStatusSummary(sosDispatch, t)
              : t('Alerta enviada · despacho en curso')
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
          {sosActive
            ? (
              <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'none' }}>
                {sosDispatch ? (
                  <>
                    <li>{t('Voz')}: {channelBadge(sosDispatch.channels.voice.status, t)}</li>
                    <li>{t('SMS')}: {channelBadge(sosDispatch.channels.sms.status, t)}</li>
                    <li>{t('Correo')}: {channelBadge(sosDispatch.channels.email.status, t)}</li>
                  </>
                ) : (
                  <>
                    <li>{t('Voz')}: {t('Enviando…')}</li>
                    <li>{t('SMS')}: {t('Enviando…')}</li>
                    <li>{t('Correo')}: {t('Enviando…')}</li>
                  </>
                )}
              </ul>
            )
            : t('Hola María, soy tu agente de salud ANTARES. ¿Cómo te sientes hoy? Puedes preguntarme sobre síntomas, tu plan nutricional o agendar una cita.')}
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
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
