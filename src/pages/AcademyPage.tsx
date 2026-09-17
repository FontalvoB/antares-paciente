import { type CSSProperties } from 'react'
import { IonButton, IonProgressBar } from '@ionic/react'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'
import { useT } from '../i18n/I18nContext'

export function AcademyPage() {
  const t = useT()
  const { showToast } = useApp()
  return (
    <Screen>
      <Scroll>
        <div className="hero hero-cosmos">
          <div className="kicker">COPP ADRESD BIOHACKING</div>
          <div className="h1">🎓 Academia BIO</div>
          <div className="sub">{t('Formación y certificación profesional · COPP-ADRESD')}</div>
          <div className="chips">
            <span className="chip chip-gold">{t('18 hrs completadas')}</span>
            <span className="chip chip-glass">{t('3 certificados')}</span>
          </div>
        </div>
        <div className="sec">{t('BIO — El cuerpo')}</div>
        <div className="card" style={{ margin: '0 14px 10px' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="ico" style={{ background: 'var(--teal-l)' }}>🥗</div>
            <div>
              <div className="ct">{t('Nutrición y prevención de la obesidad')}</div>
              <div className="cs">USDA MyPlate · ADA · ABOM</div>
              <span className="chip chip-teal" style={{ marginTop: 6 }}>{t('Certificado obtenido')}</span>
            </div>
          </div>
          <IonProgressBar className="pb" style={{ margin: '12px 0' } as CSSProperties} value={1} />
          <IonButton expand="block" className="bt bt-ghost" onClick={() => showToast(t('Certificado ABOM descargado'), 'ok')}>
            {t('📄 Ver certificado')}
          </IonButton>
        </div>
        <div className="card" style={{ margin: '0 14px 10px' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="ico" style={{ background: 'var(--blue-l)' }}>🏃</div>
            <div>
              <div className="ct">{t('Actividad física y control del peso')}</div>
              <div className="cs">CDC · ACSM 2024 · Módulo 5 activo</div>
            </div>
          </div>
          <IonProgressBar className="pb" style={{ margin: '12px 0', '--progress-background': 'var(--blue)' } as CSSProperties} value={0.68} />
          <IonButton expand="block" className="bt bt-primary" onClick={() => showToast(t('Iniciando módulo 5: rutinas en casa'), 'info')}>
            {t('Continuar módulo 5')}
          </IonButton>
        </div>
        <div className="sec">{t('PSICO — La mente')}</div>
        <div className="card" style={{ margin: '0 14px 10px' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="ico" style={{ background: '#FBEAF0' }}>🧠</div>
            <div>
              <div className="ct">{t('Salud mental y cambio de hábitos')}</div>
              <div className="cs">APA CBT · MBSR · 33%</div>
            </div>
          </div>
          <IonProgressBar className="pb" style={{ margin: '12px 0', '--progress-background': '#D4537E' } as CSSProperties} value={0.33} />
          <IonButton
            expand="block"
            className="bt"
            style={{ '--background': '#D4537E', '--color': '#fff' } as CSSProperties}
            onClick={() => showToast(t('Módulo 3: hábitos'), 'info')}
          >
            {t('Continuar módulo 3')}
          </IonButton>
        </div>
        <div className="sec">Marketplace</div>
        <div className="grid-2" style={{ marginBottom: 16 }}>
          {[
            ['💊', 'Nutraceútica', 'Suplementos · Salud'],
            ['🚐', 'Unidades móviles', 'Check-up en tu ciudad'],
            ['🎤', 'SUMMIT virtuales', 'Eventos · Comunidad'],
            ['🛒', 'Tiendas de salud', 'Wellness · Conveniencia'],
          ].map(([e, title, s]) => (
            <button key={title} className="card" style={{ textAlign: 'left' }} onClick={() => showToast(t('Abriendo {title}…', { title }), 'info')}>
              <div style={{ fontSize: 22 }}>{e}</div>
              <div className="ct">{t(title)}</div>
              <div className="cs">{t(s)}</div>
            </button>
          ))}
        </div>
      </Scroll>
    </Screen>
  )
}
