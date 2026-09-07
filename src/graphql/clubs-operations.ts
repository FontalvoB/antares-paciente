// Operaciones GraphQL del módulo de Clubes (hand-written, sin codegen).
// Espejo del contrato del backend CoppAddresd.Community (D1 congelado en
// src/graphql/clubs.ts). Misma forma que consume el ERP en
// coppaddresd-front/features/community/clubs/services/clubs-service.ts.
import { gql } from "urql";

export const CLUBS_QUERY = gql`
  query Clubs($filter: ClubFilterInput, $take: Int, $skip: Int) {
    clubs(filter: $filter, take: $take, skip: $skip) {
      id slug name description rules objectives category tags
      coverUrl logoUrl visibility maxMembers status memberCount createdAt
      myMembership { clubId profileId role status mutedUntil joinedAt }
    }
  }
`;

export const CLUB_QUERY = gql`
  query Club($id: UUID!) {
    club(id: $id) {
      id slug name description rules objectives category tags
      coverUrl logoUrl visibility maxMembers status memberCount createdAt
      myMembership {
        clubId profileId role status mutedUntil joinedAt
        profile { id displayName }
      }
    }
  }
`;

export const MY_CLUBS_QUERY = gql`
  query MyClubs {
    myClubs {
      id slug name description rules objectives category tags
      coverUrl logoUrl visibility maxMembers status memberCount createdAt
      myMembership { clubId profileId role status mutedUntil joinedAt }
    }
  }
`;

export const CLUB_FEED_QUERY = gql`
  query ClubFeed($clubId: UUID!, $take: Int, $skip: Int) {
    clubFeed(clubId: $clubId, take: $take, skip: $skip) {
      id clubId body type clubVisibility clubStatus pinned featured scheduledFor createdAt
      profile { id displayName isSystem }
      likes { id profileId }
      comments { id body profileId createdAt profile { id displayName } }
      poll { options { id text votes { id profileId } } }
    }
  }
`;

export const PUBLIC_CLUB_POSTS_QUERY = gql`
  query PublicClubPosts($take: Int) {
    publicClubPosts(take: $take) {
      id clubId body type clubVisibility clubStatus pinned featured scheduledFor createdAt
      club {
        id slug name description rules objectives category tags
        coverUrl logoUrl visibility maxMembers status memberCount createdAt
      }
      profile { id displayName isSystem }
      likes { id profileId }
      comments { id body profileId createdAt profile { id displayName } }
      poll { options { id text votes { id profileId } } }
    }
  }
`;

export const CLUB_MEMBERS_QUERY = gql`
  query ClubMembers($clubId: UUID!, $status: ClubMemberStatus) {
    clubMembers(clubId: $clubId, status: $status) {
      clubId profileId role status mutedUntil joinedAt
      profile { id displayName isSystem }
    }
  }
`;

export const CLUB_EVENTS_QUERY = gql`
  query ClubEvents($clubId: UUID!) {
    clubEvents(clubId: $clubId) {
      id clubId title description type startsAt endsAt location meetingUrl
      maxAttendees confirmedCount waitlistCount status
      myAttendance { id status }
    }
  }
`;

export const CLUB_LIVES_QUERY = gql`
  query ClubLiveSessions($clubId: UUID!) {
    clubLiveSessions(clubId: $clubId) {
      id clubId eventId title scheduledStartAt status embedUrl
      speakers { profileId profile { id displayName } }
      chatMessages { id senderProfileId body sentAt }
    }
  }
`;

export const CLUB_NOTIFICATIONS_QUERY = gql`
  query ClubNotifications($take: Int) {
    clubNotifications(take: $take) {
      id clubId type payload readAt createdAt
    }
  }
`;

export const CREATE_CLUB_MEDIA_UPLOAD_INFO = gql`
  mutation CreateClubMediaUploadInfo(
    $clubId: UUID
    $kind: String!
    $fileName: String!
    $contentType: String!
  ) {
    createClubMediaUploadInfo(
      clubId: $clubId
      kind: $kind
      fileName: $fileName
      contentType: $contentType
    ) {
      key
      uploadUrl
      readUrl
    }
  }
`;

