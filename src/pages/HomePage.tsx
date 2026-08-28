import { useState, type CSSProperties } from 'react'
import { IonIcon, IonProgressBar } from '@ionic/react'
import { useI18n } from '../i18n/I18nContext'
import {
  bluetooth,
  calendar,
  chatbubbleEllipses,
  checkmark,
  chevronForward,
  clipboard,
  flame,
  leaf,
  medkit,
  people,
  person,
  sparkles,
  mic,
} from 'ionicons/icons'
import { RingProgress } from '../components/RingProgress'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'
import { PROGRAM_TASKS } from '../data/program'
import { TASK_ICONS } from './program/ui'
import { LanguageToggle } from '../components/LanguageToggle'
import { MetricHistoryModal } from '../components/MetricHistoryModal'
import { HEALTH_METRICS, type MetricId } from '../data/metrics'
import type { Screen as ScreenId } from '../types'

export function HomePage() {
  const { user, navigate, openPanic, openVoice, pointsTotal, watchConnected, program, streak, programWeek } = useApp()
  const { lang, t } = useI18n()
  const [metricId, setMetricId] = useState<MetricId | null>(null)

  const moreModules: { id: ScreenId; title: string; sub: string; icon: string }[] = [
    { id: 'hc', title: t('Historia clínica'), sub: t('Diagnósticos, lab y medicamentos'), icon: clipboard },
    { id: 'com', title: t('Comunidad'), sub: t('10,847 miembros activos'), icon: people },
    { id: 'prof', title: t('Mi perfil'), sub: t('Seguros, equipo y ajustes'), icon: person },
  ]
  const first = user.nombre.split(' ')[0]
  const today = new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const todayDone = PROGRAM_TASKS.filter((task) => program[task.id]).length
  const todayTotal = PROGRAM_TASKS.length
  const nextTask = PROGRAM_TASKS.find((task) => !program[task.id])
  const dayComplete = todayDone === todayTotal

  return (
    <Screen>
      <Scroll>
        <header className="home-head">
          <div className="home-head-top">
            <div>
              <div className="home-head-date">{today}</div>
              <h1 className="home-head-name">{t('Hola,')} {first}</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LanguageToggle />
              <button type="button" className="home-avatar" onClick={() => navigate('prof')} aria-label={t('Abrir perfil')}>
                MG
              </button>
            </div>
          </div>
          <div className="home-head-chips">
            <span className="chip chip-glass">
              <span className="dot" /> {t('Riesgo bajo')}
            </span>
            <span className="chip chip-glass">{t('Semana 12 de 24')}</span>
          </div>
        </header>

        <div className="metric-scroll" aria-label={t('Indicadores de salud')}>
          {HEALTH_METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              className="metric-card"
              onClick={() => setMetricId(m.id)}
              aria-label={t('Ver historial de {label}', { label: t(m.label) })}
            >
              <div className="metric-card-lbl">{t(m.label)}</div>
              <div className="metric-card-val" style={{ color: m.color }}>
                {m.id === 'pts' ? String(pointsTotal) : m.current}
              </div>
              <div className="metric-card-sub">{t(m.sub)}</div>
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`prog-launch${dayComplete ? ' done' : ''}`}
          onClick={() => navigate('prog')}
          aria-label={
            dayComplete
              ? t('Programa de hoy completado. Abrir protocolo.')
              : t('Programa de hoy. Siguiente: {next}. {done} de {total} misiones.', { next: nextTask?.title ?? t('continuar'), done: String(todayDone), total: String(todayTotal) })
          }
        >
          <span className="prog-launch-aurora" aria-hidden="true" />
          <span className="prog-launch-kicker">
            <IonIcon icon={sparkles} />
            {t('Protocolo diario')}
          </span>
          <div className="prog-launch-head">
            <RingProgress
              value={todayDone / todayTotal}
              size={78}
              stroke={7}
              trackColor="rgba(255,255,255,0.14)"
              gradient={['#62d8ff', '#1d9e75']}
              glow
            >
              <b>{todayDone}</b>
              <small>/{todayTotal}</small>
            </RingProgress>
            <div className="prog-launch-copy">
              <div className="prog-launch-title">
                {dayComplete ? t('Día completado') : t(nextTask?.title ?? '') || t('Tu programa de hoy')}
              </div>
              <div className="prog-launch-sub">
                {dayComplete
                  ? t('Racha de {streak} días protegida', { streak: String(streak) })
                  : t('{done} de {total} misiones · {next}', { done: String(todayDone), total: String(todayTotal), next: t(nextTask?.short ?? '') || t('Toca para continuar') })}
              </div>
            </div>
          </div>
          <div className="prog-launch-orbs" aria-hidden="true">
            {PROGRAM_TASKS.map((task) => {
              const on = program[task.id]
              const next = task.id === nextTask?.id
              return (
                <span
                  key={task.id}
                  className={`prog-orb tone-${task.tone}${on ? ' on' : ''}${next ? ' next' : ''}`}
                >
                  <IonIcon icon={on ? checkmark : TASK_ICONS[task.id]} />
                </span>
              )
            })}
          </div>
          <div className="prog-launch-foot">
            <span>
              <IonIcon icon={flame} /> {streak} {t('días')}
            </span>
            <span>{t('Semana')} {programWeek}</span>
            <span className="prog-launch-cta">
              {dayComplete ? t('Ver resumen') : t('Continuar')}
              <IonIcon icon={chevronForward} />
            </span>
          </div>
        </button>

        <button type="button" className="next-appt" onClick={() => navigate('book')}>
          <div className="next-appt-time">
            <strong>15:00</strong>
            <span>{t('Hoy')}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="next-appt-name">Dr. Carlos Ramírez</div>
            <div className="next-appt-meta">{t('Telemedicina · Control semana 12')}</div>
          </div>
          <span className="chip chip-teal">{t('Unirse')}</span>
        </button>

        <div className="quick-row">
          {[
            { id: 'chat' as const, label: t('Chat IA'), icon: chatbubbleEllipses, fn: () => navigate('chat') },
            { id: 'voice' as const, label: t('Voz'), icon: mic, fn: openVoice },
            { id: 'bt' as const, label: watchConnected ? t('Reloj') : t('Conectar'), icon: bluetooth, fn: () => navigate('bt') },
            { id: 'sos' as const, label: t('SOS'), icon: medkit, fn: openPanic, panic: true },
          ].map((a) => (
            <button key={a.id} type="button" className={`quick-btn ${a.panic ? 'panic' : ''}`} onClick={a.fn}>
              <span className="quick-btn-ico">
                <IonIcon icon={a.icon} />
              </span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>

        <div className="sec">{t('Accesos')}</div>
        <div className="grid-2" style={{ marginBottom: 8 }}>
          {[
            { id: 'book' as ScreenId, title: t('Citas'), sub: t('Hoy 3:00 PM'), icon: calendar, bg: 'var(--teal-l)', color: 'var(--teal)' },
            { id: 'nut' as ScreenId, title: t('Nutrición'), sub: t('1,650 / 1,800 kcal'), icon: leaf, bg: 'var(--ice-l)', color: 'var(--teal-d)' },
          ].map((m) => (
            <button key={m.id} type="button" className="card widget-card" onClick={() => navigate(m.id)}>
              <div className="ico" style={{ background: m.bg, color: m.color }}>
                <IonIcon icon={m.icon} />
              </div>
              <div className="ct">{m.title}</div>
              <div className="cs">{m.sub}</div>
            </button>
          ))}
        </div>

        <div className="group-list">
          {moreModules.map((m) => (
            <button
              key={m.title}
              type="button"
              className="group-row"
              onClick={() => navigate(m.id)}
            >
              <span className="group-row-ico">
                <IonIcon icon={m.icon} />
              </span>
              <span className="group-row-body">
                <strong>{m.title}</strong>
                <small>{m.sub}</small>
              </span>
              <span className="group-row-chevron">›</span>
            </button>
          ))}
        </div>

        <div className="sec">{t('Progreso semanal')}</div>
        <div className="card" style={{ margin: '0 16px 20px' }}>
          {[
            [t('Hidratación'), '7/8 vasos', 87, 'var(--teal)'],
            [t('Pasos'), '6,240 / 8,000', 78, 'var(--blue)'],
            [t('Calorías'), '1,650 / 1,800', 91, 'var(--org)'],
            [t('Academia'), 'Módulo 5', 68, 'var(--cyan)'],
          ].map(([l, r, w, c]) => (
            <div key={String(l)} className="progress-row">
              <div className="progress-row-top">
                <span>{l}</span>
                <span>{r}</span>
              </div>
              <IonProgressBar
                className="pb"
                style={{ '--progress-background': String(c) } as CSSProperties}
                value={Number(w) / 100}
              />
            </div>
          ))}
        </div>
      </Scroll>
      <MetricHistoryModal metricId={metricId} pointsTotal={pointsTotal} onClose={() => setMetricId(null)} />
    </Screen>
  )
}
