import { IonButton, IonIcon } from '@ionic/react'
import { motion } from 'framer-motion'
import { trendingUp, warning } from 'ionicons/icons'
import { RingProgress } from '../../components/RingProgress'
import {
  HEALTH_PILLARS,
  HEALTH_SCORE,
  HEALTH_TREND,
  TRANSFORM_ROWS,
  TRANSFORM_SCORE,
} from '../../data/program'
import { useT } from '../../i18n/I18nContext'
import { CountUp, Sparkline } from './visuals'

export function EvolutionView({ onGoBook }: { onGoBook: () => void }) {
  const t = useT()
  const trend = HEALTH_TREND.map((p) => p.v)

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
            value={HEALTH_SCORE / 100}
            size={128}
            stroke={11}
            trackColor="var(--g1)"
            gradient={['#20c8ff', '#1d9e75']}
            glow
          >
            <b className="pg-evo-score">
              <CountUp to={HEALTH_SCORE} duration={1.1} />
            </b>
            <small>Health</small>
          </RingProgress>
          <div className="pg-evo-kpis">
            <div>
              <span>{t('Anterior')}</span>
              <b>81</b>
            </div>
            <div>
              <span>{t('Cambio')}</span>
              <b className="up">+5</b>
            </div>
            <div>
              <span>{t('Meta')}</span>
              <b>90</b>
            </div>
          </div>
        </div>
        <div className="hs-bars pg-pillars">
          {HEALTH_PILLARS.map((p, i) => (
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
      </motion.section>

      <motion.section
        className="card pg-trend-card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.4 }}
      >
        <div className="pg-trend-head">
          <div>
            <div className="ct">Health Score</div>
            <div className="cs">{t('Semanas 6 a 12 del protocolo')}</div>
          </div>
          <span className="pg-trend-chip">
            <IonIcon icon={trendingUp} /> +14 pts
          </span>
        </div>
        <Sparkline points={trend} color="var(--teal)" height={72} />
        <div className="pg-trend-axis">
          {HEALTH_TREND.map((p) => (
            <span key={p.w}>S{p.w}</span>
          ))}
        </div>
      </motion.section>

      <motion.section
        className="card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <div className="tf-head">
          <div>
            <div className="ct">Transformation Score</div>
            <div className="cs">{t('Desde tu línea base · día 0')}</div>
          </div>
          <div className="tf-score">
            <CountUp to={TRANSFORM_SCORE} duration={1} />
          </div>
        </div>
        {TRANSFORM_ROWS.map((r, i) => (
          <motion.div
            key={r.label}
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
            <div className="tf-delta">{r.delta}</div>
          </motion.div>
        ))}
      </motion.section>

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
          <div className="wk-title">{t('Índice de grasa: tendencia a vigilar')}</div>
          <div className="wk-sub">
            {t('+0.4% esta semana. La IA sugiere revisar proteínas con tu nutricionista.')}
          </div>
          <IonButton className="bt bt-gold" onClick={onGoBook}>
            {t('Ver cita')}
          </IonButton>
        </div>
      </motion.div>
    </div>
  )
}
