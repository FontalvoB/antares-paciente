/** Operaciones GraphQL y tipos de la comunidad (escritos a mano, sin codegen). */

// ---------- Tipos ----------

export type ProfileStatus = 'ACTIVE' | 'BANNED'

export interface RepostWithPost {
  id: string
  postId: string
  profileId: string
  createdAt: string
  post: Post
}

export interface Profile {
  id: string
  displayName: string
  isSystem?: boolean
  bio: string | null
  status: ProfileStatus
  banReason: string | null
  bannedAt: string | null
  avatarUrl: string | null
  coverUrl: string | null
  createdAt: string
  posts: Post[]
  reposts: RepostWithPost[]
}

export interface PostAuthor {
  id: string
  displayName: string
  avatarUrl?: string | null
  isSystem?: boolean
}

export interface LikeRef {
  id: string
  profileId: string
}

export interface RepostRef {
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
  likes: LikeRef[]
  replies: Comment[]
}

export interface PollVote {
  id: string
  profileId: string
}

export interface PollOption {
  id: string
  text: string
  votes: PollVote[]
}

export interface Poll {
  id: string
  options: PollOption[]
}

export interface Post {
  id: string
  body: string
  pinned: boolean
  imageUrl: string | null
  mediaType: 'IMAGE' | 'VIDEO' | null
  poll: Poll | null
  createdAt: string
  profile: PostAuthor
  likes: LikeRef[]
  reposts: RepostRef[]
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

export interface ProfileResult {
  profile: Profile | null
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

export interface ProfileFollowersResult {
  profileFollowers: Profile[]
}

export interface ProfileFollowingResult {
  profileFollowing: Profile[]
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

// ---------- Tipos: grupos de chat ----------

/** Grupo de chat (salón) con el último mensaje para la lista de grupos. */
export interface ChatGroup {
  id: string
  name: string
  createdByProfileId: string
  createdAt: string
  memberCount: number
  lastMessage: Message | null
}

export interface GroupResult {
  groups: ChatGroup[]
}

export interface GroupHistoryResult {
  group: Message[]
}

export interface GroupMembersResult {
  groupMembers: Profile[]
}

export interface CreateGroupResult {
  createGroup: ChatGroup
}

export interface RenameGroupResult {
  renameGroup: ChatGroup
}

export interface AddGroupMemberResult {
  addGroupMember: ChatGroup
}

export interface RemoveGroupMemberResult {
  removeGroupMember: ChatGroup
}

export interface LeaveGroupResult {
  leaveGroup: ChatGroup
}

export interface SendGroupMessageResult {
  sendGroupMessage: Message
}

export interface GroupMessageAddedResult {
  groupMessageAdded: Message
}

export interface GroupChangedResult {
  groupChanged: ChatGroup
}

// ---------- Helper: nombre localizado ----------

/** Devuelve el nombre localizado de un perfil. Si el perfil es de sistema
 *  (isSystem), usa la clave de traducción; de lo contrario, muestra el
 *  displayName. */
export function profileName(
  profile: { displayName: string; isSystem?: boolean },
  t: (key: string) => string,
): string {
  return profile.isSystem ? t('Equipo ANTARES') : profile.displayName
}

// ---------- Fragmentos ----------

const PROFILE_FRAGMENT = /* GraphQL */ `
  fragment ProfileFields on Profile {
    id
    displayName
    isSystem
    bio
    status
    banReason
    bannedAt
    avatarUrl
    coverUrl
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
      avatarUrl
      isSystem
    }
    likes {
      id
      profileId
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
        avatarUrl
        isSystem
      }
      likes {
        id
        profileId
      }
    }
  }
`

const POLL_FRAGMENT = /* GraphQL */ `
  fragment PollFields on Poll {
    id
    options {
      id
      text
      votes {
        id
        profileId
      }
    }
  }
`

const POST_FRAGMENT = /* GraphQL */ `
  fragment PostFields on Post {
    id
    body
    pinned
    imageUrl
    mediaType
    poll {
      ...PollFields
    }
    createdAt
    profile {
      id
      displayName
      avatarUrl
      isSystem
    }
    likes {
      id
      profileId
    }
    reposts {
      id
      profileId
    }
    comments {
      ...CommentFields
    }
  }
  ${POLL_FRAGMENT}
`

// ---------- Queries ----------

export const ME_QUERY = /* GraphQL */ `
  query Me {
    me {
      ...ProfileFields
      posts {
        ...PostFields
      }
      reposts {
        id
        postId
        profileId
        createdAt
        post {
          ...PostFields
        }
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

export const PROFILE_QUERY = /* GraphQL */ `
  query Profile($id: UUID!) {
    profile(id: $id) {
      ...ProfileFields
      posts {
        ...PostFields
      }
      reposts {
        id
        postId
        profileId
        createdAt
        post {
          ...PostFields
        }
      }
    }
  }
  ${PROFILE_FRAGMENT}
  ${POST_FRAGMENT}
  ${COMMENT_FRAGMENT}
`

// ---------- Mutaciones ----------

export const CREATE_POST = /* GraphQL */ `
  mutation CreatePost($body: String!, $imageKey: String) {
    createPost(body: $body, imageKey: $imageKey) {
      ...PostFields
    }
  }
  ${POST_FRAGMENT}
  ${COMMENT_FRAGMENT}
`

export const CREATE_POLL_POST = /* GraphQL */ `
  mutation CreatePollPost($question: String!, $options: [String!]!) {
    createPollPost(question: $question, options: $options) {
      ...PostFields
    }
  }
  ${POST_FRAGMENT}
  ${COMMENT_FRAGMENT}
`

export const VOTE_POLL = /* GraphQL */ `
  mutation VotePoll($optionId: UUID!) {
    votePoll(optionId: $optionId) {
      ...PostFields
    }
  }
  ${POST_FRAGMENT}
  ${COMMENT_FRAGMENT}
`

export interface CreatePollPostResult {
  createPollPost: Post
}

export interface VotePollResult {
  votePoll: Post
}

// ---------- Reportes ----------

export const REPORT_POST = /* GraphQL */ `
  mutation ReportPost($postId: UUID!, $reason: String!, $details: String) {
    reportPost(postId: $postId, reason: $reason, details: $details) {
      id
    }
  }
`

export interface ReportPostResult {
  reportPost: { id: string } | null
}

export const REPORT_COMMENT = /* GraphQL */ `
  mutation ReportComment($commentId: UUID!, $reason: String!, $details: String) {
    reportComment(commentId: $commentId, reason: $reason, details: $details) {
      id
    }
  }
`

export interface ReportCommentResult {
  reportComment: { id: string } | null
}

// ---------- Likes de comentarios ----------

export const LIKE_COMMENT = /* GraphQL */ `
  mutation LikeComment($commentId: UUID!) {
    likeComment(commentId: $commentId) {
      id
      likes {
        id
        profileId
      }
    }
  }
`

export interface LikeCommentResult {
  likeComment: { id: string; likes: LikeRef[] } | null
}

export const UNLIKE_COMMENT = /* GraphQL */ `
  mutation UnlikeComment($commentId: UUID!) {
    unlikeComment(commentId: $commentId) {
      id
      likes {
        id
        profileId
      }
    }
  }
`

export interface UnlikeCommentResult {
  unlikeComment: { id: string; likes: LikeRef[] } | null
}

// ---------- Reposts ----------

export const REPOST_POST = /* GraphQL */ `
  mutation RepostPost($postId: UUID!) {
    repostPost(postId: $postId) {
      id
      reposts {
        id
        profileId
      }
    }
  }
`

export interface RepostPostResult {
  repostPost: { id: string; reposts: RepostRef[] } | null
}

export const UNREPOST_POST = /* GraphQL */ `
  mutation UnrepostPost($postId: UUID!) {
    unrepostPost(postId: $postId) {
      id
      reposts {
        id
        profileId
      }
    }
  }
`

export interface UnrepostPostResult {
  unrepostPost: { id: string; reposts: RepostRef[] } | null
}

export const POST_REPOSTS = /* GraphQL */ `
  query PostReposts($postId: UUID!, $take: Int!, $skip: Int!) {
    postReposts(postId: $postId, take: $take, skip: $skip) {
      id
      displayName
      avatarUrl
    }
  }
`

export interface PostRepostsResult {
  postReposts: Pick<Profile, 'id' | 'displayName' | 'avatarUrl'>[]
}

export interface PostImageUploadInfo {
  key: string
  uploadUrl: string
  readUrl: string
}

export interface PostImageUploadInfoResult {
  createPostImageUploadInfo: PostImageUploadInfo
}

export interface ProfileImageUploadInfoResult {
  createProfileImageUploadInfo: PostImageUploadInfo
}

export const POST_IMAGE_UPLOAD_INFO = /* GraphQL */ `
  mutation PostImageUploadInfo($fileName: String!, $contentType: String!) {
    createPostImageUploadInfo(fileName: $fileName, contentType: $contentType) {
      key
      uploadUrl
      readUrl
    }
  }
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
  mutation UpdateProfile(
    $displayName: String!
    $bio: String
    $avatarKey: String
    $coverKey: String
  ) {
    updateProfile(displayName: $displayName, bio: $bio, avatarKey: $avatarKey, coverKey: $coverKey) {
      ...ProfileFields
    }
  }
  ${PROFILE_FRAGMENT}
`

export const PROFILE_IMAGE_UPLOAD_INFO = /* GraphQL */ `
  mutation ProfileImageUploadInfo(
    $kind: String!
    $fileName: String!
    $contentType: String!
  ) {
    createProfileImageUploadInfo(kind: $kind, fileName: $fileName, contentType: $contentType) {
      key
      uploadUrl
      readUrl
    }
  }
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
        isSystem
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

export const PROFILE_FOLLOWERS_QUERY = /* GraphQL */ `
  query ProfileFollowers($profileId: UUID!, $take: Int!, $skip: Int!) {
    profileFollowers(profileId: $profileId, take: $take, skip: $skip) {
      ...ProfileFields
    }
  }
  ${PROFILE_FRAGMENT}
`

export const PROFILE_FOLLOWING_QUERY = /* GraphQL */ `
  query ProfileFollowing($profileId: UUID!, $take: Int!, $skip: Int!) {
    profileFollowing(profileId: $profileId, take: $take, skip: $skip) {
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
        isSystem
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

/** Evento mínimo de post publicado (para el aviso "ver publicaciones nuevas"). */
export interface PostAddedEvent {
  id: string
  profile: { id: string }
}

export interface PostAddedResult {
  postAdded: PostAddedEvent
}

export const POST_ADDED = /* GraphQL */ `
  subscription PostAdded {
    postAdded {
      id
      profile {
        id
      }
    }
  }
`

// ---------- Queries: grupos de chat ----------

export const GROUPS_QUERY = /* GraphQL */ `
  query Groups($take: Int!, $skip: Int!) {
    groups(take: $take, skip: $skip) {
      id
      name
      createdByProfileId
      createdAt
      memberCount
      lastMessage {
        id
        body
        senderProfileId
        createdAt
      }
    }
  }
`

export const GROUP_QUERY = /* GraphQL */ `
  query Group($groupId: UUID!, $take: Int!, $skip: Int!) {
    group(groupId: $groupId, take: $take, skip: $skip) {
      id
      body
      senderProfileId
      createdAt
    }
  }
`

export const GROUP_MEMBERS_QUERY = /* GraphQL */ `
  query GroupMembers($groupId: UUID!) {
    groupMembers(groupId: $groupId) {
      id
      displayName
      isSystem
    }
  }
`

// ---------- Mutaciones: grupos de chat ----------

export const CREATE_GROUP = /* GraphQL */ `
  mutation CreateGroup($name: String!, $memberProfileIds: [UUID!]!) {
    createGroup(name: $name, memberProfileIds: $memberProfileIds) {
      id
      name
      createdAt
    }
  }
`

export const RENAME_GROUP = /* GraphQL */ `
  mutation RenameGroup($groupId: UUID!, $name: String!) {
    renameGroup(groupId: $groupId, name: $name) {
      id
      name
    }
  }
`

export const ADD_GROUP_MEMBER = /* GraphQL */ `
  mutation AddGroupMember($groupId: UUID!, $profileId: UUID!) {
    addGroupMember(groupId: $groupId, profileId: $profileId) {
      id
      name
      memberCount
    }
  }
`

export const REMOVE_GROUP_MEMBER = /* GraphQL */ `
  mutation RemoveGroupMember($groupId: UUID!, $profileId: UUID!) {
    removeGroupMember(groupId: $groupId, profileId: $profileId) {
      id
      name
      memberCount
    }
  }
`

export const LEAVE_GROUP = /* GraphQL */ `
  mutation LeaveGroup($groupId: UUID!) {
    leaveGroup(groupId: $groupId) {
      id
      name
    }
  }
`

export const SEND_GROUP_MESSAGE = /* GraphQL */ `
  mutation SendGroupMessage($groupId: UUID!, $body: String!) {
    sendGroupMessage(groupId: $groupId, body: $body) {
      id
      body
      senderProfileId
      createdAt
    }
  }
`

// ---------- Suscripciones: grupos de chat ----------

export const GROUP_MESSAGE_ADDED = /* GraphQL */ `
  subscription GroupMessageAdded($groupId: UUID!) {
    groupMessageAdded(groupId: $groupId) {
      id
      body
      senderProfileId
      createdAt
    }
  }
`

export const GROUP_CHANGED = /* GraphQL */ `
  subscription GroupChanged($groupId: UUID!) {
    groupChanged(groupId: $groupId) {
      id
      name
      memberCount
    }
  }
`
