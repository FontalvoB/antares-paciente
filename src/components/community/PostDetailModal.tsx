import { CommunityVideo } from "./CommunityVideo";
import { IonAlert, IonButton, IonIcon, IonModal, IonTextarea } from '@ionic/react'
import {
  arrowUndo,
  chatbubbleEllipsesOutline,
  chevronDownOutline,
  close,
  flagOutline,
  heart,
  heartOutline,
  repeat,
  repeatOutline,
  send,
} from 'ionicons/icons'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useSubscription } from 'urql'
import { COMMENT_ADDED_SUBSCRIPTION, POST_QUERY, type PostResult } from '../../graphql/community'
import { countCommunityComments, mergeCommunityComments } from '../../utils/community-comments'
import type { Comment, Post, Profile, RepostRef } from '../../graphql/community'
import { useI18n } from '../../i18n/I18nContext'
import { Avatar, timeAgo } from './community'
import { PollBlock } from './PollBlock'

/** Razones de reporte disponibles. */
const REPORT_REASONS = [
  'Spam',
  'Contenido inapropiado',
  'Información falsa',
  'Acoso o bullying',
  'Otro',
]

function byNewest(a: { createdAt: string }, b: { createdAt: string }) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

function byOldest(a: { createdAt: string }, b: { createdAt: string }) {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}

/** Comentario tipo conversación: burbuja suave + rail de sangría. Con badge
 *  "Tú" cuando es del usuario, resaltado (glow) al publicarse recién y
 *  respuestas colapsables/expandibles con animación de altura. */
function CommentItem({
  comment,
  depth,
  myId,
  isNew,
  onReply,
  onOpenProfile,
  onReportComment,
  onToggleCommentLike,
}: {
  comment: Comment
  depth: number
  myId: string | null
  isNew?: boolean
  onReply: (c: Comment) => void
  onOpenProfile?: (profileId: string) => void
  onReportComment?: (commentId: string, reason: string, details?: string) => Promise<{ id: string } | null | undefined>
  onToggleCommentLike?: (commentId: string, liked: boolean) => Promise<{ id: string; likes: { id: string; profileId: string }[] } | null>
}) {
  const isReply = depth > 0
  const { t } = useI18n()
  const name = comment.profile?.displayName ?? t('Miembro')
  const mine = myId != null && comment.profile?.id === myId
  const replyCount = comment.replies?.length ?? 0
  const [repliesOpen, setRepliesOpen] = useState(true)
  const likedByMe = myId != null && comment.likes?.some((l) => l.profileId === myId)
  const likeCount = comment.likes?.length ?? 0
  const [reportOpen, setReportOpen] = useState(false)

  return (
    <div
      className={`com-c ${isReply ? 'com-c-reply' : ''} ${isNew ? 'com-c-new' : ''}`}
      data-cid={comment.id}
    >
      <div className="com-c-row">
        <Avatar
          name={name}
          seedId={comment.profile?.id ?? comment.id}
          size={isReply ? 24 : 30}
          src={comment.profile?.avatarUrl}
          onClick={comment.profile?.id ? () => onOpenProfile?.(comment.profile!.id) : undefined}
        />
        <div className="com-c-main">
          <div className="com-c-head">
            <span
              className="com-c-name"
              style={comment.profile?.id ? { cursor: 'pointer' } : undefined}
              onClick={comment.profile?.id ? () => onOpenProfile?.(comment.profile!.id) : undefined}
            >
              {name}
            </span>
            {mine && (
              <span className="com-c-tag mine">
                <IonIcon icon={chatbubbleEllipsesOutline} style={{ fontSize: 10 }} /> {t('Tú')}
              </span>
            )}
            {isReply && !mine && (
              <span className="com-c-tag">
                <IonIcon icon={arrowUndo} style={{ fontSize: 10 }} />
                {t('Respuesta')}
              </span>
            )}
            <span className="com-c-dot">·</span>
            <span className="com-c-time">{timeAgo(comment.createdAt, t)}</span>
          </div>
          <div className="com-c-body">{comment.body}</div>
          <div className="com-c-actions">
            <IonButton fill="clear" className="com-c-replybtn" onClick={() => onReply(comment)}>
              <IonIcon icon={arrowUndo} style={{ fontSize: 12, marginRight: 4 }} /> {t('Responder')}
            </IonButton>
            {onToggleCommentLike && (
              <button
                type="button"
                className={`com-c-likebtn ${likedByMe ? 'on' : ''}`}
                onClick={() => void onToggleCommentLike(comment.id, !!likedByMe)}
                aria-pressed={likedByMe}
              >
                <IonIcon icon={likedByMe ? heart : heartOutline} style={{ fontSize: 14 }} />
                {likeCount > 0 && <span>{likeCount}</span>}
              </button>
            )}
            {onReportComment && (
              <button
                type="button"
                className="com-c-reportbtn"
                onClick={() => setReportOpen(true)}
                aria-label={t('Reportar comentario')}
              >
                <IonIcon icon={flagOutline} style={{ fontSize: 13 }} />
              </button>
            )}
            {replyCount > 0 && (
              <button
                type="button"
                className={`com-c-toggle ${repliesOpen ? 'open' : ''}`}
                onClick={() => setRepliesOpen((v) => !v)}
                aria-expanded={repliesOpen}
              >
                <IonIcon icon={chevronDownOutline} />
                {repliesOpen
                  ? t('Ocultar respuestas ({count})', { count: String(replyCount) })
                  : replyCount === 1
                    ? t('Ver {count} respuesta', { count: String(replyCount) })
                    : t('Ver {count} respuestas', { count: String(replyCount) })}
              </button>
            )}
          </div>
        </div>
      </div>
      <div className={`com-c-replies ${repliesOpen ? 'open' : ''}`}>
        <div>
          {[...(comment.replies ?? [])]
            .filter((r) => r.parentCommentId === comment.id)
            .sort(byOldest)
            .map((r) => (
              <CommentItem
                key={r.id}
                comment={r}
                depth={depth + 1}
                myId={myId}
                onReply={onReply}
                onOpenProfile={onOpenProfile}
                onReportComment={onReportComment}
                onToggleCommentLike={onToggleCommentLike}
              />
            ))}
        </div>
      </div>
      <IonAlert
        isOpen={reportOpen}
        header={t('Reportar comentario')}
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
              if (data?.[0]) {
                onReportComment?.(comment.id, data[0])
              }
            },
          },
        ]}
        onDidDismiss={() => setReportOpen(false)}
      />
    </div>
  )
}

