import { useState } from 'react'
import {
  ADHER_QS,
  ANTECS,
  CARDIO_QS,
  FAM_HX,
  MOV_QS,
  NUT_QS,
  PRIORITIES,
  PURPOSE_OPEN,
  PURPOSE_SCALE,
  SISTEMAS,
  SLEEP_FLAGS,
  SLEEP_QS,
  STRESS_QS,
  TEMP_QS,
  TESTS_META,
} from '../data/tests'
import { ChipGrid, ScaleList } from '../components/Forms'
import { useApp } from '../context/AppContext'

const SCALE: Record<number, string[]> = {
  2: ['1', '2', '3', '4', '5'],
  3: ['1', '2', '3', '4', '5'],
  4: ['0', '1', '2', '3'],
  5: ['0', '1', '2', '3', '4'],
  6: ['0', '1', '2', '3', '4'],
  7: ['0', '1', '2', '3'],
  8: ['0', '1', '2', '3', '4'],
  9: ['1', '2', '3', '4', '5'],
}

const QMAP: Record<number, typeof TEMP_QS> = {
  2: TEMP_QS,
  3: NUT_QS,
  4: MOV_QS,
  5: SLEEP_QS,
  6: ADHER_QS,
  7: CARDIO_QS,
  8: STRESS_QS,
  9: PURPOSE_SCALE,
}

