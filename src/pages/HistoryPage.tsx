import { useState } from 'react'
import { Screen, Scroll } from '../components/Screen'

const sections = [
  {
    title: '👤 Datos de identificación',
    rows: [
      ['Nombre', 'María González'],
      ['Documento', 'CC 10247381'],
      ['Fecha nac.', '12/04/1988 · 38 años'],
      ['Sexo', 'Femenino'],
      ['Grupo sangre', 'O+'],
      ['Seguro', 'BlueCross BlueShield · #BCB-20247381'],
      ['NPI médico', 'Dr. Carlos Ramírez · NPI 1234567890'],
    ],
  },
  {
    title: '🩺 Diagnósticos activos (ICD-10)',
    rows: [
      ['Principal', 'E66.01 — Obesidad leve · IMC 26.4'],
      ['Secundario', 'R73.09 — Prediabetes · HbA1c 5.9%'],
      ['Seguimiento', 'Z68.27 — IMC 26-26.9'],
      ['Preventivo', 'Z71.3 — Asesoramiento dietético'],
      ['Programa', 'Z15.89 — COPP-ADRESD semana 12/24'],
    ],
  },
  {
    title: '💊 Medicamentos activos',
    rows: [
      ['Metformina', '500mg · 1 vez/día con desayuno'],
      ['Vitamina D3', '2,000 UI/día'],
      ['Omega-3', '1g EPA+DHA/día · AHA'],
      ['Probiótico', 'Lactobacillus acidophilus'],
    ],
  },
  {
    title: '🧪 Resultados de laboratorio',
    rows: [
      ['Glucosa', '95 mg/dL · Prediabetes'],
      ['HbA1c', '5.9% · Meta <5.7%'],
      ['Colesterol', 'LDL 98 · HDL 62 · TG 145'],
      ['TA', '118/76 mmHg · Óptima'],
      ['Vitamina D', '32 ng/mL · Suficiente'],
      ['Fecha lab', '28/07/2026 · Quest Diagnostics'],
    ],
  },
  {
    title: '⚠️ Alergias y antecedentes',
    rows: [
      ['Alergias', 'Penicilina · Reacción anafiláctica'],
      ['Intolerancia', 'Lactosa leve · Gluten (no celíaca)'],
      ['Antec. famil.', 'DM2 (madre) · HTA (padre)'],
      ['Contacto emerg.', 'Pedro González · Esposo · +1 (786) 555-0192'],
    ],
  },
]

export function HistoryPage() {
  const [open, setOpen] = useState(0)

  return (
    <Screen>
      <Scroll>
        <div className="hero hero-navy">
          <div className="h1">📋 Historia clínica</div>
          <div className="sub">HIPAA protegida · Actualizada 05/08/2026</div>
          <div className="chips">
            <span className="chip chip-glass">ID: COPP-2024-00142</span>
            <span className="chip chip-gold">NPI verificado</span>
          </div>
        </div>
        {sections.map((s, i) => (
          <div key={s.title} className="hc-sec">
            <button className="hc-hdr" onClick={() => setOpen(open === i ? -1 : i)}>
              <span>{s.title}</span>
              <span>{open === i ? '▲' : '▼'}</span>
            </button>
            {open === i && (
              <div className="hc-body">
                {s.rows.map(([l, v]) => (
                  <div key={l} className="hc-row">
                    <div className="hc-lbl">{l}</div>
                    <div className="hc-val">
                      <strong>{v}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </Scroll>
    </Screen>
  )
}
