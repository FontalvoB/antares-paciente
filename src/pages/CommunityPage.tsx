import { useState } from 'react'
import {
  IonAvatar,
  IonBadge,
  IonButton,
  IonInput,
  IonModal,
  IonSearchbar,
  IonSkeletonText,
  IonTextarea,
} from '@ionic/react'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'
import { useCommunity, type FeedPostView } from '../hooks/useCommunity'
import type { Comment, Post } from '../graphql/community'
import { ErrorBoundary } from '../components/error-boundary'

const friends = [
  { i: 'CR', n: 'Carlos Rodríguez', m: 'Semana 14 · Miami FL · 1,240 pts', g: 'linear-gradient(135deg,#1B6CA8,#0A1F36)' },
  { i: 'LP', n: 'Laura Pedraza', m: 'Semana 8 · Houston TX · 620 pts', g: 'linear-gradient(135deg,#D4537E,#9B2D5A)' },
  { i: 'JM', n: 'Jorge Martínez', m: 'Semana 20 · Orlando FL · 2,890 pts', g: 'linear-gradient(135deg,#E87B2B,#C05A0A)' },
  { i: 'SM', n: 'Sandra Morales', m: 'Semana 6 · Tampa FL · 380 pts', g: 'linear-gradient(135deg,#059669,#047857)' },
]

