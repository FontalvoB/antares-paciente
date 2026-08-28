import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  IonAlert,
  IonButton,
  IonIcon,
  IonSearchbar,
  IonSkeletonText,
} from '@ionic/react'
import {
  arrowBack,
  arrowUp,
  cameraOutline,
  chatbubbleEllipsesOutline,
  createOutline,
  chatbubblesOutline,
  checkmark,
  chevronForward,
  globeOutline,
  people as peopleIcon,
  peopleOutline,
  personAddOutline,
  personRemoveOutline,
  searchOutline,
  shareSocialOutline,
  sparklesOutline,
  starOutline,
} from 'ionicons/icons'
import { Screen, Scroll } from '../components/Screen'
import { useApp } from '../context/AppContext'
import {
  useCommunity,
  useConversationMessageListener,
  useGroupChangedListener,
  useGroupMessageListener,
} from '../hooks/useCommunity'
import { useCoverTint } from '../hooks/useCoverTint'
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
import type { ChatGroup, Person, Post, Profile } from '../graphql/community'
import { ErrorBoundary } from '../components/error-boundary'
import { ConversationModal } from '../components/conversation-modal'
import { PostCard } from '../components/community/PostCard'
import { PostDetailModal } from '../components/community/PostDetailModal'
import { ComposePostModal } from '../components/community/ComposePostModal'
import { MemberProfile } from '../components/community/MemberProfile'
import { CreateGroupModal } from '../components/community/CreateGroupModal'
import { CommunityFab, type FabAction } from '../components/community/CommunityFab'
import { ComSidebar } from '../components/community/ComSidebar'
import { CommunityProfile } from '../components/community/CommunityProfile'
import { NewChatModal } from '../components/community/NewChatModal'
import { MediaLightbox } from '../components/community/MediaLightbox'
import {
  Avatar,
  BannedScreen,
  ComRow,
  EmptyState,
  ErrorCard,
  PostSkeleton,
  RowSkeleton,
  timeAgo,
  initialsOf,
} from '../components/community/community'

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
 *  llega un mensaje o el grupo cambia (alta/baja de miembros, renombrado). */
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

/** Botón "volver" de vistas anidadas (perfil de miembro, listas).
 *  Con `overlay` flota sobre la portada del perfil (estilo glass de marca). */
function BackButton({
  onClick,
  label = 'Volver',
  overlay = false,
}: {
  onClick: () => void
  label?: string
  overlay?: boolean
}) {
  if (overlay) {
    return (
      <div className="mem-back">
        <IonButton fill="clear" className="mem-back-btn" onClick={onClick} aria-label={label}>
          <IonIcon icon={arrowBack} style={{ marginRight: 6 }} /> {label}
        </IonButton>
      </div>
    )
  }
  return (
    <div style={{ padding: 14 }}>
      <IonButton fill="outline" className="bt bt-mini" onClick={onClick}>
        <IonIcon icon={arrowBack} style={{ marginRight: 6 }} /> {label}
      </IonButton>
    </div>
  )
}

/** Tarjeta de amigo/sugerencia: identidad completa (nombre sin recorte) y
 *  acciones en el pie, para que los botones no coman el ancho del nombre. */
function AmigoRow({
  name,
  seedId,
  src,
  sub,
  onClick,
  actions,
}: {
  name: string
  seedId: string
  src?: string | null
  sub?: string
  onClick: () => void
  actions: ReactNode
}) {
  return (
    <div className="com-row amg-row">
      <div className="amg-head" onClick={onClick}>
        <Avatar name={name} seedId={seedId} size={44} src={src} />
        <div className="amg-id">
          <div className="amg-name">{name}</div>
          {sub && <div className="amg-sub">{sub}</div>}
        </div>
      </div>
      <div className="amg-foot">{actions}</div>
    </div>
  )
}

/** Logos oficiales de cada red (trazos SVG, estilo simple-icons). */
const BRAND_ICONS = {
  tiktok:
    'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  instagram:
    'M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z',
  facebook:
    'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.613 23.027 24 18.062 24 12.073z',
  youtube:
    'M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  whatsapp:
    'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.198.297-.768.966-.94 1.164-.173.199-.347.223-.645.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z',
} as const

const REDES: { icon: string; name: string; sub: string; bg: string }[] = [
  { icon: BRAND_ICONS.tiktok, name: 'TikTok ANTARES', sub: '@antaresbiohacking · 48.2K', bg: 'linear-gradient(135deg,#010101,#232028)' },
  { icon: BRAND_ICONS.instagram, name: 'Instagram ANTARES', sub: '@antares.biohacking · 23.7K', bg: 'linear-gradient(135deg,#F58529,#DD2A7B 52%,#8134AF 78%,#515BD4)' },
  { icon: BRAND_ICONS.facebook, name: 'Facebook Community', sub: '15.4K miembros', bg: 'linear-gradient(135deg,#1877F2,#0E5BB2)' },
  { icon: BRAND_ICONS.youtube, name: 'YouTube ANTARES', sub: 'SUMMITs · Clases · 8.1K', bg: 'linear-gradient(135deg,#FF0000,#C4302B)' },
  { icon: BRAND_ICONS.whatsapp, name: 'WhatsApp Miami', sub: 'Grupo COPP-ADRESD · 284', bg: 'linear-gradient(135deg,#25D366,#128C7E)' },
]

