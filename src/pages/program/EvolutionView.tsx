import { useMemo } from 'react'
import { IonButton, IonIcon, IonSkeletonText } from '@ionic/react'
import { motion } from 'framer-motion'
import { flag, sparkles, trendingDown, trendingUp, warning } from 'ionicons/icons'
import { RingProgress } from '../../components/RingProgress'
import type { ScoresHistoryPointDto, ScoresResponseDto } from '../../services/program/types'
import { useT } from '../../i18n/I18nContext'
import { useScoresHistory } from '../../hooks/useScoresHistory'
import {
  resolveEvolutionViewState,
  resolveHistoryViewState,
  resolveTransformRows,
  resolveWatchCard,
} from '../../utils/evolution'
import { CountUp, Sparkline } from './visuals'

/**
 * Códigos canónicos de % grasa corporal + resolvers puros del detail viven en
 * `utils/evolution.ts` (METRIC_LABELS / resolveWatchCard / resolveTransformRows).
 */

// ---------------------------------------------------------------------------
// Estados honestos (sin mocks): loading skeleton / error+retry / empty
// ---------------------------------------------------------------------------

function EvolutionSkeleton() {
  return (
    <div className="pg-pane cpad" aria-busy="true">
      <div className="card pg-evo-hero">
        <div className="pg-evo-top">
          <IonSkeletonText animated style={{ width: 128, height: 128, borderRadius: '50%' }} />
          <div className="pg-evo-kpis" aria-hidden="true">
            <IonSkeletonText animated style={{ width: '100%', height: 38, borderRadius: 12 }} />
            <IonSkeletonText animated style={{ width: '100%', height: 38, borderRadius: 12 }} />
            <IonSkeletonText animated style={{ width: '100%', height: 38, borderRadius: 12 }} />
          </div>
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <IonSkeletonText
            key={i}
            animated
            style={{ width: '100%', height: 12, borderRadius: 99, marginBottom: 10 }}
          />
        ))}
      </div>
      <div className="card pg-trend-card">
        <IonSkeletonText animated style={{ width: 170, height: 14 }} />
        <IonSkeletonText animated style={{ width: '100%', height: 72, borderRadius: 12, marginTop: 10 }} />
        <IonSkeletonText animated style={{ width: '100%', height: 10, borderRadius: 99, marginTop: 8 }} />
      </div>
      <div className="card">
        <IonSkeletonText animated style={{ width: 150, height: 14 }} />
        <IonSkeletonText animated style={{ width: '100%', height: 44, borderRadius: 10, marginTop: 12 }} />
        <IonSkeletonText animated style={{ width: '100%', height: 44, borderRadius: 10, marginTop: 8 }} />
      </div>
    </div>
  )
}

