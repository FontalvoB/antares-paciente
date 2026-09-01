import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useClient, useMutation, useQuery, useSubscription } from 'urql'
import { ensureFreshAccessToken } from '../utils/authApi'
import {
  ADD_COMMENT,
  ADD_GROUP_MEMBER,
  CONVERSATIONS_QUERY,
  CREATE_GROUP,
  CREATE_POLL_POST,
  CREATE_POST,
  FOLLOWERS_QUERY,
  FOLLOWING_FEED_QUERY,
  FOLLOWING_QUERY,
  FOLLOW_USER,
  FEED_QUERY,
  FRIENDS_QUERY,
  GROUP_CHANGED,
  GROUP_MESSAGE_ADDED,
  GROUPS_QUERY,
  LEAVE_GROUP,
  LIKE_POST,
  LIKE_COMMENT,
  ME_QUERY,
  MESSAGE_ADDED,
  PEOPLE_SEARCH,
  POST_IMAGE_UPLOAD_INFO,
  POST_REPOSTS,
  PROFILE_IMAGE_UPLOAD_INFO,
  REMOVE_GROUP_MEMBER,
  RENAME_GROUP,
  REPLY_TO_COMMENT,
  REPOST_POST,
  REPORT_POST,
  REPORT_COMMENT,
  SEND_GROUP_MESSAGE,
  SEND_MESSAGE,
  UNFOLLOW_USER,
  UNLIKE_POST,
  UNLIKE_COMMENT,
  UNREPOST_POST,
  UPDATE_PROFILE,
  VOTE_POLL,
  conversationKey,
  type AddCommentResult,
  type AddGroupMemberResult,
  type ChatGroup,
  type Conversation,
  type ConversationsResult,
  type CreateGroupResult,
  type CreatePollPostResult,
  type CreatePostResult,
  type FeedResult,
  type FollowersResult,
  type FollowingFeedResult,
  type FollowingResult,
  type FollowUserResult,
  type FriendsResult,
  type GroupChangedResult,
  type GroupMessageAddedResult,
  type GroupResult,
  type LeaveGroupResult,
  type LikeCommentResult,
  type LikePostResult,
  type MeResult,
  type MessageAddedResult,
  type PeopleResult,
  type Person,
  type Post,
  type PostImageUploadInfoResult,
  type PostRepostsResult,
  type Profile,
  type ProfileImageUploadInfoResult,
  type RemoveGroupMemberResult,
  type RenameGroupResult,
  type ReplyResult,
  type RepostPostResult,
  type ReportCommentResult,
  type ReportPostResult,
  type SendGroupMessageResult,
  type SendMessageResult,
  type UnfollowUserResult,
  type UnlikeCommentResult,
  type UnrepostPostResult,
  type UpdateProfileResult,
  type VotePollResult,
} from '../graphql/community'

const PAGE_SIZE = 20
const LIST_SIZE = 50

/** Estado del feed (derivado): likes, reposts y si el perfil actual ya interactuó. */
export interface FeedPostView {
  post: Post
  likeCount: number
  likedByMe: boolean
  repostCount: number
  repostedByMe: boolean
}

/** Post del perfil que puede ser original o repost, con metadata de repost. */
export interface TimelinePost extends Post {
  isRepost: boolean
  repostedAt?: string
}

/**
 * Suscribe un conversationKey concreto y ejecuta `onMessage` cada vez que
 * llega un mensaje. El backend exige que seas participante de la conversación,
 * por eso se suscribe por clave real (no por un comodín). Se usa en el tab de
 * chat para refrescar la lista de conversaciones en vivo.
 */
export function useConversationMessageListener(
  meId: string | null,
  peerId: string | null,
  onMessage: () => void,
) {
  const key = meId && peerId ? conversationKey(meId, peerId) : null
  const [sub] = useSubscription<MessageAddedResult>({
    query: MESSAGE_ADDED,
    variables: { conversationKey: key ?? '' },
    pause: !key,
  })

  // Referencia estable para no re-disparar el efecto en cada render.
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    if (sub.data?.messageAdded) onMessageRef.current()
  }, [sub.data])
}

/**
 * Suscribe un grupo concreto y ejecuta `onMessage` cada vez que llega un
 * mensaje nuevo al grupo. El hook es genérico: solo dispara el callback; el
 * page decide qué refetch (pausado cuando no hay groupId).
 */
