import { useState, type CSSProperties } from 'react'
import { IonProgressBar } from '@ionic/react'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'

const meals = [
  {
    id: 'des',
    emoji: '🌅',
    title: 'Desayuno · 7:00 AM',
    kcal: 380,
    items: [
      ['🥣', 'Avena enrollada (½ taza)', 'β-glucanos · Bajo IG', '31g C', '5g P', ''],
      ['🍓', 'Frutos rojos mixtos', 'Antioxidantes · Vit. C', '10g C', '', ''],
      ['🥚', '2 claras de huevo', 'Proteína magra', '', '7g P', ''],
      ['🍵', 'Té verde sin azúcar', 'EGCG · 0 kcal', '0g', '', ''],
    ],
  },
  {
    id: 'alm',
    emoji: '☀️',
    title: 'Almuerzo · 12:00 PM',
    kcal: 620,
    items: [
      ['🍗', 'Pechuga de pollo 4 oz', 'Proteína magra · sin piel', '', '26g P', '3g G'],
      ['🍚', 'Arroz integral ½ taza', 'Grano entero · 2g fibra', '22g C', '', ''],
      ['🥗', 'Ensalada + EVOO y limón', 'Espinaca · Omega-9', '8g C', '', '7g G'],
    ],
  },
  {
    id: 'mer',
    emoji: '🍎',
    title: 'Merienda · 3:30 PM',
    kcal: 200,
    items: [
      ['🍎', 'Manzana mediana', 'Pectina · IG bajo 36', '25g C', '', ''],
      ['🥜', 'Almendras 1 oz', 'Vit. E · Mg', '', '6g P', '14g G'],
    ],
  },
  {
    id: 'cen',
    emoji: '🌙',
    title: 'Cena · 7:00 PM',
    kcal: 450,
    items: [
      ['🍲', 'Sopa de lentejas 1½ taza', '18g proteína vegetal', '40g C', '18g P', ''],
      ['🍞', 'Pan integral 1 rebanada', 'Grano entero · 3g fibra', '15g C', '', ''],
    ],
  },
]

const week = [
  ['Lun', 96, 'var(--teal)'],
  ['Mar', 88, 'var(--teal)'],
  ['Mié', 74, 'var(--org)'],
  ['Jue', 91, 'var(--teal)'],
  ['Vie', 85, 'var(--teal)'],
  ['Sáb', 68, 'var(--org)'],
  ['Dom', 93, 'var(--teal)'],
]

