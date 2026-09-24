import { IonButton, IonChip, IonIcon, IonProgressBar, IonSegment, IonSegmentButton } from '@ionic/react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { useState, type CSSProperties } from 'react'
import { flame, flash, shieldCheckmark, trophy, checkmark, calendarOutline, giftOutline, leafOutline, heartOutline } from 'ionicons/icons'
import { RingProgress } from '../../components/RingProgress'
import { NB_STREAK_DEFS } from '../../data/chests'
import { useI18n } from '../../i18n/I18nContext'
import { PROGRAM_WEEKS } from '../../data/program'
import { ClinicalChestCard, NextChestGoal, StreakChestsTrail } from './ChestsPanel'
import { CountUp } from './visuals'
import type { StreakChestDto, NbNextMilestoneDto } from '../../services/program/types'
import type { ClinicalChestView } from '../../hooks/useClinicalChests'
import type { WeekStripCell } from '../../utils/weekStrip'

export function StreakView({
  streak,
  longestStreak,
  freezesRemaining = 1,
  weekCheckins,
  weekCells,
  todayIdx,
  cells,
  weekPct,
  programWeek,
  programWeeks = PROGRAM_WEEKS,
  chests,
  clinicalChests,
  nbStreak,
  nbNextMilestone,
  multiplierActive,
  multiplierRemainingHours,
}: {
  streak: number
  /** Máxima racha REAL (server); null → sin chip (nada inventado). */
  longestStreak?: number | null
  freezesRemaining?: number
  /** Fallback legado (device behavior) cuando no hay celdas del servidor. */
  weekCheckins: boolean[]
  /** Celdas de la semana del PROGRAMA resueltas por el server (7 ítems). */
  weekCells?: WeekStripCell[] | null
  todayIdx: number
  cells: { d: number | null; kind: string }[]
  weekPct: number
  programWeek: number
  programWeeks?: number
  /** Streak chest trail: server truth (or static fallback), already resolved. */
  chests: StreakChestDto[]
  /** Clinical chests: read-only progress resolved from scores. */
  clinicalChests: ClinicalChestView[]
  /** Nutracéutico streak (per-run): earns NB chests when >= def.days. */
  nbStreak: number
  /** Server-computed next NB milestone (takes precedence when present). */
  nbNextMilestone?: NbNextMilestoneDto | null
  /** Multiplicador de XP activo (1.0 = inactivo; 2.0 = x2). */
  multiplierActive?: number
  /** Horas restantes del multiplicador (server). */
  multiplierRemainingHours?: number
}) {
  const { lang, t } = useI18n()
  const reduce = useReducedMotion()
  // Estado de exploración visual: no modifica completaciones, cofres ni XP.
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [rewardTab, setRewardTab] = useState('streak')
  const locale = lang === 'en' ? 'en-US' : 'es-ES'
  const weekday = (i: number) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 7 + i)).replace('.', '')
  const activeCell = cells.find(c => c.d != null && c.d === selectedDay) ?? cells.find(c => c.d != null && c.kind.includes('today'))
  const dayStatus = (kind: string) => {
    if (kind.includes('ok')) return t('Día completo')
    if (kind.includes('partial')) return t('Avance parcial')
    if (kind.includes('missed')) return t('Sin actividad registrada')
    if (kind.includes('nodata')) return t('Sin datos disponibles')
    if (kind.includes('today')) return t('Hoy, una nueva oportunidad')
    return t('Día por venir')
  }
  const dayHint = (kind: string) => {
    if (kind.includes('ok')) return t('Completaste tu protocolo. Cada paso suma a tu constancia.')
    if (kind.includes('partial')) return t('Registraste actividad. Tu avance también cuenta.')
    if (kind.includes('missed')) return t('Un día no define tu camino. Siempre puedes retomar.')
    if (kind.includes('nodata')) return t('Aún no hay información disponible para este día.')
    if (kind.includes('today')) return t('Tu historia de hoy se construye paso a paso.')
    return t('Tu próximo paso todavía está por escribir.')
  }
  const activeDays = Array.from({ length: 7 }, (_, i) => weekCells?.[i]?.done ?? Boolean(weekCheckins[i])).filter(Boolean).length
  const monthRaw = new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', { month: 'long', year: 'numeric' })
  const monthTitle = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1)

  const nextStreakChest = chests.find((chest) => !chest.granted)
  const nbChests: StreakChestDto[] = NB_STREAK_DEFS.map((def) => ({
    days: def.days,
    xp: def.xp,
    // Per-run semantics (AC-39): each completed run re-earns its milestone,
    // so deriving from the current nbStreak is correct for NB chests.
    granted: nbStreak >= def.days,
  }))
  const nextNb = nbNextMilestone ?? nbChests.find((chest) => !chest.granted)

  return (
    <MotionConfig reducedMotion="user">
      <div className="pg-pane cpad sr-view">
        <motion.section
          className="pg-streak-hero sr-hero"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="sr-eyebrow"><span className="sr-live-dot" />{t('Tu constancia, día a día')}</div>
          <h2>{streak > 0 ? t('Mantén viva tu chispa') : t('Tu chispa empieza hoy')}</h2>
          <div className="sr-orbit">
            <span className="sr-orbit-halo" aria-hidden="true" />
            <RingProgress value={nextStreakChest ? streak / nextStreakChest.days : chests.length ? 1 : 0} size={184} stroke={5} gradient={['var(--org-l)', 'var(--org)']}>
              <IonIcon className="sr-fire" icon={flame} aria-hidden="true" />
              <div className="pg-streak-num"><CountUp to={streak} duration={1.05} /></div>
              <div className="pg-streak-lbl">{t('días seguidos')}</div>
            </RingProgress>
          </div>
          <p className="pg-streak-copy">{nextStreakChest
            ? t('Tu próximo hito: {days} días', { days: String(nextStreakChest.days) })
            : t('Cada pequeño paso construye un gran hábito.')}</p>
          <div className="pg-streak-chips">
            {longestStreak != null && (
              <IonChip>
                <IonIcon icon={trophy} /> {t('Máxima')} {longestStreak}
              </IonChip>
            )}
            <IonChip>
              <IonIcon icon={shieldCheckmark} /> {freezesRemaining} {t('rescate(s)')}
            </IonChip>
            {multiplierActive != null && multiplierActive > 1 && (
              <IonChip className="xp-multiplier">
                <IonIcon icon={flash} /> x{multiplierActive} XP
                {multiplierRemainingHours != null && ` · ${t('quedan {h} h', { h: String(Math.ceil(multiplierRemainingHours)) })}`}
              </IonChip>
            )}
          </div>
        </motion.section>

        <div className="pg-week-card sr-week-card">
          <div className="sr-section-head"><div><span className="sr-kicker">{t('Paso a paso')}</span><h3>{t('Esta semana')}</h3></div><span className="sr-week-total">{t('{n} de 7 días activos', { n: String(activeDays) })}</span></div>
          <div className="pg-week">
            {/* Las semanas del programa arrancan en lunes (lógica de inscripción);
                las celdas ya vienen indexadas por weekday ISO 1=lunes..7=domingo. */}
            {Array.from({ length: 7 }, (_, i) => {
              const label = weekday((i + 1) % 7)
              const cell = weekCells?.[i]
              // Sin celdas del servidor → fallback legado (boolean[] device).
              const done = cell ? cell.done : Boolean(weekCheckins[i])
              const isToday = i === todayIdx
              return (
                <motion.div
                  key={i}
                  className={`pg-week-day ${done ? 'done' : ''} ${cell && !cell.hasData ? 'nodata' : ''} ${isToday ? 'today' : ''}`}
                  aria-label={`${label}: ${done ? t('Actividad registrada') : cell && !cell.hasData ? t('Sin datos disponibles') : t('Sin actividad registrada')}${isToday ? ` · ${t('Hoy')}` : ''}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.05, duration: 0.3 }}
                >
                  <span>{label}</span>
                  <b>{done ? <IonIcon icon={checkmark} aria-hidden="true" /> : isToday ? <IonIcon icon={flame} aria-hidden="true" /> : '—'}</b>
                </motion.div>
              )
            })}
          </div>
        </div>

        <section className="pg-cal-v2 sr-calendar" aria-label={t('Tu mapa de consistencia')}>
          <div className="pg-cal-v2-head">
            <div>
              <span className="sr-kicker">{t('Tu mapa de consistencia')}</span>
              <h3>{monthTitle}</h3>
            </div>
            <div className="pg-cal-v2-stat">
              <b>{cells.filter((c) => c.kind.includes('ok')).length}</b>
              <span>{t('días completos')}</span>
            </div>
          </div>
          <div className="pg-cal-v2-lbls">
            {Array.from({ length: 7 }, (_, i) => weekday(i)).map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="pg-cal-v2-grid">
            {cells.map((c, i) => (
              c.d == null ? <span key={i} aria-hidden="true" /> : <IonButton
                key={i}
                fill="clear"
                className={`sr-day ${c.kind} ${activeCell?.d === c.d ? 'selected' : ''}`}
                aria-label={`${t('Día')} ${c.d}: ${dayStatus(c.kind)}`}
                aria-pressed={activeCell?.d === c.d ? 'true' : 'false'}
                aria-current={c.kind.includes('today') ? 'date' : undefined}
                onClick={() => setSelectedDay(c.d)}
              >
                <span>{c.d}<i aria-hidden="true" /></span>
              </IonButton>
            ))}
          </div>
          <div className="pg-cal-v2-legend">
            <span>
              <i className="ok" /> {t('Completo')}
            </span>
            <span>
              <i className="partial" /> {t('Parcial')}
            </span>
            <span>
              <i className="missed" /> {t('Sin actividad')}
            </span>
            <span>
              <i className="today" /> {t('Hoy')}
            </span>
            <span><i className="nodata" /> {t('Sin datos')}</span>
          </div>
          <div className="sr-day-detail" aria-live="polite" aria-atomic="true">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={`${activeCell?.d}-${activeCell?.kind}-${lang}`} initial={{ opacity: 0, y: reduce ? 0 : 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.16 }}>
                <IonIcon icon={activeCell?.kind.includes('ok') ? checkmark : calendarOutline} aria-hidden="true" />
                <div><strong>{activeCell ? `${t('Día')} ${activeCell.d} · ${dayStatus(activeCell.kind)}` : t('Explora tu calendario')}</strong><p>{activeCell ? dayHint(activeCell.kind) : t('Toca un día para conocer tu avance.')}</p></div>
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        <section className="sr-rewards">
          <div className="sr-section-head"><div><span className="sr-kicker">{t('Cada paso tiene valor')}</span><h3>{t('Tus recompensas')}</h3></div><IonIcon className="sr-section-icon" icon={giftOutline} aria-hidden="true" /></div>
          <IonSegment className="sr-reward-tabs" value={rewardTab} aria-label={t('Tipos de recompensa')} onIonChange={e => { if (e.detail.value) setRewardTab(String(e.detail.value)) }}>
            <IonSegmentButton value="streak"><IonIcon icon={flame} aria-hidden="true" />{t('Racha')}</IonSegmentButton>
            <IonSegmentButton value="nb"><IonIcon icon={leafOutline} aria-hidden="true" />{t('Nutracéutico')}</IonSegmentButton>
            <IonSegmentButton value="clinical"><IonIcon icon={heartOutline} aria-hidden="true" />{t('Clínicos')}</IonSegmentButton>
          </IonSegment>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={rewardTab} initial={{ opacity: 0, y: reduce ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.18 }}>
            {rewardTab === 'streak' && <>
              <h4>{t('Cofres de racha')}</h4>
              <p className="cx-lead">{t('Cada hito de días seguidos abre su cofre de experiencia automáticamente.')}</p>
              <StreakChestsTrail chests={chests} streak={streak} />
              {nextStreakChest && (
                <NextChestGoal
                  days={nextStreakChest.days}
                  xp={nextStreakChest.xp}
                  streak={streak}
                />
              )}
              {chests.length === 0 && <p className="sr-empty">{t('Tus hitos aparecerán aquí cuando estén disponibles.')}</p>}
              {chests.length > 0 && !nextStreakChest && <p className="sr-empty">{t('¡Completaste todos los hitos de racha disponibles!')}</p>}
            </>}

            {rewardTab === 'nb' && <>
              <h4>{t('Cofres de nutracéutico')}</h4>
              <p className="cx-lead">{t('Cada corrida constante de nutracéutico desbloquea su propio premio.')}</p>
              <StreakChestsTrail chests={nbChests} streak={nbStreak} />
              {nextNb && <NextChestGoal days={nextNb.days} xp={nextNb.xp} streak={nbStreak} />}
            </>}

            {rewardTab === 'clinical' && <>
              <h4>{t('Cofres clínicos')}</h4>
              <p className="cx-lead">{t('Tu evolución real frente a la línea base. Sin reclamos: tu equipo valida la XP.')}</p>
              {clinicalChests.map((chest, i) => (
                <ClinicalChestCard key={chest.id} chest={chest} index={i} />
              ))}
              {clinicalChests.length === 0 && <p className="sr-empty">{t('Tus hitos aparecerán aquí cuando estén disponibles.')}</p>}
            </>}
            </motion.div>
          </AnimatePresence>
        </section>

        <div className="card pg-protocol">
          <div className="pg-protocol-top">
            <div className="cs">{t('Recorrido del protocolo')}</div>
            <strong>
              {t('Semana')} {programWeek}/{programWeeks}
            </strong>
          </div>
          <IonProgressBar
            aria-label={t('Recorrido del protocolo')}
            value={weekPct}
            className="pb"
            style={
              {
                '--progress-background': 'linear-gradient(90deg,var(--cyan),var(--teal))',
              } as CSSProperties
            }
          />
        </div>
      </div>
    </MotionConfig>
  )
}
