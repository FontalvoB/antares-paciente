import { IonIcon, IonProgressBar } from '@ionic/react'
import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import { flame, gift, shieldCheckmark, trophy } from 'ionicons/icons'
import { RingProgress } from '../../components/RingProgress'
import {
  CAL_DAY_LABELS,
  LONGEST_STREAK,
  NEXT_CHEST_DAYS,
  PROGRAM_WEEKS,
  WEEK_LABELS,
} from '../../data/program'
import { CountUp } from './visuals'

export function StreakView({
  streak,
  weekCheckins,
  todayIdx,
  cells,
  chestPct,
  weekPct,
  programWeek,
  onCell,
}: {
  streak: number
  weekCheckins: boolean[]
  todayIdx: number
  cells: { d: number | null; kind: string }[]
  chestPct: number
  weekPct: number
  programWeek: number
  onCell: (day: number, past: boolean) => void
}) {
  const monthRaw = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const monthTitle = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1)
  const today = new Date().getDate()
  const remain = Math.max(0, NEXT_CHEST_DAYS - streak)

  return (
    <div className="pg-pane cpad">
      <motion.section
        className="pg-streak-hero"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="pg-flame" aria-hidden="true">
          <span className="pg-flame-glow" />
          <span className="pg-flame-glow g2" />
          <IonIcon icon={flame} />
        </div>
        <div className="pg-streak-num">
          <CountUp to={streak} duration={1.05} />
        </div>
        <div className="pg-streak-lbl">días seguidos</div>
        <p className="pg-streak-copy">Cada día completo protege el fuego. No lo dejes apagar.</p>
        <div className="pg-streak-chips">
          <span>
            <IonIcon icon={trophy} /> Máxima {LONGEST_STREAK}
          </span>
          <span>
            <IonIcon icon={shieldCheckmark} /> 1 rescate
          </span>
        </div>
      </motion.section>

      <div className="pg-week-card">
        <div className="pg-week-lbl">Esta semana</div>
        <div className="pg-week">
          {WEEK_LABELS.map((label, i) => {
            const done = weekCheckins[i]
            const isToday = i === todayIdx
            return (
              <motion.div
                key={label}
                className={`pg-week-day ${done ? 'done' : ''} ${isToday ? 'today' : ''}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.05, duration: 0.3 }}
              >
                <span>{label}</span>
                <b>{done ? '✓' : isToday ? '·' : ''}</b>
              </motion.div>
            )
          })}
        </div>
      </div>

      <div className="pg-cal-v2">
        <div className="pg-cal-v2-head">
          <div>
            <h3>{monthTitle}</h3>
            <p>Tu mapa de consistencia</p>
          </div>
          <div className="pg-cal-v2-stat">
            <b>{cells.filter((c) => c.kind.includes('ok')).length}</b>
            <span>días ok</span>
          </div>
        </div>
        <div className="pg-cal-v2-lbls">
          {CAL_DAY_LABELS.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="pg-cal-v2-grid">
          {cells.map((c, i) => (
            <button
              key={i}
              type="button"
              className={`pg-cal-orb ${c.kind}`}
              disabled={!c.d}
              aria-label={c.d ? `Día ${c.d}` : undefined}
              onClick={() => c.d && onCell(c.d, c.d < today)}
            >
              {c.d ?? ''}
            </button>
          ))}
        </div>
        <div className="pg-cal-v2-legend">
          <span>
            <i className="ok" /> Completo
          </span>
          <span>
            <i className="partial" /> Parcial
          </span>
          <span>
            <i className="today" /> Hoy
          </span>
          <span>
            <i className="mile" /> Hito
          </span>
        </div>
      </div>

      <div className="card chest-next pg-chest-goal">
        <div className="chest-next-row">
          <RingProgress
            value={chestPct}
            size={72}
            stroke={6}
            trackColor="rgba(255,255,255,0.14)"
            gradient={['#c4b5fd', '#7c3aed']}
          >
            <span className="pg-gift">
              <IonIcon icon={gift} />
            </span>
          </RingProgress>
          <div>
            <div className="ct">Cofre de Permanencia</div>
            <div className="cs">
              {remain === 0
                ? 'Listo para abrir'
                : `${remain} día${remain === 1 ? '' : 's'} para el premio`}
            </div>
          </div>
        </div>
        <IonProgressBar
          value={chestPct}
          className="pb"
          style={
            {
              '--background': 'rgba(255,255,255,.12)',
              '--progress-background': 'linear-gradient(90deg,#c4b5fd,#7c3aed)',
            } as CSSProperties
          }
        />
        <div className="chest-next-meta">
          {streak} de {NEXT_CHEST_DAYS} · +1,500 XP al abrir
        </div>
      </div>

      <div className="card pg-protocol">
        <div className="pg-protocol-top">
          <div className="cs">Recorrido del protocolo</div>
          <strong>
            Semana {programWeek}/{PROGRAM_WEEKS}
          </strong>
        </div>
        <IonProgressBar
          value={weekPct}
          className="pb"
          style={
            {
              '--progress-background': 'linear-gradient(90deg,var(--cyan),var(--teal))',
            } as CSSProperties
          }
        />
      </div>
    </div>
  )
}