/** Modal de detalle de publicación: comentarios como conversación, con input
 *  tipo píldora, modo respuesta inline, entrada animada y scroll suave. */
export function PostDetailModal({
  post,
  me,
  onClose,
  onAddComment,
  onReply,
  onOpenImage,
  onOpenProfile,
  onToast,
  onVotePoll,
  onToggleRepost,
  onReportPost,
  onReportComment,
  onToggleCommentLike,
  onFetchPostReposts,
  dark = false,
}: {
  post: Post | null
  me?: Profile | null
  onClose: () => void
  onAddComment: (postId: string, body: string) => Promise<Comment | null | undefined>
  onReply: (commentId: string, body: string) => Promise<Comment | null | undefined>
  onOpenImage?: (url: string, mediaType: 'IMAGE' | 'VIDEO' | null) => void
  /** Click en el avatar del autor o de un comentario → abre su perfil. */
  onOpenProfile?: (profileId: string) => void
  onToast: (msg: string, kind?: 'ok' | 'err' | 'info' | 'warn') => void
  /** Vota una opción de encuesta (devuelve el post con los resultados). */
  onVotePoll?: (optionId: string) => Promise<Post | undefined>
  onToggleRepost?: (p: Post) => Promise<{ id: string; reposts: RepostRef[] } | null>
  onReportPost?: (postId: string, reason: string, details?: string) => Promise<{ id: string } | null | undefined>
  onReportComment?: (commentId: string, reason: string, details?: string) => Promise<{ id: string } | null | undefined>
  onToggleCommentLike?: (commentId: string, liked: boolean) => Promise<{ id: string; likes: { id: string; profileId: string }[] } | null>
  onFetchPostReposts?: (postId: string) => Promise<Pick<{ id: string; displayName: string; avatarUrl: string | null }, 'id' | 'displayName' | 'avatarUrl'>[]>
  dark?: boolean
}) {
  const [comments, setComments] = useState<Comment[]>(post?.comments ?? [])
  const commentsSinceOpen = useRef<Comment[]>([])
  const [draft, setDraft] = useState('')
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null)
  const [sending, setSending] = useState(false)
  const [freshId, setFreshId] = useState<string | null>(null)
  const taRef = useRef<HTMLIonTextareaElement | null>(null)
  const { t } = useI18n()

  // El modal conserva el último post abierto mientras se anima el cierre
  // (animación nativa de dismiss de Ionic), en vez de desmontarse de golpe.
  const [view, setView] = useState<Post | null>(post)
  const [modalOpen, setModalOpen] = useState(!!post)

  // Reabre con datos del servidor y recibe comentarios ERP → app mientras está abierto.
  const [freshPost, refreshPost] = useQuery<PostResult>({ query: POST_QUERY,
    variables: { id: post?.id ?? '' }, pause: !post, requestPolicy: 'network-only' })
  const [incomingComment] = useSubscription<{ commentAdded: Comment }>({
    query: COMMENT_ADDED_SUBSCRIPTION, pause: !post })

  // Recupera eventos perdidos por desconexión o réplicas sin bus compartido.
  // La consulta está acotada al detalle abierto; no toca el borrador ni la respuesta.
  useEffect(() => {
    if (!post) return
    const refresh = () => {
      if (document.visibilityState === 'visible') refreshPost({ requestPolicy: 'network-only' })
    }
    const timer = window.setInterval(refresh, 10000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('online', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('online', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [post?.id, refreshPost]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Estado: reporte ---
  const [reportOpen, setReportOpen] = useState(false)
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'comment'; id: string } | null>(null)

  // --- Estado: repost viewer ---
  const [repostViewerOpen, setRepostViewerOpen] = useState(false)
  const [repostProfiles, setRepostProfiles] = useState<Array<{ id: string; displayName: string; avatarUrl: string | null }>>([])
  const [repostLoading, setRepostLoading] = useState(false)

  const repostCount = view?.reposts?.length ?? 0
  const repostedByMe = me != null && view?.reposts?.some((r) => r.profileId === me.id)

  async function handleVote(optionId: string) {
    const updated = await onVotePoll?.(optionId)
    if (updated?.poll) {
      setView((prev) => (prev ? { ...prev, poll: updated.poll } : prev))
    }
  }

  useEffect(() => {
    if (!post) return
    setView(post)
    setModalOpen(true)
    setComments(post.comments)
    commentsSinceOpen.current = []
    setDraft('')
    setReplyTarget(null)
    setFreshId(null)
  }, [post?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const updated = freshPost.data?.post
    if (freshPost.fetching || !post || !updated || updated.id !== post.id) return
    setView(updated)
    setComments(mergeCommunityComments(updated.comments, commentsSinceOpen.current))
  }, [freshPost.data, freshPost.fetching, post?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const comment = incomingComment.data?.commentAdded
    if (!post || !comment || comment.postId !== post.id) return
    commentsSinceOpen.current = mergeCommunityComments(commentsSinceOpen.current, [comment])
    setComments((current) => mergeCommunityComments(current, [comment]))
    setFreshId(comment.id)
  }, [incomingComment.data, post?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Al quitar el post (✕, swiper o backdrop), cierra con animación.
  useEffect(() => {
    if (!post && view) setModalOpen(false)
  }, [post, view])

  // Foco para el modo respuesta.
  useEffect(() => {
    if (!replyTarget) return
    const t = window.setTimeout(() => taRef.current?.setFocus(), 220)
    return () => window.clearTimeout(t)
  }, [replyTarget])

  // Scroll suave hasta el comentario recién publicado.
  useEffect(() => {
    if (!freshId) return
    const t = window.setTimeout(() => {
      document
        .querySelector(`[data-cid="${freshId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 120)
    return () => window.clearTimeout(t)
  }, [freshId])

  if (!view) return null

  const postId = view.id
  const roots = comments.filter((c) => !c.parentCommentId).sort(byNewest)

  const handleDidDismiss = () => {
    setModalOpen(false)
    setView(null)
    onClose()
  }

  async function submit() {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const result = replyTarget
        ? await onReply(replyTarget.id, text)
        : await onAddComment(postId, text)
      if (!result) throw new Error(t('No se pudo guardar el comentario. Intenta de nuevo.'))
      commentsSinceOpen.current = mergeCommunityComments(commentsSinceOpen.current, [result])
      setComments((current) => mergeCommunityComments(current, [result]))
      setFreshId(result.id)
      onToast(replyTarget ? t('Respuesta publicada') : t('Comentario publicado'), 'ok')
      setReplyTarget(null)
      setDraft('')
    } catch (e) {
      onToast((e as Error).message, 'err')
    } finally {
      setSending(false)
    }
  }

  async function handleRepost() {
    if (!onToggleRepost || !view) return
    try {
      const updated = await onToggleRepost(view)
      if (!updated) throw new Error(t('No se pudo actualizar el repost. Intenta de nuevo.'))
      setView((current) => current ? { ...current, reposts: updated.reposts } : current)
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
    if (!onFetchPostReposts || !view) return
    setRepostLoading(true)
    setRepostViewerOpen(true)
    try {
      const profiles = await onFetchPostReposts(view.id)
      setRepostProfiles(profiles)
    } catch {
      onToast(t('Error al cargar reposts'), 'err')
    } finally {
      setRepostLoading(false)
    }
  }

  async function handleCommentLike(commentId: string, liked: boolean): Promise<{ id: string; likes: { id: string; profileId: string }[] } | null> {
    if (!onToggleCommentLike) return null
    try {
      const result = await onToggleCommentLike(commentId, liked)
      if (result) {
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId) return { ...c, likes: result.likes }
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === commentId ? { ...r, likes: result.likes } : r,
              ),
            }
          }),
        )
      }
      return result
    } catch (e) {
      onToast((e as Error).message, 'err')
      return null
    }
  }

  return (
    <IonModal
      isOpen={modalOpen}
      onDidDismiss={handleDidDismiss}
      className={dark ? 'com-dark-surface' : undefined}
    >
      <div className="com-detail">
        <div className="com-detail-head">
          <Avatar
            name={view.profile.displayName}
            seedId={view.profile.id}
            size={40}
            src={view.profile.avatarUrl}
            onClick={() => onOpenProfile?.(view.profile.id)}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="com-post-name"
              style={{ cursor: 'pointer' }}
              onClick={() => onOpenProfile?.(view.profile.id)}
            >
              {view.profile.displayName}
            </div>
            <div className="com-post-time">{timeAgo(view.createdAt, t)}</div>
          </div>
          <IonButton
            fill="clear"
            size="small"
            className="com-detail-close"
            onClick={onClose}
            aria-label={t('Cerrar')}
          >
            <IonIcon icon={close} />
          </IonButton>
        </div>

        <div className="com-detail-post">
          <div className="com-post-body">{view.body}</div>
          {view.poll && (
            <PollBlock poll={view.poll} myId={me?.id ?? null} onVote={handleVote} />
          )}
          {view.imageUrl &&
            (view.mediaType === 'VIDEO' ? (
              <CommunityVideo
                className="com-post-image"
                src={view.imageUrl}
                controls
                muted
                playsInline
                preload="metadata"
                onClick={() => onOpenImage?.(view.imageUrl!, view.mediaType)}
              />
            ) : (
              <img
                className="com-post-image"
                src={view.imageUrl}
                alt={`Imagen de ${view.profile.displayName}`}
                onClick={() => onOpenImage?.(view.imageUrl!, view.mediaType)}
              />
            ))}

          {/* Acciones del post: like, comentarios, repost, compartir, reportar */}
          <div className="com-post-actions" style={{ padding: '4px 0 0' }}>
            <button
              type="button"
              className="com-act-btn"
              onClick={() => openReport('post', postId)}
              aria-label={t('Reportar publicación')}
            >
              <IonIcon className="com-react-ico" icon={flagOutline} />
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
          </div>
        </div>

        <div className="com-detail-comments">
          <div className="com-cmt-head">
            <span className="com-cmt-title">{t('Comentarios')}</span>
            <span className="com-cmt-count">{countCommunityComments(comments)}</span>
          </div>
          {roots.length === 0 ? (
            <div className="com-detail-msg">
              <IonIcon icon={chatbubbleEllipsesOutline} style={{ fontSize: 16 }} /> {t('Sin comentarios todavía. ¡Sé el primero!')}
            </div>
          ) : (
            <div className="com-thread">
              {roots.map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  depth={0}
                  myId={me?.id ?? null}
                  isNew={c.id === freshId}
                  onReply={setReplyTarget}
                  onOpenProfile={onOpenProfile}
                  onReportComment={onReportComment}
                  onToggleCommentLike={handleCommentLike}
                />
              ))}
            </div>
          )}
        </div>

        <div className="com-detail-input">
          {replyTarget && (
            <div className="com-reply-chip">
              <span>
                {t('Respondiendo a ')} <b>{replyTarget.profile?.displayName ?? t('Miembro')}</b>
              </span>
              <IonButton
                fill="clear"
                size="small"
                className="com-reply-x"
                onClick={() => setReplyTarget(null)}
              >
                <IonIcon icon={close} />
              </IonButton>
            </div>
          )}
          <div className="com-input-wrap">
            <IonTextarea
              ref={taRef}
              className="fld composer-input com-input"
              value={draft}
              placeholder={replyTarget ? `${t('Responder a ')}${replyTarget.profile?.displayName ?? t('Miembro')}…` : t('Escribe un comentario…')}
              onIonInput={(e) => setDraft(e.detail.value ?? '')}
              autoGrow
              rows={1}
            />
            <IonButton
              className={`com-input-send ${draft.trim() ? 'bt-pur' : ''}`}
              disabled={sending || !draft.trim()}
              onClick={() => void submit()}
              aria-label={replyTarget ? t('Responder') : t('Comentar')}
            >
              <IonIcon icon={send} />
            </IonButton>
          </div>
          {sending && <div className="com-sending">{t('Enviando…')}</div>}
        </div>
      </div>

      {/* Diálogo de reporte de publicación */}
      <IonAlert
        isOpen={reportOpen}
        header={t('Reportar publicación')}
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
    </IonModal>
  )
}
