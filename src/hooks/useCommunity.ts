import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useSubscription } from 'urql'
import {
  ADD_COMMENT,
  ADD_GROUP_MEMBER,
  CONVERSATIONS_QUERY,
  CREATE_GROUP,
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
  ME_QUERY,
  MESSAGE_ADDED,
  PEOPLE_SEARCH,
  REMOVE_GROUP_MEMBER,
  RENAME_GROUP,
  REPLY_TO_COMMENT,
  SEND_GROUP_MESSAGE,
  SEND_MESSAGE,
  UNFOLLOW_USER,
  UNLIKE_POST,
  UPDATE_PROFILE,
  conversationKey,
  type AddCommentResult,
  type AddGroupMemberResult,
  type ChatGroup,
  type Conversation,
  type ConversationsResult,
  type CreateGroupResult,
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
  type LikePostResult,
  type MeResult,
  type MessageAddedResult,
  type PeopleResult,
  type Person,
  type Post,
  type Profile,
  type RemoveGroupMemberResult,
  type RenameGroupResult,
  type ReplyResult,
  type SendGroupMessageResult,
  type SendMessageResult,
  type UnfollowUserResult,
  type UpdateProfileResult,
} from '../graphql/community'

const PAGE_SIZE = 20
const LIST_SIZE = 50

/** Estado del feed (derivado): likes y si el perfil actual ya dio like. */
export interface FeedPostView {
  post: Post
  likeCount: number
  likedByMe: boolean
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

  const me: Profile | null = meResult.data?.me ?? null
  const myProfileId = me?.id ?? null

  const [, createPostMutation] = useMutation<CreatePostResult>(CREATE_POST)
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

  const feed = useMemo<FeedPostView[]>(() => {
    const list = feedResult.data?.feed ?? []
    return list.map((post) => ({
      post,
      likeCount: post.likes.length,
      likedByMe: myProfileId != null && post.likes.some((l) => l.profileId === myProfileId),
    }))
  }, [feedResult.data, myProfileId])

  const followingFeed = useMemo<FeedPostView[]>(() => {
    const list = followingFeedResult.data?.followingFeed ?? []
    return list.map((post) => ({
      post,
      likeCount: post.likes.length,
      likedByMe: myProfileId != null && post.likes.some((l) => l.profileId === myProfileId),
    }))
  }, [followingFeedResult.data, myProfileId])

  const friends: Profile[] = friendsResult.data?.friends ?? []
  const peopleFollowing: Profile[] = followingResult.data?.following ?? []
  const followers: Profile[] = followersResult.data?.followers ?? []
  const people: Person[] = peopleResult.data?.people ?? []
  const conversations: Conversation[] = conversationsResult.data?.conversations ?? []

  const createPost = useCallback(
    async (body: string) => {
      const res = await createPostMutation({ body })
      if (res.error) throw new Error(res.error.message)
      reexecuteFeed({ requestPolicy: 'network-only' })
      reexecuteMe({ requestPolicy: 'network-only' })
      return res.data?.createPost
    },
    [createPostMutation, reexecuteFeed, reexecuteMe],
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

  const updateProfile = useCallback(
    async (displayName: string, bio?: string | null) => {
      const res = await updateProfileMutation({ displayName, bio: bio ?? null })
      if (res.error) throw new Error(res.error.message)
      return res.data?.updateProfile
    },
    [updateProfileMutation],
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
  }
}
