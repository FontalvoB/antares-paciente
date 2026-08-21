/** Operaciones GraphQL y tipos de la comunidad (escritos a mano, sin codegen). */

// ---------- Tipos ----------

export type ProfileStatus = 'Active' | 'Banned'

export interface Profile {
  id: string
  displayName: string
  bio: string | null
  status: ProfileStatus
  banReason: string | null
  bannedAt: string | null
  createdAt: string
  posts: Post[]
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

export interface Person {
  profile: Profile
  isFollowing: boolean
  isFollower: boolean
  isFriend: boolean
}

export interface Message {
  id: string
  senderProfileId: string
  recipientProfileId: string
  body: string
  createdAt: string
}

export interface Conversation {
  peer: Profile
  lastMessage: Message | null
}

/** Clave de conversación: los dos ids de perfil ordenados ascendentemente y
 *  unidos por ':'. Debe coincidir con el topic del servidor `message_{key}`. */
export function conversationKey(a: string, b: string): string {
  return [a, b].sort().join(':')
}

export interface FollowingFeedResult {
  followingFeed: Post[]
}

export interface PeopleResult {
  people: Person[]
}

export interface FriendsResult {
  friends: Profile[]
}

export interface FollowingResult {
  following: Profile[]
}

export interface FollowersResult {
  followers: Profile[]
}

export interface ConversationsResult {
  conversations: Conversation[]
}

export interface ConversationResult {
  conversation: Message[]
}

export interface FollowUserResult {
  followUser: Profile
}

export interface UnfollowUserResult {
  unfollowUser: Profile
}

export interface SendMessageResult {
  sendMessage: Message
}

export interface MessageAddedResult {
  messageAdded: Message
}

// ---------- Fragmentos ----------

const PROFILE_FRAGMENT = /* GraphQL */ `
  fragment ProfileFields on Profile {
    id
    displayName
    bio
    status
    banReason
    bannedAt
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
      posts {
        ...PostFields
      }
    }
  }
  ${PROFILE_FRAGMENT}
  ${POST_FRAGMENT}
  ${COMMENT_FRAGMENT}
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

// ---------- Queries: follows + mensajes ----------

export const FOLLOWING_FEED_QUERY = /* GraphQL */ `
  query FollowingFeed($take: Int!, $skip: Int!) {
    followingFeed(take: $take, skip: $skip) {
      ...PostFields
    }
  }
  ${POST_FRAGMENT}
  ${COMMENT_FRAGMENT}
`

export const PEOPLE_SEARCH = /* GraphQL */ `
  query People($search: String, $take: Int!, $skip: Int!) {
    people(search: $search, take: $take, skip: $skip) {
      profile {
        id
        displayName
        bio
        status
      }
      isFollowing
      isFollower
      isFriend
    }
  }
`

export const FRIENDS_QUERY = /* GraphQL */ `
  query Friends($take: Int!, $skip: Int!) {
    friends(take: $take, skip: $skip) {
      ...ProfileFields
    }
  }
  ${PROFILE_FRAGMENT}
`

export const FOLLOWING_QUERY = /* GraphQL */ `
  query Following($take: Int!, $skip: Int!) {
    following(take: $take, skip: $skip) {
      ...ProfileFields
    }
  }
  ${PROFILE_FRAGMENT}
`

export const FOLLOWERS_QUERY = /* GraphQL */ `
  query Followers($take: Int!, $skip: Int!) {
    followers(take: $take, skip: $skip) {
      ...ProfileFields
    }
  }
  ${PROFILE_FRAGMENT}
`

export const CONVERSATIONS_QUERY = /* GraphQL */ `
  query Conversations($take: Int!, $skip: Int!) {
    conversations(take: $take, skip: $skip) {
      peer {
        id
        displayName
      }
      lastMessage {
        id
        senderProfileId
        recipientProfileId
        body
        createdAt
      }
    }
  }
`

export const CONVERSATION_QUERY = /* GraphQL */ `
  query Conversation($peerId: UUID!, $take: Int!, $skip: Int!) {
    conversation(peerId: $peerId, take: $take, skip: $skip) {
      id
      senderProfileId
      recipientProfileId
      body
      createdAt
    }
  }
`

// ---------- Mutaciones: follows + mensajes ----------

export const FOLLOW_USER = /* GraphQL */ `
  mutation FollowUser($profileId: UUID!) {
    followUser(profileId: $profileId) {
      id
    }
  }
`

export const UNFOLLOW_USER = /* GraphQL */ `
  mutation UnfollowUser($profileId: UUID!) {
    unfollowUser(profileId: $profileId) {
      id
    }
  }
`

export const SEND_MESSAGE = /* GraphQL */ `
  mutation SendMessage($recipientProfileId: UUID!, $body: String!) {
    sendMessage(recipientProfileId: $recipientProfileId, body: $body) {
      id
      senderProfileId
      recipientProfileId
      body
      createdAt
    }
  }
`

// ---------- Suscripción ----------

export const MESSAGE_ADDED = /* GraphQL */ `
  subscription MessageAdded($conversationKey: String!) {
    messageAdded(conversationKey: $conversationKey) {
      id
      senderProfileId
      recipientProfileId
      body
      createdAt
    }
  }
`
