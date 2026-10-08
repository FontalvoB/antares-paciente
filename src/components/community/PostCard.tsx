import { CommunityVideo } from "./CommunityVideo";
import { IonAlert, IonIcon, IonModal } from '@ionic/react'
import {
  chatbubbleEllipsesOutline,
  flagOutline,
  heart,
  heartOutline,
  pin,
  repeat,
  repeatOutline,
  shareSocialOutline,
} from 'ionicons/icons'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Post, RepostRef } from '../../graphql/community'
import type { FeedPostView } from '../../hooks/useCommunity'
import { useI18n } from '../../i18n/I18nContext'
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

/** Razones de reporte disponibles. */
const REPORT_REASONS = [
  'Spam',
  'Contenido inapropiado',
  'Información falsa',
  'Acoso o bullying',
  'Otro',
]

/** Tarjeta de publicación estilo X/Instagram: media protagonista (si hay),
 *  texto, fila de iconos limpios (like, comentario, compartir, repost, reportar)
 *  y hilo de comentarios al fondo para que el feed nunca se vea vacío. */
export function PostCard({
  view,
  index = 0,
  onOpen,
  onOpenImage,
  onOpenProfile,
  onToggleLike,
  onToggleRepost,
  onReportPost,
  onReportComment,
  onToggleCommentLike,
  onFetchPostReposts,
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
  onToggleRepost?: (p: Post) => Promise<{ id: string; reposts: RepostRef[] } | null>
  onReportPost?: (postId: string, reason: string, details?: string) => Promise<{ id: string } | null | undefined>
  onReportComment?: (commentId: string, reason: string, details?: string) => Promise<{ id: string } | null | undefined>
  onToggleCommentLike?: (commentId: string, liked: boolean) => Promise<{ id: string; likes: { id: string; profileId: string }[] } | null>
  onFetchPostReposts?: (postId: string) => Promise<Pick<{ id: string; displayName: string; avatarUrl: string | null }, 'id' | 'displayName' | 'avatarUrl'>[]>
  /** Vota una opción de encuesta (devuelve el post con los resultados). */
  onVotePoll?: (optionId: string) => Promise<Post | undefined>
  /** Id del perfil actual (para marcar la opción votada). */
  myId?: string | null
  onToast: (msg: string, kind?: 'ok' | 'err' | 'info' | 'warn') => void
}) {
  const { likeCount, likedByMe, repostCount, repostedByMe } = view
  const { post } = view
  const { t } = useI18n()
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

  // --- Estado: reporte ---
  const [reportOpen, setReportOpen] = useState(false)
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'comment'; id: string } | null>(null)

  // --- Estado: viewer de reposts ---
  const [repostViewerOpen, setRepostViewerOpen] = useState(false)
  const [repostProfiles, setRepostProfiles] = useState<Array<{ id: string; displayName: string; avatarUrl: string | null }>>([])
  const [repostLoading, setRepostLoading] = useState(false)

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

  async function handleRepost() {
    if (!onToggleRepost) return
    try {
      await onToggleRepost(viewPost)
      onToast(repostedByMe ? t('Repost eliminado') : t('Reposteado'), 'ok')
    } catch (e) {
      onToast((e as Error).message, 'err')
    }
  }

  function openReport(type: 'post' | 'comment', id: string) {
    setReportTarget({ type, id })
    setReportOpen(true)
  }

  async function submitReport(reason: string) {
    if (!reportTarget) return
    try {
      if (reportTarget.type === 'post') {
        await onReportPost?.(reportTarget.id, reason)
      } else {
        await onReportComment?.(reportTarget.id, reason)
      }
      onToast(t('Reporte enviado'), 'ok')
    } catch (e) {
      onToast((e as Error).message, 'err')
    }
    setReportTarget(null)
  }

  async function openRepostViewer() {
    if (!onFetchPostReposts || repostCount === 0) return
    setRepostLoading(true)
    setRepostViewerOpen(true)
    try {
      const profiles = await onFetchPostReposts(viewPost.id)
      setRepostProfiles(profiles)
    } catch {
      onToast(t('Error al cargar reposts'), 'err')
    } finally {
      setRepostLoading(false)
    }
  }

  async function handleCommentLike(commentId: string, liked: boolean) {
    if (!onToggleCommentLike) return
    try {
      const result = await onToggleCommentLike(commentId, liked)
      if (result) {
        setViewPost((prev) => ({
          ...prev,
          comments: prev.comments.map((c) => {
            if (c.id === commentId) return { ...c, likes: result.likes }
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === commentId ? { ...r, likes: result.likes } : r,
              ),
            }
          }),
        }))
      }
    } catch (e) {
      onToast((e as Error).message, 'err')
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
      onToast(t('Enlace de la publicación copiado'), 'ok')
    } catch {
      onToast(t('Comparte la publicación con tu comunidad'), 'info')
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
          <div className="com-post-time">{timeAgo(post.createdAt, t)}</div>
        </div>
        {post.pinned && (
          <span
            className="chip chip-gold"
            style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
          >
            <IonIcon icon={pin} style={{ fontSize: 12 }} /> {t('Fijado')}
          </span>
        )}
        <button
          type="button"
          className="com-act-btn com-act-report"
          onClick={() => openReport('post', post.id)}
          aria-label={t('Reportar publicación')}
          title={t('Reportar publicación')}
        >
          <IonIcon className="com-react-ico" icon={flagOutline} />
        </button>
      </div>

      {post.imageUrl && (
        <div className="com-post-media">
          {post.mediaType === 'VIDEO' ? (
            <CommunityVideo
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
        <button type="button" className="com-act-btn" onClick={() => onOpen(post)} aria-label={t('Ver comentarios')}>
          <IonIcon className="com-react-ico" icon={chatbubbleEllipsesOutline} />
          <span className="com-react-count">{post.comments.length}</span>
        </button>
        {onToggleRepost && (
          <button
            type="button"
            className={`com-act-btn repost ${repostedByMe ? 'on' : ''}`}
            onClick={() => void handleRepost()}
            aria-label={t('Repostear')}
          >
            <IonIcon className="com-react-ico" icon={repostedByMe ? repeat : repeatOutline} />
            {repostCount > 0 && (
              <span
                className="com-react-count com-react-count-link"
                onClick={(e) => { e.stopPropagation(); void openRepostViewer() }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') void openRepostViewer() }}
              >
                {repostCount}
              </span>
            )}
          </button>
        )}
        <button type="button" className="com-act-btn" onClick={() => void sharePost()} aria-label={t('Compartir')}>
          <IonIcon className="com-react-ico" icon={shareSocialOutline} />
        </button>
      </div>

      {post.comments.length > 0 && (
        <div className="com-post-thread">
          {post.comments.slice(0, 2).map((c) => {
            const cLiked = myId != null && c.likes.some((l) => l.profileId === myId)
            return (
              <div className="com-thread-line" key={c.id}>
                <span className="com-thread-author">{c.profile.displayName}</span>
                <span className="com-thread-body">{c.body}</span>
                {onToggleCommentLike && (
                  <button
                    type="button"
                    className={`com-thread-like ${cLiked ? 'on' : ''}`}
                    onClick={() => void handleCommentLike(c.id, cLiked)}
                    aria-label={t('Me gusta del comentario')}
                  >
                    <IonIcon icon={cLiked ? heart : heartOutline} style={{ fontSize: 12 }} />
                    {c.likes.length > 0 && <span>{c.likes.length}</span>}
                  </button>
                )}
                {onReportComment && (
                  <button
                    type="button"
                    className="com-thread-report"
                    onClick={() => openReport('comment', c.id)}
                    aria-label={t('Reportar comentario')}
                  >
                    <IonIcon icon={flagOutline} style={{ fontSize: 11 }} />
                  </button>
                )}
              </div>
            )
          })}
          {post.comments.length > 2 && (
            <button type="button" className="com-thread-more" onClick={() => onOpen(post)}>
              {t('Ver los {count} comentarios', { count: String(post.comments.length) })}
            </button>
          )}
        </div>
      )}

      {/* Diálogo de reporte */}
      <IonAlert
        isOpen={reportOpen}
        header={reportTarget?.type === 'post' ? t('Reportar publicación') : t('Reportar comentario')}
        subHeader={t('Selecciona un motivo')}
        inputs={REPORT_REASONS.map((r) => ({
          type: 'radio' as const,
          label: t(r),
          value: r,
        }))}
        buttons={[
          { text: t('Cancelar'), role: 'cancel' },
          {
            text: t('Enviar reporte'),
            handler: (data: string[]) => {
              if (data?.[0]) void submitReport(data[0])
            },
          },
        ]}
        onDidDismiss={() => setReportOpen(false)}
      />

      {/* Modal de reposts */}
      <IonModal isOpen={repostViewerOpen} onDidDismiss={() => setRepostViewerOpen(false)}>
        <div className="com-modal">
          <div className="com-modal-head">
            <h3>{t('Reposteado por')}</h3>
          </div>
          <div className="com-modal-body">
            {repostLoading ? (
              <div className="com-modal-loading">{t('Cargando…')}</div>
            ) : repostProfiles.length === 0 ? (
              <div className="com-modal-empty">{t('Sin reposts todavía')}</div>
            ) : (
              <div className="com-repost-list">
                {repostProfiles.map((p) => (
                  <div className="com-repost-item" key={p.id}>
                    <Avatar name={p.displayName} seedId={p.id} size={36} src={p.avatarUrl} />
                    <span className="com-repost-name">{p.displayName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </IonModal>
    </div>
  )
}
