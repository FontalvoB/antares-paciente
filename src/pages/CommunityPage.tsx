import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  IonAlert,
  IonBadge,
  IonButton,
  IonCheckbox,
  IonIcon,
  IonInput,
  IonModal,
  IonSearchbar,
  IonSkeletonText,
  IonTextarea,
} from '@ionic/react'
import {
  alertCircle,
  arrowBack,
  arrowUndo,
  arrowUp,
  ban,
  chatbubbleEllipsesOutline,
  chatbubbles,
  chatbubblesOutline,
  checkmark,
  close,
  compass,
  compassOutline,
  createOutline,
  documentTextOutline,
  globeOutline,
  heart,
  heartOutline,
  people as peopleIcon,
  peopleOutline,
  person,
  personAddOutline,
  personOutline,
  personRemoveOutline,
  pin,
  searchOutline,
  send,
  shareSocial,
  shareSocialOutline,
  sparklesOutline,
  star,
  starOutline,
} from 'ionicons/icons'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'
import { useCommunity, useConversationMessageListener, useGroupChangedListener, useGroupMessageListener, type FeedPostView } from '../hooks/useCommunity'
import { useQuery, useSubscription } from 'urql'
import {
  POST_ADDED,
  PROFILE_FOLLOWERS_QUERY,
  PROFILE_FOLLOWING_QUERY,
  PROFILE_QUERY,
  type PostAddedResult,
  type ProfileFollowersResult,
  type ProfileFollowingResult,
  type ProfileResult,
} from '../graphql/community'
import type { ChatGroup, Comment, Person, Post, Profile } from '../graphql/community'
import { ErrorBoundary } from '../components/error-boundary'
import { ConversationModal } from '../components/conversation-modal'

/** Suscriptor "invisible" para una conversación: avisa para refrescar la lista
 *  de conversaciones cuando llega un mensaje (tab de chat, modal cerrado). */
function ConversationMessageListener({
  meId,
  peerId,
  onMessage,
}: {
  meId: string | null
  peerId: string
  onMessage: () => void
}) {
  useConversationMessageListener(meId, peerId, onMessage)
  return null
}

/** Suscriptor "invisible" para UN grupo: refresca la lista de grupos cuando
 *  llega un mensaje o el grupo cambia (alta/baja de miembros, renombrado).
 *  Solo se usa cuando el modal de grupo está cerrado. */
function GroupListener({
  groupId,
  onMessage,
  onChanged,
}: {
  groupId: string
  onMessage: () => void
  onChanged: () => void
}) {
  useGroupMessageListener(groupId, onMessage)
  useGroupChangedListener(groupId, onChanged)
  return null
}

/** Renderiza un suscriptor por grupo (los hooks deben llamarse dentro de un
 *  componente, no en un bucle a nivel de página). */
function GroupChatListeners({
  groups,
  onMessage,
  onChanged,
}: {
  groups: ChatGroup[]
  onMessage: () => void
  onChanged: () => void
}) {
  return (
    <>
      {groups.map((g) => (
        <GroupListener key={g.id} groupId={g.id} onMessage={onMessage} onChanged={onChanged} />
      ))}
    </>
  )
}

