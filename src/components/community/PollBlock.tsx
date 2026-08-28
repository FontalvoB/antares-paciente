import { IonIcon } from '@ionic/react'
import { checkmark, statsChartOutline } from 'ionicons/icons'
import { useState } from 'react'
import type { Poll } from '../../graphql/community'

/** Bloque de encuesta dentro de una publicación: opciones tappables antes de
 *  votar; después del voto muestra resultados con progreso y porcentajes. */
export function PollBlock({
  poll,
  myId,
  onVote,
}: {
  poll: Poll
  myId: string | null
  onVote: (optionId: string) => Promise<void>
}) {
  const [voting, setVoting] = useState(false)
  const myVote = poll.options.find((o) => o.votes.some((v) => v.profileId === myId))
  const total = poll.options.reduce((acc, o) => acc + o.votes.length, 0)

  async function vote(optionId: string) {
    if (voting || myVote) return
    setVoting(true)
    try {
      await onVote(optionId)
    } finally {
      setVoting(false)
    }
  }

  return (
    <div className="poll-block">
      <div className="poll-head">
        <IonIcon icon={statsChartOutline} /> Encuesta
      </div>
      {poll.options.map((option) => {
        const votes = option.votes.length
        const pct = total > 0 ? Math.round((votes / total) * 100) : 0
        const mine = myVote?.id === option.id
        if (!myVote) {
          return (
            <button
              key={option.id}
              type="button"
              className={`poll-opt${voting ? ' busy' : ''}`}
              onClick={() => void vote(option.id)}
              aria-label={`Votar por: ${option.text}`}
            >
              <span className="poll-opt-choice" aria-hidden />
              <span className="poll-opt-text">{option.text}</span>
            </button>
          )
        }
        return (
          <div key={option.id} className={`poll-opt poll-opt-result${mine ? ' mine' : ''}`}>
            <span className="poll-opt-fill" aria-hidden>
              <i style={{ width: `${pct}%` }} />
            </span>
            <span className="poll-opt-text">
              {option.text}
              {mine && <IonIcon icon={checkmark} className="poll-opt-check" />}
            </span>
            <span className="poll-opt-pct">{pct}%</span>
          </div>
        )
      })}
      <div className="poll-total">
        {total === 0
          ? 'Sin votos todavía'
          : `${total} ${total === 1 ? 'voto' : 'votos'}`}
        {myVote && ' · Ya votaste'}
      </div>
    </div>
  )
}
