import { IonIcon, IonSegment, IonSegmentButton } from '@ionic/react'
import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { flag, medal, podium, ribbon, trophy } from 'ionicons/icons'
import {
  FLORIDA_PATIENTS,
  RANK_CATEGORIES,
  USER_STATE,
  rankedPatients,
  userRank,
  type RankCategory,
} from '../../data/rankings'
import { useT } from '../../i18n/I18nContext'

const PODIUM_ORDER = [1, 0, 2] as const

function formatValue(category: RankCategory, value: number) {
  if (category === 'racha' || category === 'rec') return String(value)
  return `${value}%`
}

function firstName(name: string) {
  return name.split(' ')[0] ?? name
}

export function RankingView() {
  const t = useT()
  const [cat, setCat] = useState<RankCategory>('racha')
  const rows = useMemo(() => rankedPatients(cat), [cat])
  const mine = useMemo(() => userRank(cat), [cat])
  const meta = RANK_CATEGORIES.find((c) => c.id === cat)!
  const top3 = rows.slice(0, 3)
  const rest = rows.slice(3)
  const total = FLORIDA_PATIENTS.length

  return (
    <div className="pg-pane cpad">
      <motion.section
        className="rk-hero"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="rk-hero-kicker">
          <IonIcon icon={flag} />
          {t('Liga de {state}', { state: t(USER_STATE) })}
        </div>
        <h2>{t('Pacientes de tu estado')}</h2>
        <p>
          {t('{n} pacientes activos en {state}. Compites en racha, evolución, adherencia y recuperación.', {
            n: String(total),
            state: t(USER_STATE),
          })}
        </p>
        <div className="rk-you">
          <div>
            <span>{t('Tu puesto')}</span>
            <b>
              #{mine.rank}
              <small>
                {t('de {n}', { n: String(total) })}
              </small>
            </b>
          </div>
          <div>
            <span>{t('Tú')}</span>
            <b>{firstName(mine.name)}</b>
          </div>
          <div>
            <span>{t(meta.label)}</span>
            <b>
              {formatValue(cat, mine.value)}
              {cat === 'racha' ? ` ${t('días')}` : ''}
            </b>
          </div>
        </div>
      </motion.section>

      <div className="rk-seg">
        <IonSegment value={cat} onIonChange={(e) => setCat((e.detail.value as RankCategory) || 'racha')}>
          {RANK_CATEGORIES.map((c) => (
            <IonSegmentButton key={c.id} value={c.id}>
              {t(c.label)}
            </IonSegmentButton>
          ))}
        </IonSegment>
      </div>

      <div className="rk-podium" aria-label={t('Podio')}>
        {PODIUM_ORDER.map((idx) => {
          const row = top3[idx]
          if (!row) return null
          const place = row.rank
          return (
            <motion.div
              key={row.id}
              className={`rk-pod p${place} ${row.you ? 'me' : ''}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * place, duration: 0.4 }}
            >
              <div className="rk-pod-medal">
                <IonIcon icon={place === 1 ? trophy : place === 2 ? medal : ribbon} />
              </div>
              <div className={`rk-avatar tone-${row.tone}`}>{row.initials}</div>
              <div className="rk-pod-state">{row.you ? t('Tú') : firstName(row.name)}</div>
              <div className="rk-pod-city">{t(row.city)}</div>
              <div className="rk-pod-val">{formatValue(cat, row.value)}</div>
              <div className="rk-pod-unit">{t(meta.unit)}</div>
            </motion.div>
          )
        })}
      </div>

      <div className="rk-list">
        <div className="rk-list-head">
          <span>{t('Clasificación')}</span>
          <span>{t(meta.unit)}</span>
        </div>
        {rest.map((row, i) => (
          <motion.div
            key={row.id}
            className={`rk-row ${row.you ? 'me' : ''}`}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.02 * i, duration: 0.28 }}
          >
            <span className="rk-pos">#{row.rank}</span>
            <span className={`rk-avatar tone-${row.tone}`}>{row.initials}</span>
            <span className="rk-name">
              {row.name}
              {row.you ? <em>{t('Tú')}</em> : <small>{t(row.city)}</small>}
            </span>
            <span className="rk-val">{formatValue(cat, row.value)}</span>
          </motion.div>
        ))}
      </div>

      <p className="rk-foot">
        <IonIcon icon={podium} />
        {t('La liga muestra a los pacientes activos de tu estado y se actualiza cada domingo.')}
      </p>
    </div>
  )
}
