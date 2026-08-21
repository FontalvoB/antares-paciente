import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery } from 'urql'
import {
  ADD_COMMENT,
  CONVERSATIONS_QUERY,
  CREATE_POST,
  FOLLOWERS_QUERY,
  FOLLOWING_FEED_QUERY,
  FOLLOWING_QUERY,
  FOLLOW_USER,
  FEED_QUERY,
  FRIENDS_QUERY,
  LIKE_POST,
  ME_QUERY,
  PEOPLE_SEARCH,
  REPLY_TO_COMMENT,
  SEND_MESSAGE,
  UNFOLLOW_USER,
  UNLIKE_POST,
  UPDATE_PROFILE,
  type AddCommentResult,
  type Conversation,
  type ConversationsResult,
  type CreatePostResult,
  type FeedResult,
  type FollowersResult,
  type FollowingFeedResult,
  type FollowingResult,
  type FollowUserResult,
  type FriendsResult,
  type LikePostResult,
  type MeResult,
  type PeopleResult,
  type Person,
  type Post,
  type Profile,
  type ReplyResult,
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
    refetchConversations: () => reexecuteConversations({ requestPolicy: 'network-only' }),
    createPost,
    toggleLike,
    addComment,
    replyToComment,
    updateProfile,
    followUser,
    unfollowUser,
    sendMessage,
  }
}
