import { useMemo } from 'react'
import { IonButton, IonIcon } from '@ionic/react'
import { motion } from 'framer-motion'
import { checkmark, chevronForward, gift, sparkles, trophy } from 'ionicons/icons'
import { RingProgress } from '../../components/RingProgress'
import {
  DAY_BONUS_PTS,
  PROGRAM_POINTS_MAX,
  PROGRAM_TASKS,
  WEEK_LABELS,
} from '../../data/program'
import type { ProgramDay, ProgramTaskId } from '../../types'
import type { TodayTaskDto } from '../../services/program/types'
import { useT } from '../../i18n/I18nContext'
import { TASK_ICONS } from './ui'
import { CountUp } from './visuals'

export function TodayView({
  program,
  todayTasks,
  pointsTodayMax = PROGRAM_POINTS_MAX,
  doneCount,
  allDone,
  currentId,
  pointsToday,
  first,
  programWeek,
  todayIdx,
  takenAt,
  onOpenTask,
  onGoEvo,
  onGoChat,
  onGoChests,
  readyChests,
  readyXp,
}: {
  program: ProgramDay
  todayTasks?: TodayTaskDto[]
  pointsTodayMax?: number
  doneCount: number
  allDone: boolean
  currentId?: ProgramTaskId
  pointsToday: number
  first: string
  programWeek: number
  todayIdx: number
  takenAt: string
  onOpenTask: (id: ProgramTaskId) => void
  onGoEvo: () => void
  onGoChat: () => void
  onGoChests: () => void
  readyChests: number
  readyXp: number
}) {
  const t = useT()

  const taskList = useMemo(() => {
    if (todayTasks && todayTasks.length > 0) {
      return todayTasks.map((t) => {
        const fallback = PROGRAM_TASKS.find((pt) => pt.id === t.taskCode)
        return {
          id: t.taskCode as ProgramTaskId,
          title: t.title || fallback?.title || t.taskCode,
          short: t.short || fallback?.short || '',
          pts: t.points ?? fallback?.pts ?? 0,
          done: t.status === 'Completed' || Boolean(program[t.taskCode as ProgramTaskId]),
          tone: fallback?.tone ?? 'teal',
          icon: TASK_ICONS[t.taskCode as ProgramTaskId] ?? checkmark,
        }
      })
    }
    return PROGRAM_TASKS.map((pt) => ({
      id: pt.id,
      title: pt.title,
      short: pt.short,
      pts: pt.pts,
      done: Boolean(program[pt.id]),
      tone: pt.tone,
      icon: TASK_ICONS[pt.id],
    }))
  }, [todayTasks, program])

  const totalTasks = taskList.length || 6
  const fillPct = (doneCount / totalTasks) * 100

  return (
    <div className="pg-pane">
      <motion.div
        className="duo-unit"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <RingProgress
          value={totalTasks > 0 ? doneCount / totalTasks : 0}
          size={64}
          stroke={7}
          trackColor="rgba(255,255,255,0.16)"
          gradient={['#62d8ff', '#1d9e75']}
        >
          <b>
            <CountUp to={doneCount} duration={0.6} />
          </b>
          <small>/{totalTasks}</small>
        </RingProgress>
        <div className="duo-unit-copy">
          <div className="pg-kicker">{t('Unidad')} {programWeek}</div>
          <strong>{allDone ? t('Día perfecto') : t('Protocolo de hoy')}</strong>
          <span>
            {allDone
              ? t('Racha protegida · cofre abierto')
              : `${pointsToday} / ${pointsTodayMax} XP`}
          </span>
        </div>
      </motion.div>

      <div className="duo-map">
        <div className="duo-trail" aria-hidden="true">
          <div className="duo-trail-fill" style={{ height: `${fillPct}%` }} />
        </div>
        {taskList.map((task, i) => {
          const done = task.done
          const current = task.id === currentId
          const locked = !done && !current
          return (
            <motion.div
              key={task.id}
              className={`duo-step ${i % 2 === 0 ? 'left' : 'right'} ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="duo-node-wrap">
                {current && !done && <div className="duo-bubble">{t('¡Empieza!')}</div>}
                <button
                  type="button"
                  className={`duo-node tone-${task.tone} ${done ? 'done' : ''} ${current ? 'current' : ''} ${locked ? 'locked' : ''}`}
                  aria-label={`${t(task.title)}${done ? t(', completada') : current ? t(', siguiente') : ''}`}
                  onClick={() => onOpenTask(task.id)}
                >
                  <IonIcon icon={done ? checkmark : task.icon} />
                  {current && !done && <span className="duo-pulse" />}
                </button>
              </div>
              <div className="duo-caption">
                <strong>{t(task.title)}</strong>
                <small>{done ? t('Completada') : t(task.short)}</small>
                <span className={`chip ${done ? 'chip-teal' : 'chip-gold'}`}>+{task.pts}</span>
              </div>
            </motion.div>
          )
        })}

        <motion.div
          className={`duo-treasure ${allDone ? 'open' : ''}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.52, duration: 0.35 }}
        >
          <div className={`duo-node tone-gold ${allDone ? 'done' : ''}`}>
            <IonIcon icon={allDone ? trophy : gift} />
          </div>
          <div className="duo-caption">
            <strong>{allDone ? `Bonus +${DAY_BONUS_PTS} XP` : t('Cofre del día')}</strong>
            <small>
              {allDone
                ? t('Desbloqueado. Mañana se abre de nuevo.')
                : `${t('Completa las 6 y gana +')}${DAY_BONUS_PTS} XP`}
            </small>
          </div>
        </motion.div>
      </div>

      {readyChests > 0 && (
        <button type="button" className="cx-today-banner" onClick={onGoChests}>
          <span className="cx-today-ico">
            <IonIcon icon={gift} />
          </span>
          <span className="cx-today-copy">
            <strong>{t('{n} cofres listos para reclamar', { n: String(readyChests) })}</strong>
            <small>+{readyXp.toLocaleString('es-ES')} XP</small>
          </span>
          <IonIcon icon={chevronForward} />
        </button>
      )}

      <div className="stitle">{t('Nutribiótico')}</div>
      <div className="nb-card pg-nb">
        <div className="nb-title">
          {program.nutribiotico ? t('Dosis de hoy lista') : t('¿Ya tomaste tu Nutribiótico?')}
        </div>
        <div className="nb-sub">
          {program.nutribiotico ? t('Registrado a las {takenAt}', { takenAt: takenAt || t('ahora') }) : t('Producto ADRED · dosis matutina')}
        </div>
        <div className="nb-streak">
          {WEEK_LABELS.map((d, i) => {
            const ok = i === todayIdx ? program.nutribiotico : i < todayIdx
            return (
              <div key={d} className={`nb-day ${ok ? 'ok' : 'no'} ${i === todayIdx ? 'today' : ''}`}>
                {d}
              </div>
            )
          })}
        </div>
        {!program.nutribiotico && (
          <IonButton expand="block" className="bt bt-teal" onClick={() => onOpenTask('nutribiotico')}>
            {t('Registrar dosis')}
          </IonButton>
        )}
      </div>

      <div className="stitle">AI Health Coach</div>
      <div className="ai-wrap pg-ai">
        <div className="pg-ai-head">
          <span className="pg-ai-avatar">
            <IonIcon icon={sparkles} />
          </span>
          <div className="ai-chip">{t('ANÁLISIS SEMANAL · SEMANA {programWeek}', { programWeek: String(programWeek) })}</div>
        </div>
        <div className="ai-bubble">
          {first}, {t('tu')} <strong>{t('adherencia nutricional subió de 67% a 84%')}</strong>. {t('El índice de grasa varió +0.4% — hay una cosa que quiero revisar contigo.')}
        </div>
        <div className="ai-actions">
          <IonButton className="bt bt-ghost" onClick={onGoEvo}>
            {t('Ver evolución')}
          </IonButton>
          <IonButton className="bt bt-primary" onClick={onGoChat}>
            {t('Hablar con IA')}
          </IonButton>
        </div>
      </div>
    </div>
  )
}