/** Modal de creación de grupo: nombre + selección de amigos (mutual-friends). */
function CreateGroupModal({
  isOpen,
  onClose,
  friends,
  onCreate,
  onToast,
}: {
  isOpen: boolean
  onClose: () => void
  friends: Profile[]
  onCreate: (name: string, memberProfileIds: string[]) => Promise<unknown>
  onToast: (msg: string, kind?: 'ok' | 'err' | 'info' | 'warn') => void
}) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  async function handleCreate() {
    if (name.trim().length < 3 || selected.length === 0 || creating) return
    setCreating(true)
    try {
      await onCreate(name.trim(), selected)
      onToast('Grupo creado', 'ok')
      setName('')
      setSelected([])
      onClose()
    } catch (e) {
      onToast((e as Error).message, 'err')
    } finally {
      setCreating(false)
    }
  }

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--wh)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px 10px', borderBottom: '1px solid var(--g1)' }}>
          <div style={{ fontWeight: 800, fontSize: 15, flex: 1 }}>Nuevo grupo</div>
          <IonButton fill="clear" size="small" onClick={onClose}><IonIcon icon={close} /></IonButton>
        </div>
        <div style={{ padding: '12px 14px 4px' }}>
          <IonInput
            className="fld"
            label="Nombre del grupo"
            labelPlacement="stacked"
            value={name}
            onIonInput={(e) => setName(e.detail.value ?? '')}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {friends.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 13, marginTop: 20, padding: '0 20px' }}>
              No tienes amigos para añadir todavía.
            </div>
          ) : (
            friends.map((f) => (
              <div
                key={f.id}
                className="row-card"
                style={{ cursor: 'pointer' }}
                onClick={() => toggle(f.id)}
              >
                <div
                  className="avatar"
                  style={{ width: 38, height: 38, fontSize: 13, background: AVATAR_GRADS[f.id.charCodeAt(0) % AVATAR_GRADS.length] }}
                >
                  {initialsOf(f.displayName)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{f.displayName}</div>
                </div>
                <IonCheckbox checked={selected.includes(f.id)} />
              </div>
            ))
          )}
        </div>
        <div style={{ borderTop: '1px solid var(--g1)', padding: '10px 12px', display: 'flex', justifyContent: 'flex-end' }}>
          <IonButton
            className="bt bt-pur bt-mini"
            disabled={name.trim().length < 3 || selected.length === 0 || creating}
            onClick={() => void handleCreate()}
          >
            {creating ? 'Creando…' : 'Crear grupo'}
          </IonButton>
        </div>
      </div>
    </IonModal>
  )
}

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
  if (status === 'BANNED') return <IonBadge color="danger">Baneado</IonBadge>
  return <IonBadge color="success">Activo</IonBadge>
}

function byNewest(a: { createdAt: string }, b: { createdAt: string }) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

function byOldest(a: { createdAt: string }, b: { createdAt: string }) {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}

function EmptyState({
  icon,
  tone = 'pur',
  title,
  hint,
  children,
}: {
  icon: string
  tone?: 'pur' | 'gold' | 'teal' | 'blue' | 'red'
  title: string
  hint?: string
  children?: ReactNode
}) {
  return (
    <div className="card" style={{ margin: 14, textAlign: 'center', padding: '18px 14px' }}>
      <div className={`empty-ico tone-${tone}`}>
        <IonIcon icon={icon} />
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 4 }}>{title}</div>
      {hint && (
        <div style={{ fontSize: 12.5, color: 'var(--mu)', lineHeight: 1.6, marginBottom: children ? 10 : 0 }}>
          {hint}
        </div>
      )}
      {children}
    </div>
  )
}

/** Pantalla de bloqueo completo para perfiles suspendidos.
 *  No es dismissable: reemplaza toda la UI de la comunidad. */
function BannedScreen({ reason }: { reason?: string | null }) {
  const { navigate } = useApp()
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      background: 'var(--red-l)',
      textAlign: 'center',
    }}>
      <IonIcon icon={ban} style={{ fontSize: 64, color: 'var(--panic)', marginBottom: 18 }} />
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Perfil suspendido</div>
      <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6, maxWidth: 280 }}>
        Tu perfil fue suspendido en la comunidad.
      </div>
      {reason && (
        <p style={{ fontSize: 12, color: 'var(--mu)', marginTop: 14, padding: '10px 14px', background: 'var(--wh)', borderRadius: 10, maxWidth: 300, lineHeight: 1.5, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
          {reason}
        </p>
      )}
      {/* Botón para salir de la comunidad y volver al inicio de la app */}
      <IonButton
        style={{ marginTop: 16, '--background': 'var(--teal)', '--color': '#fff', '--border-radius': '12px', fontWeight: 700 }}
        onClick={() => navigate('home')}
      >
        Volver a la app
      </IonButton>
    </div>
  )
}

