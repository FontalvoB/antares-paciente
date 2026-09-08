import { useState } from 'react'
import { IonIcon, IonLabel, IonList, IonItem, IonNote } from '@ionic/react'
import { arrowDown, arrowUp, bodyOutline, removeOutline } from 'ionicons/icons'
import { BodyMap } from '../components/BodyMap'
import { Screen, Scroll } from '../components/Screen'
import {
  BODY_DERIVED,
  BODY_FOOTNOTE,
  BODY_INDICES,
  BODY_MEASURES,
} from '../data/bodyProfile'
import type { BodyIndex } from '../data/bodyProfile'
import { useT } from '../i18n/I18nContext'
import type { CSSProperties } from 'react'

/** Posición del valor dentro de la escala de referencia, en 0-100 %. */
function pinAt(index: BodyIndex) {
  const { min, max } = index.scale
  return Math.min(100, Math.max(0, ((index.raw - min) / (max - min)) * 100))
}

const TREND_ICON = { down: arrowDown, up: arrowUp, flat: removeOutline }

export function BodyProfilePage() {
  const t = useT()
  const [activeId, setActiveId] = useState(BODY_INDICES[0].id as string)
  const active = BODY_INDICES.find((i) => i.id === activeId) ?? BODY_INDICES[0]

  return (
    <Screen>
      <Scroll className="bp">
        <header className="bp-head">
          <div className="bp-head-top">
            <div>
              <span className="bp-kicker">{t('Composición corporal')}</span>
              <h1 className="bp-title">{t('Visualización del perfil')}</h1>
              <p className="bp-date">{t('Medición del 05/08/2026')}</p>
            </div>
            <span className="bp-badge" aria-hidden="true">
              <IonIcon icon={bodyOutline} />
            </span>
          </div>

          <div className="bp-chips">
            <span className="bp-chip green">{t('Riesgo bajo')}</span>
            <span className="bp-chip navy">{t('Semana 12 de 24')}</span>
            <span className="bp-chip soft">{t('3 índices')}</span>
          </div>
        </header>

        <div className="sec">{t('Índices sobre tu cuerpo')}</div>

        <div className="bp-card">
          <p className="bp-hint">
            {t('Toca un índice para ver qué significa y cuál es tu meta.')}
          </p>

          <BodyMap
            indices={BODY_INDICES}
            activeId={activeId}
            onSelect={setActiveId}
          />

          <div
            className="bp-detail"
            style={{ '--a': active.color } as CSSProperties}
          >
            <div className="bp-detail-top">
              <div className="bp-detail-val">
                <strong>{active.value}</strong>
                <span>{active.unit}</span>
              </div>
              <div className="bp-detail-id">
                <b>{t(active.label)}</b>
                <span className={`bp-tone ${active.tone}`}>
                  {t(active.qualifier)}
                </span>
              </div>
            </div>

            <div className="bp-scale">
              <div className="bp-scale-track">
                {active.scale.bands.map((band, i) => {
                  const from =
                    i === 0 ? active.scale.min : active.scale.bands[i - 1].to
                  const span =
                    (band.to - from) / (active.scale.max - active.scale.min)
                  return (
                    <i
                      key={band.label}
                      className={`bp-band ${band.tone}`}
                      style={{ flexGrow: span }}
                    />
                  )
                })}
                <span
                  className="bp-scale-pin"
                  style={{ left: `${pinAt(active)}%` }}
                  aria-hidden="true"
                />
              </div>
              <div className="bp-scale-legend">
                {active.scale.bands.map((band, i) => {
                  const from =
                    i === 0 ? active.scale.min : active.scale.bands[i - 1].to
                  const span =
                    (band.to - from) / (active.scale.max - active.scale.min)
                  return (
                    <span key={band.label} style={{ flexGrow: span }}>
                      {t(band.label)}
                    </span>
                  )
                })}
              </div>
            </div>

            <p className="bp-detail-text">{t(active.detail)}</p>
            <span className="bp-target">{t(active.target)}</span>
          </div>
        </div>

        <div className="sec">{t('Mediciones')}</div>

        <IonList className="bp-list" lines="full">
          {BODY_MEASURES.map((m) => (
            <IonItem key={m.id}>
              <IonLabel>
                <h3>{t(m.label)}</h3>
                <p>{t(m.note)}</p>
              </IonLabel>
              <IonNote slot="end" className="bp-note">
                <b>
                  {m.value}
                  <i>{m.unit}</i>
                </b>
                {m.delta ? (
                  <span className={`bp-delta${m.good ? ' good' : ''}`}>
                    <IonIcon icon={TREND_ICON[m.trend]} />
                    {m.delta}
                  </span>
                ) : null}
              </IonNote>
            </IonItem>
          ))}
        </IonList>

        <div className="bp-derived">
          {BODY_DERIVED.map((d) => (
            <div key={d.id} className="bp-derived-item">
              <small>{t(d.label)}</small>
              <strong>{t(d.value)}</strong>
              <span>{t(d.note)}</span>
            </div>
          ))}
        </div>

        <p className="bp-foot">{t(BODY_FOOTNOTE)}</p>
      </Scroll>
    </Screen>
  )
}
