import { IonIcon } from '@ionic/react'
import {
  chatbubbleEllipsesOutline,
  heart,
  heartOutline,
  pin,
  shareSocialOutline,
} from 'ionicons/icons'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Post } from '../../graphql/community'
import type { FeedPostView } from '../../hooks/useCommunity'
import { Avatar, timeAgo } from './community'
import { PollBlock } from './PollBlock'

/** Direcciones del estallido de partículas al dar like (cono hacia arriba). */
const BURST: Array<[number, number]> = [
  [0, -30],
  [-16, -24],
  [16, -24],
  [-26, -10],
  [26, -10],
]

/** Tarjeta de publicación estilo X/Instagram: media protagonista (si hay),
 *  texto, fila de iconos limpios (like, comentario, compartir) y hilo de
 *  comentarios al fondo para que el feed nunca se vea vacío. */
export function PostCard({
  view,
  index = 0,
  onOpen,
  onOpenImage,
  onOpenProfile,
  onToggleLike,
  onVotePoll,
  myId,
  onToast,
}: {
  view: FeedPostView
  index?: number
  onOpen: (p: Post) => void
  onOpenImage?: (url: string, mediaType: 'IMAGE' | 'VIDEO' | null) => void
  /** Click en el avatar del autor → abre su perfil. */
  onOpenProfile?: (profileId: string) => void
  onToggleLike: (p: Post) => Promise<void>
  /** Vota una opción de encuesta (devuelve el post con los resultados). */
  onVotePoll?: (optionId: string) => Promise<Post | undefined>
  /** Id del perfil actual (para marcar la opción votada). */
  myId?: string | null
  onToast: (msg: string, kind?: 'ok' | 'err' | 'info' | 'warn') => void
}) {
  const { likeCount, likedByMe } = view
  const { post } = view
  // Copia local del post: el voto actualiza los resultados al instante.
  const [viewPost, setViewPost] = useState(view.post)
  useEffect(() => setViewPost(view.post), [view.post])

  async function handleVote(optionId: string) {
    if (!onVotePoll) return
    const updated = await onVotePoll(optionId)
    if (updated?.poll) {
      setViewPost((prev) => ({ ...prev, poll: updated.poll }))
    }
  }
  const [liking, setLiking] = useState(false)
  // Re-dispara el pop del corazón + shockwave + partículas en cada like.
  const heartKey = useRef(0)
  const [heartTick, setHeartTick] = useState(0)
  // Like por doble toque en la foto: corazón gigante + animación.
  const [dblTick, setDblTick] = useState(0)
  const openTimerRef = useRef(0)

  async function handleLike() {
    if (liking) return
    const wasLiked = likedByMe
    setLiking(true)
    try {
      await onToggleLike(post)
      if (!wasLiked) {
        heartKey.current += 1
        setHeartTick(heartKey.current)
        navigator.vibrate?.(12)
      }
    } catch (e) {
      onToast((e as Error).message, 'err')
    } finally {
      setLiking(false)
    }
  }

  function handleMediaClick() {
    // Retrasa el lightbox 260 ms: si llega un segundo toque, es doble tap.
    window.clearTimeout(openTimerRef.current)
    openTimerRef.current = window.setTimeout(() => {
      onOpenImage?.(post.imageUrl!, post.mediaType)
    }, 260)
  }

  function handleMediaDouble() {
    window.clearTimeout(openTimerRef.current)
    heartKey.current += 1
    setDblTick(heartKey.current)
    if (!likedByMe) void handleLike()
  }

  async function sharePost() {
    try {
      await navigator.clipboard.writeText(`https://antares.bio/com/${post.id}`)
      onToast('Enlace de la publicación copiado', 'ok')
    } catch {
      onToast('Comparte la publicación con tu comunidad', 'info')
    }
  }

  const burstStyle: CSSProperties = {
    '--dx': '0px',
    '--dy': '0px',
  } as CSSProperties

  return (
    <div className="com-post" style={{ animationDelay: `${Math.min(index * 45, 270)}ms` }}>
      <div className="com-post-head">
        <Avatar
          name={post.profile.displayName}
          seedId={post.profile.id}
          size={44}
          src={post.profile.avatarUrl}
          style={{ boxShadow: '0 0 0 2px var(--wh), 0 2px 8px rgba(16,42,80,0.14)' }}
          onClick={() => onOpenProfile?.(post.profile.id)}
        />
        <div className="com-post-id">
          <div className="com-post-name">{post.profile.displayName}</div>
          <div className="com-post-time">{timeAgo(post.createdAt)}</div>
        </div>
        {post.pinned && (
          <span
            className="chip chip-gold"
            style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
          >
            <IonIcon icon={pin} style={{ fontSize: 12 }} /> Fijado
          </span>
        )}
      </div>

      {post.imageUrl && (
        <div className="com-post-media">
          {post.mediaType === 'VIDEO' ? (
            <video
              className="com-post-image"
              src={post.imageUrl}
              controls
              muted
              playsInline
              preload="metadata"
              onClick={handleMediaClick}
              onDoubleClick={handleMediaDouble}
            />
          ) : (
            <img
              className="com-post-image"
              src={post.imageUrl}
              alt={`Imagen de ${post.profile.displayName}`}
              loading="lazy"
              onClick={handleMediaClick}
              onDoubleClick={handleMediaDouble}
            />
          )}
          {dblTick > 0 && (
            <span key={dblTick} className="com-dbl-heart" aria-hidden>
              <IonIcon icon={heart} />
            </span>
          )}
        </div>
      )}

      <div className="com-post-body">{viewPost.body}</div>

      {viewPost.poll && (
        <PollBlock poll={viewPost.poll} myId={myId ?? null} onVote={handleVote} />
      )}

      <div className="com-post-actions">
        <button
          className={`com-act-btn like ${likedByMe ? 'on' : ''}`}
          disabled={liking}
          onClick={() => void handleLike()}
          aria-pressed={likedByMe}
        >
          {likedByMe && heartTick > 0 && (
            <span key={`ring${heartTick}`} className="com-react-ring" aria-hidden />
          )}
          {heartTick > 0 && (
            <span key={`burst${heartTick}`} className="com-react-burst" aria-hidden>
              {BURST.map(([dx, dy], j) => (
                <i
                  key={j}
                  style={{ ...burstStyle, '--dx': `${dx}px`, '--dy': `${dy}px` } as CSSProperties}
                />
              ))}
            </span>
          )}
          <IonIcon
            key={`${likedByMe}-${heartTick}`}
            className="com-react-ico"
            icon={likedByMe ? heart : heartOutline}
          />
          <span className="com-react-count">{likeCount}</span>
        </button>
        <button type="button" className="com-act-btn" onClick={() => onOpen(post)} aria-label="Ver comentarios">
          <IonIcon className="com-react-ico" icon={chatbubbleEllipsesOutline} />
          <span className="com-react-count">{post.comments.length}</span>
        </button>
        <button type="button" className="com-act-btn" onClick={() => void sharePost()} aria-label="Compartir">
          <IonIcon className="com-react-ico" icon={shareSocialOutline} />
        </button>
      </div>

      {post.comments.length > 0 && (
        <div className="com-post-thread">
          {post.comments.slice(0, 2).map((c) => (
            <div className="com-thread-line" key={c.id}>
              <span className="com-thread-author">{c.profile.displayName}</span>
              <span className="com-thread-body">{c.body}</span>
            </div>
          ))}
          {post.comments.length > 2 && (
            <button type="button" className="com-thread-more" onClick={() => onOpen(post)}>
              Ver los {post.comments.length} comentarios
            </button>
          )}
        </div>
      )}
    </div>
  )
}
