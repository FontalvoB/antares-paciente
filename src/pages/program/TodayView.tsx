import { IonButton, IonIcon } from '@ionic/react'
import { motion } from 'framer-motion'
import { checkmark, gift, sparkles, trophy } from 'ionicons/icons'
import { RingProgress } from '../../components/RingProgress'
import {
  DAY_BONUS_PTS,
  PROGRAM_POINTS_MAX,
  PROGRAM_TASKS,
  WEEK_LABELS,
} from '../../data/program'
import type { ProgramDay, ProgramTaskId } from '../../types'
import { TASK_ICONS } from './ui'
import { CountUp } from './visuals'

export function TodayView({
  program,
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
}: {
  program: ProgramDay
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
}) {
  const fillPct = (doneCount / PROGRAM_TASKS.length) * 100

  return (
    <div className="pg-pane">
      <motion.div
        className="duo-unit"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <RingProgress
          value={doneCount / PROGRAM_TASKS.length}
          size={64}
          stroke={7}
          trackColor="rgba(255,255,255,0.16)"
          gradient={['#62d8ff', '#1d9e75']}
        >
          <b>
            <CountUp to={doneCount} duration={0.6} />
          </b>
          <small>/6</small>
        </RingProgress>
        <div className="duo-unit-copy">
          <div className="pg-kicker">Unidad {programWeek}</div>
          <strong>{allDone ? 'Día perfecto' : 'Protocolo de hoy'}</strong>
          <span>
            {allDone
              ? 'Racha protegida · cofre abierto'
              : `${pointsToday} / ${PROGRAM_POINTS_MAX} XP`}
          </span>
        </div>
      </motion.div>

      <div className="duo-map">
        <div className="duo-trail" aria-hidden="true">
          <div className="duo-trail-fill" style={{ height: `${fillPct}%` }} />
        </div>
        {PROGRAM_TASKS.map((t, i) => {
          const done = program[t.id]
          const current = t.id === currentId
          const locked = !done && !current
          return (
            <motion.div
              key={t.id}
              className={`duo-step ${i % 2 === 0 ? 'left' : 'right'} ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="duo-node-wrap">
                {current && !done && <div className="duo-bubble">¡Empieza!</div>}
                <button
                  type="button"
                  className={`duo-node tone-${t.tone} ${done ? 'done' : ''} ${current ? 'current' : ''} ${locked ? 'locked' : ''}`}
                  aria-label={`${t.title}${done ? ', completada' : current ? ', siguiente' : ''}`}
                  onClick={() => onOpenTask(t.id)}
                >
                  <IonIcon icon={done ? checkmark : TASK_ICONS[t.id]} />
                  {current && !done && <span className="duo-pulse" />}
                </button>
              </div>
              <div className="duo-caption">
                <strong>{t.title}</strong>
                <small>{done ? 'Completada' : t.short}</small>
                <span className={`chip ${done ? 'chip-teal' : 'chip-gold'}`}>+{t.pts}</span>
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
            <strong>{allDone ? `Bonus +${DAY_BONUS_PTS} XP` : 'Cofre del día'}</strong>
            <small>
              {allDone
                ? 'Desbloqueado. Mañana se abre de nuevo.'
                : `Completa las 6 y gana +${DAY_BONUS_PTS} XP`}
            </small>
          </div>
        </motion.div>
      </div>

      <div className="stitle">Nutribiótico</div>
      <div className="nb-card pg-nb">
        <div className="nb-title">
          {program.nutribiotico ? 'Dosis de hoy lista' : '¿Ya tomaste tu Nutribiótico?'}
        </div>
        <div className="nb-sub">
          {program.nutribiotico ? `Registrado a las ${takenAt || 'ahora'}` : 'Producto ADRED · dosis matutina'}
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
            Registrar dosis
          </IonButton>
        )}
      </div>

      <div className="stitle">AI Health Coach</div>
      <div className="ai-wrap pg-ai">
        <div className="pg-ai-head">
          <span className="pg-ai-avatar">
            <IonIcon icon={sparkles} />
          </span>
          <div className="ai-chip">ANÁLISIS SEMANAL · SEMANA {programWeek}</div>
        </div>
        <div className="ai-bubble">
          {first}, tu <strong>adherencia nutricional subió de 67% a 84%</strong>. El índice de grasa
          varió +0.4% — hay una cosa que quiero revisar contigo.
        </div>
        <div className="ai-actions">
          <IonButton className="bt bt-ghost" onClick={onGoEvo}>
            Ver evolución
          </IonButton>
          <IonButton className="bt bt-primary" onClick={onGoChat}>
            Hablar con IA
          </IonButton>
        </div>
      </div>
    </div>
  )
}