const AVATAR_GRADS = [
  'linear-gradient(135deg,#1B6CA8,#0A1F36)',
  'linear-gradient(135deg,#D4537E,#9B2D5A)',
  'linear-gradient(135deg,#E87B2B,#C05A0A)',
  'linear-gradient(135deg,#059669,#047857)',
]

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs} h`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'ayer'
  return `hace ${days} días`
}

function statusBadge(status: string) {
  if (status === 'Banned') return <IonBadge color="danger">Baneado</IonBadge>
  return <IonBadge color="success">Activo</IonBadge>
}

function PostCard({
  view,
  onOpen,
  onToggleLike,
  onToast,
}: {
  view: FeedPostView
  onOpen: (p: Post) => void
  onToggleLike: (p: Post) => Promise<void>
  onToast: (msg: string, kind?: 'ok' | 'err' | 'info' | 'warn') => void
}) {
  const { post, likeCount, likedByMe } = view
  return (
    <div className="card" style={{ margin: '0 14px 10px' }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
        <div className="avatar" style={{ width: 38, height: 38, background: AVATAR_GRADS[post.profile.id.charCodeAt(0) % AVATAR_GRADS.length], fontSize: 13 }}>
          {initialsOf(post.profile.displayName)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>{post.profile.displayName}</div>
          <div style={{ fontSize: 11, color: 'var(--mu)' }}>{timeAgo(post.createdAt)}</div>
        </div>
        {post.pinned && <span className="chip chip-gold">📌</span>}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>{post.body}</div>
      <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--g1)', paddingTop: 8 }}>
        <IonButton
          fill="clear"
          size="small"
          style={{ color: likedByMe ? 'var(--red)' : 'var(--mu)', fontWeight: 700, fontSize: 12 }}
          onClick={() => void onToggleLike(post).catch((e) => onToast((e as Error).message, 'err'))}
        >
          {likedByMe ? '♥' : '♡'} {likeCount}
        </IonButton>
        <IonButton fill="clear" size="small" style={{ color: 'var(--mu)', fontWeight: 700, fontSize: 12 }} onClick={() => onOpen(post)}>
          💬 {post.comments.length}
        </IonButton>
      </div>
    </div>
  )
}

function CommentItem({
  comment,
  depth,
  onReply,
}: {
  comment: Comment
  depth: number
  onReply: (c: Comment) => void
}) {
  return (
    <div style={{ paddingLeft: depth ? 14 : 0 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        <IonAvatar style={{ width: 26, height: 26, fontSize: 10 }}>
          {initialsOf(comment.profile?.displayName ?? 'Miembro')}
        </IonAvatar>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 12 }}>{comment.profile?.displayName ?? 'Miembro'}</div>
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>{comment.body}</div>
          <IonButton
            fill="clear"
            size="small"
            style={{ fontSize: 11, color: 'var(--mu)', height: 24 }}
            onClick={() => onReply(comment)}
          >
            Responder
          </IonButton>
        </div>
      </div>
      {(comment.replies ?? []).map((r) => (
        <CommentItem key={r.id} comment={r} depth={depth + 1} onReply={onReply} />
      ))}
    </div>
  )
}

export function CommunityPage() {
  const { showToast, pointsTotal } = useApp()
  const {
    me,
    meLoading,
    retryMe,
    feed,
    feedLoading,
    feedError,
    retryFeed,
    createPost,
    toggleLike,
    addComment,
    replyToComment,
    updateProfile,
  } = useCommunity()

  const [tab, setTab] = useState<'feed' | 'perfil' | 'amigos' | 'redes'>('feed')
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')
  const [publishing, setPublishing] = useState(false)

  const [activePost, setActivePost] = useState<Post | null>(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null)
  const [replyDraft, setReplyDraft] = useState('')

  const [editing, setEditing] = useState(false)
  const [dn, setDn] = useState('')
  const [bio, setBio] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  async function handlePublish() {
    const text = draft.trim()
    if (!text) return
    setPublishing(true)
    try {
      await createPost(text)
      setDraft('')
      showToast('Publicado en la comunidad', 'ok')
    } catch (e) {
      showToast((e as Error).message, 'err')
    } finally {
      setPublishing(false)
    }
  }

  async function handleToggleLike(post: Post) {
    await toggleLike(post)
  }

  async function handleAddComment() {
    if (!activePost) return
    const text = commentDraft.trim()
    if (!text) return
    setSendingComment(true)
    try {
      const c = await addComment(activePost.id, text)
      setActivePost((prev) =>
        prev && c ? { ...prev, comments: [...prev.comments, c] } : prev,
      )
      setCommentDraft('')
      showToast('Comentario publicado', 'ok')
    } catch (e) {
      showToast((e as Error).message, 'err')
    } finally {
      setSendingComment(false)
    }
  }

  async function handleReply() {
    if (!replyTarget) return
    const text = replyDraft.trim()
    if (!text) return
    setSendingComment(true)
    try {
      const r = await replyToComment(replyTarget.id, text)
      setActivePost((prev) => {
        if (!prev || !r) return prev
        return {
          ...prev,
          comments: prev.comments.map((c) =>
            c.id === replyTarget.id ? { ...c, replies: [...c.replies, r] } : c,
          ),
        }
      })
      setReplyDraft('')
      setReplyTarget(null)
      showToast('Respuesta publicada', 'ok')
    } catch (e) {
      showToast((e as Error).message, 'err')
    } finally {
      setSendingComment(false)
    }
  }

  function startEdit() {
    setDn(me?.displayName ?? '')
    setBio(me?.bio ?? '')
    setEditing(true)
  }

  async function handleSaveProfile() {
    if (!dn.trim()) {
      showToast('El nombre no puede estar vacío', 'warn')
      return
    }
    setSavingProfile(true)
    try {
      await updateProfile(dn.trim(), bio.trim() || null)
      setEditing(false)
      showToast('Perfil actualizado', 'ok')
    } catch (e) {
      showToast((e as Error).message, 'err')
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <ErrorBoundary>
    <Screen>
      <div className="hero hero-pur" style={{ paddingBottom: 0 }}>
        <div className="h2">🌐 Comunidad ANTARES</div>
        <div className="sub" style={{ marginBottom: 10 }}>
          COPP-ADRESD + INFINITO
        </div>
        <div style={{ display: 'flex' }}>
          {(['feed', 'perfil', 'amigos', 'redes'] as const).map((t) => (
            <button key={t} className={`com-tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <Scroll>
        {tab === 'feed' && (
          <>
            <div className="card" style={{ margin: 14 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="avatar" style={{ width: 36, height: 36, background: 'linear-gradient(145deg,#1a6ad8,#20c8ff)', fontSize: 12 }}>
                  {me ? initialsOf(me.displayName) : 'MG'}
                </div>
                <IonTextarea
                  className="fld draft-tx"
                  value={draft}
                  placeholder="¿Qué quieres compartir hoy?"
                  onIonInput={(e) => setDraft(e.detail.value ?? '')}
                  autoGrow
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <IonButton className="bt bt-pur bt-mini" disabled={publishing || !draft.trim()} onClick={() => void handlePublish()}>
                  {publishing ? 'Publicando…' : 'Publicar'}
                </IonButton>
              </div>
            </div>

            {feedError ? (
              <div className="card" style={{ margin: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6, marginBottom: 10 }}>
                  No se pudo cargar la comunidad. Verifica tu sesión e inténtalo de nuevo.
                </div>
                <IonButton className="bt bt-pur bt-mini" onClick={() => retryFeed()}>Reintentar</IonButton>
              </div>
            ) : feedLoading && feed.length === 0 ? (
              <div className="card" style={{ margin: '0 14px 10px' }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <IonSkeletonText style={{ width: 38, height: 38, borderRadius: 10 }} animated />
                    <div style={{ flex: 1 }}>
                      <IonSkeletonText style={{ width: '45%', height: 12 }} animated />
                      <IonSkeletonText style={{ width: '90%', height: 12 }} animated />
                      <IonSkeletonText style={{ width: '70%', height: 12 }} animated />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              feed.map((view) => (
                <PostCard
                  key={view.post.id}
                  view={view}
                  onOpen={(p) => setActivePost(p)}
                  onToggleLike={handleToggleLike}
                  onToast={showToast}
                />
              ))
            )}
          </>
        )}

        {tab === 'perfil' && (
          <>
            <div style={{ background: 'linear-gradient(135deg,#2D1B69,#1A0A3C)', padding: 18, textAlign: 'center', color: '#fff' }}>
              <div className="avatar" style={{ width: 64, height: 64, margin: '0 auto 8px', background: 'linear-gradient(135deg,var(--teal),#0F6E56)', fontSize: 22 }}>
                {me ? initialsOf(me.displayName) : 'MG'}
              </div>
              {me ? (
                <div className="display" style={{ fontSize: 18, fontWeight: 800 }}>{me.displayName}</div>
              ) : meLoading ? (
                <IonSkeletonText style={{ width: 180, height: 18, margin: '0 auto' }} animated />
              ) : (
                <div className="card" style={{ margin: 0, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6, marginBottom: 10 }}>
                    No se pudo cargar la comunidad. Verifica tu sesión e inténtalo de nuevo.
                  </div>
                  <IonButton className="bt bt-pur bt-mini" onClick={() => retryMe()}>Reintentar</IonButton>
                </div>
              )}
              <div style={{ fontSize: 11, opacity: 0.55 }}>{pointsTotal} pts</div>
              <div style={{ marginTop: 8 }}>{me ? statusBadge(me.status) : meLoading ? <IonSkeletonText style={{ width: 120, height: 18 }} animated /> : null}</div>
            </div>

            {me && me.status === 'Banned' && (
              <div className="card" style={{ margin: 14, border: '1px solid var(--red)', background: 'rgba(220,38,38,.08)' }}>
                <div style={{ fontSize: 13, color: 'var(--red)', fontWeight: 800, marginBottom: 4 }}>⚠️ Perfil suspendido</div>
                <div style={{ fontSize: 12, color: 'var(--mu)', lineHeight: 1.6 }}>
                  Tu perfil está suspendido en la comunidad. Contacta a un administrador.
                </div>
              </div>
            )}

            {editing ? (
              <div className="card" style={{ margin: 14 }}>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>Editar perfil</div>
                <IonInput className="fld" label="Nombre visible" labelPlacement="stacked" value={dn} onIonInput={(e) => setDn(e.detail.value ?? '')} />
                <IonTextarea className="fld" label="Sobre mí" labelPlacement="stacked" value={bio} onIonInput={(e) => setBio(e.detail.value ?? '')} autoGrow />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                  <IonButton fill="outline" className="bt bt-mini" onClick={() => setEditing(false)}>Cancelar</IonButton>
                  <IonButton className="bt bt-pur bt-mini" disabled={savingProfile} onClick={() => void handleSaveProfile()}>
                    {savingProfile ? 'Guardando…' : 'Guardar'}
                  </IonButton>
                </div>
              </div>
            ) : me && me.status === 'Active' ? (
              <div className="card" style={{ margin: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontWeight: 800 }}>Sobre mí</div>
                  <IonButton fill="clear" size="small" className="bt bt-mini" onClick={startEdit}>✏️ Editar</IonButton>
                </div>
                <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6 }}>
                  {me?.bio?.trim() ? me.bio : 'Cuéntanos sobre ti en la comunidad.'}
                </div>
              </div>
            ) : null}
          </>
        )}

        {tab === 'amigos' && (
          <>
            <div style={{ padding: 14 }}>
              <IonSearchbar className="sbar" value={q} placeholder="Buscar amigos en ANTARES…" onIonInput={(e) => setQ(e.detail.value ?? '')} />
            </div>
            {friends
              .filter((f) => f.n.toLowerCase().includes(q.toLowerCase()))
              .map((f) => (
                <div key={f.n} className="row-card">
                  <div className="avatar" style={{ width: 40, height: 40, background: f.g, fontSize: 13 }}>{f.i}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{f.n}</div>
                    <div style={{ fontSize: 11, color: 'var(--mu)' }}>{f.m}</div>
                  </div>
                  <IonButton className="bt bt-outline bt-mini" onClick={() => showToast(`Mensaje a ${f.n}`, 'ok')}>💬</IonButton>
                </div>
              ))}
          </>
        )}

        {tab === 'redes' && (
          <div style={{ padding: 14 }}>
            {[
              ['♪', 'TikTok ANTARES', '@antaresbiohacking · 48.2K', 'linear-gradient(90deg,#010101,#1A1A1A)'],
              ['📷', 'Instagram ANTARES', '@antares.biohacking · 23.7K', 'linear-gradient(90deg,#3A1F5C,#831843)'],
              ['f', 'Facebook Community', '15.4K miembros', 'linear-gradient(90deg,#0A1F5C,#1A3A8A)'],
              ['▶', 'YouTube ANTARES', 'SUMMITs · Clases · 8.1K', 'linear-gradient(90deg,#1A0000,#4A0000)'],
              ['💬', 'WhatsApp Miami', 'Grupo COPP-ADRESD · 284', 'linear-gradient(90deg,#003A1A,#004D23)'],
            ].map(([e, t, s, bg]) => (
              <button
                key={t as string}
                onClick={() => showToast(`Abriendo ${t}…`, 'info')}
                style={{ width: '100%', background: String(bg), border: 'none', borderRadius: 14, padding: 12, display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8, color: '#fff', textAlign: 'left' }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{e}</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{t}</div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>{s}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Scroll>

      <IonModal
        isOpen={!!activePost}
        onDidDismiss={() => {
          setActivePost(null)
          setReplyTarget(null)
          setReplyDraft('')
        }}
      >
        {activePost && (
          <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <div className="avatar" style={{ width: 38, height: 38, background: AVATAR_GRADS[activePost.profile.id.charCodeAt(0) % AVATAR_GRADS.length], fontSize: 13 }}>
                {initialsOf(activePost.profile.displayName)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{activePost.profile.displayName}</div>
                <div style={{ fontSize: 11, color: 'var(--mu)' }}>{timeAgo(activePost.createdAt)}</div>
              </div>
              <IonButton fill="clear" size="small" onClick={() => { setActivePost(null); setReplyTarget(null); setReplyDraft('') }}>✕</IonButton>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>{activePost.body}</div>

            <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid var(--g1)', paddingTop: 10 }}>
              {activePost.comments.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--mu)', textAlign: 'center', padding: 20 }}>Sin comentarios todavía. ¡Sé el primero!</div>
              ) : (
                activePost.comments.map((c) => (
                  <CommentItem key={c.id} comment={c} depth={0} onReply={(rc) => { setReplyTarget(rc); setReplyDraft('') }} />
                ))
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--g1)', paddingTop: 10 }}>
              {replyTarget && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12, color: 'var(--mu)' }}>
                  Respondiendo a <b>{replyTarget.profile?.displayName ?? 'Miembro'}</b>
                  <IonButton fill="clear" size="small" style={{ height: 22 }} onClick={() => setReplyTarget(null)}>✕</IonButton>
                </div>
              )}
              <IonTextarea
                className="fld draft-tx"
                value={replyTarget ? replyDraft : commentDraft}
                placeholder={replyTarget ? 'Escribe tu respuesta…' : 'Añade un comentario…'}
                onIonInput={(e) => {
                  const v = e.detail.value ?? ''
                  if (replyTarget) setReplyDraft(v)
                  else setCommentDraft(v)
                }}
                autoGrow
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <IonButton
                  className="bt bt-pur bt-mini"
                  disabled={sendingComment || (!replyTarget && !commentDraft.trim()) || (!!replyTarget && !replyDraft.trim())}
                  onClick={() => void (replyTarget ? handleReply() : handleAddComment())}
                >
                  {sendingComment ? 'Enviando…' : replyTarget ? 'Responder' : 'Comentar'}
                </IonButton>
              </div>
            </div>
          </div>
        )}
      </IonModal>
    </Screen>
    </ErrorBoundary>
  )
}
