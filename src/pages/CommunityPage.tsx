import { useState } from 'react'
import {
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
import { useQuery } from 'urql'
import { PROFILE_QUERY, type ProfileResult } from '../graphql/community'
import type { Comment, Person, Post, Profile } from '../graphql/community'
import { ErrorBoundary } from '../components/error-boundary'
import { ConversationModal } from '../components/conversation-modal'

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

function byNewest(a: { createdAt: string }, b: { createdAt: string }) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

function byOldest(a: { createdAt: string }, b: { createdAt: string }) {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}

function MemberProfile({
  profile,
  myId,
  isFriend,
  isFollowingBack,
  busy,
  onFollow,
  onUnfollow,
  onMessage,
  onOpenPost,
  onToggleLike,
  onToast,
}: {
  profile: Profile
  myId: string | null
  isFriend: boolean
  isFollowingBack: boolean
  busy: boolean
  onFollow: () => void
  onUnfollow: () => void
  onMessage: () => void
  onOpenPost: (p: Post) => void
  onToggleLike: (p: Post) => Promise<void>
  onToast: (msg: string, kind?: 'ok' | 'err' | 'info' | 'warn') => void
}) {
  return (
    <>
      <div style={{ background: 'linear-gradient(135deg,#2D1B69,#1A0A3C)', padding: 18, textAlign: 'center', color: '#fff' }}>
        <div className="avatar" style={{ width: 64, height: 64, margin: '0 auto 8px', background: AVATAR_GRADS[profile.id.charCodeAt(0) % AVATAR_GRADS.length], fontSize: 22 }}>
          {initialsOf(profile.displayName)}
        </div>
        <div className="display" style={{ fontSize: 18, fontWeight: 800 }}>{profile.displayName}</div>
      </div>
      <div className="card" style={{ margin: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Sobre mí</div>
        <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6 }}>
          {profile.bio?.trim() ? profile.bio : 'Sin bio todavía.'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '0 14px 8px', flexWrap: 'wrap' }}>
        {isFriend ? (
          <IonButton fill="outline" className="bt bt-mini" disabled={busy} onClick={() => onToast('Ya son amigos', 'info')}>
            Amigos ✓
          </IonButton>
        ) : isFollowingBack ? (
          <IonButton fill="outline" className="bt bt-mini" disabled={busy} onClick={onUnfollow}>
            Siguiendo
          </IonButton>
        ) : (
          <IonButton className="bt bt-pur bt-mini" disabled={busy} onClick={onFollow}>
            Seguir
          </IonButton>
        )}
        {isFriend && (
          <IonButton className="bt bt-outline bt-mini" onClick={onMessage}>💬 Enviar mensaje</IonButton>
        )}
      </div>
      <div style={{ padding: '14px 14px 4px', fontWeight: 800, fontSize: 13 }}>Publicaciones</div>
      {profile.posts.length === 0 ? (
        <div className="card" style={{ margin: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6 }}>Sin publicaciones todavía.</div>
        </div>
      ) : (
        profile.posts.map((post) => (
          <PostCard
            key={post.id}
            view={{
              post,
              likeCount: post.likes.length,
              likedByMe: post.likes.some((l) => l.profileId === myId),
            }}
            onOpen={onOpenPost}
            onToggleLike={onToggleLike}
            onToast={onToast}
          />
        ))
      )}
    </>
  )
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
      <div style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'center' }}>
        <div
          className="avatar"
          style={{
            width: 40,
            height: 40,
            background: AVATAR_GRADS[post.profile.id.charCodeAt(0) % AVATAR_GRADS.length],
            fontSize: 13,
            boxShadow: '0 0 0 2px var(--wh), 0 2px 8px rgba(16,42,80,0.14)',
          }}
        >
          {initialsOf(post.profile.displayName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {post.profile.displayName}
          </div>
          <div style={{ fontSize: 11, color: 'var(--mu)', fontWeight: 600 }}>{timeAgo(post.createdAt)}</div>
        </div>
        {post.pinned && (
          <span className="chip chip-gold" style={{ fontWeight: 700 }}>
            📌 Fijado
          </span>
        )}
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {post.body}
      </div>
      <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--g1)', paddingTop: 8 }}>
        <IonButton
          fill="solid"
          size="small"
          style={{
            '--background': likedByMe ? 'var(--red-l)' : 'var(--g1)',
            '--color': likedByMe ? 'var(--red)' : 'var(--mu)',
            '--border-radius': '999px',
            '--padding-start': '13px',
            '--padding-end': '13px',
            margin: 0,
            fontWeight: 700,
            fontSize: 12,
            height: 30,
          }}
          onClick={() => void onToggleLike(post).catch((e) => onToast((e as Error).message, 'err'))}
        >
          {likedByMe ? '♥' : '♡'} {likeCount}
        </IonButton>
        <IonButton
          fill="solid"
          size="small"
          style={{
            '--background': 'var(--blue-l)',
            '--color': '#185fa5',
            '--border-radius': '999px',
            '--padding-start': '13px',
            '--padding-end': '13px',
            margin: 0,
            fontWeight: 700,
            fontSize: 12,
            height: 30,
          }}
          onClick={() => onOpen(post)}
        >
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
  const isReply = depth > 0
  const name = comment.profile?.displayName ?? 'Miembro'
  const grad = AVATAR_GRADS[(comment.profile?.id ?? comment.id).charCodeAt(0) % AVATAR_GRADS.length]
  return (
    <div className={isReply ? 'cmt-reply' : 'cmt-root'}>
      <div className="cmt-row">
        <div
          className="avatar"
          style={{
            width: isReply ? 24 : 30,
            height: isReply ? 24 : 30,
            fontSize: isReply ? 9 : 11,
            background: grad,
            boxShadow: isReply ? undefined : '0 0 0 2px var(--wh), 0 2px 6px rgba(16,42,80,0.12)',
          }}
        >
          {initialsOf(name)}
        </div>
        <div className="cmt-bubble">
          <div className="cmt-head">
            <span className="cmt-name">{name}</span>
            {isReply && <span className="chip chip-pur cmt-tag">↩ Respuesta</span>}
            <span className="cmt-time">{timeAgo(comment.createdAt)}</span>
          </div>
          <div className="cmt-body">{comment.body}</div>
          <IonButton fill="clear" size="small" className="cmt-reply-btn" onClick={() => onReply(comment)}>
            ↩ Responder
          </IonButton>
        </div>
      </div>
      {[...(comment.replies ?? [])].sort(byOldest).map((r) => (
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
    followingFeed,
    followingFeedLoading,
    followingFeedError,
    retryFollowingFeed,
    friends,
    friendsLoading,
    friendsError,
    retryFriends,
    peopleFollowing,
    followers,
    followersLoading,
    followersError,
    retryFollowers,
    people,
    peopleLoading,
    peopleError,
    setPeopleQuery,
    createPost,
    toggleLike,
    addComment,
    replyToComment,
    updateProfile,
    followUser,
    unfollowUser,
    sendMessage,
  } = useCommunity()

  const [tab, setTab] = useState<'feed' | 'perfil' | 'amigos' | 'redes'>('feed')
  const [feedScope, setFeedScope] = useState<'forYou' | 'following'>('forYou')
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [activePeer, setActivePeer] = useState<Profile | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)

  const [profileResult, reexecuteProfile] = useQuery<ProfileResult>({
    query: PROFILE_QUERY,
    variables: { id: viewingId ?? '' },
    pause: !viewingId,
  })
  const profile = profileResult.data?.profile ?? null
  const followedIds = new Set(peopleFollowing.map((p) => p.id))
  const profileIsFriend = profile != null && friends.some((x) => x.id === profile.id)
  const profileFollowingBack = profile != null && followedIds.has(profile.id)

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
        const rootId = replyTarget.parentCommentId ?? replyTarget.id
        return {
          ...prev,
          comments: prev.comments.map((c) =>
            c.id === rootId ? { ...c, replies: [...c.replies, r] } : c,
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

  async function handleFollowToggle(person: Person) {
    const id = person.profile.id
    const name = person.profile.displayName
    setBusyId(id)
    try {
      if (person.isFriend) {
        showToast('Ya son amigos', 'info')
        return
      }
      if (person.isFollowing) {
        await unfollowUser(id)
        showToast(`Dejaste de seguir a ${name}`, 'ok')
      } else {
        await followUser(id)
        showToast(`Siguiendo a ${name}`, 'ok')
      }
    } catch (e) {
      showToast((e as Error).message, 'err')
    } finally {
      setBusyId(null)
    }
  }

  async function handleUnfollow(profileId: string, name: string) {
    setBusyId(profileId)
    try {
      await unfollowUser(profileId)
      showToast(`Dejaste de seguir a ${name}`, 'ok')
    } catch (e) {
      showToast((e as Error).message, 'err')
    } finally {
      setBusyId(null)
    }
  }

  async function handleFollow(profileId: string, name: string) {
    setBusyId(profileId)
    try {
      await followUser(profileId)
      showToast(`Siguiendo a ${name}`, 'ok')
    } catch (e) {
      showToast((e as Error).message, 'err')
    } finally {
      setBusyId(null)
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

            <div style={{ display: 'flex', padding: '0 14px 10px' }}>
              <button className={`com-tab ${feedScope === 'forYou' ? 'on' : ''}`} onClick={() => setFeedScope('forYou')}>
                Para ti
              </button>
              <button className={`com-tab ${feedScope === 'following' ? 'on' : ''}`} onClick={() => setFeedScope('following')}>
                Siguiendo
              </button>
            </div>

            {feedScope === 'forYou' ? (
              feedError ? (
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
              )
            ) : followingFeedError ? (
              <div className="card" style={{ margin: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6, marginBottom: 10 }}>
                  No se pudo cargar el feed de seguidos. Verifica tu sesión e inténtalo de nuevo.
                </div>
                <IonButton className="bt bt-pur bt-mini" onClick={() => retryFollowingFeed()}>Reintentar</IonButton>
              </div>
            ) : followingFeedLoading && followingFeed.length === 0 ? (
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
            ) : followingFeed.length === 0 ? (
              <div className="card" style={{ margin: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6, marginBottom: 10 }}>
                  Aún no sigues a nadie. Descubre miembros en Amigos.
                </div>
                <IonButton className="bt bt-pur bt-mini" onClick={() => setTab('amigos')}>Ir a Amigos</IonButton>
              </div>
            ) : (
              followingFeed.map((view) => (
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

            {me && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 14px 2px' }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>Mis publicaciones</div>
                  <div className="chip chip-pur" style={{ marginLeft: 'auto' }}>{me.posts.length}</div>
                </div>
                {me.posts.length === 0 ? (
                  <div className="card" style={{ margin: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6, marginBottom: 10 }}>
                      Aún no has publicado nada.
                    </div>
                    <IonButton className="bt bt-pur bt-mini" onClick={() => setTab('feed')}>Ir al feed</IonButton>
                  </div>
                ) : (
                  me.posts.map((post) => (
                    <PostCard
                      key={post.id}
                      view={{
                        post,
                        likeCount: post.likes.length,
                        likedByMe: post.likes.some((l) => l.profileId === me.id),
                      }}
                      onOpen={(p) => setActivePost(p)}
                      onToggleLike={handleToggleLike}
                      onToast={showToast}
                    />
                  ))
                )}
              </>
            )}
          </>
        )}

        {tab === 'amigos' && (viewingId ? (
          <>
            <div style={{ padding: 14 }}>
              <IonButton fill="clear" size="small" className="bt bt-mini" onClick={() => setViewingId(null)}>← Volver</IonButton>
            </div>
            {profileResult.fetching ? (
              <div className="card" style={{ margin: 14 }}>
                <IonSkeletonText style={{ width: 64, height: 64, borderRadius: 32, margin: '0 auto' }} animated />
                <IonSkeletonText style={{ width: '50%', height: 16, margin: '10px auto 0' }} animated />
                <IonSkeletonText style={{ width: '80%', height: 12, margin: '10px auto 0' }} animated />
              </div>
            ) : profileResult.error ? (
              <div className="card" style={{ margin: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6, marginBottom: 10 }}>
                  No se pudo cargar el perfil.
                </div>
                <IonButton className="bt bt-pur bt-mini" onClick={() => reexecuteProfile({ requestPolicy: 'network-only' })}>Reintentar</IonButton>
              </div>
            ) : !profile ? (
              <div className="card" style={{ margin: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6 }}>
                  No se encontró el perfil.
                </div>
              </div>
            ) : (
              <MemberProfile
                profile={profile}
                myId={me?.id ?? null}
                isFriend={profileIsFriend}
                isFollowingBack={profileFollowingBack}
                busy={busyId === profile.id}
                onFollow={() => void handleFollow(profile.id, profile.displayName)}
                onUnfollow={() => void handleUnfollow(profile.id, profile.displayName)}
                onMessage={() => setActivePeer(profile)}
                onOpenPost={setActivePost}
                onToggleLike={handleToggleLike}
                onToast={showToast}
              />
            )}
          </>
        ) : (
          <>
            <div style={{ padding: 14 }}>
              <IonSearchbar
                className="sbar"
                value={q}
                placeholder="Buscar amigos en ANTARES…"
                onIonInput={(e) => {
                  const v = e.detail.value ?? ''
                  setQ(v)
                  setPeopleQuery(v)
                }}
              />
            </div>

            {q.trim() !== '' ? (
              peopleLoading ? (
                <div className="card" style={{ margin: '0 14px 10px' }}>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                      <IonSkeletonText style={{ width: 40, height: 40, borderRadius: 10 }} animated />
                      <div style={{ flex: 1 }}>
                        <IonSkeletonText style={{ width: '45%', height: 12 }} animated />
                        <IonSkeletonText style={{ width: '80%', height: 12 }} animated />
                      </div>
                    </div>
                  ))}
                </div>
              ) : peopleError ? (
                <div className="card" style={{ margin: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6, marginBottom: 10 }}>
                    No se pudo buscar. Inténtalo de nuevo.
                  </div>
                  <IonButton className="bt bt-pur bt-mini" onClick={() => setPeopleQuery(q)}>Reintentar</IonButton>
                </div>
              ) : people.length === 0 ? (
                <div className="card" style={{ margin: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6 }}>
                    Sin resultados para «{q}»
                  </div>
                </div>
              ) : (
                people.map((p) => {
                  const grad = AVATAR_GRADS[p.profile.id.charCodeAt(0) % AVATAR_GRADS.length]
                  const busy = busyId === p.profile.id
                  return (
                    <div key={p.profile.id} className="row-card">
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, minWidth: 0 }} onClick={() => setViewingId(p.profile.id)}>
                        <div className="avatar" style={{ width: 40, height: 40, background: grad, fontSize: 13 }}>
                          {initialsOf(p.profile.displayName)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 13 }}>{p.profile.displayName}</div>
                          <div style={{ fontSize: 11, color: 'var(--mu)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.profile.bio?.trim() || 'Sin bio'}
                          </div>
                        </div>
                      </div>
                      {p.isFriend ? (
                        <>
                          <IonButton fill="outline" className="bt bt-mini" disabled={busy} onClick={() => showToast('Ya son amigos', 'info')}>
                            Amigos ✓
                          </IonButton>
                          <IonButton className="bt bt-outline bt-mini" onClick={() => setActivePeer(p.profile)}>💬</IonButton>
                        </>
                      ) : p.isFollowing ? (
                        <IonButton fill="outline" className="bt bt-mini" disabled={busy} onClick={() => void handleFollowToggle(p)}>
                          Siguiendo
                        </IonButton>
                      ) : (
                        <IonButton className="bt bt-pur bt-mini" disabled={busy} onClick={() => void handleFollowToggle(p)}>
                          Seguir
                        </IonButton>
                      )}
                    </div>
                  )
                })
              )
            ) : (
              <>
                <div style={{ padding: '14px 14px 4px', fontWeight: 800, fontSize: 13 }}>
                  Amigos <span className="chip chip-pur" style={{ marginLeft: 6 }}>{friends.length}</span>
                </div>
                {friendsError ? (
                  <div className="card" style={{ margin: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6, marginBottom: 10 }}>
                      No se pudo cargar tus amigos.
                    </div>
                    <IonButton className="bt bt-pur bt-mini" onClick={() => retryFriends()}>Reintentar</IonButton>
                  </div>
                ) : friendsLoading ? (
                  <div className="card" style={{ margin: '0 14px 10px' }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                        <IonSkeletonText style={{ width: 40, height: 40, borderRadius: 10 }} animated />
                        <div style={{ flex: 1 }}>
                          <IonSkeletonText style={{ width: '45%', height: 12 }} animated />
                          <IonSkeletonText style={{ width: '80%', height: 12 }} animated />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : friends.length === 0 ? (
                  <div className="card" style={{ margin: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6 }}>
                      Aún no tienes amigos. ¡Sigue a alguien y si te siguen, serán amigos!
                    </div>
                  </div>
                ) : (
                  friends.map((f) => (
                    <div key={f.id} className="row-card">
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, minWidth: 0 }} onClick={() => setViewingId(f.id)}>
                        <div className="avatar" style={{ width: 40, height: 40, background: AVATAR_GRADS[f.id.charCodeAt(0) % AVATAR_GRADS.length], fontSize: 13 }}>
                          {initialsOf(f.displayName)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 13 }}>{f.displayName}</div>
                          <div style={{ fontSize: 11, color: 'var(--mu)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.bio?.trim() || 'Sin bio'}
                          </div>
                        </div>
                      </div>
                      <IonButton className="bt bt-outline bt-mini" onClick={() => setActivePeer(f)}>💬</IonButton>
                    </div>
                  ))
                )}

                <div style={{ padding: '14px 14px 4px', fontWeight: 800, fontSize: 13 }}>Seguidores</div>
                {followersError ? (
                  <div className="card" style={{ margin: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6, marginBottom: 10 }}>
                      No se pudo cargar tus seguidores.
                    </div>
                    <IonButton className="bt bt-pur bt-mini" onClick={() => retryFollowers()}>Reintentar</IonButton>
                  </div>
                ) : followersLoading ? (
                  <div className="card" style={{ margin: '0 14px 10px' }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                        <IonSkeletonText style={{ width: 40, height: 40, borderRadius: 10 }} animated />
                        <div style={{ flex: 1 }}>
                          <IonSkeletonText style={{ width: '45%', height: 12 }} animated />
                          <IonSkeletonText style={{ width: '80%', height: 12 }} animated />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : followers.length === 0 ? (
                  <div className="card" style={{ margin: 14, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6 }}>
                      Aún no tienes seguidores.
                    </div>
                  </div>
                ) : (
                  followers.map((f) => {
                    const isFriend = friends.some((x) => x.id === f.id)
                    const isFollowingBack = followedIds.has(f.id)
                    const busy = busyId === f.id
                    return (
                      <div key={f.id} className="row-card">
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, minWidth: 0 }} onClick={() => setViewingId(f.id)}>
                          <div className="avatar" style={{ width: 40, height: 40, background: AVATAR_GRADS[f.id.charCodeAt(0) % AVATAR_GRADS.length], fontSize: 13 }}>
                            {initialsOf(f.displayName)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: 13 }}>{f.displayName}</div>
                            <div style={{ fontSize: 11, color: 'var(--mu)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {f.bio?.trim() || 'Sin bio'}
                            </div>
                          </div>
                        </div>
                        {isFriend ? (
                          <>
                            <span style={{ fontSize: 11, color: 'var(--mu)', fontWeight: 700 }}>Te sigue</span>
                            <IonButton fill="outline" className="bt bt-mini" disabled={busy} onClick={() => showToast('Ya son amigos', 'info')}>
                              Amigos ✓
                            </IonButton>
                            <IonButton className="bt bt-outline bt-mini" onClick={() => setActivePeer(f)}>💬</IonButton>
                          </>
                        ) : isFollowingBack ? (
                          <>
                            <span style={{ fontSize: 11, color: 'var(--mu)', fontWeight: 700 }}>Te sigue</span>
                            <IonButton fill="outline" className="bt bt-mini" disabled={busy} onClick={() => void handleUnfollow(f.id, f.displayName)}>
                              Siguiendo
                            </IonButton>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: 11, color: 'var(--mu)', fontWeight: 700 }}>Te sigue</span>
                            <IonButton className="bt bt-pur bt-mini" disabled={busy} onClick={() => void handleFollow(f.id, f.displayName)}>
                              Seguir de vuelta
                            </IonButton>
                          </>
                        )}
</div>
                    )
                  })
                )}
              </>
            )}
          </>
        ))}

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
              {activePost.comments.filter((c) => !c.parentCommentId).sort(byNewest).length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--mu)', textAlign: 'center', padding: 20 }}>Sin comentarios todavía. ¡Sé el primero!</div>
              ) : (
                activePost.comments.filter((c) => !c.parentCommentId).sort(byNewest).map((c) => (
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

      {me && activePeer && (
        <ConversationModal
          peer={activePeer}
          me={me}
          open={!!activePeer}
          onClose={() => setActivePeer(null)}
          onToast={showToast}
          onSend={async (body) => {
            await sendMessage(activePeer.id, body)
          }}
        />
      )}
    </Screen>
    </ErrorBoundary>
  )
}
