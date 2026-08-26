import { useEffect, useMemo, useRef, useState } from 'react'
import {
  IonButton,
  IonChip,
  IonIcon,
  IonInput,
  IonProgressBar,
  IonRange,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTextarea,
} from '@ionic/react'
import {
  bluetooth,
  checkmark,
  checkmarkCircle,
  heart,
  pause,
  play,
  playBack,
  playForward,
} from 'ionicons/icons'
import {
  BARRIER_REPLY,
  CIRCUIT_STEPS,
  EMOTION_FACES,
  NB_WEEK_SEED,
  PODCAST_EPISODE,
  TODAY_PLAN,
  VITAL_FIELDS,
  WEEK_BARRIERS,
  WEEK_LABELS,
} from '../../data/program'
import { weekdayMondayIndex } from '../../utils/dates'
import { useT } from '../../i18n/I18nContext'

function mmss(sec: number) {
  const s = Math.max(0, Math.floor(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function vitalNumber(raw: string) {
  if (!raw.trim()) return NaN
  if (raw.includes('/')) return parseFloat(raw.split('/')[0])
  return parseFloat(raw.replace(',', '.'))
}

function vitalStatus(raw: string, lo: number, hi: number, t: (s: string) => string) {
  const n = parseFloat(raw.replace('/', '.'))
  if (!raw.trim() || Number.isNaN(n)) return { label: '—', cls: '' }
  if (n < lo) return { label: t('Bajo'), cls: 'warn' }
  if (n > hi) return { label: t('Alto'), cls: 'warn' }
  return { label: t('En rango'), cls: 'ok' }
}

function EcgLive() {
  const d =
    'M0 36 H28 L36 36 L42 18 L50 58 L58 36 H96 L104 36 L110 12 L118 60 L126 36 H168 L176 36 L182 20 L190 54 L198 36 H240 L248 36 L254 14 L262 58 L270 36 H312 L320 36 L326 22 L334 52 L342 36 H360'
  return (
    <svg className="vt-ecg" viewBox="0 0 360 72" aria-hidden="true">
      <path className="vt-ecg-base" d={d} />
      <path className="vt-ecg-line" d={d} />
    </svg>
  )
}

export function PodcastLesson({
  done,
  pts,
  playing,
  progress,
  onToggle,
  onSkip,
  onComplete,
}: {
  done: boolean
  pts: number
  playing: boolean
  progress: number
  onToggle: () => void
  onSkip: (delta: number) => void
  onComplete: () => void
}) {
  const t = useT()
  const elapsed = progress * PODCAST_EPISODE.durationSec
  const chapter = [...PODCAST_EPISODE.chapters].reverse().find((c) => elapsed >= c.at) ?? PODCAST_EPISODE.chapters[0]

  return (
    <div className="lsn-stack">
      <div className="pod-stage">
        <div className="pod-wave" aria-hidden="true">
          {Array.from({ length: 22 }, (_, i) => (
            <span
              key={i}
              className={playing ? 'on' : undefined}
              style={{ animationDelay: `${i * 0.05}s`, height: `${18 + ((i * 17) % 28)}px` }}
            />
          ))}
        </div>
        <div className="pod-now">{t(chapter.label)}</div>
        <div className="pod-times">
          <span>{mmss(elapsed)}</span>
          <span>{mmss(PODCAST_EPISODE.durationSec)}</span>
        </div>
        <IonProgressBar value={progress} className="pb" />
      </div>

      <div className="pod-copy">
        <strong>{t(PODCAST_EPISODE.title)}</strong>
        <span>
          {PODCAST_EPISODE.host} · {t(PODCAST_EPISODE.blurb)}
        </span>
      </div>

      <div className="pod-transport">
        <IonButton fill="clear" aria-label={t('Retroceder 15 segundos')} onClick={() => onSkip(-15)} disabled={done}>
          <IonIcon slot="icon-only" icon={playBack} />
        </IonButton>
        <IonButton className="bt bt-pur pod-play" onClick={onToggle} disabled={done}>
          <IonIcon icon={playing ? pause : play} slot="start" />
          {playing ? t('Pausar') : progress >= 1 ? t('Repetir') : t('Reproducir')}
        </IonButton>
        <IonButton fill="clear" aria-label={t('Adelantar 15 segundos')} onClick={() => onSkip(15)} disabled={done}>
          <IonIcon slot="icon-only" icon={playForward} />
        </IonButton>
      </div>

      <div className="lsn-chapters">
        {PODCAST_EPISODE.chapters.map((c) => (
          <button
            key={c.at}
            type="button"
            className={`lsn-chip ${elapsed >= c.at ? 'on' : ''}`}
            onClick={() => onSkip(c.at - elapsed)}
          >
            {mmss(c.at)} · {t(c.label)}
          </button>
        ))}
      </div>

      <div className="lsn-tips">
        {PODCAST_EPISODE.takeaways.map((tip) => (
          <div key={tip}>✓ {t(tip)}</div>
        ))}
      </div>

      {!done && (
        <IonButton expand="block" className="bt bt-primary" disabled={progress < 0.7} onClick={onComplete}>
          {progress < 0.7 ? t('Escucha el 70% · vas {pct}%', { pct: String(Math.round(progress * 100)) }) : t('Marcar escuchado · +{pts} pts', { pts: String(pts) })}
        </IonButton>
      )}
    </div>
  )
}

export function VitalsLesson({
  done,
  pts,
  watchConnected,
  onConnectWatch,
  onComplete,
}: {
  done: boolean
  pts: number
  watchConnected: boolean
  onConnectWatch: () => void
  onComplete: () => void
}) {
  const t = useT()
  const [vals, setVals] = useState<Record<string, string>>({})
  const [syncing, setSyncing] = useState(false)
  const syncRef = useRef<number | null>(null)
  const filled = VITAL_FIELDS.filter((f) => (vals[f.id] ?? '').trim()).length

  useEffect(
    () => () => {
      if (syncRef.current) window.clearInterval(syncRef.current)
    },
    [],
  )

  const sync = () => {
    if (done || syncing) return
    setSyncing(true)
    let i = 0
    syncRef.current = window.setInterval(() => {
      const f = VITAL_FIELDS[i]
      setVals((prev) => ({ ...prev, [f.id]: f.watch }))
      i += 1
      if (i >= VITAL_FIELDS.length) {
        if (syncRef.current) window.clearInterval(syncRef.current)
        syncRef.current = null
        setSyncing(false)
      }
    }, 170)
  }

  return (
    <div className="lsn-stack vt-lesson">
      <section className="vt-hero">
        <div className="vt-hero-top">
          <span className="vt-heart">
            <IonIcon icon={heart} />
          </span>
          <div>
            <div className="vt-kicker">{t('Check-in clínico')}</div>
            <strong>{t('Signos de ahora')}</strong>
          </div>
          <div className="vt-count">
            <b>{filled}</b>
            <small>/6</small>
          </div>
        </div>
        <EcgLive />
        <p>{t('Compara con ayer. La tendencia importa más que un solo número.')}</p>
      </section>

      {watchConnected ? (
        <button type="button" className="vt-sync" onClick={sync} disabled={done || syncing}>
          <span className={`vt-sync-orb ${syncing ? 'on' : ''}`}>
            {syncing ? <IonSpinner name="crescent" /> : <IonIcon icon={bluetooth} />}
          </span>
          <span className="vt-sync-copy">
            <strong>{syncing ? t('Leyendo el reloj…') : t('Sincronizar ANTARES Watch')}</strong>
            <small>{syncing ? t('FC, SpO2, presión y más') : t('Autollenar con la última medición')}</small>
          </span>
        </button>
      ) : (
        <button type="button" className="vt-sync" onClick={onConnectWatch}>
          <span className="vt-sync-orb">
            <IonIcon icon={bluetooth} />
          </span>
          <span className="vt-sync-copy">
            <strong>{t('Conectar reloj')}</strong>
            <small>{t('Autollenar FC, SpO2, presión y peso')}</small>
          </span>
        </button>
      )}

      <div className="vt-grid">
        {VITAL_FIELDS.map((f) => {
          const v = vals[f.id] ?? ''
          const n = vitalNumber(v)
          const st = vitalStatus(v, f.lo, f.hi, t)
          const span = f.hi - f.lo || 1
          const pct = Number.isNaN(n) ? null : Math.min(100, Math.max(0, ((n - f.lo) / span) * 100))
          return (
            <article key={f.id} className={`vt-tile ${st.cls} ${v ? 'has' : ''}`}>
              <header>
                <span className="vt-emoji">{f.emoji}</span>
                <span className="vt-label">{t(f.label)}</span>
                {st.cls === 'ok' && <IonIcon icon={checkmarkCircle} className="vt-ok-ico" />}
              </header>
              <div className="vt-value">
                <IonInput
                  className="vt-input"
                  placeholder="—"
                  inputmode="decimal"
                  value={v}
                  disabled={done}
                  aria-label={t(f.label)}
                  onIonInput={(e) => setVals((prev) => ({ ...prev, [f.id]: e.detail.value ?? '' }))}
                />
                <em>{f.unit}</em>
              </div>
              <div className="vt-range" aria-hidden="true">
                <i style={{ left: pct === null ? '-8px' : `${pct}%`, opacity: pct === null ? 0 : 1 }} />
              </div>
              <footer>
                <span className={st.cls || undefined}>{st.label}</span>
                <span>{t('Ayer')} {f.demo}</span>
              </footer>
            </article>
          )
        })}
      </div>

      {!done && (
        <IonButton expand="block" className="bt bt-primary" disabled={filled < 4} onClick={onComplete}>
          {filled < 4 ? t('Registra al menos 4 signos ({filled}/6)', { filled: String(filled) }) : t('Guardar signos · +{pts} pts', { pts: String(pts) })}
        </IonButton>
      )}
    </div>
  )
}

export function NutritionLesson({
  done,
  pts,
  mealsLogged,
  onGoPlan,
  onComplete,
}: {
  done: boolean
  pts: number
  mealsLogged: string[]
  onGoPlan: () => void
  onComplete: () => void
}) {
  const t = useT()
  const kcal = TODAY_PLAN.filter((m) => mealsLogged.includes(m.id)).reduce((s, m) => s + m.kcal, 0)
  const pct = mealsLogged.length / TODAY_PLAN.length

  return (
    <div className="lsn-stack">
      <div className="nut-hero">
        <div>
          <div className="kicker" style={{ color: 'var(--teal-d)' }}>
            {t('Plan mediterráneo')}
          </div>
          <strong>1,800 kcal · 90 g proteína</strong>
          <span>{t('Hoy llevas {kcal} kcal registradas · {pct}% de comidas', { kcal: String(kcal), pct: String(Math.round(pct * 100)) })}</span>
        </div>
        <div className="nut-ring" aria-hidden="true">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="24" fill="none" stroke="var(--g1)" strokeWidth="7" />
            <circle
              cx="32"
              cy="32"
              r="24"
              fill="none"
              stroke="var(--teal)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${pct * 150.8} 150.8`}
              transform="rotate(-90 32 32)"
            />
          </svg>
          <b>{Math.round(pct * 100)}%</b>
        </div>
      </div>
      <div className="lsn-warn">{t('Proteínas 68 g vs meta 90 g · suma una fuente magra en almuerzo o cena.')}</div>
      {TODAY_PLAN.map((m) => (
        <div key={m.id} className={`lsn-meal ${mealsLogged.includes(m.id) ? 'on' : ''}`}>
          <span className="lsn-meal-ico">{m.emoji}</span>
          <div>
            <strong>{t(m.title)}</strong>
            <span>
              {t(m.items)} · {m.kcal} kcal
            </span>
          </div>
          <em>{mealsLogged.includes(m.id) ? '✓' : ''}</em>
        </div>
      ))}
      <IonButton expand="block" className="bt bt-teal" onClick={onGoPlan}>
        {t('Ir a registrar comidas')}
      </IonButton>
      {!done && mealsLogged.length >= 2 && (
        <IonButton expand="block" className="bt bt-gold" onClick={onComplete}>
          {t('Validar adherencia · +{pts} pts', { pts: String(pts) })}
        </IonButton>
      )}
      {!done && mealsLogged.length < 2 && (
        <p className="lesson-hint">{t('Registra al menos 2 comidas del plan para validar el día.')}</p>
      )}
    </div>
  )
}

export function ExerciseLesson({
  done,
  pts,
  step,
  left,
  running,
  onToggle,
  onSkip,
  onComplete,
}: {
  done: boolean
  pts: number
  step: number
  left: number
  running: boolean
  onToggle: () => void
  onSkip: () => void
  onComplete: () => void
}) {
  const t = useT()
  const cur = CIRCUIT_STEPS[step]
  const total = CIRCUIT_STEPS.reduce((s, x) => s + x.sec, 0)
  const doneSec =
    CIRCUIT_STEPS.slice(0, step).reduce((s, x) => s + x.sec, 0) + (cur.sec - left)
  const ring = cur ? 1 - left / cur.sec : 1

  return (
    <div className="lsn-stack">
      <div className="ex-timer">
        <div className="ex-ring-wrap">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r="58" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="10" />
            <circle
              cx="70"
              cy="70"
              r="58"
              fill="none"
              stroke="var(--ice)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${ring * 364.4} 364.4`}
              transform="rotate(-90 70 70)"
            />
          </svg>
          <div className="ex-ring-center">
            <div className="kicker" style={{ color: 'var(--ice)' }}>
              {step + 1} / {CIRCUIT_STEPS.length}
            </div>
            <div className="display ex-clock">{mmss(left)}</div>
          </div>
        </div>
        <div className="ex-step-name">{t(cur.name)}</div>
        <div className="ex-step-cue">{t(cur.cue)}</div>
        <div className="ex-total">{t('Sesión')} {mmss(doneSec)} / {mmss(total)}</div>
      </div>

      <div className="ex-list">
        {CIRCUIT_STEPS.map((s, i) => (
          <div key={s.name} className={`ex-li ${i < step ? 'done' : ''} ${i === step ? 'now' : ''}`}>
            <b>{i < step ? '✓' : i + 1}</b>
            <div>
              <strong>{t(s.name)}</strong>
              <span>{mmss(s.sec)}</span>
            </div>
          </div>
        ))}
      </div>

      {!done && (
        <>
          <IonButton expand="block" className="bt bt-pur" onClick={onToggle}>
            {running ? t('Pausar') : step === 0 && left === CIRCUIT_STEPS[0].sec ? t('Iniciar circuito') : t('Continuar')}
          </IonButton>
          <IonButton expand="block" className="bt bt-ghost" onClick={onSkip}>
            {t('Saltar estación')}
          </IonButton>
          <IonButton expand="block" className="bt bt-gold" onClick={onComplete}>
            {t('Ya lo hice · +{pts} pts', { pts: String(pts) })}
          </IonButton>
        </>
      )}
    </div>
  )
}

export function NutribioticLesson({
  done,
  pts,
  takenAt,
  slot,
  onSlot,
  onComplete,
}: {
  done: boolean
  pts: number
  takenAt: string
  slot: string
  onSlot: (v: string) => void
  onComplete: () => void
}) {
  const t = useT()
  const todayIdx = weekdayMondayIndex()
  return (
    <div className="lsn-stack">
      <div className="nb-card">
        <div className="nb-title">{t('¿Ya tomaste tu Nutribiótico?')}</div>
        <div className="nb-sub">{done ? t('Registrado · {takenAt}', { takenAt }) : t('Producto ADRED · 1 cápsula con el desayuno')}</div>
        <IonSegment value={slot} onIonChange={(e) => onSlot(String(e.detail.value))} disabled={done}>
          <IonSegmentButton value="manana">{t('Mañana')}</IonSegmentButton>
          <IonSegmentButton value="tarde">{t('Tarde')}</IonSegmentButton>
          <IonSegmentButton value="noche">{t('Noche')}</IonSegmentButton>
        </IonSegment>
        <div className="nb-streak">
          {WEEK_LABELS.map((d, i) => {
            const ok = i === todayIdx ? done : NB_WEEK_SEED[i]
            return (
              <div key={d} className={`nb-day ${ok ? 'ok' : 'no'} ${i === todayIdx ? 'today' : ''}`}>
                {d}
              </div>
            )
          })}
        </div>
        {!done ? (
          <IonButton expand="block" className="bt bt-teal" onClick={onComplete}>
            {t('Sí, ya lo tomé · +{pts} pts', { pts: String(pts) })}
          </IonButton>
        ) : (
          <div className="lesson-done-banner">{t('Dosis de hoy confirmada')}</div>
        )}
      </div>
    </div>
  )
}

export function EmotionalLesson({
  done,
  pts,
  onComplete,
}: {
  done: boolean
  pts: number
  onComplete: (payload: { mood: string; barrier: string }) => void
}) {
  const t = useT()
  const [mood, setMood] = useState('')
  const [stress, setStress] = useState(5)
  const [motivation, setMotivation] = useState(8)
  const [sleep, setSleep] = useState('')
  const [barrier, setBarrier] = useState('')
  const [note, setNote] = useState('')
  const reply = barrier ? t(BARRIER_REPLY[barrier]) : ''
  const ready = Boolean(mood && sleep && barrier)

  const stressLabel = useMemo(() => (stress <= 3 ? t('Bajo') : stress <= 6 ? t('Moderado') : t('Alto')), [stress, t])

  return (
    <div className="lsn-stack">
      <p className="lesson-q">{t('¿Cómo está tu ánimo ahora?')}</p>
      <div className="mood-row">
        {EMOTION_FACES.map((m) => (
          <button key={m.v} type="button" className={`mood-face ${mood === m.v ? 'sel' : ''}`} onClick={() => setMood(m.v)}>
            <span>{m.face}</span>
            <small>{t(m.label)}</small>
          </button>
        ))}
      </div>

      <p className="lesson-q">{t('Estrés')} · {stressLabel}</p>
      <IonRange min={1} max={10} step={1} snaps value={stress} disabled={done} onIonInput={(e) => setStress(Number(e.detail.value))} />

      <p className="lesson-q">{t('Motivación')} · {motivation}/10</p>
      <IonRange min={1} max={10} step={1} snaps value={motivation} disabled={done} onIonInput={(e) => setMotivation(Number(e.detail.value))} />

      <p className="lesson-q">{t('Sueño anoche')}</p>
      <IonSegment value={sleep} onIonChange={(e) => setSleep(String(e.detail.value ?? ''))} disabled={done}>
        <IonSegmentButton value="5">≤5 h</IonSegmentButton>
        <IonSegmentButton value="6">6–7 h</IonSegmentButton>
        <IonSegmentButton value="8">≥8 h</IonSegmentButton>
      </IonSegment>

      <p className="lesson-q">{t('¿Qué fue lo más difícil esta semana?')}</p>
      <div className="barrier-opts">
        {WEEK_BARRIERS.map((b) => (
          <IonChip key={b.id} className={barrier === b.id ? 'sel' : undefined} onClick={() => !done && setBarrier(b.id)}>
            {t(b.label)}
          </IonChip>
        ))}
      </div>
      {reply && <div className="lsn-ai">{reply}</div>}

      <IonTextarea
        className="fld post-tx"
        value={note}
        disabled={done}
        placeholder={t('Nota opcional para tu psicóloga')}
        autoGrow
        onIonInput={(e) => setNote(e.detail.value ?? '')}
      />

      {!done && (
        <IonButton expand="block" className="bt bt-primary" disabled={!ready} onClick={() => onComplete({ mood, barrier })}>
          <IonIcon icon={checkmark} slot="start" />
          {t('Guardar evaluación · +{pts} pts', { pts: String(pts) })}
        </IonButton>
      )}
    </div>
  )
}

export type ProgramTab = 'hoy' | 'racha' | 'evo'