export const JOIN_CLUB_DIRECT = gql`
  mutation JoinClubDirect($clubId: UUID!) {
    joinClubDirect(clubId: $clubId) { clubId profileId role status mutedUntil joinedAt }
  }
`;

export const REQUEST_MEMBERSHIP = gql`
  mutation RequestMembership($clubId: UUID!) {
    requestMembership(clubId: $clubId) { clubId profileId role status }
  }
`;

export const JOIN_WITH_INVITATION = gql`
  mutation JoinWithInvitation($token: String!) {
    joinWithInvitation(token: $token) { clubId profileId role status mutedUntil joinedAt }
  }
`;

export const LEAVE_CLUB = gql`
  mutation LeaveClub($clubId: UUID!) { leaveClub(clubId: $clubId) }
`;

export const CREATE_CLUB_POST = gql`
  mutation CreateClubPost($clubId: UUID!, $input: ClubPostInput!) {
    createClubPost(clubId: $clubId, input: $input) { id body clubStatus pinned featured scheduledFor }
  }
`;

export const TOGGLE_CLUB_POST_LIKE = gql`
  mutation ToggleClubPostLike($postId: UUID!) {
    toggleClubPostLike(postId: $postId) { id clubId body clubVisibility }
  }
`;

export const ADD_CLUB_COMMENT = gql`
  mutation AddClubComment($postId: UUID!, $body: String!) {
    addClubComment(postId: $postId, body: $body) { id postId body }
  }
`;

export const VOTE_CLUB_POLL = gql`
  mutation VoteClubPoll($postId: UUID!, $optionId: UUID!) {
    voteClubPoll(postId: $postId, optionId: $optionId) { id }
  }
`;

export const CONFIRM_ATTENDANCE = gql`
  mutation ConfirmAttendance($eventId: UUID!) {
    confirmAttendance(eventId: $eventId) { id eventId profileId status createdAt }
  }
`;

export const JOIN_WAITLIST = gql`
  mutation JoinWaitlist($eventId: UUID!) {
    joinWaitlist(eventId: $eventId) { id eventId profileId status createdAt }
  }
`;

export const CHECK_IN = gql`
  mutation CheckIn($eventId: UUID!) {
    checkIn(eventId: $eventId) { id eventId profileId status createdAt }
  }
`;

export const SEND_LIVE_CHAT_MESSAGE = gql`
  mutation SendLiveChatMessage($liveId: UUID!, $body: String!) {
    sendLiveChatMessage(liveId: $liveId, body: $body) { id senderProfileId body sentAt }
  }
`;

export const MARK_NOTIFICATION_READ = gql`
  mutation MarkNotificationRead($id: UUID!) {
    markNotificationRead(id: $id) { id readAt }
  }
`;

// --- Subscriptions ---

export const LIVE_CHAT_MESSAGE_ADDED = gql`
  subscription LiveChatMessageAdded($liveId: UUID!) {
    liveChatMessageAdded(liveId: $liveId) {
      id senderProfileId body sentAt
    }
  }
`;

export const CLUB_POST_ADDED = gql`
  subscription ClubPostAdded($clubId: UUID!) {
    clubPostAdded(clubId: $clubId) {
      id clubId body type clubVisibility clubStatus pinned featured scheduledFor createdAt
      profile { id displayName isSystem }
      likes { id profileId }
      comments { id body profileId createdAt profile { id displayName } }
      poll { options { id text votes { id profileId } } }
    }
  }
`;

export const CLUB_NOTIFICATION_ADDED = gql`
  subscription ClubNotificationAdded($profileId: UUID!) {
    clubNotificationAdded(profileId: $profileId) {
      id clubId type payload readAt createdAt
    }
  }
`;