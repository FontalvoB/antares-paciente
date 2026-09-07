import { useMemo, type ReactNode } from 'react'
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
import type { ScoresResponseDto, TodayTaskDto } from '../../services/program/types'
import { useI18n } from '../../i18n/I18nContext'
import {
  nbServerTodayIndex,
  nbWeekLabel,
  resolveNbDayOk,
} from '../../utils/nbWeekDays'
import { TASK_ICONS } from './ui'

/** Formatea un `completedAt` ISO del servidor en HH:mm del locale del device. */
function formatTaskTime(iso: string, lang: 'es' | 'en'): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(lang === 'en' ? 'en-US' : 'es-ES', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function TodayView({
  program,
  todayTasks,
  allDone,
  currentId,
  first,
  programWeek,
  todayIdx,
  takenAt,
  nbWeekDays,
  weekStartDateLocal,
  todayLocalDate,
  dailyBonusAmount,
  todayBonusAvailable,
  scores,
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
  /** Instante optimista de sesión (justo tras completar, antes del refetch). */
  takenAt: string
  /** Completaciones reales de la semana (server truth, indexadas por weekStartDateLocal + i). */
  nbWeekDays?: boolean[] | null
  /** Inicio de la semana de la INSCRIPCIÓN (snapshot.template.currentWeekStartDateLocal). */
  weekStartDateLocal?: string | null
  /** "Hoy" del servidor (snapshot.todayLocalDate). */
  todayLocalDate?: string | null
  /** Monto base real de la regla DAY_BONUS; null/undefined en API previa. */
  dailyBonusAmount?: number | null
  /** "Bonus aún ganable" (server): false = ya otorgado hoy. undefined = API previa. */
  todayBonusAvailable?: boolean
  /** Puntajes reales cargados para Liga/Evo — la burbuja ya no inventa números. */
  scores?: ScoresResponseDto
  onOpenTask: (id: ProgramTaskId) => void
  onGoEvo: () => void
  onGoChat: () => void
}) {
  const { t, lang } = useI18n()

  // La lista viene del backend cuando hay snapshot; si no, del plan local.
  const taskList = useMemo(() => {
    if (todayTasks && todayTasks.length > 0) {
      return todayTasks.map((task) => {
        const fallback = PROGRAM_TASKS.find((pt) => pt.id === task.taskCode)
        let shortText = task.short || fallback?.short || ''
        if (task.taskCode === 'podcast' && task.content?.title) {
          const durationMin = task.content.durationSecs
            ? Math.round(task.content.durationSecs / 60)
            : null
          shortText = durationMin
            ? `${task.content.title} · ${durationMin} min`
            : task.content.title
        } else if (task.taskCode === 'nut' && task.content?.title) {
          shortText = task.content.title
        } else if (task.taskCode === 'ejercicio' && task.content?.title) {
          shortText = task.content.title
        }

        return {
          id: task.taskCode as ProgramTaskId,
          title: task.title || fallback?.title || task.taskCode,
          short: shortText,
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

  // --- Nutracéutico: hora real de la última completación (server truth) ---
  // `completedAt` del servidor formateado en locale del device; `takenAt` de
  // sesión solo como instante optimista (antes de que aterrice el refetch).
  // Si no hay ninguno, "Registrado" sin hora inventada.
  const nbServerTask = todayTasks?.find((task) => task.taskCode === 'nutraceutico')
  const nbTime = useMemo(() => {
    if (nbServerTask?.completedAt) {
      const formatted = formatTaskTime(nbServerTask.completedAt, lang)
      if (formatted) return formatted
    }
    return takenAt
  }, [nbServerTask?.completedAt, takenAt, lang])

  // --- Cofre del día: verdad del snapshot cuando existe ---
  // `todayBonusAvailable === false` → bonus ya otorgado; `=== true` → aún
  // ganable; `undefined` (API previa) → derivación local legada (allDone).
  const chest = useMemo(() => {
    if (todayBonusAvailable === false) {
      return { done: true, amount: dailyBonusAmount ?? DAY_BONUS_PTS, n: null }
    }
    if (todayBonusAvailable === true) {
      return {
        done: false,
        amount: dailyBonusAmount ?? DAY_BONUS_PTS,
        n: todayTasks?.length ?? taskList.length,
      }
    }
    return { done: allDone, amount: dailyBonusAmount ?? DAY_BONUS_PTS, n: taskList.length }
  }, [todayBonusAvailable, dailyBonusAmount, todayTasks, taskList.length, allDone])

  // --- Burbuja del AI Health Coach: composición honesta desde los puntajes ---
  const hs = scores?.health_score ?? scores?.healthScore
  const ts = scores?.transformation_score ?? scores?.transformationScore
  const nutrition = hs?.dimensions?.nutrition
  const prevNutrition = hs?.dimensions_previous?.nutrition
  const bodyFat = ts?.detail
    ? (ts.detail['body_fat'] ?? ts.detail['grasa'] ?? ts.detail['% grasa'] ?? ts.detail['Grasa'])
    : undefined

  const aiBubble: ReactNode = useMemo(() => {
    if (nutrition == null) {
      // Sin puntajes reales → invitación genérica sin números (botones intactos).
      return (
        <>
          {first}, {t('cuéntame cómo fue tu semana y reviso tus indicadores contigo.')}
        </>
      )
    }
    let trend = ''
    if (prevNutrition != null) {
      if (nutrition > prevNutrition) {
        trend = t('subió de {prev}% a {cur}%', {
          prev: String(prevNutrition),
          cur: String(nutrition),
        })
      } else if (nutrition < prevNutrition) {
        trend = t('bajó de {prev}% a {cur}%', {
          prev: String(prevNutrition),
          cur: String(nutrition),
        })
      } else {
        trend = t('se mantiene en {cur}%', { cur: String(nutrition) })
      }
    }
    // Segunda oración: índice de grasa SOLO si existe un indicador real en el
    // detail de transformation_score; si no, neutra sin números.
    const bodyLine = bodyFat
      ? t('El índice de grasa está en {pct}%', { pct: String(bodyFat.current) })
      : t('Seguimos monitoreando tu composición corporal.')
    return (
      <>
        {first}, {t('tu')}{' '}
        <strong>
          {t('tu adherencia nutricional está en {pct}%', { pct: String(nutrition) })}
        </strong>
        .{trend ? ` ${trend}.` : ''} {bodyLine}
      </>
    )
  }, [nutrition, prevNutrition, bodyFat, first, t])

  // --- Franja semanal de Nutracéutico: alineada por FECHA del servidor ---
  // `nbWeekDays` está indexado por `template.currentWeekStartDateLocal + i`
  // (la semana de la INSCRIPCIÓN, no necesariamente lunes). El índice de HOY
  // se deriva con matemática de fecha pura entre las dos fechas del snapshot
  // (sin reloj ni TZ del device). Cuando no hay fechas del servidor, el índice
  // cae fuera de 0..6, o el arreglo no viene (API previa) → derivación local
  // legada con el índice device (lunes-primero).
  const serverTodayIdx = nbServerTodayIndex(weekStartDateLocal, todayLocalDate)
  const serverAligned = serverTodayIdx !== null && !!nbWeekDays && nbWeekDays.length === 7
  const stripTodayIdx = serverAligned ? (serverTodayIdx as number) : todayIdx
  const stripArray = serverAligned ? nbWeekDays : null

  // Letras visibles: derivadas de la semana del servidor (Intl 'narrow' en el
  // locale actual); sin fecha del servidor se conserva el fallback device
  // WEEK_LABELS (L..D, lunes-primero) — comportamiento documentado.
  const stripLabels = useMemo(() => {
    if (weekStartDateLocal) {
      const derived = WEEK_LABELS.map((_, i) => nbWeekLabel(weekStartDateLocal, i, lang))
      if (derived.every((l): l is string => l !== null)) return derived
    }
    return [...WEEK_LABELS]
  }, [weekStartDateLocal, lang])

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
          className={`pcard pcard-chest${chest.done ? ' done' : ''}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="pcard-chest-art" aria-hidden="true">
            <IonIcon icon={chest.done ? trophy : gift} />
          </span>
          <span className="pcard-panel">
            <span className="pcard-copy">
              <strong>{chest.done ? t('Bonus del día desbloqueado') : t('Cofre del día')}</strong>
              <small>
                {chest.done
                  ? t('Desbloqueado. Mañana se abre de nuevo.')
                  : t('Completa las {n} misiones', { n: String(chest.n) })}
              </small>
            </span>
            <span className="pcard-side">
              <span className="pcard-pts">+{chest.amount}</span>
            </span>
          </span>
        </motion.div>
      </div>

      <div className="stitle">{t('Nutracéutico')}</div>
      <div className="nb-card pg-nb">
        <div className="nb-title">
          {program.nutraceutico ? t('Dosis de hoy lista') : t('¿Ya tomaste tu Nutracéutico?')}
        </div>
        <div className="nb-sub">
          {program.nutraceutico
            ? nbTime
              ? t('Registrado a las {takenAt}', { takenAt: nbTime })
              : t('Registrado')
            : t('Producto ADRED · dosis matutina')}
        </div>
        <div className="nb-streak">
          {stripLabels.map((d, i) => {
            // `resolveNbDayOk` con el índice YA resuelto: el del servidor
            // cuando la semana del snapshot aplica (stripArray), o la
            // derivación local legada (pasado ok · futuro no · hoy = local)
            // cuando el arreglo no aplica. El estado optimista local gana
            // solo para la celda de hoy si el arreglo aún dice false.
            const ok = resolveNbDayOk(i, stripTodayIdx, stripArray, program.nutraceutico)
            return (
              <div key={`${d}-${i}`} className={`nb-day ${ok ? 'ok' : 'no'} ${i === stripTodayIdx ? 'today' : ''}`}>
                {d}
              </div>
            )
          })}
        </div>
        {!program.nutraceutico && (
          <IonButton expand="block" className="bt bt-teal" onClick={() => onOpenTask('nutraceutico')}>
            {t('Registrar dosis')}
          </IonButton>
        )}
      </div>

      <div className="stitle">{t('AI Health Coach')}</div>
      <div className="ai-wrap pg-ai">
        <div className="pg-ai-head">
          <span className="pg-ai-avatar">
            <IonIcon icon={sparkles} />
          </span>
          <div className="ai-chip">{t('ANÁLISIS SEMANAL · SEMANA {programWeek}', { programWeek: String(programWeek) })}</div>
        </div>
        <div className="ai-bubble">{aiBubble}</div>
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