function EvolutionMessage({ kind, onRetry }: { kind: 'error' | 'empty'; onRetry: () => void }) {
  const t = useT()
  return (
    <div className="pg-pane cpad">
      <div className="rk-empty">
        <div className="rk-empty-ico">
          <IonIcon icon={kind === 'error' ? flag : sparkles} />
        </div>
        <h3>
          {kind === 'error' ? t('No pudimos cargar tu evolución') : t('Tu evolución está arrancando')}
        </h3>
        <p>
          {kind === 'error'
            ? t('Intenta de nuevo en unos segundos.')
            : t('Sin datos todavía. Tu equipo cargará tu línea base en tu primera consulta.')}
        </p>
        <IonButton expand="block" className="bt bt-primary" onClick={onRetry}>
          {t('Reintentar')}
        </IonButton>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Vista de datos — SOLO números reales (rework anti-datos fabricados)
// ---------------------------------------------------------------------------

export function EvolutionView({
  scores,
  stale = false,
  scoresLoading,
  scoresError,
  onRetryScores,
  onGoBook,
}: {
  scores?: ScoresResponseDto
  stale?: boolean
  scoresLoading: boolean
  scoresError: boolean
  onRetryScores: () => void
  onGoBook: () => void
}) {
  const t = useT()
  // Trend card: hook interno self-hosted (patrón RankingView/useLeague).
  const { history, isLoading: historyLoading, isError: historyError } = useScoresHistory()

  const view = resolveEvolutionViewState({
    isLoading: scoresLoading,
    isError: scoresError,
    scores,
  })

  // --- Derivaciones reales ---
  // Seguras con `scores` undefined (los early returns llegan DESPUÉS de todos
  // los hooks — regla rules-of-hooks: mismo orden en cada render).
  const hs = scores?.health_score ?? scores?.healthScore ?? null
  const ts = scores?.transformation_score ?? scores?.transformationScore ?? null
  const detail = ts?.detail ?? null
  const healthScore = view.state === 'data' ? view.healthScore : null
  const prevHealthScore = view.state === 'data' ? view.previousHealthScore : null
  // Sin fila previa → los KPIs Anterior/Cambio NO se renderizan (antes se
  // inyectaba un 81 fijo y se fabricaba un delta). Con previo → delta real.
  const hasPrevious = prevHealthScore !== null
  const changeScore = hasPrevious && healthScore !== null ? healthScore - prevHealthScore : null
  const transformScore = ts?.current ?? ts?.score ?? null
  const isStale = stale

  // Pilares reales del Health Score; sin `dimensions` (campo aditivo) el
  // bloque se degrada a nota muda — nunca barras inventadas.
  const pillars = useMemo(() => {
    const dims = hs?.dimensions
    if (!dims) return null
    return [
      { label: 'Nutrición', pct: dims.nutrition, color: '#1d9e75' },
      { label: 'Ejercicio', pct: dims.exercise, color: '#20c8ff' },
      { label: 'Bienestar mental', pct: dims.psychology, color: '#a78bfa' },
      { label: 'Adherencia al plan', pct: dims.adherence, color: '#f59e0b' },
      { label: 'Control clínico', pct: dims.clinical, color: '#ec4899' },
    ]
  }, [hs])

  // Filas de transformación REALES (detail del backend; entradas SIN nombre —
  // la key ES el código de métrica y el label sale de METRIC_LABELS). Sin
  // detail → null → la UI degrada a requires-data, jamás filas fabricadas.
  const transformRows = useMemo(() => resolveTransformRows(detail), [detail])

  // Serie REAL de Health Score para la sparkline (filtra semanas persistidas
  // sin cómputo; null nunca rompe el chart).
  const series = useMemo(() => {
    const pts = history?.points ?? []
    return pts
      .filter((p): p is ScoresHistoryPointDto & { healthScore: number } => p.healthScore != null)
      .map((p) => ({ week: p.weekNumber, value: p.healthScore }))
  }, [history])

  const trendState = resolveHistoryViewState({
    isLoading: historyLoading,
    isError: historyError,
    points: history?.points,
  })

  const trendDelta = useMemo(() => {
    if (series.length < 2) return null
    return series[series.length - 1].value - series[series.length - 2].value
  }, [series])

  // Watch card ("Índice de grasa"): SOLO con indicador real de % grasa en el
  // detail actual + `delta_pct` (wire snake_case) computado por el backend.
  // Sin esos datos la card NO se renderiza (antes: texto 100% fabricado).
  const watch = useMemo(() => resolveWatchCard(detail), [detail])

  if (view.state === 'loading') return <EvolutionSkeleton />

  if (view.state === 'error' || view.state === 'empty') {
    return <EvolutionMessage kind={view.state} onRetry={onRetryScores} />
  }

  return (
    <div className="pg-pane cpad">
      <motion.section
        className="card pg-evo-hero"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="pg-evo-top">
          <RingProgress
            value={healthScore !== null ? healthScore / 100 : 0}
            size={128}
            stroke={11}
            trackColor="var(--g1)"
            gradient={['#20c8ff', '#1d9e75']}
            glow
          >
            <b className="pg-evo-score">
              {healthScore !== null ? <CountUp to={healthScore} duration={1.1} /> : '—'}
            </b>
            <small>{t('Health')}</small>
          </RingProgress>
          <div className="pg-evo-kpis">
            {hasPrevious && (
              <div>
                <span>{t('Anterior')}</span>
                <b>{prevHealthScore}</b>
              </div>
            )}
            {hasPrevious && changeScore !== null && (
              <div>
                <span>{t('Cambio')}</span>
                <b className={changeScore >= 0 ? 'up' : 'down'}>
                  {changeScore >= 0 ? `+${changeScore}` : changeScore}
                </b>
              </div>
            )}
            <div>
              <span>{t('Meta')}</span>
              {/* Meta estática del protocolo (diseño): el Health Score objetivo
                  es 90; es un umbral del plan, no un dato fabricado del paciente. */}
              <b>90</b>
            </div>
          </div>
        </div>
        {pillars ? (
          <div className="hs-bars pg-pillars">
            {pillars.map((p, i) => (
              <div key={p.label} className="hs-bar-row">
                <div className="hs-bar-top">
                  <span>{t(p.label)}</span>
                  <span>{p.pct}%</span>
                </div>
                <div className="hs-bar-track">
                  <motion.div
                    className="hs-bar-fill"
                    style={{ background: p.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${p.pct}%` }}
                    transition={{ delay: 0.15 + i * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="tf-reqdata">
            {t('Sin línea base clínica aún · tu equipo la fija en tu primera consulta')}
          </div>
        )}
      </motion.section>

      <motion.section
        className="card pg-trend-card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.4 }}
      >
        <div className="pg-trend-head">
          <div>
            <div className="ct">{t('Health Score')}</div>
            <div className="cs">{t('Tus últimas semanas')}</div>
          </div>
          {trendState === 'data' && trendDelta !== null && (
            <span className="pg-trend-chip">
              <IonIcon icon={trendDelta >= 0 ? trendingUp : trendingDown} />
              {trendDelta >= 0 ? `+${trendDelta}` : trendDelta} pts
            </span>
          )}
        </div>
        {trendState === 'loading' && (
          <IonSkeletonText animated style={{ width: '100%', height: 72, borderRadius: 12, marginTop: 8 }} />
        )}
        {(trendState === 'empty' || (trendState === 'data' && series.length < 2)) && (
          <div className="pg-trend-empty">{t('Aún no hay suficientes semanas para ver tu tendencia')}</div>
        )}
        {trendState === 'data' && series.length >= 2 && (
          <>
            <Sparkline points={series.map((s) => s.value)} color="var(--teal)" height={72} />
            <div className="pg-trend-axis">
              {series.map((s) => (
                <span key={s.week}>S{s.week}</span>
              ))}
            </div>
          </>
        )}
      </motion.section>

      <motion.section
        className="card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        {transformScore !== null ? (
          <>
            <div className="tf-head">
              <div>
                <div className="ct">
                  {t('Transformation Score')}
                  {isStale && (
                    <span className="chip chip-glass" style={{ marginLeft: 8, fontSize: 10 }}>
                      {t('Actualizando…')}
                    </span>
                  )}
                </div>
                <div className="cs">{t('Desde tu línea base · día 0')}</div>
              </div>
              <div className="tf-score">
                <CountUp to={transformScore} duration={1} />
              </div>
            </div>
            {transformRows ? (
              transformRows.map((r, i) => (
                <motion.div
                  key={r.metricCode}
                  className="tf-row pg-tf-row"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.22 + i * 0.05, duration: 0.3 }}
                >
                  <div className="tf-lbl">{t(r.label)}</div>
                  <div className="tf-base">{r.base}</div>
                  <span className="pg-tf-arrow" aria-hidden="true">
                    →
                  </span>
                  <div className="tf-cur">{r.cur}</div>
                  <div className={`tf-delta ${r.delta.tone}`}>{r.delta.text}</div>
                </motion.div>
              ))
            ) : (
              <div className="tf-reqdata">
                {t('Sin línea base clínica aún · tu equipo la fija en tu primera consulta')}
              </div>
            )}
          </>
        ) : (
          <div className="tf-reqdata">
            {t('Sin línea base clínica aún · tu equipo la fija en tu primera consulta')}
          </div>
        )}
      </motion.section>

      {watch && (
        <motion.div
          className="wk-card wk-amber pg-watch"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.35 }}
        >
          <div className="pg-watch-ico">
            <IonIcon icon={warning} />
          </div>
          <div>
            <div className="wk-title">
              {t('Índice de grasa: {delta}% esta semana', { delta: watch.delta })}
            </div>
            <div className="wk-sub">{t('Coméntalo con tu nutricionista en tu próxima cita')}</div>
            <IonButton className="bt bt-gold" onClick={onGoBook}>
              {t('Ver cita')}
            </IonButton>
          </div>
        </motion.div>
      )}
    </div>
  )
}