/** Renderiza el logotipo de una red con su trazo oficial. */
function BrandIcon({ path, size = 20 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d={path} />
    </svg>
  )
}

export function CommunityPage() {
  const { showToast, pointsTotal } = useApp()
  const {
    me,
    meLoading,
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
    createPollPost,
    votePoll,
    uploadPostImage,
    uploadProfileImage,
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

  const coverTint = useCoverTint(me?.coverUrl)
  const heroCss = useMemo(() => {
    const [cr, cg, cb] = coverTint.rgb
    // Adónde se funde el hero en modo claro: el mismo gris del fondo del feed
    // (#d9dfe8) para que el degradado termine sin costura.
    const LIGHT: [number, number, number] = [217, 223, 232]
    const mixToBg = (t: number): string => {
      const c = [cr, cg, cb].map((v, i) => Math.round(v + (LIGHT[i] - v) * t))
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
    }
    return {
      '--me-cover-end': `rgb(${cr}, ${cg}, ${cb})`,
      '--me-bg': `linear-gradient(180deg, ${mixToBg(0)} 0%, ${mixToBg(0.55)} 52%, ${mixToBg(1)} 100%)`,
      '--me-on': coverTint.dark ? '#ffffff' : '#14213b',
      '--me-on-soft': coverTint.dark ? 'rgba(255, 255, 255, 0.82)' : 'rgba(20, 33, 59, 0.82)',
    } as React.CSSProperties
  }, [coverTint])

  const [tab, setTab] = useState<'feed' | 'perfil' | 'chat' | 'amigos' | 'redes'>('feed')
  const [feedScope, setFeedScope] = useState<'forYou' | 'following'>('forYou')
  const [q, setQ] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [activePeer, setActivePeer] = useState<Profile | null>(null)
  const [activeGroup, setActiveGroup] = useState<ChatGroup | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [unfollowTarget, setUnfollowTarget] = useState<Profile | null>(null)
  const [perfilList, setPerfilList] = useState<'followers' | 'following' | null>(null)
  const [memberList, setMemberList] = useState<'followers' | 'following' | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [chatQ, setChatQ] = useState('')
  const [newChatOpen, setNewChatOpen] = useState(false)
  const [amigosTab, setAmigosTab] = useState<'amigos' | 'sugerencias'>('amigos')
  const storiesRef = useRef<HTMLDivElement | null>(null)
  const storiesDragRef = useRef<{ x: number; left: number; moved: boolean } | null>(null)
  const storiesTapRef = useRef(false)

  // Drag-to-scroll de las burbujas (mouse/pointer); el touch usa el nativo.
  function onStoriesDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'touch' || !storiesRef.current) return
    // Sin setPointerCapture: capturar el puntero en el contenedor redirigiría
    // el click derivado al contenedor y las burbujas dejarían de responder.
    storiesDragRef.current = { x: e.clientX, left: storiesRef.current.scrollLeft, moved: false }
  }
  function onStoriesMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = storiesDragRef.current
    if (!d || !storiesRef.current) return
    const dx = e.clientX - d.x
    if (Math.abs(dx) > 6) d.moved = true
    storiesRef.current.scrollLeft = d.left - dx
  }
  function onStoriesEnd() {
    const d = storiesDragRef.current
    if (!d) return
    if (d.moved) {
      storiesTapRef.current = true
      window.setTimeout(() => {
        storiesTapRef.current = false
      }, 80)
    }
    storiesDragRef.current = null
  }

  // Transición del perfil entre vista principal y listas (despliegue/colapso).
  const [profLeaving, setProfLeaving] = useState(false)
  const profBusyRef = useRef(false)
  const profGo = (to: 'followers' | 'following' | 'main') => {
    if (profBusyRef.current) return
    profBusyRef.current = true
    setProfLeaving(true)
    window.setTimeout(() => {
      setPerfilList(to === 'main' ? null : to)
      setProfLeaving(false)
      profBusyRef.current = false
    }, 180)
  }

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

  const heroRef = useRef<HTMLDivElement | null>(null)
  const [topbarOn, setTopbarOn] = useState(false)
  const topbarOnRef = useRef(false)
  const [fabHidden, setFabHidden] = useState(false)
  const fabHiddenRef = useRef(false)
  fabHiddenRef.current = fabHidden
  const [hambHidden, setHambHidden] = useState(false)
  const hambHiddenRef = useRef(false)
  hambHiddenRef.current = hambHidden
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let raf = 0
    let heroH = 0
    let lastY = el.scrollTop
    let upAcc = 0
    const onScroll = () => {
      const st = el.scrollTop
      const hero = heroRef.current
      // Desvanecido (smoothstep) + translate leve. Solo propiedades compositor
      // (opacity/transform): NO se toca la altura, así el documento nunca cambia
      // de tamaño durante el scroll (el colapso con maxHeight causaba un bucle
      // de ajuste del navegador → no dejaba volver a subir y traba el scroll).
      if (hero && !raf) {
        raf = window.requestAnimationFrame(() => {
          raf = 0
          if (heroH === 0 && hero.offsetHeight) heroH = hero.offsetHeight
          const fadeDist = Math.max(160, Math.round((heroH || 340) * 0.55))
          const t = Math.min(1, Math.max(0, st / fadeDist))
          const fade = 1 - t * t * (3 - 2 * t)
          hero.style.opacity = String(fade)
          hero.style.transform = `translate3d(0, ${(-t * 40).toFixed(2)}px, 0)`
        })
      }
      // Zona muerta <12px (micro-rebotes del dedo) antes de decidir nada.
      const delta = st - lastY
      if (Math.abs(delta) <= 12) return
      lastY = st
      // Topbar con histéresis amplia: encender >160 (hero casi invisible),
      // apagar <40 (casi al tope).
      const on = st > (topbarOnRef.current ? 40 : 160)
      if (on !== topbarOnRef.current) {
        topbarOnRef.current = on
        setTopbarOn(on)
      }
      // Oculta el FAB y el hamburger al bajar; los muestra al subir (o al
      // estar en el tope).
      if (st < 26) {
        upAcc = 0
        if (fabHiddenRef.current) setFabHidden(false)
        if (hambHiddenRef.current) setHambHidden(false)
      } else if (delta > 0) {
        upAcc = 0
        if (!fabHiddenRef.current) setFabHidden(true)
        if (!hambHiddenRef.current) setHambHidden(true)
      } else {
        upAcc += -delta
        if (upAcc >= 40) {
          upAcc = 0
          if (fabHiddenRef.current) setFabHidden(false)
          if (hambHiddenRef.current) setHambHidden(false)
        }
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (raf) window.cancelAnimationFrame(raf)
    }
    // El Scroll (y su ref) solo existe después de resolver la carga inicial.
  }, [scrollRef, meLoading, me])

  const [postAddedResult] = useSubscription<PostAddedResult>({
    query: POST_ADDED,
    pause: !(tab === 'feed' && !viewingId) || me?.status === 'BANNED',
  })

  useEffect(() => {
    const post = postAddedResult.data?.postAdded
    if (!post || !post.profile) return
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
  const [lightbox, setLightbox] = useState<{ url: string; mediaType: 'IMAGE' | 'VIDEO' | null } | null>(null)
  const openImage = (url: string, mediaType: 'IMAGE' | 'VIDEO' | null) => setLightbox({ url, mediaType })


  async function handleToggleLike(post: Post) {
    await toggleLike(post)
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

  const chatQuery = chatQ.trim().toLowerCase()
  const filteredConversations = conversations.filter(
    (c) => !chatQuery || c.peer.displayName.toLowerCase().includes(chatQuery),
  )
  const filteredGroups = groups.filter(
    (g) => !chatQuery || g.name.toLowerCase().includes(chatQuery),
  )

  const handleTab = (id: 'feed' | 'perfil' | 'chat' | 'amigos' | 'redes') => {
    setTab(id)
    setViewingId(null)
    setMemberList(null)
  }

  /** Abre el perfil de un miembro; si es el mío, redirige a mi perfil (tab Perfil). */
  const openProfile = (profileId: string) => {
    if (profileId === me?.id) {
      handleTab('perfil')
      return
    }
    setViewingId(profileId)
  }

  const [comDark, setComDark] = useState(false)
  const [themeAnim, setThemeAnim] = useState(false)

  const handleFab = (a: FabAction) => {
    if (a === 'publish') {
      setComposeOpen(true)
      return
    }
    if (a === 'darkmode') {
      setComDark((d) => !d)
      setThemeAnim(true)
      window.setTimeout(() => setThemeAnim(false), 520)
      return
    }
    handleTab(a)
    window.setTimeout(() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 60)
  }

  return (
    <ErrorBoundary>
      {meLoading && !me ? (
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
          }}
        >
          <IonSkeletonText style={{ width: 180, height: 18 }} animated />
        </div>
      ) : me && me.status === 'BANNED' ? (
        <BannedScreen reason={me.banReason} />
      ) : (
        <Screen hideNav className={comDark ? 'com-dark' : undefined}>
          <Scroll
            ref={scrollRef}
            noNav
            className={`com-scroll${themeAnim ? ' com-theme-anim' : ''}`}
          >
            {viewingId ? (
              memberList ? (
                <>
                  <BackButton onClick={() => setMemberList(null)} />
                  <div style={{ padding: '0 14px 6px', fontWeight: 800, fontSize: 14 }}>
                    {memberList === 'followers' ? 'Seguidores' : 'Siguiendo'}
                  </div>
                  {memberListFetching ? (
                    <RowSkeleton rows={3} />
                  ) : memberListError ? (
                    <ErrorCard message="No se pudo cargar la lista." onRetry={retryMemberList} />
                  ) : memberListItems.length === 0 ? (
                    <EmptyState
                      icon={memberList === 'followers' ? peopleOutline : personAddOutline}
                      tone={memberList === 'followers' ? 'teal' : 'blue'}
                      title={memberList === 'followers' ? 'Aún no tiene seguidores' : 'No sigue a nadie todavía'}
                    />
                  ) : (
                    memberListItems.map((row) => (
                      <ComRow
                        key={row.id}
                        name={row.displayName}
                        seedId={row.id}
                        src={row.avatarUrl}
                        sub={row.bio?.trim() || 'Sin bio'}
                        onClick={() => {
                          openProfile(row.id)
                          setMemberList(null)
                        }}
                      >
                        <span className="com-row-lbl">
                          {memberList === 'followers' ? 'Te sigue' : 'Siguiendo'}
                        </span>
                      </ComRow>
                    ))
                  )}
                </>
              ) : (
                <div className="mem-wrap">
                  {profileResult.fetching ? (
                    <>
                      <BackButton onClick={() => setViewingId(null)} />
                      <div className="com-skel" style={{ margin: 14 }}>
                        <IonSkeletonText style={{ width: 64, height: 64, borderRadius: 32, margin: '0 auto' }} animated />
                        <IonSkeletonText style={{ width: '50%', height: 16, margin: '10px auto 0' }} animated />
                        <IonSkeletonText style={{ width: '80%', height: 12, margin: '10px auto 0' }} animated />
                      </div>
                    </>
                  ) : profileResult.error ? (
                    <>
                      <BackButton onClick={() => setViewingId(null)} />
                      <ErrorCard
                        message="No se pudo cargar el perfil."
                        onRetry={() => reexecuteProfile({ requestPolicy: 'network-only' })}
                      />
                    </>
                  ) : !profile ? (
                    <>
                      <BackButton onClick={() => setViewingId(null)} />
                      <EmptyState icon={searchOutline} tone="pur" title="No se encontró el perfil" />
                    </>
                  ) : (
                    <>
                      <MemberProfile
                        profile={profile}
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
                      />
                      <BackButton overlay onClick={() => setViewingId(null)} />
                    </>
                  )}
                </div>
              )
            ) : (
              <>
                {tab === 'feed' && (
                  <>
                    <div
                      className="com-me-hero"
                      ref={heroRef}
                      style={heroCss}
                    >
                      <div
                        className="compf-cover com-me-cover"
                        style={
                          me?.coverUrl
                            ? {
                                backgroundImage: `url(${me.coverUrl})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                              }
                            : undefined
                        }
                      >
                        <span className="compf-cover-kicker">
                          <IonIcon icon={cameraOutline} style={{ fontSize: 14 }} /> Mi espacio
                        </span>
                      </div>
                      <div className="com-me-avatar-slot">
                        <Avatar
                          name={me?.displayName ?? 'AT'}
                          seedId={me?.id ?? 'me'}
                          size={86}
                          src={me?.avatarUrl}
                          style={{
                            boxShadow: '0 0 0 4px var(--wh), 0 12px 26px rgba(124,58,237,0.18)',
                          }}
                        />
                      </div>
                      {me ? (
                        <div className="com-me-name">{me.displayName}</div>
                      ) : meLoading ? (
                        <IonSkeletonText
                          style={{ width: 150, height: 18, margin: '0 auto' }}
                          animated
                        />
                      ) : (
                        <div className="com-me-name">Bienvenido</div>
                      )}
                      <div className="com-me-kicker">COPP-ADRESD + INFINITO</div>
                      <p className="com-me-bio">
                        {me?.bio?.trim() ? me.bio : 'Comparte lo que haces con la comunidad.'}
                      </p>
                      <div className="com-me-scope-row">
                        <div className="com-scope">
                          <button
                            type="button"
                            className={`com-scope-btn ${feedScope === 'forYou' ? 'on' : ''}`}
                            onClick={() => setFeedScope('forYou')}
                            aria-pressed={feedScope === 'forYou'}
                          >
                            <IonIcon icon={sparklesOutline} /> Para ti
                          </button>
                          <button
                            type="button"
                            className={`com-scope-btn ${feedScope === 'following' ? 'on' : ''}`}
                            onClick={() => setFeedScope('following')}
                            aria-pressed={feedScope === 'following'}
                          >
                            <IonIcon icon={peopleOutline} /> Siguiendo
                          </button>
                        </div>
                      </div>
                    </div>

                    {newPostsCount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '0 14px 10px' }}>
                        <IonButton
                          shape="round"
                          size="small"
                          className="com-newpost"
                          style={{ display: 'flex', alignItems: 'center', gap: 5 }}
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
                        <ErrorCard
                          message="No se pudo cargar la comunidad. Verifica tu sesión e inténtalo de nuevo."
                          onRetry={retryFeed}
                        />
                      ) : feedLoading && feed.length === 0 ? (
                        <>
                          <PostSkeleton />
                          <PostSkeleton />
                          <PostSkeleton />
                        </>
                      ) : feed.length === 0 ? (
                        <EmptyState
                          icon={sparklesOutline}
                          tone="pur"
                          title="La comunidad está en silencio por ahora"
                          hint="Sé la primera persona en compartir algo con ANTARES."
                        />
                      ) : (
                        feed.map((view, i) => (
                          <PostCard
                            key={view.post.id}
                            index={i}
                            view={view}
                            onOpen={setActivePost}
                            onOpenImage={openImage}
                            onToggleLike={handleToggleLike}
                            onVotePoll={votePoll}
                            myId={me?.id ?? null}
                            onToast={showToast}
                          />
                        ))
                      )
                    ) : followingFeedError ? (
                      <ErrorCard
                        message="No se pudo cargar el feed de seguidos. Verifica tu sesión e inténtalo de nuevo."
                        onRetry={retryFollowingFeed}
                      />
                    ) : followingFeedLoading && followingFeed.length === 0 ? (
                      <>
                        <PostSkeleton />
                        <PostSkeleton />
                        <PostSkeleton />
                      </>
                    ) : followingFeed.length === 0 ? (
                      <EmptyState
                        icon={peopleOutline}
                        tone="teal"
                        title="Aún no sigues a nadie"
                        hint="Descubre miembros en Amigos y sigue a quien te interese."
                      >
                        <IonButton className="bt bt-pur bt-mini" onClick={() => setTab('amigos')}>
                          Ir a Amigos
                        </IonButton>
                      </EmptyState>
                    ) : (
                      followingFeed.map((view, i) => (
                        <PostCard
                          key={view.post.id}
                          index={i}
                          view={view}
                          onOpen={setActivePost}
                          onOpenImage={openImage}
                          onToggleLike={handleToggleLike}
                          onVotePoll={votePoll}
                          myId={me?.id ?? null}
                          onToast={showToast}
                        />
                      ))
                    )}
                  </>
                )}

                {tab === 'perfil' && (
                  <div
                    key={perfilList ?? 'main'}
                    className={`prof-view ${profLeaving ? 'out' : ''}`}
                  >
                  {perfilList ? (
                    <>
                      <BackButton onClick={() => profGo('main')} />
                      <div style={{ padding: '0 14px 6px', fontWeight: 800, fontSize: 14 }}>
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
                          <ComRow
                            key={f.id}
                            name={f.displayName}
                            seedId={f.id}
                            src={f.avatarUrl}
                            sub={f.bio?.trim() || 'Sin bio'}
                            onClick={() => openProfile(f.id)}
                          >
                            <span className="com-row-lbl">
                              {perfilList === 'followers' ? 'Te sigue' : 'Siguiendo'}
                            </span>
                          </ComRow>
                        ))
                      )}
                    </>
                  ) : (
                    <CommunityProfile
                      me={me}
                      meLoading={meLoading}
                      pointsTotal={pointsTotal}
                      followersCount={followers.length}
                      followingCount={peopleFollowing.length}
                      posts={me?.posts ?? []}
                      onSaveProfile={async (name, bio, avatarKey, coverKey) => {
                        await updateProfile(name, bio, avatarKey, coverKey)
                      }}
                      onCompose={() => setComposeOpen(true)}
                      onShowList={profGo}
                      onOpenPost={setActivePost}
                      onUploadProfileImage={async (kind, file) => {
                        const info = await uploadProfileImage(kind, file)
                        return { key: info.key, readUrl: info.readUrl }
                      }}
                      onToast={showToast}
                    />
                  )}
                  </div>
                )}

                {tab === 'chat' && (
                  <>
                    {!activePeer &&
                      conversations.map((c) => (
                        <ConversationMessageListener
                          key={c.peer.id}
                          meId={me?.id ?? null}
                          peerId={c.peer.id}
                          onMessage={refetchConversations}
                        />
                      ))}
                    {!activeGroup && (
                      <GroupChatListeners groups={groups} onMessage={refetchGroups} onChanged={refetchGroups} />
                    )}

                    <div className="chat-hero anim-in">
                      <div className="chat-hero-main">
                        <div className="chat-title">
                          <IonIcon icon={globeOutline} className="chat-globe" /> Chat ANTARES
                        </div>
                        <div className="chat-sub">
                          <IonIcon icon={peopleOutline} /> Tus amigos y grupos
                        </div>
                      </div>
                      <div className="chat-hero-actions">
                        <IonButton className="chat-icon-btn" onClick={() => setCreateOpen(true)} aria-label="Nuevo grupo">
                          <IonIcon icon={personAddOutline} />
                        </IonButton>
                        <IonButton className="chat-icon-btn" onClick={() => setNewChatOpen(true)} aria-label="Nuevo chat">
                          <IonIcon icon={createOutline} />
                        </IonButton>
                      </div>
                    </div>

                    <div className="chat-search anim-in" style={{ animationDelay: '40ms' }}>
                      <IonSearchbar
                        className="sbar chat-sbar"
                        value={chatQ}
                        placeholder="Buscar o preguntar…"
                        onIonInput={(e) => setChatQ(e.detail.value ?? '')}
                      />
                    </div>

                    {/* Accesos rápidos: burbujas de amigos y grupos */}
                    {(conversations.length > 0 || groups.length > 0) && (
                      <div
                        className="chat-stories anim-in"
                        style={{ animationDelay: '80ms' }}
                        ref={storiesRef}
                        onPointerDown={onStoriesDown}
                        onPointerMove={onStoriesMove}
                        onPointerUp={onStoriesEnd}
                        onPointerCancel={onStoriesEnd}
                      >
                        {groups.slice(0, 4).map((g, i) => (
                          <button
                            key={g.id}
                            type="button"
                            className={`chat-story ${i === 0 ? 'lead' : ''}`}
                            style={{ animationDelay: `${(7 + i) * 45}ms` }}
                            onClick={() => {
                              if (storiesTapRef.current) return
                              setActiveGroup(g)
                            }}
                          >
                            <span className="chat-story-av group">
                              <span>{initialsOf(g.name)}</span>
                            </span>
                            <span className="chat-story-name">{g.name}</span>
                          </button>
                        ))}
                        {conversations.slice(0, groups.length > 0 ? 3 : 4).map((c, i) => (
                          <button
                            key={c.peer.id}
                            type="button"
                            className={`chat-story ${groups.length === 0 && i === 0 ? 'lead' : ''}`}
                            style={{ animationDelay: `${(7 + groups.slice(0, 4).length + i) * 45}ms` }}
                            onClick={() => {
                              if (storiesTapRef.current) return
                              setActivePeer(c.peer)
                            }}
                          >
                            <span className="chat-story-av">
                              {c.peer.avatarUrl ? (
                                <img src={c.peer.avatarUrl} alt={c.peer.displayName} />
                              ) : (
                                initialsOf(c.peer.displayName)
                              )}
                            </span>
                            <span className="chat-story-name">{c.peer.displayName}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="chat-list-head anim-in" style={{ animationDelay: '120ms' }}>
                      <span>Mensajes</span>
                      <span className="chat-list-count">
                        {conversations.length + groups.length}
                      </span>
                    </div>

                    {conversationsLoading || groupsLoading ? (
                      <RowSkeleton rows={3} />
                    ) : conversationsError || groupsError ? (
                      <ErrorCard
                        message="No se pudo cargar tus conversaciones."
                        onRetry={() => {
                          refetchConversations()
                          refetchGroups()
                        }}
                      />
                    ) : conversations.length === 0 && groups.length === 0 ? (
                      <EmptyState
                        icon={chatbubblesOutline}
                        tone="blue"
                        title="Aún no tienes conversaciones"
                        hint="Escribe a un amigo desde Amigos o crea un grupo."
                      />
                    ) : (
                      <>
                        {filteredGroups.map((g, i) => (
                          <button
                            key={g.id}
                            type="button"
                            className="chat-msg"
                            style={{ animationDelay: `${i * 40}ms` }}
                            onClick={() => setActiveGroup(g)}
                          >
                            <span className="chat-msg-av group">
                              {initialsOf(g.name)}
                            </span>
                            <span className="chat-msg-main">
                              <span className="chat-msg-top">
                                <span className="chat-msg-name">{g.name}</span>
                                {g.lastMessage && (
                                  <span className="chat-msg-time">{timeAgo(g.lastMessage.createdAt)}</span>
                                )}
                              </span>
                              <span className="chat-msg-sub">
                                {g.lastMessage?.body ?? 'Sin mensajes todavía'}
                              </span>
                            </span>
                          </button>
                        ))}
                        {filteredConversations.map((c, i) => (
                          <button
                            key={c.peer.id}
                            type="button"
                            className="chat-msg"
                            style={{ animationDelay: `${(filteredGroups.length + i) * 40}ms` }}
                            onClick={() => setActivePeer(c.peer)}
                          >
                            <span
                              className="chat-msg-av"
                              onClick={(e) => {
                                e.stopPropagation()
                                openProfile(c.peer.id)
                              }}
                            >
                              {c.peer.avatarUrl ? (
                                <img src={c.peer.avatarUrl} alt={c.peer.displayName} />
                              ) : (
                                initialsOf(c.peer.displayName)
                              )}
                            </span>
                            <span className="chat-msg-main">
                              <span className="chat-msg-top">
                                <span className="chat-msg-name">{c.peer.displayName}</span>
                                {c.lastMessage && (
                                  <span className="chat-msg-time">{timeAgo(c.lastMessage.createdAt)}</span>
                                )}
                              </span>
                              <span className="chat-msg-sub">
                                {c.lastMessage?.body ?? 'Sin mensajes todavía'}
                              </span>
                            </span>
                          </button>
                        ))}
                        {filteredConversations.length === 0 && filteredGroups.length === 0 && (
                          <EmptyState
                            icon={searchOutline}
                            tone="pur"
                            title="Sin resultados"
                            hint={`No hay conversaciones para «${chatQ}».`}
                          />
                        )}
                      </>
                    )}
                  </>
                )}

                {tab === 'amigos' && (
                  <>
                    <div className="com-banner anim-in">
                      <div className="com-banner-main">
                        <div className="com-banner-title">
                          <IonIcon icon={peopleOutline} /> Amigos ANTARES
                        </div>
                        <div className="com-banner-sub">
                          <IonIcon icon={sparklesOutline} /> Encuentra, conecta y sigue
                        </div>
                      </div>
                    </div>
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

                    <div className="amg-tabs anim-in">
                      <div className="com-scope">
                        <button
                          type="button"
                          className={`com-scope-btn ${amigosTab === 'amigos' ? 'on' : ''}`}
                          onClick={() => setAmigosTab('amigos')}
                          aria-pressed={amigosTab === 'amigos'}
                        >
                          <IonIcon icon={peopleIcon} /> Amigos
                          <span className="amg-count">{friends.length}</span>
                        </button>
                        <button
                          type="button"
                          className={`com-scope-btn ${amigosTab === 'sugerencias' ? 'on' : ''}`}
                          onClick={() => setAmigosTab('sugerencias')}
                          aria-pressed={amigosTab === 'sugerencias'}
                        >
                          <IonIcon icon={starOutline} /> Sugerencias
                          <span className="amg-count">{recommended.length}</span>
                        </button>
                      </div>
                    </div>

                    {q.trim() !== '' ? (
                      peopleLoading ? (
                        <RowSkeleton rows={4} />
                      ) : peopleError ? (
                        <ErrorCard message="No se pudo buscar. Inténtalo de nuevo." onRetry={() => setPeopleQuery(q)} />
                      ) : people.length === 0 ? (
                        <EmptyState
                          icon={searchOutline}
                          tone="pur"
                          title="Sin resultados"
                          hint={`No encontramos a nadie para «${q}».`}
                        />
                      ) : (
                        people.map((p) => {
                          const busy = busyId === p.profile.id
                          return (
                            <AmigoRow
                              key={p.profile.id}
                              name={p.profile.displayName}
                              seedId={p.profile.id}
                              src={p.profile.avatarUrl}
                              sub={p.profile.bio?.trim() || 'Sin bio'}
                              onClick={() => openProfile(p.profile.id)}
                              actions={
                                p.isFriend ? (
                                  <>
                                    <IonButton
                                      fill="outline"
                                      className="bt bt-mini"
                                      disabled={busy}
                                      onClick={() => showToast('Ya son amigos', 'info')}
                                    >
                                      <IonIcon icon={checkmark} style={{ marginRight: 4 }} /> Amigos
                                    </IonButton>
                                    <IonButton
                                      className="bt bt-outline bt-mini"
                                      onClick={() => setActivePeer(p.profile)}
                                      aria-label={`Escribir a ${p.profile.displayName}`}
                                    >
                                      <IonIcon icon={chatbubbleEllipsesOutline} />
                                    </IonButton>
                                  </>
                                ) : p.isFollowing ? (
                                  <IonButton
                                    fill="outline"
                                    className="bt bt-mini"
                                    disabled={busy}
                                    onClick={() => void handleFollowToggle(p)}
                                  >
                                    <IonIcon icon={personRemoveOutline} style={{ marginRight: 4 }} /> Siguiendo
                                  </IonButton>
                                ) : (
                                  <IonButton
                                    className="bt bt-pur bt-mini"
                                    disabled={busy}
                                    onClick={() => void handleFollowToggle(p)}
                                  >
                                    <IonIcon icon={personAddOutline} style={{ marginRight: 4 }} /> Seguir
                                  </IonButton>
                                )
                              }
                            />
                          )
                        })
                      )
                    ) : amigosTab === 'amigos' ? (
                      friendsError ? (
                        <ErrorCard message="No se pudo cargar tus amigos." onRetry={retryFriends} />
                      ) : friendsLoading ? (
                        <RowSkeleton rows={3} />
                      ) : friends.length === 0 ? (
                        <EmptyState
                          icon={peopleOutline}
                          tone="pur"
                          title="Aún no tienes amigos"
                          hint="Sigue a alguien y si te siguen, serán amigos."
                        />
                      ) : (
                        friends.map((f) => (
                          <AmigoRow
                            key={f.id}
                            name={f.displayName}
                            seedId={f.id}
                            src={f.avatarUrl}
                            sub={f.bio?.trim() || 'Sin bio'}
                            onClick={() => openProfile(f.id)}
                            actions={
                              <>
                                <IonButton
                                  fill="outline"
                                  className="bt bt-mini"
                                  onClick={() => setUnfollowTarget(f)}
                                >
                                  <IonIcon icon={personRemoveOutline} style={{ marginRight: 4 }} /> Dejar de seguir
                                </IonButton>
                                <IonButton
                                  className="bt bt-outline bt-mini"
                                  onClick={() => setActivePeer(f)}
                                  aria-label={`Escribir a ${f.displayName}`}
                                >
                                  <IonIcon icon={chatbubbleEllipsesOutline} />
                                </IonButton>
                              </>
                            }
                          />
                        ))
                      )
                    ) : followersError ? (
                      <ErrorCard message="No se pudo cargar tus seguidores." onRetry={retryFollowers} />
                    ) : followersLoading ? (
                      <RowSkeleton rows={3} />
                    ) : recommended.length === 0 ? (
                      <EmptyState
                        icon={starOutline}
                        tone="gold"
                        title="No tienes seguidores nuevos por ahora"
                        hint="Cuando nuevos miembros te sigan, aparecerán aquí para conectar."
                      />
                    ) : (
                      recommended.map((f) => {
                        const isFollowingBack = followedIds.has(f.id)
                        const busy = busyId === f.id
                        return (
                          <AmigoRow
                            key={f.id}
                            name={f.displayName}
                            seedId={f.id}
                            src={f.avatarUrl}
                            sub={f.bio?.trim() || 'Sin bio'}
                            onClick={() => openProfile(f.id)}
                            actions={
                              <>
                                <span className="com-row-lbl">Te sigue</span>
                                {isFollowingBack ? (
                                  <IonButton
                                    fill="outline"
                                    className="bt bt-mini"
                                    disabled={busy}
                                    onClick={() => setUnfollowTarget(f)}
                                  >
                                    <IonIcon icon={personRemoveOutline} style={{ marginRight: 4 }} /> Siguiendo
                                  </IonButton>
                                ) : (
                                  <IonButton
                                    className="bt bt-pur bt-mini"
                                    disabled={busy}
                                    onClick={() => void handleFollow(f.id, f.displayName)}
                                  >
                                    <IonIcon icon={personAddOutline} style={{ marginRight: 4 }} /> Seguir de vuelta
                                  </IonButton>
                                )}
                              </>
                            }
                          />
                        )
                      })
                    )}
                  </>
                )}

                {tab === 'redes' && (
                  <>
                    <div className="com-banner anim-in">
                      <div className="com-banner-main">
                        <div className="com-banner-title">
                          <IonIcon icon={shareSocialOutline} /> Redes ANTARES
                        </div>
                        <div className="com-banner-sub">
                          <IonIcon icon={globeOutline} /> Nuestros canales y comunidades
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: 14 }}>
                      {REDES.map((r, i) => (
                        <button
                          key={r.name}
                          type="button"
                          className="com-net"
                          style={{ background: r.bg, animationDelay: `${(i + 1) * 45}ms` }}
                          onClick={() => showToast(`Abriendo ${r.name}…`, 'info')}
                        >
                          <div className="com-net-ico">
                            <BrandIcon path={r.icon} />
                          </div>
                          <div className="com-net-main">
                            <div className="com-net-name">{r.name}</div>
                            <div className="com-net-sub">{r.sub}</div>
                          </div>
                          <IonIcon icon={chevronForward} className="com-net-arrow" />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
            {/* Espacio transparente al final del feed para el FAB */}
            <div style={{ height: 88 }} aria-hidden />
          </Scroll>

          <div className={`com-topbar ${topbarOn ? 'on' : ''}`} aria-hidden>
            <div className="com-topbar-title">
              <IonIcon icon={globeOutline} style={{ fontSize: 16 }} />
              Comunidad ANTARES
            </div>
          </div>

          <PostDetailModal
            post={activePost}
            me={me}
            onClose={() => setActivePost(null)}
            onAddComment={async (postId, body) => {
              return await addComment(postId, body)
            }}
            onReply={async (commentId, body) => {
              return await replyToComment(commentId, body)
            }}
            onOpenImage={openImage}
            onToast={showToast}
            onVotePoll={votePoll}
          />

          {me && (
            <ConversationModal
              peer={activePeer ?? undefined}
              me={me}
              open={!!activePeer}
              onClose={() => setActivePeer(null)}
              onToast={showToast}
              onSend={async (body) => {
                return await sendMessage(activePeer?.id ?? '', body)
              }}
            />
          )}

          {me && (
            <ConversationModal
              group={activeGroup ?? undefined}
              friends={friends}
              me={me}
              open={!!activeGroup}
              onClose={() => setActiveGroup(null)}
              onToast={showToast}
              onSend={async (body) => {
                return await sendGroupMessage(activeGroup?.id ?? '', body)
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

          <NewChatModal
            open={newChatOpen}
            onClose={() => setNewChatOpen(false)}
            friends={friends}
            onPick={(friend) => {
              setNewChatOpen(false)
              setActivePeer(friend)
            }}
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

          <CommunityFab scrollRef={scrollRef} hidden={fabHidden} onPick={handleFab} dark={comDark} />

          <MediaLightbox
            url={lightbox?.url ?? null}
            mediaType={lightbox?.mediaType ?? null}
            onClose={() => setLightbox(null)}
          />

          <ComSidebar me={me} hidden={hambHidden} />

          <ComposePostModal
            open={composeOpen}
            onClose={() => setComposeOpen(false)}
            me={me}
            onPublish={async (text, mediaKey) => {
              await createPost(text, mediaKey ?? undefined)
            }}
            onPublishPoll={async (question, options) => {
              await createPollPost(question, options)
            }}
            onUploadMedia={async (file, contentType) => {
              return await uploadPostImage(file, contentType)
            }}
            onToast={showToast}
          />
        </Screen>
      )}
    </ErrorBoundary>
  )
}