function MemberProfile({
  profile,
  myId,
  isFriend,
  isFollowingBack,
  busy,
  followersCount,
  followingCount,
  onShowList,
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
  followersCount: number
  followingCount: number
  onShowList: (which: 'followers' | 'following') => void
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
        <div style={{ display: 'flex', gap: 28, justifyContent: 'center', marginTop: 12 }}>
          <button onClick={() => onShowList('followers')} style={{ background: 'none', border: 'none', color: '#fff', padding: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{followersCount}</div>
            <div style={{ fontSize: 11, opacity: 0.65, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center' }}><IonIcon icon={peopleOutline} style={{ fontSize: 12 }} /> Seguidores</div>
          </button>
          <button onClick={() => onShowList('following')} style={{ background: 'none', border: 'none', color: '#fff', padding: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{followingCount}</div>
            <div style={{ fontSize: 11, opacity: 0.65, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center' }}><IonIcon icon={personAddOutline} style={{ fontSize: 12 }} /> Siguiendo</div>
          </button>
        </div>
      </div>
      <div className="card" style={{ margin: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Sobre mí</div>
        <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6 }}>
          {profile.bio?.trim() ? profile.bio : 'Sin bio todavía.'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '0 14px 8px', flexWrap: 'wrap' }}>
        {isFriend ? (
          <IonButton fill="outline" className="bt bt-mini" disabled={busy} onClick={onUnfollow}>
            <IonIcon icon={personRemoveOutline} style={{ marginRight: 4, verticalAlign: '-2px' }} /> Dejar de seguir
          </IonButton>
        ) : isFollowingBack ? (
          <IonButton fill="outline" className="bt bt-mini" disabled={busy} onClick={onUnfollow}>
            <IonIcon icon={checkmark} style={{ marginRight: 4, verticalAlign: '-2px' }} /> Siguiendo
          </IonButton>
        ) : (
          <IonButton className="bt bt-pur bt-mini" disabled={busy} onClick={onFollow}>
            <IonIcon icon={personAddOutline} style={{ marginRight: 4, verticalAlign: '-2px' }} /> Seguir
          </IonButton>
        )}
        {isFriend && (
          <IonButton className="bt bt-outline bt-mini" onClick={onMessage}><IonIcon icon={chatbubbleEllipsesOutline} style={{ marginRight: 4, verticalAlign: '-2px' }} /> Enviar mensaje</IonButton>
        )}
      </div>
      <div className="com-sech"><span className="com-sech-ico pur"><IonIcon icon={documentTextOutline} /></span> Publicaciones</div>
      {profile.posts.length === 0 ? (
        <EmptyState icon={documentTextOutline} tone="pur" title="Sin publicaciones todavía" />
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
          <span className="chip chip-gold" style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <IonIcon icon={pin} style={{ fontSize: 12 }} /> Fijado
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
          {likedByMe ? <IonIcon icon={heart} style={{ verticalAlign: '-2px' }} /> : <IonIcon icon={heartOutline} style={{ verticalAlign: '-2px' }} />} {likeCount}
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
          <IonIcon icon={chatbubbleEllipsesOutline} style={{ verticalAlign: '-2px' }} /> {post.comments.length}
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
            {isReply && <span className="chip chip-pur cmt-tag"><IonIcon icon={arrowUndo} style={{ fontSize: 10, marginRight: 3, verticalAlign: '-1px' }} />Respuesta</span>}
            <span className="cmt-time">{timeAgo(comment.createdAt)}</span>
          </div>
          <div className="cmt-body">{comment.body}</div>
          <IonButton fill="clear" size="small" className="cmt-reply-btn" onClick={() => onReply(comment)}>
            <IonIcon icon={arrowUndo} style={{ fontSize: 12, marginRight: 3, verticalAlign: '-2px' }} /> Responder
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
    conversations,
    conversationsLoading,
    conversationsError,
    refetchConversations,
    createPost,
    toggleLike,
    addComment,
    replyToComment,
    updateProfile,
    followUser,
    unfollowUser,
    sendMessage,
    // --- Grupos de chat ---
    groups,
    groupsLoading,
    groupsError,
    refetchGroups,
    createGroup,
    renameGroup,
    addGroupMember,
    removeGroupMember,
    leaveGroup,
    sendGroupMessage,
  } = useCommunity()

  const [tab, setTab] = useState<'feed' | 'perfil' | 'chat' | 'amigos' | 'redes'>('feed')
  const [feedScope, setFeedScope] = useState<'forYou' | 'following'>('forYou')
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [activePeer, setActivePeer] = useState<Profile | null>(null)
  const [activeGroup, setActiveGroup] = useState<ChatGroup | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [unfollowTarget, setUnfollowTarget] = useState<Profile | null>(null)
  const [perfilList, setPerfilList] = useState<'followers' | 'following' | null>(null)
  const [memberList, setMemberList] = useState<'followers' | 'following' | null>(null)

  const [profileResult, reexecuteProfile] = useQuery<ProfileResult>({
    query: PROFILE_QUERY,
    variables: { id: viewingId ?? '' },
    pause: !viewingId,
  })
  const [memberFollowersResult, reexecuteMemberFollowers] = useQuery<ProfileFollowersResult>({
    query: PROFILE_FOLLOWERS_QUERY,
    variables: { profileId: viewingId ?? '', take: 50, skip: 0 },
    pause: !viewingId,
  })
  const [memberFollowingResult, reexecuteMemberFollowing] = useQuery<ProfileFollowingResult>({
    query: PROFILE_FOLLOWING_QUERY,
    variables: { profileId: viewingId ?? '', take: 50, skip: 0 },
    pause: !viewingId,
  })
  const memberListItems =
    memberList === 'followers'
      ? (memberFollowersResult.data?.profileFollowers ?? [])
      : (memberFollowingResult.data?.profileFollowing ?? [])
  const memberListFetching =
    memberList === 'followers' ? memberFollowersResult.fetching : memberFollowingResult.fetching
  const memberListError =
    memberList === 'followers' ? memberFollowersResult.error : memberFollowingResult.error
  const retryMemberList = () => {
    if (memberList === 'followers') void reexecuteMemberFollowers({ requestPolicy: 'network-only' })
    else void reexecuteMemberFollowing({ requestPolicy: 'network-only' })
  }
  const profile = profileResult.data?.profile ?? null
  const followedIds = useMemo(() => new Set(peopleFollowing.map((p) => p.id)), [peopleFollowing])
  const recommended = followers.filter((f) => !friends.some((x) => x.id === f.id))
  const profileIsFriend = profile != null && friends.some((x) => x.id === profile.id)
  const profileFollowingBack = profile != null && followedIds.has(profile.id)

  useEffect(() => {
    if (tab === 'chat') void refetchConversations()
  }, [tab, refetchConversations])

  const scrollRef = useRef<HTMLDivElement>(null)
  const [newPostsCount, setNewPostsCount] = useState(0)
  const seenPostIdsRef = useRef(new Set<string>())

  const [postAddedResult] = useSubscription<PostAddedResult>({
    query: POST_ADDED,
    pause: !(tab === 'feed' && !viewingId) || me?.status === 'BANNED',
  })

  useEffect(() => {
    const post = postAddedResult.data?.postAdded
    if (!post) return
    if (post.profile.id === me?.id) return
    if (feedScope === 'following' && !followedIds.has(post.profile.id)) return
    if (seenPostIdsRef.current.has(post.id)) return
    seenPostIdsRef.current.add(post.id)
    setNewPostsCount((c) => c + 1)
  }, [postAddedResult.data, me?.id, feedScope, followedIds])

  useEffect(() => {
    seenPostIdsRef.current.clear()
    setNewPostsCount(0)
  }, [tab, viewingId, feedScope])

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
        setUnfollowTarget(person.profile)
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

  const handleTab = (id: 'feed' | 'perfil' | 'chat' | 'amigos' | 'redes') => {
    setTab(id)
    setViewingId(null)
    setMemberList(null)
  }

  return (
    <ErrorBoundary>
    {meLoading && !me ? (
      /* Skeleton de carga mientras se obtiene el perfil */
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <IonSkeletonText style={{ width: 180, height: 18 }} animated />
      </div>
    ) : me && me.status === 'BANNED' ? (
      <BannedScreen reason={me.banReason} />
    ) : (
    <Screen>
      <div className="hero hero-pur" style={{ paddingBottom: 0 }}>
        <div className="h2"><IonIcon icon={globeOutline} style={{ marginRight: 6, verticalAlign: '-2px' }} /> Comunidad ANTARES</div>
        <div className="sub" style={{ marginBottom: 10 }}>
          COPP-ADRESD + INFINITO
        </div>
        <div style={{ display: 'flex' }}>
          {([
            ['feed', 'Feed', compassOutline, compass],
            ['perfil', 'Perfil', personOutline, person],
            ['chat', 'Chat', chatbubblesOutline, chatbubbles],
            ['amigos', 'Amigos', peopleOutline, peopleIcon],
            ['redes', 'Redes', shareSocialOutline, shareSocial],
          ] as const).map(([id, label, iconOff, iconOn]) => (
            <button key={id} className={`com-tab ${tab === id ? 'on' : ''}`} onClick={() => handleTab(id)}>
              <IonIcon icon={tab === id ? iconOn : iconOff} style={{ marginRight: 5, verticalAlign: '-2px' }} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <Scroll ref={scrollRef}>
        {viewingId ? (memberList ? (
          <>
            <div style={{ padding: 14 }}>
              <IonButton fill="clear" size="small" className="bt bt-mini" onClick={() => setMemberList(null)}><IonIcon icon={arrowBack} style={{ marginRight: 4 }} /> Volver</IonButton>
            </div>
            <div style={{ padding: '0 14px 4px', fontWeight: 800, fontSize: 14 }}>
              {memberList === 'followers' ? 'Seguidores' : 'Siguiendo'}
            </div>
            {memberListFetching ? (
              <div className="card" style={{ margin: 14 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <IonSkeletonText style={{ width: 40, height: 40, borderRadius: 10 }} animated />
                    <div style={{ flex: 1 }}>
                      <IonSkeletonText style={{ width: '45%', height: 12 }} animated />
                      <IonSkeletonText style={{ width: '70%', height: 12 }} animated />
                    </div>
                  </div>
                ))}
              </div>
            ) : memberListError ? (
              <div className="card" style={{ margin: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6, marginBottom: 10 }}>
                  No se pudo cargar la lista.
                </div>
                <IonButton className="bt bt-pur bt-mini" onClick={retryMemberList}>Reintentar</IonButton>
              </div>
            ) : memberListItems.length === 0 ? (
              <EmptyState
                icon={memberList === 'followers' ? peopleOutline : personAddOutline}
                tone={memberList === 'followers' ? 'teal' : 'blue'}
                title={memberList === 'followers' ? 'Aún no tiene seguidores' : 'No sigue a nadie todavía'}
              />
            ) : (
              memberListItems.map((row) => (
                <div key={row.id} className="row-card">
                  <div
                    style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, minWidth: 0, cursor: 'pointer' }}
                    onClick={() => {
                      setViewingId(row.id)
                      setMemberList(null)
                    }}
                  >
                    <div className="avatar" style={{ width: 40, height: 40, background: AVATAR_GRADS[row.id.charCodeAt(0) % AVATAR_GRADS.length], fontSize: 13 }}>
                      {initialsOf(row.displayName)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{row.displayName}</div>
                      <div style={{ fontSize: 11, color: 'var(--mu)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.bio?.trim() || 'Sin bio'}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--mu)', fontWeight: 700 }}>
                      {memberList === 'followers' ? 'Te sigue' : 'Siguiendo'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </>
        ) : (
          <>
            <div style={{ padding: 14 }}>
              <IonButton fill="clear" size="small" className="bt bt-mini" onClick={() => setViewingId(null)}><IonIcon icon={arrowBack} style={{ marginRight: 4 }} /> Volver</IonButton>
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
                followersCount={memberFollowersResult.data?.profileFollowers.length ?? 0}
                followingCount={memberFollowingResult.data?.profileFollowing.length ?? 0}
                onShowList={(w) => setMemberList(w)}
                onFollow={() => void handleFollow(profile.id, profile.displayName)}
                onUnfollow={() => setUnfollowTarget(profile)}
                onMessage={() => setActivePeer(profile)}
                onOpenPost={setActivePost}
                onToggleLike={handleToggleLike}
                onToast={showToast}
              />
            )}
          </>
        )) : (
          <>
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
                  {publishing ? 'Publicando…' : (
                    <>
                      <IonIcon icon={send} style={{ marginRight: 4, verticalAlign: '-2px' }} /> Publicar
                    </>
                  )}
                </IonButton>
              </div>
            </div>

            <div style={{ display: 'flex', padding: '0 14px 10px' }}>
              <button className={`com-tab lt ${feedScope === 'forYou' ? 'on' : ''}`} onClick={() => setFeedScope('forYou')}>
                <IonIcon icon={sparklesOutline} style={{ marginRight: 5, verticalAlign: '-2px' }} /> Para ti
              </button>
              <button className={`com-tab lt ${feedScope === 'following' ? 'on' : ''}`} onClick={() => setFeedScope('following')}>
                <IonIcon icon={peopleOutline} style={{ marginRight: 5, verticalAlign: '-2px' }} /> Siguiendo
              </button>
            </div>

            {newPostsCount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '0 14px 10px' }}>
                <IonButton
                  shape="round"
                  size="small"
                  style={
                    {
                      '--background': 'var(--teal)',
                      '--color': '#fff',
                      '--box-shadow': '0 2px 8px rgba(20,33,59,0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    } as CSSProperties
                  }
                  onClick={() => {
                    setNewPostsCount(0)
                    seenPostIdsRef.current.clear()
                    if (feedScope === 'forYou') retryFeed()
                    else retryFollowingFeed()
                    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  <IonIcon icon={arrowUp} />
                  <span>
                    Ver {newPostsCount} {newPostsCount === 1 ? 'publicación nueva' : 'publicaciones nuevas'}
                  </span>
                </IonButton>
              </div>
            )}

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
              <EmptyState
                icon={peopleOutline}
                tone="teal"
                title="Aún no sigues a nadie"
                hint="Descubre miembros en Amigos y sigue a quien te interese."
              >
                <IonButton className="bt bt-pur bt-mini" onClick={() => setTab('amigos')}>Ir a Amigos</IonButton>
              </EmptyState>
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

        {tab === 'perfil' && (perfilList ? (
          <>
            <div style={{ padding: 14 }}>
              <IonButton fill="clear" size="small" className="bt bt-mini" onClick={() => setPerfilList(null)}><IonIcon icon={arrowBack} style={{ marginRight: 4 }} /> Volver</IonButton>
            </div>
            <div style={{ padding: '0 14px 4px', fontWeight: 800, fontSize: 14 }}>
              {perfilList === 'followers' ? 'Seguidores' : 'Siguiendo'}
            </div>
            {(perfilList === 'followers' ? followers : peopleFollowing).length === 0 ? (
              <EmptyState
                icon={perfilList === 'followers' ? peopleOutline : personAddOutline}
                tone={perfilList === 'followers' ? 'teal' : 'blue'}
                title={perfilList === 'followers' ? 'Aún no tienes seguidores' : 'No sigues a nadie todavía'}
              />
            ) : (
              (perfilList === 'followers' ? followers : peopleFollowing).map((f) => (
                <div
                  key={f.id}
                  className="row-card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setViewingId(f.id)}
                >
                  <div className="avatar" style={{ width: 40, height: 40, background: AVATAR_GRADS[f.id.charCodeAt(0) % AVATAR_GRADS.length], fontSize: 13 }}>
                    {initialsOf(f.displayName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{f.displayName}</div>
                    <div style={{ fontSize: 11, color: 'var(--mu)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.bio?.trim() || 'Sin bio'}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--mu)', fontWeight: 700 }}>
                    {perfilList === 'followers' ? 'Te sigue' : 'Siguiendo'}
                  </span>
                </div>
              ))
            )}
          </>
        ) : (
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
              <div style={{ display: 'flex', gap: 28, justifyContent: 'center', marginTop: 12 }}>
                <button onClick={() => setPerfilList('followers')} style={{ background: 'none', border: 'none', color: '#fff', padding: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{followers.length}</div>
                  <div style={{ fontSize: 11, opacity: 0.65, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center' }}>
                    <IonIcon icon={peopleOutline} style={{ fontSize: 12 }} /> Seguidores
                  </div>
                </button>
                <button onClick={() => setPerfilList('following')} style={{ background: 'none', border: 'none', color: '#fff', padding: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{peopleFollowing.length}</div>
                  <div style={{ fontSize: 11, opacity: 0.65, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center' }}>
                    <IonIcon icon={personAddOutline} style={{ fontSize: 12 }} /> Siguiendo
                  </div>
                </button>
              </div>
            </div>

            {me && me.status === 'BANNED' && (
              <div className="card" style={{ margin: 14, border: '1px solid var(--red)', background: 'rgba(220,38,38,.08)' }}>
                <div style={{ fontSize: 13, color: 'var(--red)', fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <IonIcon icon={alertCircle} /> Perfil suspendido
                </div>
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
            ) : me && me.status === 'ACTIVE' ? (
              <div className="card" style={{ margin: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontWeight: 800 }}>Sobre mí</div>
                  <IonButton fill="clear" size="small" className="bt bt-mini" onClick={startEdit}>
                    <IonIcon icon={createOutline} style={{ marginRight: 4 }} /> Editar
                  </IonButton>
                </div>
                <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6 }}>
                  {me?.bio?.trim() ? me.bio : 'Cuéntanos sobre ti en la comunidad.'}
                </div>
              </div>
            ) : null}

            {me && (
              <>
                <div className="com-sech">
                  <span className="com-sech-ico pur"><IonIcon icon={documentTextOutline} /></span>
                  Mis publicaciones
                  <span className="chip chip-pur" style={{ marginLeft: 'auto' }}>{me.posts.length}</span>
                </div>
                {me.posts.length === 0 ? (
                  <EmptyState icon={documentTextOutline} tone="pur" title="Aún no has publicado nada" hint="Comparte algo con la comunidad desde el feed.">
                    <IonButton className="bt bt-pur bt-mini" onClick={() => setTab('feed')}>Ir al feed</IonButton>
                  </EmptyState>
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
          ))}

        {tab === 'chat' && (
          <>
            {/* Refresca la lista en vivo: un suscriptor por conversación.
                Solo cuando el modal está cerrado (el modal ya escucha la suya). */}
            {!activePeer &&
              conversations.map((c) => (
                <ConversationMessageListener
                  key={c.peer.id}
                  meId={me?.id ?? null}
                  peerId={c.peer.id}
                  onMessage={refetchConversations}
                />
              ))}
            {/* Suscriptores por grupo (mensajes + cambios). Solo cuando el
                modal de grupo está cerrado. */}
            {!activeGroup && (
              <GroupChatListeners groups={groups} onMessage={refetchGroups} onChanged={refetchGroups} />
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 14px 6px' }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Chat</div>
              <IonButton className="bt bt-pur bt-mini" onClick={() => setCreateOpen(true)}>
                <IonIcon icon={personAddOutline} style={{ marginRight: 4, verticalAlign: '-2px' }} /> Nuevo grupo
              </IonButton>
            </div>

            {conversationsLoading || groupsLoading ? (
              <div className="card" style={{ margin: 14 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--g1)' : 'none' }}>
                    <IonSkeletonText style={{ width: 40, height: 40, borderRadius: 10 }} animated />
                    <div style={{ flex: 1 }}>
                      <IonSkeletonText style={{ width: '40%', height: 12, marginBottom: 6 }} animated />
                      <IonSkeletonText style={{ width: '70%', height: 11 }} animated />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversationsError || groupsError ? (
              <div className="card" style={{ margin: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--mu)', lineHeight: 1.6, marginBottom: 10 }}>
                  No se pudo cargar tus conversaciones.
                </div>
                <IonButton className="bt bt-pur bt-mini" onClick={() => { refetchConversations(); refetchGroups() }}>
                  Reintentar
                </IonButton>
              </div>
            ) : conversations.length === 0 && groups.length === 0 ? (
              <EmptyState
                icon={chatbubblesOutline}
                tone="blue"
                title="Aún no tienes conversaciones"
                hint="Escribe a un amigo desde Amigos o crea un grupo."
              />
            ) : (
              <>
                {groups.map((g) => (
                  <div key={g.id} className="row-card">
                    <div
                      style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0, cursor: 'pointer' }}
                      onClick={() => setActiveGroup(g)}
                    >
                      <div className="avatar" style={{ width: 46, height: 46, flexShrink: 0, background: AVATAR_GRADS[g.name.charCodeAt(0) % AVATAR_GRADS.length], fontSize: 14 }}>
                        {initialsOf(g.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <div style={{ fontWeight: 800, fontSize: 13.5, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {g.name}
                          </div>
                          {g.lastMessage && (
                            <div style={{ fontSize: 10, color: 'var(--mu)', flexShrink: 0 }}>
                              {timeAgo(g.lastMessage.createdAt)}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--mu)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                          {g.lastMessage?.body ?? 'Sin mensajes todavía'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {conversations.map((c) => (
                  <div key={c.peer.id} className="row-card">
                    <div
                      style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0, cursor: 'pointer' }}
                      onClick={() => setActivePeer(c.peer)}
                    >
                      <div className="avatar" style={{ width: 46, height: 46, flexShrink: 0, background: AVATAR_GRADS[c.peer.id.charCodeAt(0) % AVATAR_GRADS.length], fontSize: 14 }}>
                        {initialsOf(c.peer.displayName)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <div style={{ fontWeight: 800, fontSize: 13.5, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.peer.displayName}
                          </div>
                          {c.lastMessage && (
                            <div style={{ fontSize: 10, color: 'var(--mu)', flexShrink: 0 }}>
                              {timeAgo(c.lastMessage.createdAt)}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--mu)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                          {c.lastMessage?.body ?? 'Sin mensajes todavía'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {tab === 'amigos' && (
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
                <EmptyState icon={searchOutline} tone="pur" title="Sin resultados" hint={`No encontramos a nadie para «${q}».`} />
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
                            <IonIcon icon={checkmark} style={{ marginRight: 4, verticalAlign: '-2px' }} /> Amigos
                          </IonButton>
                          <IonButton className="bt bt-outline bt-mini" onClick={() => setActivePeer(p.profile)}><IonIcon icon={chatbubbleEllipsesOutline} /></IonButton>
                        </>
                      ) : p.isFollowing ? (
                        <IonButton fill="outline" className="bt bt-mini" disabled={busy} onClick={() => void handleFollowToggle(p)}>
                          <IonIcon icon={personRemoveOutline} style={{ marginRight: 4, verticalAlign: '-2px' }} /> Siguiendo
                        </IonButton>
                      ) : (
                        <IonButton className="bt bt-pur bt-mini" disabled={busy} onClick={() => void handleFollowToggle(p)}>
                          <IonIcon icon={personAddOutline} style={{ marginRight: 4, verticalAlign: '-2px' }} /> Seguir
                        </IonButton>
                      )}
                    </div>
                  )
                })
              )
            ) : (
              <>
                <div className="com-sech">
                  <span className="com-sech-ico pur"><IonIcon icon={peopleIcon} /></span>
                  Amigos
                  <span className="chip chip-pur" style={{ marginLeft: 'auto' }}>{friends.length}</span>
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
                  <EmptyState
                    icon={peopleOutline}
                    tone="pur"
                    title="Aún no tienes amigos"
                    hint="Sigue a alguien y si te siguen, serán amigos."
                  />
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
                      <IonButton fill="outline" className="bt bt-mini" onClick={() => setUnfollowTarget(f)}>
                        <IonIcon icon={personRemoveOutline} style={{ marginRight: 4, verticalAlign: '-2px' }} /> Dejar de seguir
                      </IonButton>
                      <IonButton className="bt bt-outline bt-mini" onClick={() => setActivePeer(f)}><IonIcon icon={chatbubbleEllipsesOutline} /></IonButton>
                    </div>
                  ))
                )}

<div className="com-sech"><span className="com-sech-ico gold"><IonIcon icon={star} /></span> Recomendados</div>
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
                ) : recommended.length === 0 ? (
                  <EmptyState icon={starOutline} tone="gold" title="No tienes seguidores nuevos por ahora" />
                ) : (
                  recommended.map((f) => {
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
                        {isFollowingBack ? (
                          <>
                            <span style={{ fontSize: 11, color: 'var(--mu)', fontWeight: 700 }}>Te sigue</span>
                            <IonButton fill="outline" className="bt bt-mini" disabled={busy} onClick={() => setUnfollowTarget(f)}>
                              <IonIcon icon={personRemoveOutline} style={{ marginRight: 4, verticalAlign: '-2px' }} /> Siguiendo
                            </IonButton>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: 11, color: 'var(--mu)', fontWeight: 700 }}>Te sigue</span>
                            <IonButton className="bt bt-pur bt-mini" disabled={busy} onClick={() => void handleFollow(f.id, f.displayName)}>
                              <IonIcon icon={personAddOutline} style={{ marginRight: 4, verticalAlign: '-2px' }} /> Seguir de vuelta
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
          </>
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
              <IonButton fill="clear" size="small" onClick={() => { setActivePost(null); setReplyTarget(null); setReplyDraft('') }}><IonIcon icon={close} /></IonButton>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>{activePost.body}</div>

            <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid var(--g1)', paddingTop: 10 }}>
              {activePost.comments.filter((c) => !c.parentCommentId).sort(byNewest).length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: 'var(--mu)', padding: 20 }}><IonIcon icon={chatbubbleEllipsesOutline} style={{ fontSize: 16 }} /> Sin comentarios todavía. ¡Sé el primero!</div>
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
                  <IonButton fill="clear" size="small" style={{ height: 22 }} onClick={() => setReplyTarget(null)}><IonIcon icon={close} /></IonButton>
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
            return await sendMessage(activePeer.id, body)
          }}
        />
      )}

      {me && activeGroup && (
        <ConversationModal
          group={activeGroup}
          friends={friends}
          me={me}
          open={!!activeGroup}
          onClose={() => setActiveGroup(null)}
          onToast={showToast}
          onSend={async (body) => {
            return await sendGroupMessage(activeGroup.id, body)
          }}
          onRemoveMember={async (gid, pid) => {
            return await removeGroupMember(gid, pid)
          }}
          onRenameGroup={async (gid, n) => {
            return await renameGroup(gid, n)
          }}
          onAddMember={async (gid, pid) => {
            return await addGroupMember(gid, pid)
          }}
          onLeaveGroup={async (gid) => {
            return await leaveGroup(gid)
          }}
        />
      )}

      <CreateGroupModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        friends={friends}
        onCreate={async (n, ids) => {
          return await createGroup(n, ids)
        }}
        onToast={showToast}
      />

      <IonAlert
        isOpen={!!unfollowTarget}
        header="Dejar de seguir"
        message={`¿Dejar de seguir a ${unfollowTarget?.displayName}?`}
        buttons={[
          'Cancelar',
          {
            text: 'Dejar de seguir',
            role: 'destructive',
            handler: () => {
              if (unfollowTarget) void handleUnfollow(unfollowTarget.id, unfollowTarget.displayName)
            },
          },
        ]}
        onDidDismiss={() => setUnfollowTarget(null)}
      />
    </Screen>
    )}
    </ErrorBoundary>
  )
}
