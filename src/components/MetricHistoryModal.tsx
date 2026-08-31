import { IonButton, IonContent, IonIcon, IonModal } from '@ionic/react'
import { close, sparkles, trendingDown, trendingUp } from 'ionicons/icons'
import { HEALTH_METRICS, type MetricId } from '../data/metrics'
import { useT } from '../i18n/I18nContext'
import { formatDateForDisplay } from '../utils/dates'
import { Sparkline } from '../pages/program/visuals'

export function MetricHistoryModal({
  metricId,
  pointsTotal,
  onClose,
}: {
  metricId: MetricId | null
  pointsTotal: number
  onClose: () => void
}) {
  const t = useT()
  const metric = HEALTH_METRICS.find((m) => m.id === metricId) ?? null
  const current = metric?.id === 'pts' ? String(pointsTotal) : metric?.current
  const series = metric?.history.map((h) => h.value) ?? []
  const first = metric?.history[0]?.value
  const last = metric?.history.at(-1)?.value
  const delta = first != null && last != null ? last - first : 0
  const improved = metric ? (metric.direction === 'down' ? delta < 0 : delta > 0) : false

  return (
    <IonModal
      isOpen={!!metric}
      onDidDismiss={onClose}
      initialBreakpoint={1}
      breakpoints={[0, 1]}
      handle
      className="metric-modal"
    >
      {metric && (
        <IonContent>
          <div className="mh-sheet">
            <div className="mh-head">
              <div>
                <div className="mh-kicker">{t('Historial clínico')}</div>
                <h2>{t(metric.label)}</h2>
                <p>{t('Todos los resultados registrados en tu protocolo.')}</p>
              </div>
              <IonButton fill="clear" aria-label={t('Cerrar')} onClick={onClose}>
                <IonIcon slot="icon-only" icon={close} />
              </IonButton>
            </div>

            <div className="mh-hero" style={{ ['--mh-accent' as string]: metric.color }}>
              <div>
                <div className="mh-now">
                  {current}
                  {metric.unit && !String(current).includes(metric.unit) ? (
                    <small>{metric.unit}</small>
                  ) : null}
                </div>
                <div className={`mh-delta ${improved ? 'up' : 'down'}`}>
                  <IonIcon icon={delta < 0 ? trendingDown : trendingUp} />
                  {t(metric.sub)}
                </div>
              </div>
              <div className="mh-target">
                <span>{t('Meta')}</span>
                <b>{t(metric.target)}</b>
              </div>
            </div>

            <div className="mh-chart">
              <div className="mh-chart-lbl">
                <IonIcon icon={sparkles} />
                {t('Tendencia')}
              </div>
              <Sparkline points={series} color={metric.color} height={78} />
            </div>

            <div className="mh-list">
              {[...metric.history].reverse().map((row, i) => {
                const prev = metric.history[metric.history.length - 2 - i]
                const diff = prev ? row.value - prev.value : 0
                const better = metric.direction === 'down' ? diff < 0 : diff > 0
                return (
                  <div key={row.iso} className="mh-row">
                    <div className="mh-dot" style={{ background: metric.color }} />
                    <div className="mh-row-body">
                      <strong>
                        {row.value.toLocaleString('es-ES', {
                          minimumFractionDigits: metric.decimals,
                          maximumFractionDigits: metric.decimals,
                        })}
                        {metric.unit ? ` ${metric.unit}` : ''}
                      </strong>
                      <span>{t(row.note)}</span>
                    </div>
                    <div className="mh-row-meta">
                      <time dateTime={row.iso}>{formatDateForDisplay(row.iso)}</time>
                      {prev ? (
                        <small className={better ? 'better' : diff === 0 ? '' : 'worse'}>
                          {diff > 0 ? '+' : ''}
                          {diff.toLocaleString('es-ES', {
                            minimumFractionDigits: metric.decimals,
                            maximumFractionDigits: metric.decimals,
                          })}
                        </small>
                      ) : (
                        <small>{t('Inicio')}</small>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </IonContent>
      )}
    </IonModal>
  )
}
