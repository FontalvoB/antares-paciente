/** Operaciones GraphQL y tipos de la comunidad (escritos a mano, sin codegen). */

// ---------- Tipos ----------

export type ProfileStatus = 'Pending' | 'Approved' | 'Rejected'

export interface Profile {
  id: string
  displayName: string
  bio: string | null
  status: ProfileStatus
  rejectionReason: string | null
  createdAt: string
}

export interface PostAuthor {
  id: string
  displayName: string
}

export interface LikeRef {
  id: string
  profileId: string
}

export interface Comment {
  id: string
  postId: string
  parentCommentId: string | null
  body: string
  createdAt: string
  profile: PostAuthor
  replies: Comment[]
}

export interface Post {
  id: string
  body: string
  pinned: boolean
  createdAt: string
  profile: PostAuthor
  likes: LikeRef[]
  comments: Comment[]
}

export interface FeedResult {
  feed: Post[]
}

export interface MeResult {
  me: Profile | null
}

export interface PostResult {
  post: Post | null
}

export interface CreatePostResult {
  createPost: Post
}

export interface LikePostResult {
  likePost: Post | null
}

export interface AddCommentResult {
  addComment: Comment
}

export interface ReplyResult {
  replyToComment: Comment
}

export interface UpdateProfileResult {
  updateProfile: Profile
}

// ---------- Fragmentos ----------

const PROFILE_FRAGMENT = /* GraphQL */ `
  fragment ProfileFields on Profile {
    id
    displayName
    bio
    status
    rejectionReason
    createdAt
  }
`

const COMMENT_FRAGMENT = /* GraphQL */ `
  fragment CommentFields on Comment {
    id
    postId
    parentCommentId
    body
    createdAt
    profile {
      id
      displayName
    }
    replies {
      id
      postId
      parentCommentId
      body
      createdAt
      profile {
        id
        displayName
      }
    }
  }
`

const POST_FRAGMENT = /* GraphQL */ `
  fragment PostFields on Post {
    id
    body
    pinned
    createdAt
    profile {
      id
      displayName
    }
    likes {
      id
      profileId
    }
    comments {
      ...CommentFields
    }
  }
`

// ---------- Queries ----------

export const ME_QUERY = /* GraphQL */ `
  query Me {
    me {
      ...ProfileFields
    }
  }
  ${PROFILE_FRAGMENT}
`

export const FEED_QUERY = /* GraphQL */ `
  query Feed($take: Int!, $skip: Int!) {
    feed(take: $take, skip: $skip) {
      ...PostFields
    }
  }
  ${POST_FRAGMENT}
  ${COMMENT_FRAGMENT}
`

export const POST_QUERY = /* GraphQL */ `
  query Post($id: UUID!) {
    post(id: $id) {
      ...PostFields
    }
  }
  ${POST_FRAGMENT}
  ${COMMENT_FRAGMENT}
`

// ---------- Mutaciones ----------

export const CREATE_POST = /* GraphQL */ `
  mutation CreatePost($body: String!) {
    createPost(body: $body) {
      ...PostFields
    }
  }
  ${POST_FRAGMENT}
  ${COMMENT_FRAGMENT}
`

export const LIKE_POST = /* GraphQL */ `
  mutation LikePost($postId: UUID!) {
    likePost(postId: $postId) {
      id
      likes {
        id
        profileId
      }
    }
  }
`

export const UNLIKE_POST = /* GraphQL */ `
  mutation UnlikePost($postId: UUID!) {
    unlikePost(postId: $postId) {
      id
      likes {
        id
        profileId
      }
    }
  }
`

export const ADD_COMMENT = /* GraphQL */ `
  mutation AddComment($postId: UUID!, $body: String!) {
    addComment(postId: $postId, body: $body) {
      ...CommentFields
    }
  }
  ${COMMENT_FRAGMENT}
`

export const REPLY_TO_COMMENT = /* GraphQL */ `
  mutation ReplyToComment($commentId: UUID!, $body: String!) {
    replyToComment(commentId: $commentId, body: $body) {
      ...CommentFields
    }
  }
  ${COMMENT_FRAGMENT}
`

export const UPDATE_PROFILE = /* GraphQL */ `
  mutation UpdateProfile($displayName: String!, $bio: String) {
    updateProfile(displayName: $displayName, bio: $bio) {
      ...ProfileFields
    }
  }
  ${PROFILE_FRAGMENT}
`