export function NutritionPage() {
  const { hydration, setHydration, mealsLogged, logMeal, showToast } = useApp()
  const [tab, setTab] = useState<'hoy' | 'semana' | 'indicaciones' | 'historial'>('hoy')
  const [openDay, setOpenDay] = useState(1)

  const log = (id: string, name: string) => {
    logMeal(id)
    showToast(`Foto de ${name} analizada · adherencia alta`, 'ok')
  }

  return (
    <Screen>
      <div className="hero hero-teal">
        <div className="h1">🥗 Plan nutricional</div>
        <div className="sub">Nut. Ana Torres, RDN · CPT 97802</div>
        <div className="chips">
          <span className="chip chip-glass">Dieta mediterránea</span>
          <span className="chip chip-glass">USDA 2025</span>
          <span className="chip chip-glass">ADA 2026</span>
        </div>
      </div>

      <div style={{ background: '#fff', padding: 14, display: 'flex', gap: 14, borderBottom: '1px solid var(--g1)' }}>
        <div style={{ position: 'relative', width: 92, height: 92, flexShrink: 0 }}>
          <svg width="92" height="92" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="50" cy="50" r="38" fill="none" stroke="#E8EEF4" strokeWidth="10" />
            <circle cx="50" cy="50" r="38" fill="none" stroke="#1D9E75" strokeWidth="10" strokeDasharray="239" strokeDashoffset="36" strokeLinecap="round" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="display" style={{ fontSize: 16, fontWeight: 800 }}>1,650</div>
            <div style={{ fontSize: 9, color: 'var(--mu)' }}>/1,800</div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {[
            ['Carbohidratos', '168g', 75, '#1B6CA8'],
            ['Proteínas', '90g', 88, '#1D9E75'],
            ['Grasas', '50g', 60, '#E87B2B'],
            ['Fibra', '28g', 80, '#7C3AED'],
          ].map(([n, v, w, c]) => (
            <div key={String(n)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--mu)', width: 78 }}>{n}</span>
              <IonProgressBar
                className="pb"
                style={{ flex: 1, '--progress-background': String(c) } as CSSProperties}
                value={Number(w) / 100}
              />
              <span style={{ fontSize: 11, fontWeight: 700, width: 36, textAlign: 'right' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="plan-tabs">
        {(['hoy', 'semana', 'indicaciones', 'historial'] as const).map((t) => (
          <button key={t} className={`ptab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <Scroll>
        {tab === 'hoy' && (
          <>
            <div className="card" style={{ margin: '10px 14px', background: 'var(--blue-l)', borderColor: '#B5D4F4' }}>
              <div style={{ fontWeight: 700, color: 'var(--blue)', marginBottom: 10, fontSize: 13 }}>💧 Hidratación · 8 vasos (2L)</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <button key={i} className={`hyd-glass ${i < hydration ? 'full' : ''}`} onClick={() => setHydration(i + 1)}>
                    🥛
                  </button>
                ))}
              </div>
            </div>
            {meals.map((m) => (
              <div key={m.id} className="meal-card">
                <div className="meal-hdr">
                  <span>{m.emoji}</span>
                  <span style={{ flex: 1, fontWeight: 700 }}>{m.title}</span>
                  <span style={{ opacity: 0.75, fontSize: 12 }}>{m.kcal} kcal</span>
                </div>
                {m.items.map((it) => (
                  <div key={it[1]} className="food-item">
                    <span>{it[0]}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{it[1]}</div>
                      <div style={{ fontSize: 11, color: 'var(--mu)' }}>{it[2]}</div>
                    </div>
                    <div>
                      {it[3] && <span className="fm fm-c">{it[3]}</span>}
                      {it[4] && <span className="fm fm-p">{it[4]}</span>}
                      {it[5] && <span className="fm fm-g">{it[5]}</span>}
                    </div>
                  </div>
                ))}
                {mealsLogged.includes(m.id) ? (
                  <div style={{ margin: 12, background: 'var(--teal-l)', borderRadius: 12, padding: 12, color: '#0F6E56', fontWeight: 700, fontSize: 13 }}>
                    ✓ Registrado con foto · IA 92% adherencia
                  </div>
                ) : (
                  <button
                    onClick={() => log(m.id, m.title)}
                    style={{
                      margin: 12,
                      width: 'calc(100% - 24px)',
                      background: 'linear-gradient(135deg,#0D2B4B,#1A3D5C)',
                      border: '2px dashed rgba(212,175,55,.35)',
                      borderRadius: 12,
                      padding: 12,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 20 }}>📸</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>Registrar lo que comí</div>
                      <div style={{ fontSize: 11, opacity: 0.6 }}>IA analiza gramos · kcal · adherencia</div>
                    </div>
                  </button>
                )}
              </div>
            ))}
          </>
        )}

        {tab === 'semana' && (
          <div style={{ padding: '12px 0' }}>
            <div className="card" style={{ margin: '0 14px 12px' }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>📊 Adherencia semanal</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 90 }}>
                {week.map(([d, h, c]) => (
                  <div key={String(d)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700 }}>{h}%</span>
                    <div style={{ width: '100%', height: Number(h) * 0.7, background: String(c), borderRadius: '4px 4px 0 0' }} />
                    <span style={{ fontSize: 10, color: 'var(--mu)' }}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
            {[
              ['04/08/2026', '1,720 kcal · 96%', 0],
              ['05/08/2026 · HOY', '1,650 kcal · 88%', 1],
              ['06/08/2026', 'Plan 1,760 kcal', 2],
            ].map(([n, k, i]) => (
              <button
                key={String(n)}
                className="card"
                style={{ margin: '0 14px 8px', textAlign: 'left' }}
                onClick={() => setOpenDay(Number(i))}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  {n}
                  <span className="chip chip-teal">{k}</span>
                </div>
                {openDay === i && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--mu)', lineHeight: 1.7 }}>
                    Desayuno · Almuerzo · Merienda · Cena según plan mediterráneo.
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {tab === 'indicaciones' && (
          <div className="card" style={{ margin: 14 }}>
            {[
              ['🔥', 'Calorías diarias', '1,800 kcal'],
              ['🍚', 'Carbohidratos', '≤ 200g/día'],
              ['🥩', 'Proteínas', '≥ 90g/día'],
              ['🧂', 'Sodio (AHA)', '≤ 2,300mg'],
              ['🍬', 'Azúcar añadida', '≤ 25g/día'],
              ['💧', 'Agua (USDA)', '≥ 2L/día'],
            ].map(([e, n, v]) => (
              <div key={String(n)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--g1)' }}>
                <span>{e}</span>
                <span style={{ flex: 1, fontWeight: 600 }}>{n}</span>
                <span style={{ fontWeight: 800, color: 'var(--teal)' }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'historial' && (
          <div className="card" style={{ margin: 14, padding: 0 }}>
            <div style={{ background: 'var(--navy)', color: '#fff', padding: 12, fontWeight: 700 }}>📉 Evolución de peso</div>
            {[
              ['1 may', '71.7 kg', 'IMC 27.6 · Inicio', ''],
              ['01/06/2026', '70.2 kg', 'IMC 27.0', '↓ 1.5 kg'],
              ['05/08/2026', '68.5 kg', 'IMC 26.4 · HbA1c 5.9%', '↓ 0.8 kg'],
            ].map(([d, k, s, ch]) => (
              <div key={d} style={{ display: 'flex', gap: 10, padding: 12, borderBottom: '1px solid var(--g1)', alignItems: 'center' }}>
                <div style={{ width: 48, fontSize: 11, color: 'var(--mu)' }}>{d}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>{k}</div>
                  <div style={{ fontSize: 11, color: 'var(--mu)' }}>{s}</div>
                </div>
                <span style={{ color: 'var(--teal)', fontWeight: 700, fontSize: 12 }}>{ch}</span>
              </div>
            ))}
            <div style={{ padding: 12, background: '#F8FBF8' }}>
              <div style={{ fontSize: 11, color: 'var(--mu)' }}>Meta semana 24</div>
              <div style={{ fontWeight: 800 }}>65 kg · IMC≤25 · HbA1c&lt;5.7%</div>
              <IonProgressBar className="pb" style={{ marginTop: 8, '--progress-background': 'var(--teal)' } as CSSProperties} value={0.5} />
            </div>
          </div>
        )}
      </Scroll>
    </Screen>
  )
}
