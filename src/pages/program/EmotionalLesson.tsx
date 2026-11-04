import { useState } from 'react'
import { IonButton, IonIcon, IonInput, IonRange, IonTextarea } from '@ionic/react'
import { checkmarkCircleOutline, heartOutline, moonOutline, watchOutline, timeOutline } from 'ionicons/icons'
import { EMOTION_FACES, WEEK_BARRIERS } from '../../data/program'
import { useWearable } from '../../context/WearableContext'
import { useT } from '../../i18n/I18nContext'
import { resolveLastNightSleep } from '../../utils/emotionalSleep'
import type { EmotionalAssessmentPayload } from '../../services/program/types'

export interface EmotionalLessonResult { mood: string; barrier: string; emotional: EmotionalAssessmentPayload }

export function EmotionalLesson({ done, pending = false, pts, onComplete }: { done: boolean; pending?: boolean; pts: number; onComplete: (payload: EmotionalLessonResult) => void }) {
  const t = useT()
  const { samples, device } = useWearable()
  const sleepFromDevice = resolveLastNightSleep(samples.sleep, device?.deviceId)
  const [mood, setMood] = useState('')
  const [stress, setStress] = useState<number | null>(null)
  const [motivation, setMotivation] = useState<number | null>(null)
  const [hours, setHours] = useState('')
  const [sleepSource, setSleepSource] = useState<'manual' | 'wearable'>('manual')
  const [selectedSleep, setSelectedSleep] = useState<{ minutes: number; recordedAt: string } | null>(null)
  const [barrier, setBarrier] = useState('')
  const [note, setNote] = useState('')
  const sleepMinutes = sleepSource === 'wearable' ? selectedSleep?.minutes : hours.trim() ? Number(hours.replace(',', '.')) * 60 : NaN
  const ready = Boolean(mood && Number.isFinite(sleepMinutes) && sleepMinutes! >= 0 && sleepMinutes! <= 1440)

  if (done) return <div className="protocol-reflection protocol-saved" role="status"><IonIcon icon={pending ? timeOutline : checkmarkCircleOutline} /><h3>{t(pending ? 'Tu evaluación está pendiente de sincronización' : 'Tu evaluación de hoy está guardada')}</h3><p>{t(pending ? 'Tu registro se confirmará al sincronizar con el servidor.' : 'Gracias por escuchar cómo te sientes. Tu equipo puede revisar este registro.')}</p></div>

  return <div className="lsn-stack protocol-reflection">
    <section className="protocol-note"><IonIcon icon={heartOutline} /><div><h3>{t('Un momento para ti')}</h3><p>{t('No hay respuestas correctas. Cuéntanos cómo estás hoy para acompañarte mejor.')}</p></div></section>
    <fieldset className="protocol-fieldset"><legend>{t('¿Cómo está tu ánimo ahora?')}</legend><div className="mood-row">{EMOTION_FACES.map(m => <IonButton key={m.v} fill="clear" className={`mood-face ${mood === m.v ? 'sel' : ''}`} aria-pressed={mood === m.v} onClick={() => setMood(m.v)}><span className="protocol-mood-choice"><span aria-hidden="true">{m.face}</span><small>{t(m.label)}</small></span></IonButton>)}</div></fieldset>
    <section className="protocol-question"><h3>{t('Estrés')} <strong>{stress == null ? t('Sin responder') : `${stress}/10`}</strong></h3><p>{t('De mucha calma a mucha tensión.')}</p><IonRange aria-label={t('Estrés')} min={1} max={10} step={1} snaps value={stress ?? 5} onIonInput={e => setStress(Number(e.detail.value))} /></section>
    <section className="protocol-question"><h3>{t('Motivación')} <strong>{motivation == null ? t('Sin responder') : `${motivation}/10`}</strong></h3><p>{t('¿Con cuánta energía te sientes para tus hábitos?')}</p><IonRange aria-label={t('Motivación')} min={1} max={10} step={1} snaps value={motivation ?? 5} onIonInput={e => setMotivation(Number(e.detail.value))} /></section>
    <section className="protocol-question"><h3><IonIcon icon={moonOutline} /> {t('Sueño anoche')}</h3>
      {sleepFromDevice && <div className="protocol-sleep-suggestion"><IonIcon icon={watchOutline} /><p>{t('Tu wearable registró {hours} h de sueño.', { hours: String(Math.round(sleepFromDevice.minutes / 6) / 10) })}</p><IonButton fill="outline" onClick={() => { setSelectedSleep(sleepFromDevice); setSleepSource('wearable'); setHours(String(Math.round(sleepFromDevice.minutes / 6) / 10)) }}>{t('Usar dato de mi wearable')}</IonButton></div>}
      <IonInput className="fld" label={t('Horas de sueño')} labelPlacement="stacked" inputmode="decimal" value={hours} onIonInput={e => { setHours(String(e.detail.value ?? '')); setSleepSource('manual'); setSelectedSleep(null) }} />
      <small>{sleepSource === 'wearable' ? t('Dato del wearable seleccionado. Puedes corregirlo.') : t('Escribe entre 0 y 24 horas. También puedes usar decimales.')}</small>
    </section>
    <fieldset className="protocol-fieldset"><legend>{t('¿Qué fue lo más difícil esta semana?')}</legend><p>{t('Opcional: elige lo que más te haya costado.')}</p><div className="protocol-barriers">{WEEK_BARRIERS.map(b => <IonButton key={b.id} fill={barrier === b.id ? 'solid' : 'outline'} aria-pressed={barrier === b.id} onClick={() => setBarrier(barrier === b.id ? '' : b.id)}>{t(b.label)}</IonButton>)}</div></fieldset>
    <IonTextarea className="fld" label={t('Nota opcional para tu equipo')} labelPlacement="stacked" value={note} maxlength={2000} autoGrow counter onIonInput={e => setNote(e.detail.value ?? '')} />
    <p className="protocol-privacy">{t('Este registro se comparte con tu equipo de atención, no con la comunidad.')}</p>
    <IonButton expand="block" className="bt bt-primary" disabled={!ready} onClick={() => onComplete({ mood, barrier, emotional: { ...(stress != null ? { stressScore: stress } : {}), ...(motivation != null ? { motivationScore: motivation } : {}), sleepMinutes: sleepMinutes!, sleepSource, ...(sleepSource === 'wearable' && selectedSleep ? { sleepRecordedAt: selectedSleep.recordedAt } : {}), ...(note.trim() ? { notes: note.trim() } : {}) } })}><IonIcon icon={checkmarkCircleOutline} slot="start" />{t('Guardar evaluación · +{pts} pts', { pts: String(pts) })}</IonButton>
  </div>
}
