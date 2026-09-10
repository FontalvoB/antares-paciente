import { IonButton, IonContent, IonIcon, IonModal } from '@ionic/react'
import { close, sparkles, trendingDown, trendingUp } from 'ionicons/icons'
import type { HomeMetricCard } from '../data/metrics'
import { formatMetricTarget, formatMetricValue } from '../data/metrics'
import { useI18n } from '../i18n/I18nContext'
import { formatDateForDisplay } from '../utils/dates'
import { Sparkline } from '../pages/program/visuals'

/**
 * Modal de historial de una métrica del Home. Recibe la tarjeta YA resuelta
 * por `resolveHomeCards` (verdad del backend): nunca lee constantes estáticas.
 * Sin filas reales → estado requires-data honesto (nota, sin sparkline ni
 * lista fabricada).
 */
export function MetricHistoryModal({
  card,
  onClose,
}: {
  card: HomeMetricCard | null
  onClose: () => void
}) {
  const { t, lang } = useI18n()
  // S3: locale activo para números (es-ES coma decimal / en-US punto).
  const locale = lang === 'en' ? 'en-US' : 'es-ES'
  const fmt = (v: number) => formatMetricValue(v, card?.decimals ?? 0, locale)

  return (
    <IonModal
      isOpen={!!card}
      onDidDismiss={onClose}
      initialBreakpoint={1}
      breakpoints={[0, 1]}
      handle
      className="metric-modal"
    >
      {card && (
        <IonContent>
          <div className="mh-sheet">
            <div className="mh-head">
              <div>
                <div className="mh-kicker">{t('Historial clínico')}</div>
                <h2>{t(card.label)}</h2>
                <p>{t('Todos los resultados registrados en tu protocolo.')}</p>
              </div>
              <IonButton fill="clear" aria-label={t('Cerrar')} onClick={onClose}>
                <IonIcon slot="icon-only" icon={close} />
              </IonButton>
            </div>

            {card.kind === 'requires-data' ? (
              <div className="mh-empty">
                <IonIcon icon={sparkles} />
                <p>{t(card.note)}</p>
              </div>
            ) : (
              <>
                <div
                  className="mh-hero"
                  style={{ ['--mh-accent' as string]: card.color }}
                >
                  <div>
                    <div className="mh-now">
                      {fmt(card.current)}
                      {card.unit ? <small>{card.unit}</small> : null}
                    </div>
                    {card.first != null && card.last != null && card.last !== card.first ? (
                      <div className={`mh-delta ${card.last < card.first ? 'down' : 'up'}`}>
                        <IonIcon
                          icon={card.last < card.first ? trendingDown : trendingUp}
                        />
                        {fmt(card.last - card.first)}
                      </div>
                    ) : null}
                  </div>
                  {formatMetricTarget(card.target, card.unit, card.decimals, locale) && (
                    <div className="mh-target">
                      <span>{t('Meta')}</span>
                      <b>{formatMetricTarget(card.target, card.unit, card.decimals, locale)}</b>
                    </div>
                  )}
                </div>

                {card.points.length >= 2 && (
                  <div className="mh-chart">
                    <div className="mh-chart-lbl">
                      <IonIcon icon={sparkles} />
                      {t('Tendencia')}
                    </div>
                    <Sparkline
                      points={card.points.map((p) => p.value)}
                      color={card.color}
                      height={78}
                    />
                  </div>
                )}

                {card.points.length >= 1 && (
                  <div className="mh-list">
                    {[...card.points].reverse().map((row, i) => {
                      const prev = card.points[card.points.length - 2 - i]
                      const diff = prev ? row.value - prev.value : 0
                      return (
                        // S2: dos mediciones el mismo día → key única por índice.
                        <div key={`${row.date}-${i}`} className="mh-row">
                          <div
                            className="mh-dot"
                            style={{ background: card.color }}
                          />
                          <div className="mh-row-body">
                            <strong>
                              {fmt(row.value)}
                              {card.unit ? ` ${card.unit}` : ''}
                            </strong>
                            <span />
                          </div>
                          <div className="mh-row-meta">
                            <time dateTime={row.date}>
                              {formatDateForDisplay(row.date)}
                            </time>
                            {prev ? (
                              <small className={diff < 0 ? 'better' : diff === 0 ? '' : 'worse'}>
                                {diff > 0 ? '+' : ''}
                                {fmt(diff)}
                              </small>
                            ) : (
                              <small>{t('Inicio')}</small>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </IonContent>
      )}
    </IonModal>
  )
}
