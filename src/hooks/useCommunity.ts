import { useCallback, useMemo } from 'react'
import { useMutation, useQuery } from 'urql'
import {
  ADD_COMMENT,
  CREATE_POST,
  FEED_QUERY,
  LIKE_POST,
  ME_QUERY,
  REPLY_TO_COMMENT,
  UNLIKE_POST,
  UPDATE_PROFILE,
  type AddCommentResult,
  type CreatePostResult,
  type FeedResult,
  type LikePostResult,
  type MeResult,
  type Post,
  type Profile,
  type ReplyResult,
  type UpdateProfileResult,
} from '../graphql/community'

const PAGE_SIZE = 20

/** Estado del feed (derivado): likes y si el perfil actual ya dio like. */
export interface FeedPostView {
  post: Post
  likeCount: number
  likedByMe: boolean
}

/**
 * Datos de la comunidad: perfil `me` (auto-aprovisionado por el backend en el
 * primer acceso), feed paginado, creación de publicaciones y likes.
 */
export function useCommunity() {
  const [meResult] = useQuery<MeResult>({ query: ME_QUERY })
  const [feedResult, reexecuteFeed] = useQuery<FeedResult>({
    query: FEED_QUERY,
    variables: { take: PAGE_SIZE, skip: 0 },
  })

  const me: Profile | null = meResult.data?.me ?? null
  const myProfileId = me?.id ?? null

  const [, createPostMutation] = useMutation<CreatePostResult>(CREATE_POST)
  const [, likeMutation] = useMutation<LikePostResult>(LIKE_POST)
  const [, unlikeMutation] = useMutation<LikePostResult>(UNLIKE_POST)
  const [, addCommentMutation] = useMutation<AddCommentResult>(ADD_COMMENT)
  const [, replyMutation] = useMutation<ReplyResult>(REPLY_TO_COMMENT)
  const [, updateProfileMutation] = useMutation<UpdateProfileResult>(UPDATE_PROFILE)

  const feed = useMemo<FeedPostView[]>(() => {
    const list = feedResult.data?.feed ?? []
    return list.map((post) => ({
      post,
      likeCount: post.likes.length,
      likedByMe: myProfileId != null && post.likes.some((l) => l.profileId === myProfileId),
    }))
  }, [feedResult.data, myProfileId])

  const createPost = useCallback(
    async (body: string) => {
      const res = await createPostMutation({ body })
      if (res.error) throw new Error(res.error.message)
      reexecuteFeed({ requestPolicy: 'network-only' })
      return res.data?.createPost
    },
    [createPostMutation, reexecuteFeed],
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

  return {
    me,
    meLoading: meResult.fetching,
    meError: meResult.error,
    feed,
    feedLoading: feedResult.fetching,
    feedError: feedResult.error,
    createPost,
    toggleLike,
    addComment,
    replyToComment,
    updateProfile,
  }
}
