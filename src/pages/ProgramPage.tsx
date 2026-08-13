import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { IonButton, IonInput, IonProgressBar, IonTextarea } from '@ionic/react'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'

export function ProgramPage() {
  const { program, completeStep, pointsToday, pointsTotal, navigate, showToast, mealsLogged } = useApp()
  const [open, setOpen] = useState<string>('vitals')
  const [running, setRunning] = useState(false)
  const [secs, setSecs] = useState(12 * 60)
  const [post, setPost] = useState('')

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          window.clearInterval(id)
          setRunning(false)
          if (!program.ejercicio) {
            completeStep('ejercicio', 150)
            showToast('Circuito completado · +150 pts', 'ok')
          }
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [running, program.ejercicio, completeStep, showToast])

  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')
  const doneCount = Object.values(program).filter(Boolean).length
  const allDone = doneCount === 5

  const Step = ({
    id,
    n,
    title,
    sub,
    pts,
    children,
  }: {
    id: keyof typeof program
    n: number
    title: string
    sub: string
    pts: number
    children: ReactNode
  }) => (
    <div className={`prog-step ${program[id] ? 'done' : ''}`}>
      <button
        onClick={() => setOpen(open === id ? '' : id)}
        style={{ width: '100%', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: 12, textAlign: 'left' }}
      >
        <div className="ps-num">{program[id] ? '✓' : n}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>{title}</div>
          <div style={{ fontSize: 11, color: 'var(--mu)' }}>{sub}</div>
        </div>
        <span className="chip chip-gold">+{pts} pts</span>
      </button>
      {open === id && !program[id] && <div style={{ padding: '0 12px 12px' }}>{children}</div>}
      {program[id] && open === id && (
        <div style={{ padding: '0 12px 12px', color: 'var(--teal-d)', fontWeight: 700, fontSize: 13 }}>Completado · +{pts} pts</div>
      )}
    </div>
  )

  return (
    <Screen>
      <Scroll>
        <div className="hero hero-cosmos">
          <div className="kicker">COPP-ADRESD · PROTOCOLO</div>
          <div className="h1">🌟 Mi programa hoy</div>
          <div className="sub">Semana 12 · Completa los pasos y acumula puntos</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(212,175,55,.25)', borderRadius: 12, padding: 10 }}>
              <div style={{ fontSize: 10, opacity: 0.5 }}>Puntos hoy</div>
              <div className="display" style={{ color: 'var(--gold)', fontSize: 22, fontWeight: 800 }}>
                {pointsToday} / 700
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: 10, minWidth: 90 }}>
              <div style={{ fontSize: 10, opacity: 0.5 }}>Total</div>
              <div className="display" style={{ fontSize: 18, fontWeight: 800 }}>
                {pointsTotal}
              </div>
            </div>
          </div>
          <IonProgressBar
            className="pb"
            style={{ marginTop: 12, '--background': 'rgba(255,255,255,.12)', '--progress-background': 'linear-gradient(90deg,#D4AF37,#1D9E75)' } as CSSProperties}
            value={doneCount / 5}
          />
        </div>

        <div style={{ height: 10 }} />

        <Step id="vitals" n={1} title="Medir signos vitales" sub="FC · Presión · SpO2 · Glucosa · Peso" pts={100}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            {['❤️ FC', '🩺 Presión', '💨 SpO2', '🩸 Glucosa', '⚖️ Peso', '🌡️ Temp'].map((l) => (
              <div key={l} className="vital-inp">
                <label>{l}</label>
                <IonInput className="vital-i" placeholder="—" />
              </div>
            ))}
          </div>
          <IonButton expand="block" className="bt bt-primary" onClick={() => { completeStep('vitals', 100); showToast('+100 pts por signos vitales', 'ok') }}>
            Registrar signos · +100 pts
          </IonButton>
        </Step>

        <Step id="nut" n={2} title="Seguir el plan nutricional" sub="Registra comidas con foto" pts={200}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 10 }}>
            {[
              ['des', '🌅 Des'],
              ['alm', '☀️ Alm'],
              ['mer', '🍎 Mer'],
              ['cen', '🌙 Cena'],
            ].map(([id, t]) => (
              <div key={id} style={{ textAlign: 'center', padding: 8, borderRadius: 10, background: mealsLogged.includes(id) ? 'var(--teal-l)' : 'var(--g1)', fontSize: 12, fontWeight: 700 }}>
                {t}
              </div>
            ))}
          </div>
          <IonButton expand="block" className="bt bt-teal" onClick={() => navigate('nut')}>
            Ir a registrar comidas
          </IonButton>
          {mealsLogged.length >= 2 && (
            <IonButton expand="block" className="bt bt-gold" style={{ marginTop: 8 }} onClick={() => { completeStep('nut', 200); showToast('+200 pts nutrición', 'ok') }}>
              Validar adherencia · +200
            </IonButton>
          )}
        </Step>

        <Step id="ejercicio" n={3} title="Hacer ejercicio del día" sub="Semana 12 · 12 minutos" pts={150}>
          <div style={{ background: 'linear-gradient(135deg,#0A0A1A,#1A1A3C)', borderRadius: 16, padding: 18, textAlign: 'center', marginBottom: 10, color: '#fff' }}>
            <div style={{ color: '#818CF8', fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>TEMPORIZADOR</div>
            <div className="display" style={{ fontSize: 48, fontWeight: 800 }}>
              {mm}:{ss}
            </div>
          </div>
          <div style={{ background: 'var(--g1)', borderRadius: 12, padding: 12, fontSize: 12, lineHeight: 1.8, marginBottom: 10 }}>
            ① Calentamiento 2 min · ② Sentadillas 2 min · ③ Plancha 1 min · ④ Caminata 3 min · ⑤ Estiramiento 2 min · ⑥ Respiración 4-7-8
          </div>
          <IonButton expand="block" className="bt bt-pur" onClick={() => setRunning((r) => !r)}>
            {running ? 'Detener' : 'Iniciar cronómetro'}
          </IonButton>
        </Step>

        <Step id="psico" n={4} title="Ver video del día" sub="PSICO · Mindfulness 12:34" pts={100}>
          <div
            onClick={() => { completeStep('psico', 100); showToast('Video completado · +100 pts', 'ok') }}
            style={{ background: 'linear-gradient(135deg,#2D1B69,#1A0A3C)', borderRadius: 14, height: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', marginBottom: 8, cursor: 'pointer' }}
          >
            <div style={{ fontSize: 36 }}>▶</div>
            <div style={{ fontWeight: 700, fontSize: 13, textAlign: 'center', padding: '0 16px' }}>Mindfulness para estrés por prediabetes</div>
          </div>
        </Step>

        <Step id="comunidad" n={5} title="Comentar en comunidad" sub="Comparte tu experiencia · 20 caracteres" pts={150}>
          <IonTextarea className="fld post-tx" value={post} placeholder="¿Cómo te sientes hoy?" onIonInput={(e) => setPost(e.detail.value ?? '')} autoGrow />
          <IonButton
            expand="block"
            className="bt bt-pur"
            onClick={() => {
              if (post.trim().length < 20) {
                showToast('Escribe al menos 20 caracteres', 'warn')
                return
              }
              completeStep('comunidad', 150)
              showToast('+150 pts comunidad', 'ok')
            }}
          >
            Publicar y ganar +150 pts
          </IonButton>
          <IonButton expand="block" className="bt bt-ghost" style={{ marginTop: 8 }} onClick={() => navigate('com')}>
            Ver comunidad completa
          </IonButton>
        </Step>

        {allDone && (
          <div style={{ margin: 14, background: 'linear-gradient(135deg,#0C3D2C,#1D9E75)', borderRadius: 16, padding: 18, textAlign: 'center', color: '#fff' }}>
            <div style={{ fontSize: 32 }}>🏆</div>
            <div className="display" style={{ fontSize: 20, fontWeight: 800 }}>¡Programa completado!</div>
            <div style={{ opacity: 0.8, fontSize: 13 }}>Has ganado {pointsToday} pts hoy. Mañana vuelve a completar el protocolo.</div>
          </div>
        )}
      </Scroll>
    </Screen>
  )
}
