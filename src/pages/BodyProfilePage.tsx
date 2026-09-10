import { useState } from 'react'
import type { CSSProperties } from 'react'
import {
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSegment,
  IonSegmentButton,
} from '@ionic/react'
import { arrowDown, arrowUp, bodyOutline, removeOutline } from 'ionicons/icons'
import { BodyMap } from '../components/BodyMap'
import { Screen, Scroll } from '../components/Screen'
import {
  BODY_DERIVED,
  BODY_FOOTNOTE,
  BODY_INDICES,
  BODY_MEASURES,
  bodySelection,
  type BodyIndex,
  type BodyView,
} from '../data/bodyProfile'
import { useT } from '../i18n/I18nContext'

/** Posición del valor dentro de la escala de referencia, en 0-100 %. */
function pinAt(index: BodyIndex) {
  const { min, max } = index.scale
  return Math.min(100, Math.max(0, ((index.raw - min) / (max - min)) * 100))
}

const TREND_ICON = { down: arrowDown, up: arrowUp, flat: removeOutline }

export function BodyProfilePage() {
  const t = useT()
  const [activeId, setActiveId] = useState(BODY_INDICES[0].id as string)
  const [view, setView] = useState<BodyView>('front')
  const selection = bodySelection(activeId)
  const accent =
    selection.kind === 'index' ? selection.item.color : selection.item.color

  const select = (id: string) => {
    const next = bodySelection(id)
    setActiveId(id)
    if (next.kind === 'measure' || next.item.regions[view].length === 0) {
      setView(next.item.preferredView)
    }
  }

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
          <IonSegment
            className="bp-seg nut-period"
            value={view}
            onIonChange={(e) =>
              setView((e.detail.value as BodyView) || 'front')
            }
          >
            <IonSegmentButton value="front">{t('Frente')}</IonSegmentButton>
            <IonSegmentButton value="back">{t('Espalda')}</IonSegmentButton>
          </IonSegment>

          <p className="bp-hint">
            {t('Toca una zona del cuerpo o un índice para ver el detalle.')}
          </p>

          <BodyMap
            indices={BODY_INDICES}
            activeId={activeId}
            view={view}
            onSelect={select}
          />

          {selection.kind === 'index' ? (
            <IndexDetail index={selection.item} />
          ) : (
            <div
              className="bp-detail"
              style={{ '--a': accent } as CSSProperties}
            >
              <div className="bp-detail-top">
                <div className="bp-detail-val">
                  <strong>{selection.item.value}</strong>
                  <span>{selection.item.unit}</span>
                </div>
                <div className="bp-detail-id">
                  <b>{t(selection.item.label)}</b>
                  <span className="bp-tone ok">{t(selection.item.zone)}</span>
                </div>
              </div>
              <p className="bp-detail-text">{t(selection.item.note)}</p>
              {selection.item.delta ? (
                <span className={`bp-delta${selection.item.good ? ' good' : ''}`}>
                  <IonIcon icon={TREND_ICON[selection.item.trend]} />
                  {selection.item.delta}
                </span>
              ) : null}
            </div>
          )}
        </div>

        <div className="sec">{t('Mediciones')}</div>

        <IonList className="bp-list" lines="full">
          {BODY_MEASURES.map((m) => (
            <IonItem
              key={m.id}
              button
              detail={false}
              className={m.id === activeId ? 'on' : undefined}
              onClick={() => select(m.id)}
            >
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

function IndexDetail({ index }: { index: BodyIndex }) {
  const t = useT()
  return (
    <div className="bp-detail" style={{ '--a': index.color } as CSSProperties}>
      <div className="bp-detail-top">
        <div className="bp-detail-val">
          <strong>{index.value}</strong>
          <span>{index.unit}</span>
        </div>
        <div className="bp-detail-id">
          <b>{t(index.label)}</b>
          <span className={`bp-tone ${index.tone}`}>{t(index.qualifier)}</span>
        </div>
      </div>

      <div className="bp-scale">
        <div className="bp-scale-track">
          {index.scale.bands.map((band, i) => {
            const from = i === 0 ? index.scale.min : index.scale.bands[i - 1].to
            const span = (band.to - from) / (index.scale.max - index.scale.min)
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
            style={{ left: `${pinAt(index)}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="bp-scale-legend">
          {index.scale.bands.map((band, i) => {
            const from = i === 0 ? index.scale.min : index.scale.bands[i - 1].to
            const span = (band.to - from) / (index.scale.max - index.scale.min)
            return (
              <span key={band.label} style={{ flexGrow: span }}>
                {t(band.label)}
              </span>
            )
          })}
        </div>
      </div>

      <p className="bp-detail-text">{t(index.detail)}</p>
      <span className="bp-target">{t(index.target)}</span>
    </div>
  )
}
