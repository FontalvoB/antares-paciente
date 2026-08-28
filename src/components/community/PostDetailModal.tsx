import { IonButton, IonIcon, IonModal, IonTextarea } from '@ionic/react'
import { arrowUndo, chatbubbleEllipsesOutline, chevronDownOutline, close, send } from 'ionicons/icons'
import { useEffect, useRef, useState } from 'react'
import type { Comment, Post, Profile } from '../../graphql/community'
import { Avatar, timeAgo } from './community'
import { PollBlock } from './PollBlock'

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
}: {
  comment: Comment
  depth: number
  myId: string | null
  isNew?: boolean
  onReply: (c: Comment) => void
  onOpenProfile?: (profileId: string) => void
}) {
  const isReply = depth > 0
  const name = comment.profile?.displayName ?? 'Miembro'
  const mine = myId != null && comment.profile?.id === myId
  const replyCount = comment.replies?.length ?? 0
  const [repliesOpen, setRepliesOpen] = useState(true)

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
                <IonIcon icon={chatbubbleEllipsesOutline} style={{ fontSize: 10 }} /> Tú
              </span>
            )}
            {isReply && !mine && (
              <span className="com-c-tag">
                <IonIcon icon={arrowUndo} style={{ fontSize: 10 }} />
                Respuesta
              </span>
            )}
            <span className="com-c-dot">·</span>
            <span className="com-c-time">{timeAgo(comment.createdAt)}</span>
          </div>
          <div className="com-c-body">{comment.body}</div>
          <div className="com-c-actions">
            <IonButton fill="clear" className="com-c-replybtn" onClick={() => onReply(comment)}>
              <IonIcon icon={arrowUndo} style={{ fontSize: 12, marginRight: 4 }} /> Responder
            </IonButton>
            {replyCount > 0 && (
              <button
                type="button"
                className={`com-c-toggle ${repliesOpen ? 'open' : ''}`}
                onClick={() => setRepliesOpen((v) => !v)}
                aria-expanded={repliesOpen}
              >
                <IonIcon icon={chevronDownOutline} />
                {repliesOpen
                  ? `Ocultar respuestas (${replyCount})`
                  : `Ver ${replyCount} ${replyCount === 1 ? 'respuesta' : 'respuestas'}`}
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
              />
            ))}
        </div>
      </div>
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
  dark?: boolean
}) {
  const [comments, setComments] = useState<Comment[]>(post?.comments ?? [])
  const [draft, setDraft] = useState('')
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null)
  const [sending, setSending] = useState(false)
  const [freshId, setFreshId] = useState<string | null>(null)
  const taRef = useRef<HTMLIonTextareaElement | null>(null)

  // El modal conserva el último post abierto mientras se anima el cierre
  // (animación nativa de dismiss de Ionic), en vez de desmontarse de golpe.
  const [view, setView] = useState<Post | null>(post)
  const [modalOpen, setModalOpen] = useState(!!post)

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
    setDraft('')
    setReplyTarget(null)
    setFreshId(null)
  }, [post?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
      if (replyTarget) {
        const r = await onReply(replyTarget.id, text)
        if (r) {
          const rootId = replyTarget.parentCommentId ?? replyTarget.id
          setComments((prev) =>
            prev.map((c) => (c.id === rootId ? { ...c, replies: [...c.replies, r] } : c)),
          )
          setFreshId(r.id)
        }
        setReplyTarget(null)
        onToast('Respuesta publicada', 'ok')
      } else {
        const c = await onAddComment(postId, text)
        if (c) {
          setComments((prev) => [c, ...prev])
          setFreshId(c.id)
        }
        onToast('Comentario publicado', 'ok')
      }
      setDraft('')
    } catch (e) {
      onToast((e as Error).message, 'err')
    } finally {
      setSending(false)
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
            <div className="com-post-time">{timeAgo(view.createdAt)}</div>
          </div>
          <IonButton
            fill="clear"
            size="small"
            className="com-detail-close"
            onClick={onClose}
            aria-label="Cerrar"
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
              <video
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
        </div>

        <div className="com-detail-comments">
          <div className="com-cmt-head">
            <span className="com-cmt-title">Comentarios</span>
            <span className="com-cmt-count">{comments.length}</span>
          </div>
          {roots.length === 0 ? (
            <div className="com-detail-msg">
              <IonIcon icon={chatbubbleEllipsesOutline} style={{ fontSize: 16 }} /> Sin comentarios
              todavía. ¡Sé el primero!
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
                />
              ))}
            </div>
          )}
        </div>

        <div className="com-detail-input">
          {replyTarget && (
            <div className="com-reply-chip">
              <span>
                Respondiendo a <b>{replyTarget.profile?.displayName ?? 'Miembro'}</b>
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
              placeholder={replyTarget ? `Responder a ${replyTarget.profile?.displayName ?? 'Miembro'}…` : 'Escribe un comentario…'}
              onIonInput={(e) => setDraft(e.detail.value ?? '')}
              autoGrow
              rows={1}
            />
            <IonButton
              className={`com-input-send ${draft.trim() ? 'bt-pur' : ''}`}
              disabled={sending || !draft.trim()}
              onClick={() => void submit()}
              aria-label={replyTarget ? 'Responder' : 'Comentar'}
            >
              <IonIcon icon={send} />
            </IonButton>
          </div>
          {sending && <div className="com-sending">Enviando…</div>}
        </div>
      </div>
    </IonModal>
  )
}
