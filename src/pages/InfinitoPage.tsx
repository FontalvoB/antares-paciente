import { IonButton } from '@ionic/react'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'
import { useT } from '../i18n/I18nContext'

export function InfinitoPage() {
  const t = useT()
  const { showToast, navigate } = useApp()
  return (
    <Screen>
      <Scroll>
        <div className="hero hero-pur">
          <div className="kicker" style={{ color: '#A78BFA' }}>LA CONSCIENCIA</div>
          <div className="h1">∞ INFINITO</div>
          <div className="sub">{t('Consciencia aplicada a la transformación humana · B2C')}</div>
          <div className="chips">
            <span className="chip chip-glass">{t('Mente y bienestar')}</span>
            <span className="chip chip-glass">{t('Espiritualidad')}</span>
            <span className="chip chip-glass">{t('Transformación')}</span>
          </div>
        </div>
        {[
          ['BIO — El cuerpo', [['Health Care particular', 'Telemedicina · bienestar personal'], ['Experiencias de bienestar', 'Rituales · terapias · frecuencias']]],
          ['PSICO — La mente', [['Espiritualidad', 'Propósito de vida · yo interior'], ['Frecuencias y consciencia', 'Neurociencia · meditación']]],
          ['SOCIAL — Comunidad', [['Community Global', 'Red de miembros INFINITO'], ['Leadership Coaches', 'Liderazgo y desarrollo personal']]],
        ].map(([sec, cards]) => (
          <div key={String(sec)}>
            <div className="sec">{t(String(sec))}</div>
            <div className="grid-2">
              {(cards as string[][]).map(([label, s]) => (
                <button key={label} className="card" style={{ textAlign: 'left' }} onClick={() => showToast(t('Abriendo {label}…', { label }), 'info')}>
                  <div className="ico" style={{ background: 'var(--pur-l)', color: 'var(--pur)' }}>∞</div>
                  <div className="ct">{t(label)}</div>
                  <div className="cs">{t(s)}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="sec">{t('Sistema UPPER MIND')}</div>
        <div style={{ margin: '0 14px 12px', background: 'linear-gradient(135deg,#2D1B69,#1A0A3C)', borderRadius: 16, padding: 16, color: '#fff' }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>∞ Sistema UPPER MIND</div>
          <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.6 }}>{t('Integra neurociencia, espiritualidad y biohacking para crear una nueva versión de ti.')}</div>
          <IonButton expand="block" className="bt bt-pur" style={{ marginTop: 12 }} onClick={() => showToast(t('Accediendo a UPPER MIND…'), 'info')}>
            {t('Acceder al sistema')}
          </IonButton>
        </div>
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <button className="card card-accent ac-pur" style={{ textAlign: 'left' }} onClick={() => navigate('com')}>
            <div style={{ fontSize: 22 }}>🎤</div>
            <div className="ct">{t('SUMMIT presenciales')}</div>
            <div className="cs">Wellness · Boot Camps</div>
          </button>
          <button className="card card-accent ac-gold" style={{ textAlign: 'left' }} onClick={() => showToast(t('Planes vacacionales…'), 'info')}>
            <div style={{ fontSize: 22 }}>🌴</div>
            <div className="ct">{t('Planes vacacionales')}</div>
            <div className="cs">{t('Retiros de bienestar')}</div>
          </button>
        </div>
      </Scroll>
    </Screen>
  )
}
