import { useMemo } from 'react'
import { IonButton, IonIcon } from '@ionic/react'
import { motion } from 'framer-motion'
import { checkmark, gift, sparkles, trophy } from 'ionicons/icons'
import {
  DAY_BONUS_PTS,
  PROGRAM_TASKS,
  WEEK_LABELS,
} from '../../data/program'
import { MISSION_PHOTOS } from '../../data/missionPhotos'
import type { ProgramDay, ProgramTaskId } from '../../types'
import type { TodayTaskDto } from '../../services/program/types'
import { useT } from '../../i18n/I18nContext'
import { TASK_ICONS } from './ui'

export function TodayView({
  program,
  todayTasks,
  allDone,
  currentId,
  first,
  programWeek,
  todayIdx,
  takenAt,
  onOpenTask,
  onGoEvo,
  onGoChat,
}: {
  program: ProgramDay
  /** Misiones del día servidas por el backend; sin ellas se usa el plan local. */
  todayTasks?: TodayTaskDto[]
  allDone: boolean
  currentId?: ProgramTaskId
  first: string
  programWeek: number
  todayIdx: number
  takenAt: string
  onOpenTask: (id: ProgramTaskId) => void
  onGoEvo: () => void
  onGoChat: () => void
}) {
  const t = useT()

  // La lista viene del backend cuando hay snapshot; si no, del plan local.
  const taskList = useMemo(() => {
    if (todayTasks && todayTasks.length > 0) {
      return todayTasks.map((task) => {
        const fallback = PROGRAM_TASKS.find((pt) => pt.id === task.taskCode)
        return {
          id: task.taskCode as ProgramTaskId,
          title: task.title || fallback?.title || task.taskCode,
          short: task.short || fallback?.short || '',
          pts: task.points ?? fallback?.pts ?? 0,
          done: task.status === 'Completed' || Boolean(program[task.taskCode as ProgramTaskId]),
          tone: fallback?.tone ?? 'teal',
          icon: TASK_ICONS[task.taskCode as ProgramTaskId] ?? checkmark,
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

  return (
    <div className="pg-pane">
      <div className="pcards">
        {taskList.map((task, i) => {
          const done = task.done
          const current = task.id === currentId
          // "Mediterráneo · 1,800 kcal" → subtítulo a la izquierda, dato a la
          // derecha. Solo se separa cuando el último tramo es una cifra
          // ("8 min", "Semana 12"); si no, el texto va entero al subtítulo.
          const parts = t(task.short).split(' · ')
          const tail = parts.length > 1 && /\d/.test(parts[parts.length - 1]) ? parts.pop() : null
          const subtitle = parts.join(' · ')
          return (
            <motion.button
              key={task.id}
              type="button"
              className={`pcard${done ? ' done' : ''}${current ? ' current' : ''}`}
              aria-label={`${t(task.title)}${done ? t(', completada') : current ? t(', siguiente') : ''}`}
              onClick={() => onOpenTask(task.id)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 + i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <img className="pcard-photo" src={MISSION_PHOTOS[task.id]} alt="" loading="lazy" />
              <span className={`pcard-flag tone-${task.tone}`}>
                <IonIcon icon={done ? checkmark : task.icon} />
              </span>
              {current && !done && <span className="pcard-next">{t('Siguiente')}</span>}
              <span className="pcard-panel">
                <span className="pcard-copy">
                  <strong>{t(task.title)}</strong>
                  <small>{done ? t('Completada') : subtitle}</small>
                </span>
                <span className="pcard-side">
                  <span className="pcard-pts">+{task.pts}</span>
                  {tail && <span className="pcard-meta">{tail}</span>}
                </span>
              </span>
            </motion.button>
          )
        })}

        <motion.div
          className={`pcard pcard-chest${allDone ? ' done' : ''}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="pcard-chest-art" aria-hidden="true">
            <IonIcon icon={allDone ? trophy : gift} />
          </span>
          <span className="pcard-panel">
            <span className="pcard-copy">
              <strong>{allDone ? t('Bonus del día desbloqueado') : t('Cofre del día')}</strong>
              <small>
                {allDone
                  ? t('Desbloqueado. Mañana se abre de nuevo.')
                  : t('Completa las {n} misiones', { n: String(taskList.length) })}
              </small>
            </span>
            <span className="pcard-side">
              <span className="pcard-pts">+{DAY_BONUS_PTS}</span>
            </span>
          </span>
        </motion.div>
      </div>

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
