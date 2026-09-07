import { IonButton, IonIcon, IonSegment, IonSegmentButton, IonSkeletonText } from '@ionic/react'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { chevronForward, flag, medal, ribbon, sparkles, trophy } from 'ionicons/icons'
import { useApp } from '../../context/AppContext'
import { useI18n, useT } from '../../i18n/I18nContext'
import { useLeague } from '../../hooks/useLeague'
import {
  LEAGUE_CATEGORIES,
  formatLeagueUpdatedAt,
  formatLeagueValue,
  resolveLeagueViewState,
  type LeagueCategoryId,
} from '../../utils/league'
import type { LeagueEntryDto } from '../../services/program/types'

const PODIUM_ORDER = [1, 0, 2] as const
const TONES = ['teal', 'blue', 'pur', 'org', 'ice', 'navy'] as const

function toneAt(position: number): string {
  return TONES[(position - 1 + TONES.length) % TONES.length]
}

/** Iniciales del display (nickname o código anónimo): 1-2 letras. */
function initialsOf(display: string): string {
  const parts = display.split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return display.slice(0, 2).toUpperCase()
}

// ---------------------------------------------------------------------------
// Estados honestos (sin mocks): loading / error / empty / data
// ---------------------------------------------------------------------------

function LeagueSkeleton() {
  return (
    <div className="pg-pane cpad">
      <div className="rk-hero" aria-busy="true">
        <IonSkeletonText animated style={{ width: 130, height: 13 }} />
        <IonSkeletonText animated style={{ width: 200, height: 22 }} />
        <IonSkeletonText animated style={{ width: 160, height: 13 }} />
      </div>
      <div className="rk-seg" aria-hidden="true">
        <IonSkeletonText animated style={{ width: '100%', height: 36, borderRadius: 12 }} />
      </div>
      <div className="rk-podium">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rk-pod" style={{ alignItems: 'center', gap: 8 }}>
            <IonSkeletonText animated style={{ width: 44, height: 44, borderRadius: '50%' }} />
            <IonSkeletonText animated style={{ width: 70, height: 12 }} />
          </div>
        ))}
      </div>
      <div className="rk-list">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rk-row">
            <IonSkeletonText animated style={{ width: 24, height: 12 }} />
            <IonSkeletonText animated style={{ width: 28, height: 28, borderRadius: '50%' }} />
            <IonSkeletonText animated style={{ flex: 1, height: 13 }} />
            <IonSkeletonText animated style={{ width: 40, height: 13 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function LeagueEmpty({
  kind,
  onRetry,
  onGoProgram,
}: {
  kind: 'error' | 'no-enrollment' | 'empty'
  onRetry: () => void
  onGoProgram: () => void
}) {
  const t = useT()
  return (
    <div className="pg-pane cpad">
      <div className="rk-empty">
        <div className="rk-empty-ico">
          <IonIcon icon={kind === 'error' ? flag : sparkles} />
        </div>
        <h3>{kind === 'error' ? t('No pudimos cargar la liga') : t('La liga está arrancando')}</h3>
        <p>
          {kind === 'error'
            ? t('Intenta de nuevo en unos segundos.')
            : kind === 'no-enrollment'
              ? t('Sin un programa activo no puedes aparecer en la liga. Completa las misiones de hoy y vuelve cuando abra.')
              : t('Todavía no hay suficientes jugadores con datos. Vuelve pronto.')}
        </p>
        <IonButton expand="block" className="bt bt-primary" onClick={onGoProgram}>
          {t('Completar las misiones de hoy')}
        </IonButton>
        {kind === 'error' && (
          <IonButton expand="block" className="bt bt-ghost" onClick={onRetry}>
            {t('Reintentar')}
          </IonButton>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Data view
// ---------------------------------------------------------------------------

function PodiumRow({
  entry,
  category,
  unitLabel,
}: {
  entry: LeagueEntryDto
  category: LeagueCategoryId
  unitLabel: string
}) {
  const t = useT()
  const place = entry.position
  return (
    <motion.div
      className={`rk-pod p${place} ${entry.isMe ? 'me' : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 * place, duration: 0.4 }}
    >
      <div className="rk-pod-medal">
        <IonIcon icon={place === 1 ? trophy : place === 2 ? medal : ribbon} />
      </div>
      <div className={`rk-avatar tone-${toneAt(place)}`}>{initialsOf(entry.display)}</div>
      <div className="rk-pod-state">{entry.isMe ? t('Tú') : entry.display}</div>
      <div className="rk-pod-val">{formatLeagueValue(category, entry.value)}</div>
      <div className="rk-pod-unit">{unitLabel}</div>
    </motion.div>
  )
}

export function RankingView() {
  const t = useT()
  const { lang } = useI18n()
  const { navigate } = useApp()
  const { league, isLoading, isError, error, refetch } = useLeague()
  const [cat, setCat] = useState<LeagueCategoryId>('racha')

  // El state machine de la vista vive en resolveLeagueViewState
  // (src/utils/league.ts, testeado por rama) — este componente solo lo consume.
  const active = league?.categories?.[cat] ?? null
  const viewState = resolveLeagueViewState({
    isLoading,
    isError,
    error,
    league,
    activeCategory: active,
  })

  if (viewState === 'loading') return <LeagueSkeleton />

  if (viewState === 'no-enrollment' || viewState === 'error' || viewState === 'empty') {
    return (
      <LeagueEmpty
        kind={viewState}
        onRetry={() => void refetch()}
        onGoProgram={() => navigate('prog')}
      />
    )
  }

  // viewState === 'data' → active no puede ser null (lo garantiza el resolver).
  const category = active!
  const { cohort, me } = league!
  const meta = LEAGUE_CATEGORIES.find((c) => c.id === cat)!
  // '%' es un símbolo, no una palabra traducible — fuera de t().
  const unitLabel = meta.unit === '%' ? meta.unit : t(meta.unit)

  const scopeLabel =
    cohort.scope === 'state' && cohort.stateCode
      ? t('Liga de {stateCode}', { stateCode: cohort.stateCode })
      : t('Liga nacional')
  const computed = formatLeagueUpdatedAt(cohort.computedAt, lang)
  const updatedLabel = computed
    ? computed.date
      ? t('Actualizado {fecha} {hora}', { fecha: computed.date, hora: computed.time })
      : t('Actualizado {hora}', { hora: computed.time })
    : ''
  const myEntry = category.entries.find((e) => e.isMe)
  const myDisplay = myEntry?.display ?? me.nickname ?? null
  const top3 = category.entries.slice(0, 3)
  const rest = category.entries.slice(3)

  return (
    <div className="pg-pane cpad">
      {!me.optedIn && (
        <motion.button
          type="button"
          className="rk-optin-banner"
          onClick={() => navigate('prof')}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <span>{t('No apareces en la liga · activa tu apodo en Perfil')}</span>
          <IonIcon icon={chevronForward} />
        </motion.button>
      )}

      <motion.section
        className="rk-hero"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="rk-hero-kicker">
          <IonIcon icon={flag} />
          {scopeLabel}
        </div>
        <h2>{t('{n} participantes', { n: String(cohort.participants) })}</h2>
        {cohort.scope === 'national' && (
          <p>{t('aún no hay suficientes jugadores en tu zona')}</p>
        )}
        {updatedLabel && (
          <div className="rk-updated">{updatedLabel}</div>
        )}
        <div className="rk-you">
          <div>
            <span>{t('Tu puesto')}</span>
            <b>
              {category.myRank != null ? `#${category.myRank}` : '—'}
              <small>
                {category.myRank != null ? t('de {n}', { n: String(category.totalParticipants) }) : ''}
              </small>
            </b>
          </div>
          <div>
            <span>{t('Tú')}</span>
            <b>{myDisplay ?? '—'}</b>
          </div>
          <div>
            <span>{t(meta.label)}</span>
            <b>{category.myValue != null ? formatLeagueValue(cat, category.myValue) : '—'}</b>
          </div>
        </div>
      </motion.section>

      <div className="rk-seg">
        <IonSegment value={cat} onIonChange={(e) => setCat((e.detail.value as LeagueCategoryId) || 'racha')}>
          {LEAGUE_CATEGORIES.map((c) => (
            <IonSegmentButton key={c.id} value={c.id}>
              {t(c.label)}
            </IonSegmentButton>
          ))}
        </IonSegment>
      </div>

      <div className="rk-podium" aria-label={t('Podio')}>
        {PODIUM_ORDER.map((idx) => {
          const entry = top3[idx]
          if (!entry) return null
          return <PodiumRow key={entry.position} entry={entry} category={cat} unitLabel={unitLabel} />
        })}
      </div>

      <div className="rk-list">
        <div className="rk-list-head">
          <span>{t('Clasificación')}</span>
          <span>{unitLabel}</span>
        </div>
        {rest.map((entry, i) => (
          <motion.div
            key={entry.position}
            className={`rk-row ${entry.isMe ? 'me' : ''}`}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.02 * i, duration: 0.28 }}
          >
            <span className="rk-pos">#{entry.position}</span>
            <span className={`rk-avatar tone-${toneAt(entry.position)}`}>{initialsOf(entry.display)}</span>
            <span className="rk-name">
              {entry.display}
              {entry.isMe ? <em>{t('Tú')}</em> : null}
            </span>
            <span className="rk-val">{formatLeagueValue(cat, entry.value)}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}