export function useGroupMessageListener(
  groupId: string | null,
  onMessage: () => void,
) {
  const [sub] = useSubscription<GroupMessageAddedResult>({
    query: GROUP_MESSAGE_ADDED,
    variables: { groupId: groupId ?? '' },
    pause: !groupId,
  })

  // Referencia estable para no re-disparar el efecto en cada render.
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    if (sub.data?.groupMessageAdded) onMessageRef.current()
  }, [sub.data])
}

/**
 * Suscribe un grupo concreto y ejecuta `onChanged` cada vez que el grupo
 * cambia (alta/baja de miembros, renombrado, etc.). Hook genérico: solo
 * dispara el callback; el page decide qué refetch (pausado si no hay groupId).
 */
export function useGroupChangedListener(
  groupId: string | null,
  onChanged: () => void,
) {
  const [sub] = useSubscription<GroupChangedResult>({
    query: GROUP_CHANGED,
    variables: { groupId: groupId ?? '' },
    pause: !groupId,
  })

  // Referencia estable para no re-disparar el efecto en cada render.
  const onChangedRef = useRef(onChanged)
  onChangedRef.current = onChanged

  useEffect(() => {
    if (sub.data?.groupChanged) onChangedRef.current()
  }, [sub.data])
}

/**
 * Datos de la comunidad: perfil `me` (auto-aprovisionado por el backend en el
 * primer acceso), feed paginado, follows (amigos/seguidos/seguidores), búsqueda
 * de personas, mensajería y creación de publicaciones/likes.
 */
