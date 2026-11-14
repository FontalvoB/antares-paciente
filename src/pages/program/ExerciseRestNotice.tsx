import { IonIcon } from '@ionic/react'
import { leafOutline } from 'ionicons/icons'
import { useT } from '../../i18n/I18nContext'

/** Estado compartido por Hoy y la apertura directa de la lección de ejercicio. */
export function ExerciseRestNotice() {
  const t = useT()
  return <section className="exercise-rest" role="status">
    <IonIcon icon={leafOutline} aria-hidden="true" />
    <h2>{t('Hoy descansas del ejercicio')}</h2>
    <p>{t('Hoy no tienes una misión de ejercicio. Continúa con las demás actividades de tu programa.')}</p>
  </section>
}
