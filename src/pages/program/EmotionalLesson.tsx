import { useState } from 'react'
import { IonButton, IonIcon, IonInput, IonRange, IonTextarea } from '@ionic/react'
import { checkmarkCircleOutline, moonOutline, timeOutline } from 'ionicons/icons'
import { WEEK_BARRIERS } from '../../data/program'
import { useWearable } from '../../context/WearableContext'
import { useI18n, useT } from '../../i18n/I18nContext'
import { resolveLastNightSleep } from '../../utils/emotionalSleep'
import { toLocalISODate } from '../../utils/dates'
import type { EmotionalAssessmentPayload, TodayTaskDto } from '../../services/program/types'

export interface EmotionalLessonResult { mood: string; barrier: string; emotional: EmotionalAssessmentPayload }
const MOODS = ['Muy bajo', 'Bajo', 'Neutro', 'Bien', 'Muy bien'] as const
const QUALITIES = [{ value: 'poor', label: 'Poco reparador' }, { value: 'fair', label: 'Regular' }, { value: 'restorative', label: 'Reparador' }] as const

export function EmotionalLesson({ done, pending = false, saving = false, localDate, saved, pts, onComplete }: {
  done: boolean; pending?: boolean; saving?: boolean; localDate?: string
  saved?: TodayTaskDto['emotionalAssessment']; pts: number; onComplete: (payload: EmotionalLessonResult) => void
}) {
  const t = useT()
  const { lang } = useI18n()
  const { samples, device, syncing, lastSyncAt } = useWearable()
  const nightDate = localDate ?? toLocalISODate()
  const sleepFromDevice = resolveLastNightSleep(samples.sleep, device?.deviceId, Date.now(), nightDate)
  const [mood, setMood] = useState('')
  const [stress, setStress] = useState<number | null>(null)
  const [motivation, setMotivation] = useState<number | null>(null)
  const [sleepChoice, setSleepChoice] = useState<'auto' | 'manual' | 'unknown'>('auto')
  const [manualMinutes, setManualMinutes] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [hours, setHours] = useState('')
  const [sleepError, setSleepError] = useState(false)
  const [sleepQuality, setSleepQuality] = useState<EmotionalAssessmentPayload['sleepQuality']>()
  const [barrier, setBarrier] = useState('')
  const [note, setNote] = useState('')
  const minutes = sleepChoice === 'auto' ? sleepFromDevice?.minutes : sleepChoice === 'manual' ? manualMinutes : null
  const ready = Boolean(mood && !editing && !saving && (sleepChoice === 'unknown' || minutes != null))
  const duration = (value: number) => t('{hours} h {minutes} min', { hours: String(Math.floor(value / 60)), minutes: String(value % 60).padStart(2, '0') })
  const dateLabel = new Date(`${nightDate}T12:00:00`).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CO', { day: 'numeric', month: 'long' })

  function editSleep() {
    setHours(minutes == null ? '' : String(Math.round(minutes / 60 * 100) / 100))
    setSleepError(false)
    setEditing(true)
  }
  function applySleep() {
    const number = Number(hours.trim().replace(',', '.'))
    if (!hours.trim() || !Number.isFinite(number) || number < 0 || number > 24) { setSleepError(true); return }
    setManualMinutes(Math.round(number * 60))
    setSleepChoice('manual')
    setEditing(false)
    setSleepError(false)
  }
  function submit() {
    if (!ready) return
    const wearableSleep = sleepChoice === 'auto' ? sleepFromDevice : null
    onComplete({ mood, barrier, emotional: {
      ...(stress != null ? { stressScore: stress } : {}),
      ...(motivation != null ? { motivationScore: motivation } : {}),
      ...(minutes != null ? { sleepMinutes: minutes, sleepNightDate: nightDate } : {}),
      sleepSource: sleepChoice === 'auto' ? 'wearable' : sleepChoice,
      ...(wearableSleep ? { sleepRecordedAt: wearableSleep.recordedAt, sleepDeviceId: wearableSleep.deviceId } : {}),
      ...(sleepQuality ? { sleepQuality } : {}),
      ...(note.trim() ? { notes: note.trim() } : {}),
    } })
  }

  if (done) return <div className="emotion-saved" role="status">
    <IonIcon icon={pending ? timeOutline : checkmarkCircleOutline} />
    <h3>{t(pending ? 'Tu evaluación está pendiente de sincronización' : 'Tu evaluación de hoy está guardada')}</h3>
    <p>{t(pending ? 'Tu registro se confirmará al sincronizar con el servidor.' : 'Gracias por escuchar cómo te sientes. Tu equipo puede revisar este registro.')}</p>
    {!pending && saved && <dl className="emotion-summary">
      <div><dt>{t('Ánimo')}</dt><dd>{t(MOODS[saved.moodScore - 1] ?? 'Sin responder')}</dd></div>
      <div><dt>{t('Sueño anoche')}</dt><dd>{saved.answers.sleepMinutes != null ? duration(saved.answers.sleepMinutes) : t('Sin dato')}{saved.answers.sleepMinutes != null && <small>{t(saved.answers.sleepSource === 'wearable' ? 'Dato del wearable' : 'Añadido por ti')}</small>}</dd></div>
      {saved.answers.sleepQuality && <div><dt>{t('Descanso percibido')}</dt><dd>{t(QUALITIES.find(q => q.value === saved.answers.sleepQuality)?.label ?? 'Sin responder')}</dd></div>}
      {saved.answers.stressScore != null && <div><dt>{t('Estrés')}</dt><dd>{saved.answers.stressScore}/10</dd></div>}
      {saved.answers.motivationScore != null && <div><dt>{t('Motivación')}</dt><dd>{saved.answers.motivationScore}/10</dd></div>}
    </dl>}
  </div>

  return <div className="emotion-checkin">
    <header className="emotion-intro"><h2>{t('¿Cómo te sientes hoy?')}</h2><p>{t('Tómate un momento para registrar tu ánimo y cómo descansaste.')}</p></header>
    <fieldset className="emotion-field"><legend>{t('Tu ánimo ahora')}</legend><div className="emotion-moods">{MOODS.map((label, index) => <IonButton key={label} fill="clear" className={`emotion-mood${mood === String(index + 1) ? ' selected' : ''}`} aria-label={t(label)} aria-pressed={mood === String(index + 1)} onClick={() => setMood(String(index + 1))}><span><strong>{index + 1}</strong><small>{t(label)}</small></span></IonButton>)}</div></fieldset>
    <section className="emotion-sleep" aria-labelledby="emotion-sleep-title">
      <div className="emotion-sleep-heading"><h3 id="emotion-sleep-title"><IonIcon icon={moonOutline} />{t('Sueño anoche')}</h3><span>{sleepChoice === 'manual' ? t('Añadido por ti') : sleepChoice === 'unknown' ? t('Sin dato') : sleepFromDevice ? device?.name ?? t('Wearable') : t('Manual disponible')}</span></div>
      {minutes != null ? <><p className="emotion-night">{t('Noche que termina el {date}', { date: dateLabel })}</p><p className="emotion-duration">{duration(minutes)}</p><p className="emotion-sleep-meta">{t(sleepChoice === 'auto' ? 'Estimación del wearable' : 'Dato manual · no reemplaza el registro del wearable')}{sleepChoice === 'auto' && lastSyncAt != null && ` · ${t('Sincronizado a las {time}', { time: new Date(lastSyncAt).toLocaleTimeString(lang === 'en' ? 'en-US' : 'es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }) })}`}</p></> : <p className="emotion-sleep-empty" role="status">{t(sleepChoice === 'unknown' ? 'Guardarás tu evaluación sin horas de sueño. No registraremos cero horas.' : syncing ? 'Buscando el registro de anoche. Puedes añadir tus horas manualmente.' : samples.sleep ? 'El registro disponible no corresponde a una estimación válida de anoche. Puedes añadir tus horas manualmente.' : 'No tenemos un registro de anoche. Puedes añadir tus horas manualmente.')}</p>}
      {syncing && minutes != null && <p className="emotion-sleep-meta" role="status">{t('Actualizando el registro del wearable…')}</p>}
      <div className="emotion-sleep-actions"><IonButton fill="clear" onClick={editSleep}>{t(minutes == null ? 'Registrar mis horas' : 'Corregir este dato')}</IonButton><IonButton fill="clear" onClick={() => { setSleepChoice('unknown'); setEditing(false); setSleepError(false) }}>{t('No tengo este dato')}</IonButton></div>
      {editing && <div className="emotion-sleep-editor"><IonInput className="fld" label={t('Horas de sueño')} labelPlacement="stacked" inputmode="decimal" value={hours} onIonInput={e => { setHours(String(e.detail.value ?? '')); setSleepError(false) }} /><div><IonButton onClick={applySleep}>{t('Aplicar')}</IonButton><IonButton fill="clear" onClick={() => { setEditing(false); setSleepError(false) }}>{t('Cancelar')}</IonButton></div>{sleepError && <p className="emotion-input-error" role="alert">{t('Escribe un valor entre 0 y 24 horas.')}</p>}</div>}
    </section>
    <fieldset className="emotion-field emotion-quality"><legend>{t('¿Qué tan reparador fue tu descanso?')} <small>{t('Opcional')}</small></legend><div className="emotion-pills">{QUALITIES.map(q => <IonButton key={q.value} fill="outline" aria-pressed={sleepQuality === q.value} className={sleepQuality === q.value ? 'selected' : ''} onClick={() => setSleepQuality(sleepQuality === q.value ? undefined : q.value)}>{t(q.label)}</IonButton>)}</div><p className="emotion-help">{t('Esta es tu percepción, independiente del dato del wearable.')}</p></fieldset>
    <section className="emotion-details"><h3>{t('Cuéntanos un poco más')} <small>{t('Opcional')}</small></h3>
      <div className="emotion-range"><label>{t('Estrés')} <span>{stress == null ? t('Sin responder') : `${stress}/10`}</span></label><IonRange aria-label={t('Estrés')} min={1} max={10} step={1} snaps value={stress ?? 5} onIonInput={e => setStress(Number(e.detail.value))} /><div><span>{t('1 · Mucha calma')}</span><span>{t('10 · Mucha tensión')}</span></div></div>
      <div className="emotion-range"><label>{t('Motivación para tus hábitos')} <span>{motivation == null ? t('Sin responder') : `${motivation}/10`}</span></label><IonRange aria-label={t('Motivación')} min={1} max={10} step={1} snaps value={motivation ?? 5} onIonInput={e => setMotivation(Number(e.detail.value))} /><div><span>{t('1 · Muy poca')}</span><span>{t('10 · Mucha')}</span></div></div>
      <fieldset className="emotion-field"><legend>{t('¿Qué te ha costado esta semana?')}</legend><div className="emotion-pills">{WEEK_BARRIERS.map(b => <IonButton key={b.id} fill="outline" className={barrier === b.id ? 'selected' : ''} aria-pressed={barrier === b.id} onClick={() => setBarrier(barrier === b.id ? '' : b.id)}>{t(b.label.replace(/^\S+\s/, ''))}</IonButton>)}</div></fieldset>
      <IonTextarea className="fld emotion-note" label={t('Algo que quieras contar (opcional)')} labelPlacement="stacked" value={note} maxlength={2000} autoGrow counter onIonInput={e => setNote(e.detail.value ?? '')} />
    </section>
    <p className="emotion-privacy">{t('Tu equipo de atención puede revisar este registro. No se publica en la comunidad.')}</p>
    <IonButton expand="block" className="emotion-save" disabled={!ready} onClick={submit}>{t(saving ? 'Guardando evaluación…' : 'Guardar evaluación · +{pts} pts', { pts: String(pts) })}</IonButton>
    {!ready && !saving && <p className="emotion-save-hint">{t(!mood ? 'Selecciona tu ánimo para continuar.' : editing ? 'Aplica o cancela la corrección de sueño para continuar.' : 'Escribe tus horas o elige «No tengo este dato».')}</p>}
  </div>
}