export function useCommunity() {
  const [meResult, reexecuteMe] = useQuery<MeResult>({ query: ME_QUERY })
  const [feedResult, reexecuteFeed] = useQuery<FeedResult>({
    query: FEED_QUERY,
    variables: { take: PAGE_SIZE, skip: 0 },
  })
  const [followingFeedResult, reexecuteFollowingFeed] = useQuery<FollowingFeedResult>({
    query: FOLLOWING_FEED_QUERY,
    variables: { take: PAGE_SIZE, skip: 0 },
  })
  const [friendsResult, reexecuteFriends] = useQuery<FriendsResult>({
    query: FRIENDS_QUERY,
    variables: { take: LIST_SIZE, skip: 0 },
  })
  const [followingResult, reexecuteFollowing] = useQuery<FollowingResult>({
    query: FOLLOWING_QUERY,
    variables: { take: LIST_SIZE, skip: 0 },
  })
  const [followersResult, reexecuteFollowers] = useQuery<FollowersResult>({
    query: FOLLOWERS_QUERY,
    variables: { take: LIST_SIZE, skip: 0 },
  })
  const [peopleQuery, setPeopleQuery] = useState('')
  const [peopleResult, reexecutePeople] = useQuery<PeopleResult>({
    query: PEOPLE_SEARCH,
    variables: { search: peopleQuery.trim() || null, take: 30, skip: 0 },
    pause: peopleQuery.trim().length === 0,
  })
  const [conversationsResult, reexecuteConversations] = useQuery<ConversationsResult>({
    query: CONVERSATIONS_QUERY,
    variables: { take: LIST_SIZE, skip: 0 },
  })
  const [groupsResult, reexecuteGroups] = useQuery<GroupResult>({
    query: GROUPS_QUERY,
    variables: { take: LIST_SIZE, skip: 0 },
  })

  const client = useClient()

  const me: Profile | null = meResult.data?.me ?? null
  const myProfileId = me?.id ?? null

  /** Timeline del perfil actual: publicaciones propias + reposts, ordenadas
   *  cronológicamente y deduplicadas (si un post es propio y reposteado,
   *  se conserva la versión original). */
  const meTimelinePosts = useMemo<TimelinePost[]>(() => {
    const own: TimelinePost[] = (me?.posts ?? []).map((p) => ({ ...p, isRepost: false }))
    const reposted: TimelinePost[] = (me?.reposts ?? []).map((r) => ({
      ...r.post,
      isRepost: true,
      repostedAt: r.createdAt,
    }))
    const merged = [...own, ...reposted]
    // Deduplicar: si un post aparece como propio y reposteado, conservar la
    // versión own (isRepost: false) ya que fue creado por el usuario.
    const seen = new Set<string>()
    const deduped: TimelinePost[] = []
    // Primero ordenar por fecha descendente para que la dedup priorice el más
    // reciente, luego filtrar duplicados.
    merged.sort(
      (a, b) =>
        new Date(b.repostedAt ?? b.createdAt).getTime() -
        new Date(a.repostedAt ?? a.createdAt).getTime(),
    )
    for (const item of merged) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        deduped.push(item)
      }
    }
    return deduped
  }, [me])

  const [, createPostMutation] = useMutation<CreatePostResult>(CREATE_POST)
  const [, createPollPostMutation] = useMutation<CreatePollPostResult>(CREATE_POLL_POST)
  const [, votePollMutation] = useMutation<VotePollResult>(VOTE_POLL)
  const [, imageUploadInfoMutation] =
    useMutation<PostImageUploadInfoResult>(POST_IMAGE_UPLOAD_INFO)
  const [, profileImageUploadInfoMutation] =
    useMutation<ProfileImageUploadInfoResult>(PROFILE_IMAGE_UPLOAD_INFO)
  const [, likeMutation] = useMutation<LikePostResult>(LIKE_POST)
  const [, unlikeMutation] = useMutation<LikePostResult>(UNLIKE_POST)
  const [, addCommentMutation] = useMutation<AddCommentResult>(ADD_COMMENT)
  const [, replyMutation] = useMutation<ReplyResult>(REPLY_TO_COMMENT)
  const [, updateProfileMutation] = useMutation<UpdateProfileResult>(UPDATE_PROFILE)
  const [, followMutation] = useMutation<FollowUserResult>(FOLLOW_USER)
  const [, unfollowMutation] = useMutation<UnfollowUserResult>(UNFOLLOW_USER)
  const [, sendMessageMutation] = useMutation<SendMessageResult>(SEND_MESSAGE)
  const [, createGroupMutation] = useMutation<CreateGroupResult>(CREATE_GROUP)
  const [, renameGroupMutation] = useMutation<RenameGroupResult>(RENAME_GROUP)
  const [, addGroupMemberMutation] = useMutation<AddGroupMemberResult>(ADD_GROUP_MEMBER)
  const [, removeGroupMemberMutation] = useMutation<RemoveGroupMemberResult>(REMOVE_GROUP_MEMBER)
  const [, leaveGroupMutation] = useMutation<LeaveGroupResult>(LEAVE_GROUP)
  const [, sendGroupMessageMutation] = useMutation<SendGroupMessageResult>(SEND_GROUP_MESSAGE)

  // --- Reportes ---
  const [, reportPostMutation] = useMutation<ReportPostResult>(REPORT_POST)
  const [, reportCommentMutation] = useMutation<ReportCommentResult>(REPORT_COMMENT)

  // --- Likes de comentarios ---
  const [, likeCommentMutation] = useMutation<LikeCommentResult>(LIKE_COMMENT)
  const [, unlikeCommentMutation] = useMutation<UnlikeCommentResult>(UNLIKE_COMMENT)

  // --- Reposts ---
  const [, repostPostMutation] = useMutation<RepostPostResult>(REPOST_POST)
  const [, unrepostPostMutation] = useMutation<UnrepostPostResult>(UNREPOST_POST)

  const feed = useMemo<FeedPostView[]>(() => {
    const list = feedResult.data?.feed ?? []
    return list.map((post) => ({
      post,
      likeCount: post.likes.length,
      likedByMe: myProfileId != null && post.likes.some((l) => l.profileId === myProfileId),
      repostCount: post.reposts.length,
      repostedByMe: myProfileId != null && post.reposts.some((r) => r.profileId === myProfileId),
    }))
  }, [feedResult.data, myProfileId])

  const followingFeed = useMemo<FeedPostView[]>(() => {
    const list = followingFeedResult.data?.followingFeed ?? []
    return list.map((post) => ({
      post,
      likeCount: post.likes.length,
      likedByMe: myProfileId != null && post.likes.some((l) => l.profileId === myProfileId),
      repostCount: post.reposts.length,
      repostedByMe: myProfileId != null && post.reposts.some((r) => r.profileId === myProfileId),
    }))
  }, [followingFeedResult.data, myProfileId])

  const friends: Profile[] = friendsResult.data?.friends ?? []
  const peopleFollowing: Profile[] = followingResult.data?.following ?? []
  const followers: Profile[] = followersResult.data?.followers ?? []
  const people: Person[] = peopleResult.data?.people ?? []
  const conversations: Conversation[] = conversationsResult.data?.conversations ?? []

  const createPost = useCallback(
    async (body: string, imageKey?: string | null) => {
      const res = await createPostMutation({ body, imageKey: imageKey || undefined })
      if (res.error) throw new Error(res.error.message)
      reexecuteFeed({ requestPolicy: 'network-only' })
      reexecuteMe({ requestPolicy: 'network-only' })
      return res.data?.createPost
    },
    [createPostMutation, reexecuteFeed, reexecuteMe],
  )

  const createPollPost = useCallback(
    async (question: string, options: string[]) => {
      const res = await createPollPostMutation({ question, options })
      if (res.error) throw new Error(res.error.message)
      reexecuteFeed({ requestPolicy: 'network-only' })
      reexecuteMe({ requestPolicy: 'network-only' })
      return res.data?.createPollPost
    },
    [createPollPostMutation, reexecuteFeed, reexecuteMe],
  )

  /** Registra el voto en la encuesta y devuelve el post con resultados. */
  const votePoll = useCallback(
    async (optionId: string) => {
      const res = await votePollMutation({ optionId })
      if (res.error) throw new Error(res.error.message)
      reexecuteFeed({ requestPolicy: 'network-only' })
      return res.data?.votePoll
    },
    [votePollMutation, reexecuteFeed],
  )

  /** Pide la info de subida (clave + URLs) para la imagen de una publicación. */
  const createPostImageUpload = useCallback(
    async (fileName: string, contentType: string) => {
      const res = await imageUploadInfoMutation({ fileName, contentType })
      if (res.error) throw new Error(res.error.message)
      const info = res.data?.createPostImageUploadInfo
      if (!info) throw new Error('No se obtuvo la URL de subida.')
      return info
    },
    [imageUploadInfoMutation],
  )

  /** Pide la info de subida para foto de perfil o portada ("AVATAR" | "COVER"). */
  const createProfileImageUpload = useCallback(
    async (kind: 'AVATAR' | 'COVER', fileName: string, contentType: string) => {
      const res = await profileImageUploadInfoMutation({ kind, fileName, contentType })
      if (res.error) throw new Error(res.error.message)
      const info = res.data?.createProfileImageUploadInfo
      if (!info) throw new Error('No se obtuvo la URL de subida.')
      return info
    },
    [profileImageUploadInfoMutation],
  )

  /** Sube la imagen y devuelve la clave de storage (foto de perfil o portada). */
  const uploadProfileImage = useCallback(
    async (kind: 'AVATAR' | 'COVER', file: File) => {
      const info = await createProfileImageUpload(kind, file.name, file.type)
      const token = await ensureFreshAccessToken()
      const res = await fetch(info.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: await file.arrayBuffer(),
      })
      if (!res.ok) throw new Error('No se pudo subir la imagen. Inténtalo de nuevo.')
      return info
    },
    [createProfileImageUpload],
  )

  /** Sube el binario de la imagen a la URL provista (proxy local con Bearer o
   *  presigned URL de S3). Devuelve la clave de almacenamiento. */
  const uploadPostImage = useCallback(
    async (file: File, contentType: string) => {
      const info = await createPostImageUpload(file.name, contentType)
      const token = await ensureFreshAccessToken()
      const res = await fetch(info.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: await file.arrayBuffer(),
      })
      if (!res.ok) throw new Error('No se pudo subir la imagen. Inténtalo de nuevo.')
      return info.key
    },
    [createPostImageUpload],
  )

  const toggleLike = useCallback(
    async (post: Post) => {
      const liked = myProfileId != null && post.likes.some((l) => l.profileId === myProfileId)
      const mutation = liked ? unlikeMutation : likeMutation
      const res = await mutation({ postId: post.id })
      if (res.error) throw new Error(res.error.message)
      reexecuteFeed({ requestPolicy: 'network-only' })
      return res.data?.likePost
    },
    [myProfileId, likeMutation, unlikeMutation, reexecuteFeed],
  )

  const addComment = useCallback(
    async (postId: string, body: string) => {
      const res = await addCommentMutation({ postId, body })
      if (res.error) throw new Error(res.error.message)
      return res.data?.addComment
    },
    [addCommentMutation],
  )

  const replyToComment = useCallback(
    async (commentId: string, body: string) => {
      const res = await replyMutation({ commentId, body })
      if (res.error) throw new Error(res.error.message)
      return res.data?.replyToComment
    },
    [replyMutation],
  )

  // --- Reportes ---

  const reportPost = useCallback(
    async (postId: string, reason: string, details?: string) => {
      const res = await reportPostMutation({ postId, reason, details: details || undefined })
      if (res.error) throw new Error(res.error.message)
      return res.data?.reportPost
    },
    [reportPostMutation],
  )

  const reportComment = useCallback(
    async (commentId: string, reason: string, details?: string) => {
      const res = await reportCommentMutation({ commentId, reason, details: details || undefined })
      if (res.error) throw new Error(res.error.message)
      return res.data?.reportComment
    },
    [reportCommentMutation],
  )

  // --- Likes de comentarios ---

  const toggleCommentLike = useCallback(
    async (commentId: string, liked: boolean) => {
      if (liked) {
        const res = await unlikeCommentMutation({ commentId })
        if (res.error) throw new Error(res.error.message)
        return res.data?.unlikeComment ?? null
      }
      const res = await likeCommentMutation({ commentId })
      if (res.error) throw new Error(res.error.message)
      return res.data?.likeComment ?? null
    },
    [likeCommentMutation, unlikeCommentMutation],
  )

  // --- Reposts ---

  const toggleRepost = useCallback(
    async (post: Post) => {
      const reposted = myProfileId != null && post.reposts.some((r) => r.profileId === myProfileId)
      if (reposted) {
        const res = await unrepostPostMutation({ postId: post.id })
        if (res.error) throw new Error(res.error.message)
        reexecuteFeed({ requestPolicy: 'network-only' })
        return res.data?.unrepostPost ?? null
      }
      const res = await repostPostMutation({ postId: post.id })
      if (res.error) throw new Error(res.error.message)
      reexecuteFeed({ requestPolicy: 'network-only' })
      return res.data?.repostPost ?? null
    },
    [myProfileId, repostPostMutation, unrepostPostMutation, reexecuteFeed],
  )

  /** Carga la lista de perfiles que repostearon una publicación. */
  const fetchPostReposts = useCallback(
    async (postId: string) => {
      const res = await client.query<PostRepostsResult>(POST_REPOSTS, { postId, take: 50, skip: 0 }).toPromise()
      if (res.error) throw new Error(res.error.message)
      return res.data?.postReposts ?? []
    },
    [client],
  )

  const updateProfile = useCallback(
    async (displayName: string, bio?: string | null, avatarKey?: string | null, coverKey?: string | null) => {
      const res = await updateProfileMutation({
        displayName,
        bio: bio ?? null,
        avatarKey: avatarKey || undefined,
        coverKey: coverKey || undefined,
      })
      if (res.error) throw new Error(res.error.message)
      reexecuteMe({ requestPolicy: 'network-only' })
      return res.data?.updateProfile
    },
    [updateProfileMutation, reexecuteMe],
  )

  const followUser = useCallback(
    async (profileId: string) => {
      const res = await followMutation({ profileId })
      if (res.error) throw new Error(res.error.message)
      reexecuteFriends({ requestPolicy: 'network-only' })
      reexecuteFollowing({ requestPolicy: 'network-only' })
      reexecuteFollowers({ requestPolicy: 'network-only' })
      reexecutePeople({ requestPolicy: 'network-only' })
      return res.data?.followUser
    },
    [followMutation, reexecuteFriends, reexecuteFollowing, reexecuteFollowers, reexecutePeople],
  )

  const unfollowUser = useCallback(
    async (profileId: string) => {
      const res = await unfollowMutation({ profileId })
      if (res.error) throw new Error(res.error.message)
      reexecuteFriends({ requestPolicy: 'network-only' })
      reexecuteFollowing({ requestPolicy: 'network-only' })
      reexecuteFollowers({ requestPolicy: 'network-only' })
      reexecutePeople({ requestPolicy: 'network-only' })
      return res.data?.unfollowUser
    },
    [unfollowMutation, reexecuteFriends, reexecuteFollowing, reexecuteFollowers, reexecutePeople],
  )

  const sendMessage = useCallback(
    async (recipientProfileId: string, body: string) => {
      const res = await sendMessageMutation({ recipientProfileId, body })
      if (res.error) throw new Error(res.error.message)
      reexecuteConversations({ requestPolicy: 'network-only' })
      return res.data?.sendMessage
    },
    [sendMessageMutation, reexecuteConversations],
  )

  // Referencia estable: evita que el useEffect del tab de chat re-dispare
  // refetches en cada render (loop infinito de loading).
  const refetchConversations = useCallback(
    () => reexecuteConversations({ requestPolicy: 'network-only' }),
    [reexecuteConversations],
  )

  const refetchGroups = useCallback(
    () => reexecuteGroups({ requestPolicy: 'network-only' }),
    [reexecuteGroups],
  )

  const createGroup = useCallback(
    async (name: string, memberProfileIds: string[]) => {
      const res = await createGroupMutation({ name, memberProfileIds })
      if (res.error) throw new Error(res.error.message)
      refetchGroups()
      return res.data?.createGroup
    },
    [createGroupMutation, refetchGroups],
  )

  const renameGroup = useCallback(
    async (groupId: string, name: string) => {
      const res = await renameGroupMutation({ groupId, name })
      if (res.error) throw new Error(res.error.message)
      refetchGroups()
      return res.data?.renameGroup
    },
    [renameGroupMutation, refetchGroups],
  )

  const addGroupMember = useCallback(
    async (groupId: string, profileId: string) => {
      const res = await addGroupMemberMutation({ groupId, profileId })
      if (res.error) throw new Error(res.error.message)
      refetchGroups()
      return res.data?.addGroupMember
    },
    [addGroupMemberMutation, refetchGroups],
  )

  const removeGroupMember = useCallback(
    async (groupId: string, profileId: string) => {
      const res = await removeGroupMemberMutation({ groupId, profileId })
      if (res.error) throw new Error(res.error.message)
      refetchGroups()
      return res.data?.removeGroupMember
    },
    [removeGroupMemberMutation, refetchGroups],
  )

  const leaveGroup = useCallback(
    async (groupId: string) => {
      const res = await leaveGroupMutation({ groupId })
      if (res.error) throw new Error(res.error.message)
      refetchGroups()
      return res.data?.leaveGroup
    },
    [leaveGroupMutation, refetchGroups],
  )

  const sendGroupMessage = useCallback(
    async (groupId: string, body: string) => {
      const res = await sendGroupMessageMutation({ groupId, body })
      if (res.error) throw new Error(res.error.message)
      refetchGroups()
      return res.data?.sendGroupMessage
    },
    [sendGroupMessageMutation, refetchGroups],
  )

  /** Lista de grupos de chat y estado de carga/error derivados. */
  const groups: ChatGroup[] = groupsResult.data?.groups ?? []
  const groupsLoading = groupsResult.fetching
  const groupsError = groupsResult.error ? groupsResult.error.message : null

  return {
    me,
    meLoading: meResult.fetching,
    meError: meResult.error,
    retryMe: () => reexecuteMe({ requestPolicy: 'network-only' }),
    meTimelinePosts,
    feed,
    feedLoading: feedResult.fetching,
    feedError: feedResult.error,
    retryFeed: () => reexecuteFeed({ requestPolicy: 'network-only' }),
    followingFeed,
    followingFeedLoading: followingFeedResult.fetching,
    followingFeedError: followingFeedResult.error,
    retryFollowingFeed: () => reexecuteFollowingFeed({ requestPolicy: 'network-only' }),
    friends,
    friendsLoading: friendsResult.fetching,
    friendsError: friendsResult.error,
    retryFriends: () => reexecuteFriends({ requestPolicy: 'network-only' }),
    peopleFollowing,
    followingLoading: followingResult.fetching,
    followingError: followingResult.error,
    retryFollowing: () => reexecuteFollowing({ requestPolicy: 'network-only' }),
    followers,
    followersLoading: followersResult.fetching,
    followersError: followersResult.error,
    retryFollowers: () => reexecuteFollowers({ requestPolicy: 'network-only' }),
    people,
    peopleLoading: peopleResult.fetching,
    peopleError: peopleResult.error,
    setPeopleQuery,
    conversations,
    conversationsLoading: conversationsResult.fetching,
    conversationsError: conversationsResult.error,
    refetchConversations,
    createPost,
    createPollPost,
    votePoll,
    createPostImageUpload,
    uploadPostImage,
    toggleLike,
    addComment,
    replyToComment,
    reportPost,
    reportComment,
    toggleCommentLike,
    toggleRepost,
    fetchPostReposts,
    updateProfile,
  uploadProfileImage,
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
  }
}