export function TestsPage() {
  const { testsDone, markTest, skipTests, finishTests, showToast } = useApp()
  const [openId, setOpenId] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Record<number, Record<number, number>>>({})
  const [chips, setChips] = useState<number[]>([])
  const [fam, setFam] = useState<number[]>([])
  const [flags, setFlags] = useState<number[]>([])
  const [priority, setPriority] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sisOpen, setSisOpen] = useState<number | null>(0)
  const [sisSel, setSisSel] = useState<Record<number, number[]>>({})

  const completed = testsDone.length
  const pct = Math.round((completed / 9) * 100)
  const meta = TESTS_META.find((t) => t.id === openId)

  const toggle = (list: number[], set: (n: number[]) => void, i: number) =>
    set(list.includes(i) ? list.filter((x) => x !== i) : [...list, i])

  const saveTest = () => {
    if (!openId) return
    markTest(openId)
    showToast('Evaluación guardada', 'ok')
    setOpenId(null)
  }

  const openIA = () => {
    setShowResult(true)
    setLoading(true)
    window.setTimeout(() => setLoading(false), 1600)
  }

  return (
    <div className="screen" style={{ background: '#fff' }}>
      <div className="hero hero-cosmos">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {openId && (
            <button
              onClick={() => setOpenId(null)}
              style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', fontSize: 18 }}
            >
              ←
            </button>
          )}
          <div style={{ flex: 1 }}>
            <div className="kicker">ANTARES · PERFIL DE SALUD</div>
            <div className="h2">{meta?.title ?? 'Batería de evaluación inicial'}</div>
          </div>
          <button
            onClick={skipTests}
            style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', color: 'rgba(255,255,255,.7)', borderRadius: 10, padding: '6px 10px', fontSize: 11, fontWeight: 700 }}
          >
            Después
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 12 }}>
          <span>{completed} de 9 evaluaciones</span>
          <span>{pct}%</span>
        </div>
        <div className="ptrack" style={{ background: 'rgba(255,255,255,.12)', marginTop: 6 }}>
          <div className="pfill" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#1D9E75,#D4AF37)' }} />
        </div>
      </div>

      {showResult ? (
        <div className="screen-scroll no-nav" style={{ padding: 14 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🧬</div>
              <div className="display" style={{ fontSize: 18, fontWeight: 700 }}>
                Analizando tu perfil…
              </div>
              <p style={{ fontSize: 12, color: 'var(--mu)' }}>Correlacionando variables clínicas, conducta y propósito.</p>
            </div>
          ) : (
            <>
              <div style={{ background: 'linear-gradient(135deg,#06091A,#1A0A3C)', borderRadius: 16, padding: 16, marginBottom: 12 }}>
                {[
                  ['Metabolismo', 62, '#E87B2B'],
                  ['Nutrición', 74, '#1D9E75'],
                  ['Movimiento', 58, '#1B6CA8'],
                  ['Sueño', 51, '#7C3AED'],
                  ['Adherencia', 81, '#D4AF37'],
                  ['Estrés', 44, '#E24B4A'],
                ].map(([n, w, c]) => (
                  <div key={String(n)} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ width: 92, fontSize: 11, color: 'rgba(255,255,255,.6)' }}>{n}</span>
                    <div className="ptrack" style={{ flex: 1, background: 'rgba(255,255,255,.1)' }}>
                      <div className="pfill" style={{ width: `${w}%`, background: String(c) }} />
                    </div>
                    <span style={{ width: 28, fontSize: 11, color: '#fff', textAlign: 'right' }}>{w}</span>
                  </div>
                ))}
              </div>
              <div className="card" style={{ marginBottom: 10, borderColor: 'var(--pur)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pur)', marginBottom: 8 }}>🤖 ANTARES AI</div>
                <p style={{ fontSize: 13, lineHeight: 1.65, margin: 0 }}>
                  Perfil de riesgo bajo-moderado. Prediabetes (HbA1c 5.9%) con buena adherencia (81%) y temperamento mixto sanguíneo-flemático. Prioriza sueño, control glucémico y movimiento progresivo de 12 min/día.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div style={{ background: '#E1F5EE', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#0F6E56' }}>FORTALEZAS</div>
                  <div style={{ fontSize: 11, marginTop: 6 }}>Adherencia alta · Apoyo familiar · Motivación clara</div>
                </div>
                <div style={{ background: '#FCEBEB', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#A32D2D' }}>RIESGOS</div>
                  <div style={{ fontSize: 11, marginTop: 6 }}>Prediabetes · Sueño 6.8h · Antecedente familiar DM2</div>
                </div>
              </div>
              <div style={{ background: 'linear-gradient(135deg,#0C3D2C,var(--teal))', borderRadius: 16, padding: 16, textAlign: 'center' }}>
                <div style={{ color: '#fff', fontWeight: 700, marginBottom: 8 }}>Tu programa está personalizado</div>
                <button className="btn" style={{ background: 'rgba(255,255,255,.2)', color: '#fff', border: '1px solid rgba(255,255,255,.3)' }} onClick={finishTests}>
                  Entrar a mi programa ANTARES
                </button>
              </div>
            </>
          )}
        </div>
      ) : !openId ? (
        <div className="screen-scroll no-nav" style={{ padding: 14 }}>
          <p style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6 }}>
            Completa las evaluaciones para personalizar tu programa. Puedes guardar y continuar cuando quieras.
          </p>
          {TESTS_META.map((t) => {
            const done = testsDone.includes(t.id)
            const active = !done && (testsDone.length === 0 ? t.id === 1 : t.id === Math.min(...[1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => !testsDone.includes(n))))
            return (
              <button key={t.id} className={`ts-card ${done ? 'done' : ''} ${active ? 'active-now' : ''}`} onClick={() => setOpenId(t.id)}>
                <div className="ico" style={{ background: t.bg, marginBottom: 0 }}>
                  {t.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{t.id}. {t.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{t.sub}</div>
                </div>
                <span className={`chip ${done ? 'chip-teal' : active ? 'chip-org' : 'chip-blue'}`} style={{ fontSize: 10 }}>
                  {done ? 'Hecho' : active ? 'Ahora' : 'Pendiente'}
                </span>
              </button>
            )
          })}
          {completed >= 3 && (
            <button className="btn btn-gold" style={{ marginTop: 8 }} onClick={openIA}>
              Ver mi perfil de salud ANTARES · IA
            </button>
          )}
        </div>
      ) : (
        <div className="screen-scroll no-nav" style={{ padding: '14px 14px 110px' }}>
          {openId === 1 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, margin: '4px 0 8px' }}>Antecedentes patológicos</div>
              <ChipGrid items={ANTECS} selected={chips} toggle={(i) => toggle(chips, setChips, i)} />
              <div style={{ fontSize: 12, fontWeight: 700, margin: '14px 0 8px' }}>Revisión por sistemas</div>
              {SISTEMAS.map((s, i) => (
                <div key={s.s} style={{ border: `1.5px solid ${s.bg}`, borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
                  <button
                    onClick={() => setSisOpen(sisOpen === i ? null : i)}
                    style={{ width: '100%', background: s.bg, border: 'none', padding: 12, display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <span>{s.ico}</span>
                    <span style={{ flex: 1, fontWeight: 700, fontSize: 13, textAlign: 'left' }}>{s.s}</span>
                    <span style={{ fontSize: 11, color: 'var(--mu)' }}>{sisOpen === i ? '▲' : '▼'}</span>
                  </button>
                  {sisOpen === i && (
                    <div style={{ padding: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {s.sintomas.map((sin, si) => {
                        const on = (sisSel[i] ?? []).includes(si)
                        return (
                          <button key={sin} className={`choice ${on ? 'sel' : ''}`} onClick={() => {
                            const cur = sisSel[i] ?? []
                            setSisSel({ ...sisSel, [i]: on ? cur.filter((x) => x !== si) : [...cur, si] })
                          }}>
                            <span style={{ fontSize: 11, fontWeight: 600 }}>{sin}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
              <div style={{ fontSize: 12, fontWeight: 700, margin: '8px 0' }}>Antecedentes familiares</div>
              <ChipGrid items={FAM_HX} selected={fam} toggle={(i) => toggle(fam, setFam, i)} />
            </>
          )}

          {openId && openId >= 2 && openId <= 8 && (
            <ScaleList
              questions={QMAP[openId]}
              scale={SCALE[openId]}
              answers={answers[openId] ?? {}}
              onAnswer={(i, v) => setAnswers((a) => ({ ...a, [openId]: { ...(a[openId] ?? {}), [i]: v } }))}
            />
          )}

          {openId === 5 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, margin: '8px 0' }}>Señales de alerta</div>
              <ChipGrid items={SLEEP_FLAGS} selected={flags} toggle={(i) => toggle(flags, setFlags, i)} />
            </>
          )}

          {openId === 9 && (
            <>
              {PURPOSE_OPEN.map((p) => (
                <div key={p.q} className="tq-card">
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{p.q}</div>
                  <textarea className="field" placeholder={p.ph} style={{ width: '100%', minHeight: 70, border: '1.5px solid var(--bd)', borderRadius: 10, padding: 10 }} />
                </div>
              ))}
              <ScaleList
                questions={PURPOSE_SCALE}
                scale={['1', '2', '3', '4', '5']}
                answers={answers[9] ?? {}}
                onAnswer={(i, v) => setAnswers((a) => ({ ...a, 9: { ...(a[9] ?? {}), [i]: v } }))}
              />
              <div style={{ background: 'linear-gradient(135deg,#06091A,#1A0A3C)', borderRadius: 16, padding: 14, marginTop: 8 }}>
                <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 12, marginBottom: 10 }}>¿Qué priorizarías primero?</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPriority(p.id)}
                      style={{
                        background: priority === p.id ? 'rgba(124,58,237,.35)' : 'rgba(255,255,255,.06)',
                        border: `1px solid ${priority === p.id ? 'var(--pur)' : 'rgba(255,255,255,.1)'}`,
                        borderRadius: 12,
                        padding: 12,
                        color: '#fff',
                      }}
                    >
                      <div>{p.ico}</div>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>{p.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {openId && !showResult && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 14px calc(16px + env(safe-area-inset-bottom, 0px))', background: 'linear-gradient(transparent,#fff 30%)' }}>
          <button className="btn btn-teal" onClick={saveTest}>
            Guardar evaluación
          </button>
        </div>
      )}
    </div>
  )
}
