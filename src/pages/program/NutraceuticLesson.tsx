import { IonButton, IonIcon } from '@ionic/react'
import { checkmarkCircleOutline, leafOutline, peopleOutline, shieldCheckmarkOutline, timeOutline, sparklesOutline } from 'ionicons/icons'
import { MISSION_PHOTOS } from '../../data/missionPhotos'
import { WEEK_LABELS } from '../../data/program'
import { weekdayMondayIndex } from '../../utils/dates'
import { resolveNbDayOk } from '../../utils/nbWeekDays'
import { useI18n } from '../../i18n/I18nContext'

export function NutraceuticLesson({ done, pending = false, pts, takenAt, recordedAt, nbWeekDays, dayNumber, onComplete, onShare }: {
  done: boolean; pending?: boolean; pts: number; takenAt: string; recordedAt?: string | null; nbWeekDays?: boolean[] | null; dayNumber?: number | null
  onComplete: () => void; onShare?: () => void
}) {
  const { t, lang } = useI18n()
  const today = weekdayMondayIndex()
  const timestamp = recordedAt ? new Date(recordedAt) : null
  const time = timestamp && Number.isFinite(timestamp.getTime()) ? timestamp.toLocaleTimeString(lang === 'en' ? 'en-US' : 'es-ES', { hour: 'numeric', minute: '2-digit' }) : takenAt
  return <div className="lsn-stack nutraceutic-detail">
    {dayNumber != null && dayNumber > 0 && <section className="nutraceutic-day-celebration" aria-label={t('Día {day} para estar más sano', { day: String(dayNumber) })}>
      <div className="nutraceutic-day-topline"><IonIcon icon={sparklesOutline} aria-hidden="true" /><span>{t('HOY ELIGES CUIDARTE')}</span></div>
      <div className="nutraceutic-day-number"><span>{t('Día')}</span><strong>{dayNumber}</strong></div>
      <h2>{t('Para estar más sano')}</h2><p>{t('Un día más de constancia. Un paso que cuenta para ti.')}</p>
    </section>}
    <section className="nutraceutic-cover"><img src={MISSION_PHOTOS.nutraceutico} alt={t('Nutracéutico: imagen de referencia')} /><span>{t('Imagen de referencia')}</span></section>
    <section className="nutraceutic-intro"><span className="protocol-eyebrow"><IonIcon icon={leafOutline} />{t('Un hábito para cuidar de ti')}</span><h2>{t('Tu bienestar se construye cada día')}</h2><p>{t('Sigue la dosis y las indicaciones que te dio tu profesional de salud.')}</p></section>
    <div className="protocol-note"><IonIcon icon={shieldCheckmarkOutline} /><p>{t('Registra únicamente la toma que ya realizaste. Si tienes dudas sobre tu producto, consulta a tu equipo de atención.')}</p></div>
    <section className="protocol-question"><h3>{pending ? t('Pendiente de sincronización') : done ? t('Tu registro de hoy') : t('Registra tu toma de hoy')}</h3>{done && !pending && <p>{time ? t('Registrado · {takenAt}', { takenAt: time }) : t('Registrado')}</p>}
      <p className="protocol-small">{t('Esta semana, una toma registrada a la vez.')}</p><div className="nb-streak">{WEEK_LABELS.map((day, index) => <div key={day} className={`nb-day ${resolveNbDayOk(index, today, nbWeekDays, done) ? 'ok' : 'no'} ${index === today ? 'today' : ''}`} aria-label={t('Día {day}: {status}', { day: t(day), status: resolveNbDayOk(index, today, nbWeekDays, done) ? t('Registrado') : t('Sin registro') })}>{t(day)}</div>)}</div>
    </section>
    {!done ? <IonButton expand="block" className="bt bt-primary" onClick={onComplete}><IonIcon slot="start" icon={checkmarkCircleOutline} />{t('Sí, ya lo tomé · +{pts} pts', { pts: String(pts) })}</IonButton> : <div className={`lesson-done-banner ${pending ? 'is-pending' : ''}`}><IonIcon icon={pending ? timeOutline : checkmarkCircleOutline} />{pending ? t('Tu registro se confirmará al sincronizar con el servidor.') : t('Dosis de hoy confirmada')}</div>}
    {done && !pending && onShare && <section className="nutraceutic-share"><IonIcon icon={peopleOutline} /><h3>{t('Celebra tu constancia')}</h3><p>{t('Si quieres, comparte este hábito con la comunidad. Podrás revisar el mensaje antes de publicarlo.')}</p><IonButton expand="block" fill="outline" onClick={onShare}>{t('Preparar publicación')}</IonButton></section>}
  </div>
}
