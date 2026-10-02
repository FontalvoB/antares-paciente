import { useState } from 'react'
import { IonButton, IonIcon, IonProgressBar, IonSkeletonText } from '@ionic/react'
import { bodyOutline, waterOutline, fitnessOutline, restaurantOutline, trophyOutline, calendarOutline } from 'ionicons/icons'
import { RingProgress } from '../RingProgress'
import { useT } from '../../i18n/I18nContext'
import { formatMetricValue } from '../../data/metrics'
import { formatDateForDisplay } from '../../utils/dates'
import type { MetricSeriesDto } from '../../services/program/types'

/** Tarjetas clínicas compartidas por Plan e Historial: solo mediciones reales. */
export function NutritionMetrics({ metrics, loading, locale }: { metrics: MetricSeriesDto[]; loading: boolean; locale: string }) {
  const t = useT()
  const definitions = [
    { code: 'bmi', label: 'IMC', icon: bodyOutline },
    { code: 'hba1c', label: 'HbA1c', icon: waterOutline },
    { code: 'body_fat', label: '% de grasa', icon: fitnessOutline },
  ]
  return <div className="ntr-metrics" aria-label={t('Indicadores de salud')}>
    {definitions.map(({ code, label, icon }) => {
      const series = metrics.find(m => m.code.toLowerCase() === code)
      const points = [...(series?.points ?? [])].sort((a, b) => a.date.localeCompare(b.date))
      const latest = points.at(-1)
      const first = points[0]
      return <article className="ntr-metric" key={code}>
        <IonIcon icon={icon} aria-hidden="true" />
        {loading && !latest ? <IonSkeletonText animated /> : <strong>{latest ? formatMetricValue(latest.value, 1, locale) : '—'}<small>{series?.unit}</small></strong>}
        <span>{t(label)}</span>
        <footer>{first && points.length > 1 ? t('Desde {value}', { value: formatMetricValue(first.value, 1, locale) }) : latest ? formatDateForDisplay(latest.date) : t('Sin medición')}</footer>
      </article>
    })}
  </div>
}

export function NutritionWeek({ current, previous, loading, failed, onRetry, locale }: {
  current: number | null; previous: number | null; loading: boolean; failed: boolean; onRetry: () => void; locale: string;
}) {
  const t = useT()
  const difference = current != null && previous != null ? current - previous : null
  return <div className="ntr-view">
    <section className="ntr-card ntr-week">
      <div className="ntr-section-title"><IonIcon icon={calendarOutline} /><h2>{t('Adherencia semanal')}</h2></div>
      <p className="ntr-muted">{t('Una mirada a tu constancia con la alimentación.')}</p>
      {loading && current == null ? <div aria-busy="true"><IonSkeletonText animated className="ntr-skeleton" /></div> : current == null ? <div className="ntr-empty">{t('Sin datos de adherencia esta semana todavía')}{failed && <IonButton fill="clear" onClick={onRetry}>{t('Reintentar')}</IonButton>}</div> : <>
        <div className="ntr-week-summary">
          <RingProgress value={current / 100} size={142} stroke={12} trackColor="var(--teal-l)" gradient={['var(--safe)', 'var(--blue)']}>
            <strong className="ntr-ring-number">{formatMetricValue(current, 0, locale)}<small>%</small></strong><span className="ntr-ring-label">{t('Adherencia')}</span>
          </RingProgress>
          <div className="ntr-week-comparison"><span>{t('Esta semana')}</span><strong>{t('Cada hábito cuenta')}</strong>
            {difference != null ? <p><b>{difference > 0 ? '↑' : difference < 0 ? '↓' : '—'} {formatMetricValue(Math.abs(difference), 0, locale)} {t('puntos')}</b><span>{t('vs. semana anterior')}</span></p> : <p>{t('Tu primera referencia semanal')}</p>}
          </div>
        </div>
        <div className="ntr-habit"><span className="ntr-habit-icon"><IonIcon icon={restaurantOutline} /></span><div><div className="ntr-row"><strong>{t('Alimentación')}</strong><b>{formatMetricValue(current, 0, locale)}%</b></div><IonProgressBar value={Math.max(0, Math.min(1, current / 100))} aria-label={t('Alimentación')} /></div></div>
        {previous != null && <div className="ntr-previous"><span>{t('Semana anterior')}</span><strong>{formatMetricValue(previous, 0, locale)}%</strong></div>}
      </>}
    </section>
    <aside className="ntr-encouragement"><span><IonIcon icon={trophyOutline} /></span><div><strong>{t('Tu constancia tiene valor')}</strong><p>{t('Revisa tu evolución, reconoce tus avances y sigue a tu ritmo.')}</p></div></aside>
  </div>
}

/** Gráfica SVG de dominio; Ionic no tiene gráfico temporal. Fechas espaciadas por tiempo real. */
export function NutritionWeightChart({ series, locale }: { series: MetricSeriesDto; locale: string }) {
  const t = useT()
  const [selection, setSelection] = useState<string | null>(null)
  const points = [...series.points].filter(p => Number.isFinite(p.value) && Number.isFinite(Date.parse(p.date))).sort((a, b) => a.date.localeCompare(b.date))
  if (!points.length) return null
  const chosen = points.find(p => p.date === selection) ?? points[points.length - 1]
  const values = points.map(p => p.value)
  const min = Math.min(...values), max = Math.max(...values)
  const start = Date.parse(points[0].date), end = Date.parse(points[points.length - 1].date)
  const coordinates = points.map(p => ({ ...p, x: end === start ? 160 : 12 + ((Date.parse(p.date) - start) / (end - start)) * 296, y: 88 - ((p.value - min) / (max - min || 1)) * 58 }))
  const path = coordinates.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')
  return <section className="ntr-weight-chart">
    <div className="ntr-row" aria-live="polite"><div><span className="ntr-eyebrow">{t('Evolución de peso')}</span><p>{formatDateForDisplay(chosen.date)}</p></div><strong>{formatMetricValue(chosen.value, 1, locale)} <small>{series.unit ?? 'kg'}</small></strong></div>
    <svg viewBox="0 0 320 110" role="img" aria-label={t('Evolución de peso')}>
      {[24, 56, 88].map(y => <line key={y} x1="12" x2="308" y1={y} y2={y} stroke="var(--bd)" strokeDasharray="3 5" />)}
      {coordinates.length > 1 && <path d={`${path} L 308 106 L 12 106 Z`} fill="var(--teal-l)" opacity=".6" />}
      <path d={path} fill="none" stroke="var(--blue)" strokeWidth="2.5" strokeLinejoin="round" />
      {coordinates.map(p => <circle key={p.date} cx={p.x} cy={p.y} r={p.date === chosen.date ? 5 : 3} fill="var(--teal)" stroke="var(--wh)" strokeWidth="2" />)}
    </svg>
    <div className="ntr-chart-dates"><span>{formatDateForDisplay(points[0].date)}</span><span>{formatDateForDisplay(points[points.length - 1].date)}</span></div>
    <div className="ntr-chart-select" aria-label={t('Mediciones')}>
      {points.slice(-7).map(p => <IonButton key={p.date} fill="clear" aria-pressed={p.date === chosen.date ? 'true' : 'false'} onClick={() => setSelection(p.date)}><span>{formatDateForDisplay(p.date)}<b>{formatMetricValue(p.value, 1, locale)} {series.unit ?? 'kg'}</b></span></IonButton>)}
    </div>
  </section>
}
