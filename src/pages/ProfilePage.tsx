import { IonIcon } from '@ionic/react'
import {
  calendarOutline,
  clipboardOutline,
  infinite,
  languageOutline,
  leafOutline,
  logOutOutline,
  medkit,
  schoolOutline,
} from 'ionicons/icons'
import { PageHeader } from '../components/PageHeader'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'
import { useT } from '../i18n/I18nContext'
import { useI18n } from '../i18n/I18nContext'
import type { Screen as ScreenId } from '../types'

export function ProfilePage() {
  const { user, navigate, openPanic, showToast, pointsTotal, logout } = useApp()
  const t = useT()
  const { lang, toggleLang } = useI18n()

  const go = (s: ScreenId) => navigate(s)

  return (
    <Screen>
      <PageHeader title={t('Perfil')} sub={t('ID COPP-2024-00142 · Semana 12/24')} />
      <Scroll>
        <div className="profile-hero-card">
          <div className="avatar" style={{ width: 64, height: 64, fontSize: 22, background: 'linear-gradient(145deg,#1a6ad8,#20c8ff)' }}>
            MG
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h2" style={{ margin: 0 }}>{user.nombre}</div>
            <div className="cs">{t('Miembro BIO activo')}</div>
          </div>
        </div>

        <div className="hero-metrics" style={{ padding: '0 16px', marginBottom: 8 }}>
          {[
            ['12', 'Semanas'],
            ['−3.2 kg', 'Peso'],
            [String(pointsTotal), 'Puntos'],
          ].map(([v, l]) => (
            <div key={l} className="metric-card" style={{ flex: 1, textAlign: 'center', padding: '12px 8px' }}>
              <div className="metric-card-val" style={{ fontSize: 20, margin: '0 0 2px', color: 'var(--tx)' }}>{v}</div>
              <div className="metric-card-lbl">{t(l)}</div>
            </div>
          ))}
        </div>

        <div className="sec">{t('Mi plan')}</div>
        <div className="group-list">
          {[
            { ico: clipboardOutline, t: 'Historia clínica', s: 'Diagnósticos · Lab · Medicamentos', fn: () => go('hc') },
            { ico: calendarOutline, t: 'Calendario de citas', s: 'Próxima: Dr. Ramírez hoy 15:00', fn: () => go('book') },
            { ico: leafOutline, t: 'Plan nutricional', s: '1,800 kcal · Mediterránea', fn: () => go('nut') },
          ].map((r) => (
            <button key={r.t} type="button" className="group-row" onClick={r.fn}>
              <span className="group-row-ico">
                <IonIcon icon={r.ico} />
              </span>
              <span className="group-row-body">
                <strong>{t(r.t)}</strong>
                <small>{t(r.s)}</small>
              </span>
              <span className="group-row-chevron">›</span>
            </button>
          ))}
        </div>

        <div className="sec">{t('Equipo ANTARES')}</div>
        <div className="group-list">
          {[
            ['🩺', 'Dr. Carlos Ramírez, MD', 'Médico COPP-ADRESD'],
            ['🥗', 'Nut. Ana Torres, RDN', 'Nutricionista · CDR'],
            ['🧠', 'Psi. Luis Mora, PhD', 'Psicólogo · CBT'],
            ['🤝', 'Coach Marco Reyes, NBHWC', 'Coach de salud'],
          ].map(([e, name, s]) => (
            <button key={name} type="button" className="group-row" onClick={() => showToast(t('Contactando a {name}…', { name }), 'info')}>
              <span className="group-row-ico">{e}</span>
              <span className="group-row-body">
                <strong>{t(name!)}</strong>
                <small>{t(s!)}</small>
              </span>
              <span className="group-row-chevron">›</span>
            </button>
          ))}
        </div>

        <div className="sec">{t('Ecosistema')}</div>
        <div className="group-list">
          <button type="button" className="group-row" onClick={() => go('edu')}>
            <span className="group-row-ico">
              <IonIcon icon={schoolOutline} />
            </span>
            <span className="group-row-body">
              <strong>{t('Academia BIO')}</strong>
              <small>{t('18 hrs completadas')}</small>
            </span>
            <span className="group-row-chevron">›</span>
          </button>
          <button type="button" className="group-row" onClick={() => go('infinito')}>
            <span className="group-row-ico">
              <IonIcon icon={infinite} />
            </span>
            <span className="group-row-body">
              <strong>INFINITO B2C</strong>
              <small>{t('Consciencia · Bienestar')}</small>
            </span>
            <span className="group-row-chevron">›</span>
          </button>
        </div>

        <div className="sec">{t('Cuenta')}</div>
        <div className="group-list" style={{ marginBottom: 20 }}>
          <button type="button" className="group-row" onClick={toggleLang}>
            <span className="group-row-ico">
              <IonIcon icon={languageOutline} />
            </span>
            <span className="group-row-body">
              <strong>{t('Idioma')}</strong>
              <small>{lang === 'es' ? 'ES → EN' : 'EN → ES'}</small>
            </span>
            <span className="group-row-chevron">›</span>
          </button>
          <button type="button" className="group-row" onClick={openPanic}>
            <span className="group-row-ico" style={{ background: 'var(--red-l)', color: 'var(--panic)' }}>
              <IonIcon icon={medkit} />
            </span>
            <span className="group-row-body">
              <strong style={{ color: 'var(--panic)' }}>{t('Botón de pánico SOS')}</strong>
              <small>{t('Ambulancia + familia + médico')}</small>
            </span>
          </button>
          <button
            type="button"
            className="group-row"
            onClick={() => {
              logout()
              showToast(t('Sesión cerrada'), 'ok')
            }}
          >
            <span className="group-row-ico" style={{ background: 'var(--red-l)', color: 'var(--red)' }}>
              <IonIcon icon={logOutOutline} />
            </span>
            <span className="group-row-body">
              <strong style={{ color: 'var(--red)' }}>{t('Cerrar sesión')}</strong>
            </span>
          </button>
        </div>
      </Scroll>
    </Screen>
  )
}
