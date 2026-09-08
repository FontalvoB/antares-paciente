import { IonAccordion, IonAccordionGroup, IonIcon, IonItem, IonLabel } from '@ionic/react'
import { shieldCheckmarkOutline } from 'ionicons/icons'
import { Screen, Scroll } from '../components/Screen'
import { useT } from '../i18n/I18nContext'

/** Resumen del paciente que encabeza el expediente (demo, sin backend). */
const patient = {
  name: 'María González',
  meta: 'CC 10247381 · 38 años · O+',
  stats: [
    ['26.4', 'IMC'],
    ['5.9%', 'HbA1c'],
    ['118/76', 'TA'],
  ],
}

const sections = [
  {
    id: 'ident',
    emoji: '👤',
    title: 'Datos de identificación',
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
    id: 'dx',
    emoji: '🩺',
    title: 'Diagnósticos activos (ICD-10)',
    rows: [
      ['Principal', 'E66.01 — Obesidad leve · IMC 26.4'],
      ['Secundario', 'R73.09 — Prediabetes · HbA1c 5.9%'],
      ['Seguimiento', 'Z68.27 — IMC 26-26.9'],
      ['Preventivo', 'Z71.3 — Asesoramiento dietético'],
      ['Programa', 'Z15.89 — COPP-ADRESD semana 12/24'],
    ],
  },
  {
    id: 'meds',
    emoji: '💊',
    title: 'Medicamentos activos',
    rows: [
      ['Metformina', '500mg · 1 vez/día con desayuno'],
      ['Vitamina D3', '2,000 UI/día'],
      ['Omega-3', '1g EPA+DHA/día · AHA'],
      ['Probiótico', 'Lactobacillus acidophilus'],
    ],
  },
  {
    id: 'lab',
    emoji: '🧪',
    title: 'Resultados de laboratorio',
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
    id: 'alerts',
    emoji: '⚠️',
    title: 'Alergias y antecedentes',
    rows: [
      ['Alergias', 'Penicilina · Reacción anafiláctica'],
      ['Intolerancia', 'Lactosa leve · Gluten (no celíaca)'],
      ['Antec. famil.', 'DM2 (madre) · HTA (padre)'],
      ['Contacto emerg.', 'Pedro González · Esposo · +1 (786) 555-0192'],
    ],
  },
]

export function HistoryPage() {
  const t = useT()

  return (
    <Screen>
      <Scroll className="hc">
        <header className="hc-head">
          <div className="hc-head-top">
            <div>
              <span className="hc-kicker">{t('Expediente clínico')}</span>
              <h1 className="hc-title">{t('Historia clínica')}</h1>
              <p className="hc-date">{t('Actualizada 05/08/2026')}</p>
            </div>
            <span className="hc-shield" aria-hidden="true">
              <IonIcon icon={shieldCheckmarkOutline} />
            </span>
          </div>

          <div className="hc-chips">
            <span className="hc-chip green">{t('HIPAA protegida')}</span>
            <span className="hc-chip navy">{t('ID: COPP-2024-00142')}</span>
            <span className="hc-chip soft">{t('NPI verificado')}</span>
          </div>
        </header>

        <div className="hc-patient">
          <span className="hc-patient-kicker">{t('Paciente')}</span>
          <strong className="hc-patient-name">{patient.name}</strong>
          <span className="hc-patient-meta">{patient.meta}</span>
          <div className="hc-patient-stats">
            {patient.stats.map(([value, label]) => (
              <div key={label} className="hc-stat">
                <b>{value}</b>
                <small>{t(label)}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="sec">{t('Secciones del expediente')}</div>

        <IonAccordionGroup className="hc-acc" value="ident">
          {sections.map((s) => (
            <IonAccordion key={s.id} value={s.id}>
              <IonItem slot="header" lines="none">
                <span className="hc-acc-ico" aria-hidden="true">
                  {s.emoji}
                </span>
                <IonLabel>{t(s.title)}</IonLabel>
              </IonItem>
              <div slot="content" className="hc-acc-body">
                {s.rows.map(([l, v]) => (
                  <div key={l} className="hc-row">
                    <span className="hc-lbl">{t(l)}</span>
                    <strong className="hc-val">{t(v)}</strong>
                  </div>
                ))}
              </div>
            </IonAccordion>
          ))}
        </IonAccordionGroup>
      </Scroll>
    </Screen>
  )
}
