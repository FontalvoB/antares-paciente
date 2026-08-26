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

function mmss(sec: number) {
  const s = Math.max(0, Math.floor(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function vitalNumber(raw: string) {
  if (!raw.trim()) return NaN
  if (raw.includes('/')) return parseFloat(raw.split('/')[0])
  return parseFloat(raw.replace(',', '.'))
}

function vitalStatus(raw: string, lo: number, hi: number) {
  const n = vitalNumber(raw)
  if (Number.isNaN(n)) return { label: 'Pendiente', cls: '' }
  if (n < lo) return { label: 'Bajo', cls: 'warn' }
  if (n > hi) return { label: 'Alto', cls: 'warn' }
  return { label: 'En rango', cls: 'ok' }
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
        <div className="pod-now">{chapter.label}</div>
        <div className="pod-times">
          <span>{mmss(elapsed)}</span>
          <span>{mmss(PODCAST_EPISODE.durationSec)}</span>
        </div>
        <IonProgressBar value={progress} className="pb" />
      </div>

      <div className="pod-copy">
        <strong>{PODCAST_EPISODE.title}</strong>
        <span>
          {PODCAST_EPISODE.host} · {PODCAST_EPISODE.blurb}
        </span>
      </div>

      <div className="pod-transport">
        <IonButton fill="clear" aria-label="Retroceder 15 segundos" onClick={() => onSkip(-15)} disabled={done}>
          <IonIcon slot="icon-only" icon={playBack} />
        </IonButton>
        <IonButton className="bt bt-pur pod-play" onClick={onToggle} disabled={done}>
          <IonIcon icon={playing ? pause : play} slot="start" />
          {playing ? 'Pausar' : progress >= 1 ? 'Repetir' : 'Reproducir'}
        </IonButton>
        <IonButton fill="clear" aria-label="Adelantar 15 segundos" onClick={() => onSkip(15)} disabled={done}>
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
            {mmss(c.at)} · {c.label}
          </button>
        ))}
      </div>

      <div className="lsn-tips">
        {PODCAST_EPISODE.takeaways.map((t) => (
          <div key={t}>✓ {t}</div>
        ))}
      </div>

      {!done && (
        <IonButton expand="block" className="bt bt-primary" disabled={progress < 0.7} onClick={onComplete}>
          {progress < 0.7 ? `Escucha el 70% · vas ${Math.round(progress * 100)}%` : `Marcar escuchado · +${pts} pts`}
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
            <div className="vt-kicker">Check-in clínico</div>
            <strong>Signos de ahora</strong>
          </div>
          <div className="vt-count">
            <b>{filled}</b>
            <small>/6</small>
          </div>
        </div>
        <EcgLive />
        <p>Compara con ayer. La tendencia importa más que un solo número.</p>
      </section>

      {watchConnected ? (
        <button type="button" className="vt-sync" onClick={sync} disabled={done || syncing}>
          <span className={`vt-sync-orb ${syncing ? 'on' : ''}`}>
            {syncing ? <IonSpinner name="crescent" /> : <IonIcon icon={bluetooth} />}
          </span>
          <span className="vt-sync-copy">
            <strong>{syncing ? 'Leyendo el reloj…' : 'Sincronizar ANTARES Watch'}</strong>
            <small>{syncing ? 'FC, SpO2, presión y más' : 'Autollenar con la última medición'}</small>
          </span>
        </button>
      ) : (
        <button type="button" className="vt-sync" onClick={onConnectWatch}>
          <span className="vt-sync-orb">
            <IonIcon icon={bluetooth} />
          </span>
          <span className="vt-sync-copy">
            <strong>Conectar reloj</strong>
            <small>Autollenar FC, SpO2, presión y peso</small>
          </span>
        </button>
      )}

      <div className="vt-grid">
        {VITAL_FIELDS.map((f) => {
          const v = vals[f.id] ?? ''
          const n = vitalNumber(v)
          const st = vitalStatus(v, f.lo, f.hi)
          const span = f.hi - f.lo || 1
          const pct = Number.isNaN(n) ? null : Math.min(100, Math.max(0, ((n - f.lo) / span) * 100))
          return (
            <article key={f.id} className={`vt-tile ${st.cls} ${v ? 'has' : ''}`}>
              <header>
                <span className="vt-emoji">{f.emoji}</span>
                <span className="vt-label">{f.label}</span>
                {st.cls === 'ok' && <IonIcon icon={checkmarkCircle} className="vt-ok-ico" />}
              </header>
              <div className="vt-value">
                <IonInput
                  className="vt-input"
                  placeholder="—"
                  inputmode="decimal"
                  value={v}
                  disabled={done}
                  aria-label={f.label}
                  onIonInput={(e) => setVals((prev) => ({ ...prev, [f.id]: e.detail.value ?? '' }))}
                />
                <em>{f.unit}</em>
              </div>
              <div className="vt-range" aria-hidden="true">
                <i style={{ left: pct === null ? '-8px' : `${pct}%`, opacity: pct === null ? 0 : 1 }} />
              </div>
              <footer>
                <span className={st.cls || undefined}>{st.label}</span>
                <span>Ayer {f.demo}</span>
              </footer>
            </article>
          )
        })}
      </div>

      {!done && (
        <IonButton expand="block" className="bt bt-primary" disabled={filled < 4} onClick={onComplete}>
          {filled < 4 ? `Registra al menos 4 signos (${filled}/6)` : `Guardar signos · +${pts} pts`}
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
  const kcal = TODAY_PLAN.filter((m) => mealsLogged.includes(m.id)).reduce((s, m) => s + m.kcal, 0)
  const pct = mealsLogged.length / TODAY_PLAN.length

  return (
    <div className="lsn-stack">
      <div className="nut-hero">
        <div>
          <div className="kicker" style={{ color: 'var(--teal-d)' }}>
            Plan mediterráneo
          </div>
          <strong>1,800 kcal · 90 g proteína</strong>
          <span>Hoy llevas {kcal} kcal registradas · {Math.round(pct * 100)}% de comidas</span>
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
      <div className="lsn-warn">Proteínas 68 g vs meta 90 g · suma una fuente magra en almuerzo o cena.</div>
      {TODAY_PLAN.map((m) => (
        <div key={m.id} className={`lsn-meal ${mealsLogged.includes(m.id) ? 'on' : ''}`}>
          <span className="lsn-meal-ico">{m.emoji}</span>
          <div>
            <strong>{m.title}</strong>
            <span>
              {m.items} · {m.kcal} kcal
            </span>
          </div>
          <em>{mealsLogged.includes(m.id) ? '✓' : ''}</em>
        </div>
      ))}
      <IonButton expand="block" className="bt bt-teal" onClick={onGoPlan}>
        Ir a registrar comidas
      </IonButton>
      {!done && mealsLogged.length >= 2 && (
        <IonButton expand="block" className="bt bt-gold" onClick={onComplete}>
          Validar adherencia · +{pts} pts
        </IonButton>
      )}
      {!done && mealsLogged.length < 2 && (
        <p className="lesson-hint">Registra al menos 2 comidas del plan para validar el día.</p>
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
        <div className="ex-step-name">{cur.name}</div>
        <div className="ex-step-cue">{cur.cue}</div>
        <div className="ex-total">Sesión {mmss(doneSec)} / {mmss(total)}</div>
      </div>

      <div className="ex-list">
        {CIRCUIT_STEPS.map((s, i) => (
          <div key={s.name} className={`ex-li ${i < step ? 'done' : ''} ${i === step ? 'now' : ''}`}>
            <b>{i < step ? '✓' : i + 1}</b>
            <div>
              <strong>{s.name}</strong>
              <span>{mmss(s.sec)}</span>
            </div>
          </div>
        ))}
      </div>

      {!done && (
        <>
          <IonButton expand="block" className="bt bt-pur" onClick={onToggle}>
            {running ? 'Pausar' : step === 0 && left === CIRCUIT_STEPS[0].sec ? 'Iniciar circuito' : 'Continuar'}
          </IonButton>
          <IonButton expand="block" className="bt bt-ghost" onClick={onSkip}>
            Saltar estación
          </IonButton>
          <IonButton expand="block" className="bt bt-gold" onClick={onComplete}>
            Ya lo hice · +{pts} pts
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
  const todayIdx = weekdayMondayIndex()
  return (
    <div className="lsn-stack">
      <div className="nb-card">
        <div className="nb-title">¿Ya tomaste tu Nutribiótico?</div>
        <div className="nb-sub">{done ? `Registrado · ${takenAt}` : 'Producto ADRED · 1 cápsula con el desayuno'}</div>
        <IonSegment value={slot} onIonChange={(e) => onSlot(String(e.detail.value))} disabled={done}>
          <IonSegmentButton value="manana">Mañana</IonSegmentButton>
          <IonSegmentButton value="tarde">Tarde</IonSegmentButton>
          <IonSegmentButton value="noche">Noche</IonSegmentButton>
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
            Sí, ya lo tomé · +{pts} pts
          </IonButton>
        ) : (
          <div className="lesson-done-banner">Dosis de hoy confirmada</div>
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
  const [mood, setMood] = useState('')
  const [stress, setStress] = useState(5)
  const [motivation, setMotivation] = useState(8)
  const [sleep, setSleep] = useState('')
  const [barrier, setBarrier] = useState('')
  const [note, setNote] = useState('')
  const reply = barrier ? BARRIER_REPLY[barrier] : ''
  const ready = Boolean(mood && sleep && barrier)

  const stressLabel = useMemo(() => (stress <= 3 ? 'Bajo' : stress <= 6 ? 'Moderado' : 'Alto'), [stress])

  return (
    <div className="lsn-stack">
      <p className="lesson-q">¿Cómo está tu ánimo ahora?</p>
      <div className="mood-row">
        {EMOTION_FACES.map((m) => (
          <button key={m.v} type="button" className={`mood-face ${mood === m.v ? 'sel' : ''}`} onClick={() => setMood(m.v)}>
            <span>{m.face}</span>
            <small>{m.label}</small>
          </button>
        ))}
      </div>

      <p className="lesson-q">Estrés · {stressLabel}</p>
      <IonRange min={1} max={10} step={1} snaps value={stress} disabled={done} onIonInput={(e) => setStress(Number(e.detail.value))} />

      <p className="lesson-q">Motivación · {motivation}/10</p>
      <IonRange min={1} max={10} step={1} snaps value={motivation} disabled={done} onIonInput={(e) => setMotivation(Number(e.detail.value))} />

      <p className="lesson-q">Sueño anoche</p>
      <IonSegment value={sleep} onIonChange={(e) => setSleep(String(e.detail.value ?? ''))} disabled={done}>
        <IonSegmentButton value="5">≤5 h</IonSegmentButton>
        <IonSegmentButton value="6">6–7 h</IonSegmentButton>
        <IonSegmentButton value="8">≥8 h</IonSegmentButton>
      </IonSegment>

      <p className="lesson-q">¿Qué fue lo más difícil esta semana?</p>
      <div className="barrier-opts">
        {WEEK_BARRIERS.map((b) => (
          <IonChip key={b.id} className={barrier === b.id ? 'sel' : undefined} onClick={() => !done && setBarrier(b.id)}>
            {b.label}
          </IonChip>
        ))}
      </div>
      {reply && <div className="lsn-ai">{reply}</div>}

      <IonTextarea
        className="fld post-tx"
        value={note}
        disabled={done}
        placeholder="Nota opcional para tu psicóloga"
        autoGrow
        onIonInput={(e) => setNote(e.detail.value ?? '')}
      />

      {!done && (
        <IonButton expand="block" className="bt bt-primary" disabled={!ready} onClick={() => onComplete({ mood, barrier })}>
          <IonIcon icon={checkmark} slot="start" />
          Guardar evaluación · +{pts} pts
        </IonButton>
      )}
    </div>
  )
}

export type ProgramTab = 'hoy' | 'racha' | 'evo'
