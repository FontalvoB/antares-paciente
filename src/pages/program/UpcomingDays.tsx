import { IonAccordion, IonAccordionGroup, IonBadge, IonItem, IonLabel, IonList } from '@ionic/react'
import { PROGRAM_TASKS } from '../../data/program'
import { useT } from '../../i18n/I18nContext'
import type { ProgramUpcomingDayDto } from '../../services/program/types'
import { formatDateForDisplay } from '../../utils/dates'

/** Calendario de solo lectura: las misiones futuras nunca abren ni completan las de hoy. */
export function UpcomingDays({ days }: { days?: readonly ProgramUpcomingDayDto[] | null }) {
  const t = useT()
  if (!days?.length) return null

  return <section className="pg-upcoming" aria-label={t('Lo que viene')}>
    <h2>{t('Lo que viene')}</h2>
    <p>{t('Próximos días de tu programa')}</p>
    <IonAccordionGroup>
      {days.slice(0, 6).map(day => <IonAccordion key={day.date} value={day.date}>
        <IonItem slot="header" lines="full">
          <IonLabel className="ion-text-wrap">
            <h3><time dateTime={day.date}>{formatDateForDisplay(day.date)}</time></h3>
            <p>{t('Día {day} · Semana {week}', { day: String(day.day), week: String(day.weekNumber) })}</p>
          </IonLabel>
          {day.rest === true && <IonBadge slot="end">{t('Descanso de ejercicio')}</IonBadge>}
        </IonItem>
        <IonList slot="content" lines="none">
          {day.missions.map(mission => {
            const task = PROGRAM_TASKS.find(item => item.id === mission.type)
            const label = t(task?.title ?? mission.type)
            // Si el título clínico repite la etiqueta de la misión, se muestra una sola línea.
            const repeated = label.trim().toLowerCase() === mission.title.trim().toLowerCase()
            return <IonItem key={mission.type} className={`pg-up-mission tone-${task?.tone ?? 'blue'}`}>
              <span className="pg-up-dot" slot="start" aria-hidden="true" />
              <IonLabel className="ion-text-wrap">
                {!repeated && <p>{label}</p>}
                <h3>{mission.title}</h3>
                {mission.contentUnavailable && <p role="status">{t('Tu equipo está preparando este contenido.')}</p>}
              </IonLabel>
            </IonItem>
          })}
        </IonList>
      </IonAccordion>)}
    </IonAccordionGroup>
  </section>
}
