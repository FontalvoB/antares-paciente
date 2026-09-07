// Capa de datos real del módulo de Clubes (antares-paciente).
// Sustituye a mocks/clubs-api.ts: misma forma de funciones, pero ejecuta
// GraphQL contra el servicio Community vía gateway (urql). El wire del
// backend se mapea al contrato D1 (src/graphql/clubs.ts).

import type { AnyVariables } from "urql";
import { communityClient } from "../graphql/client";
import * as ops from "../graphql/clubs-operations";
import type {
  Club,
  ClubEvent,
  ClubInvitation,
  ClubMember,
  ClubNotification,
  ClubPost,
  EventAttendance,
  LiveChatMessage,
  LiveSession,
} from "../graphql/clubs";
import { ensureFreshAccessToken } from "../utils/authApi";
import { getGatewayBaseUrl } from "../utils/apiBaseUrl";

// Wire del backend: shape libre de la respuesta GraphQL (se mapea al D1).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Wire = any;

async function query<T>(
  doc: Parameters<typeof communityClient.query>[0],
  variables: AnyVariables = {},
): Promise<T> {
  const res = await communityClient
    .query(doc, variables, { requestPolicy: "network-only" })
    .toPromise();
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

async function mutate<T>(
  doc: Parameters<typeof communityClient.mutation>[0],
  variables: AnyVariables = {},
): Promise<T> {
  const res = await communityClient
    .mutation(doc, variables)
    .toPromise();
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** El backend devuelve URLs de media relativas (/storage/...); prefijar el gateway. */
function resolveStorageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = getGatewayBaseUrl();
  if (!base) return url;
  return `${base}${url}`;
}

// ─── Queries ─────────────────────────────────────────────────────────────

export async function fetchClubs(filter: {
  category?: string | null;
  search?: string | null;
  visibility?: Club["visibility"] | null;
} = {}): Promise<Club[]> {
  const data = await query<{ clubs: Wire[] }>(ops.CLUBS_QUERY, {
    filter: {
      category: filter.category ?? undefined,
      search: filter.search ?? undefined,
      visibility: filter.visibility ?? undefined,
    },
    take: 100,
    skip: 0,
  });
  return (data.clubs ?? []).map(toClub);
}

export async function fetchClub(id: string): Promise<Club> {
  const data = await query<{ club: Wire | null }>(ops.CLUB_QUERY, { id });
  if (!data.club) throw new Error("No se encontró el club.");
  return toClub(data.club);
}

export async function fetchMyClubs(): Promise<Club[]> {
  const data = await query<{ myClubs: Wire[] }>(ops.MY_CLUBS_QUERY);
  return (data.myClubs ?? []).map(toClub);
}

export async function fetchClubFeed(clubId: string): Promise<ClubPost[]> {
  const data = await query<{ clubFeed: Wire[] }>(ops.CLUB_FEED_QUERY, {
    clubId,
    take: 50,
    skip: 0,
  });
  return (data.clubFeed ?? []).map(toClubPost);
}

/** Posts públicos de todos los clubes (para el feed general de la app). */
export async function fetchPublicClubPosts(): Promise<
  { club: Club; post: ClubPost }[]
> {
  const data = await query<{ publicClubPosts: Wire[] }>(
    ops.PUBLIC_CLUB_POSTS_QUERY,
    { take: 10 },
  );
  return (data.publicClubPosts ?? []).map((p) => ({
    club: toClub(p.club),
    post: toClubPost(p),
  }));
}

export async function fetchClubMembers(
  clubId: string,
  status?: string,
): Promise<ClubMember[]> {
  const data = await query<{ clubMembers: Wire[] }>(ops.CLUB_MEMBERS_QUERY, {
    clubId,
    status: status ?? undefined,
  });
  return (data.clubMembers ?? []).map(toClubMember);
}

export async function fetchClubEvents(clubId: string): Promise<ClubEvent[]> {
  const data = await query<{ clubEvents: Wire[] }>(ops.CLUB_EVENTS_QUERY, {
    clubId,
  });
  return (data.clubEvents ?? []).map(toClubEvent);
}

export async function fetchClubLiveSessions(
  clubId: string,
): Promise<LiveSession[]> {
  const data = await query<{ clubLiveSessions: Wire[] }>(ops.CLUB_LIVES_QUERY, {
    clubId,
  });
  return (data.clubLiveSessions ?? []).map(toLiveSession);
}

export async function fetchNotifications(): Promise<ClubNotification[]> {
  const data = await query<{ clubNotifications: Wire[] }>(
    ops.CLUB_NOTIFICATIONS_QUERY,
    { take: 50 },
  );
  return (data.clubNotifications ?? []).map(toClubNotification);
}

// ─── Mutations ──────────────────────────────────────────────────────────

export async function joinClubDirect(clubId: string): Promise<Club> {
  await mutate(ops.JOIN_CLUB_DIRECT, { clubId });
  return fetchClub(clubId);
}

export async function joinWithInvitation(
  clubId: string,
  token: string,
): Promise<Club> {
  await mutate(ops.JOIN_WITH_INVITATION, { token });
  return fetchClub(clubId);
}

export async function requestMembership(clubId: string): Promise<boolean> {
  await mutate(ops.REQUEST_MEMBERSHIP, { clubId });
  return true;
}

export async function leaveClub(clubId: string): Promise<boolean> {
  await mutate(ops.LEAVE_CLUB, { clubId });
  return true;
}

export async function toggleClubPostLike(
  clubId: string,
  postId: string,
): Promise<ClubPost> {
  void clubId;
  await mutate(ops.TOGGLE_CLUB_POST_LIKE, { postId });
  return (await fetchClubFeed(clubId)).find((p) => p.id === postId)
    ?? (await fetchClubFeed(clubId))[0];
}

export async function addClubComment(
  clubId: string,
  postId: string,
  body: string,
): Promise<ClubPost> {
  await mutate(ops.ADD_CLUB_COMMENT, { postId, body });
  const feed = await fetchClubFeed(clubId);
  return feed.find((p) => p.id === postId) ?? feed[0];
}

export async function voteClubPoll(
  clubId: string,
  pollOptionId: string,
): Promise<ClubPost> {
  const feed = await fetchClubFeed(clubId);
  const post = feed.find((p) => p.poll?.options.some((o) => o.id === pollOptionId));
  if (!post) throw new Error("No se encontró la encuesta.");
  await mutate(ops.VOTE_CLUB_POLL, { postId: post.id, optionId: pollOptionId });
  return post;
}

export async function confirmAttendance(
  eventId: string,
): Promise<EventAttendance> {
  const data = await mutate<{ confirmAttendance: Wire }>(
    ops.CONFIRM_ATTENDANCE,
    { eventId },
  );
  return toEventAttendance(data.confirmAttendance);
}

export async function joinWaitlist(eventId: string): Promise<EventAttendance> {
  const data = await mutate<{ joinWaitlist: Wire }>(ops.JOIN_WAITLIST, {
    eventId,
  });
  return toEventAttendance(data.joinWaitlist);
}

export async function checkIn(eventId: string): Promise<EventAttendance> {
  const data = await mutate<{ checkIn: Wire }>(ops.CHECK_IN, { eventId });
  return toEventAttendance(data.checkIn);
}

export async function sendLiveChatMessage(
  liveId: string,
  body: string,
): Promise<LiveChatMessage> {
  const data = await mutate<{ sendLiveChatMessage: Wire }>(
    ops.SEND_LIVE_CHAT_MESSAGE,
    { liveId, body },
  );
  return toLiveChatMessage(data.sendLiveChatMessage);
}

export async function markNotificationRead(id: string): Promise<boolean> {
  await mutate(ops.MARK_NOTIFICATION_READ, { id });
  return true;
}

/**
 * Sube la portada (COVER) o el logo (LOGO) de un club: obtiene la información
 * de subida firmada y hace el PUT del binario (Bearer de la app). Devuelve la
 * clave para guardarla en updateClub.
 */
export async function uploadClubImage(
  clubId: string | null,
  kind: "COVER" | "LOGO",
  file: File,
): Promise<string> {
  const data = await mutate<{
    createClubMediaUploadInfo: { key: string; uploadUrl: string };
  }>(ops.CREATE_CLUB_MEDIA_UPLOAD_INFO, {
    clubId: clubId ?? null,
    kind,
    fileName: file.name,
    contentType: file.type,
  });
  const { uploadUrl } = data.createClubMediaUploadInfo;

  const token = await ensureFreshAccessToken();
  const absoluteUploadUrl = uploadUrl.startsWith("http")
    ? uploadUrl
    : `${getGatewayBaseUrl()}${uploadUrl}`;
  const res = await fetch(absoluteUploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: file,
  });
  if (!res.ok) throw new Error(`Error subiendo la imagen (${res.status}).`);
  return data.createClubMediaUploadInfo.key;
}

// ─── Mapeos wire (backend) → contrato D1 ─────────────────────────────────

export function toClub(wire: Wire): Club {
  return {
    id: wire.id,
    slug: wire.slug,
    name: wire.name,
    description: wire.description ?? "",
    rules: wire.rules ?? [],
    objectives: wire.objectives ?? [],
    category: wire.category,
    tags: wire.tags ?? [],
    coverUrl: resolveStorageUrl(wire.coverUrl),
    logoUrl: resolveStorageUrl(wire.logoUrl),
    visibility: wire.visibility,
    maxMembers: wire.maxMembers ?? null,
    status: wire.status,
    memberCount: wire.memberCount ?? 0,
    myMembership: wire.myMembership?.role ?? null,
    createdAt: wire.createdAt,
  };
}

export function toClubMember(wire: Wire): ClubMember {
  return {
    id: `${wire.clubId}:${wire.profileId}`,
    clubId: wire.clubId,
    profile: {
      id: wire.profile?.id ?? wire.profileId,
      displayName: wire.profile?.displayName ?? "Miembro",
      avatarUrl: resolveStorageUrl(wire.profile?.avatarUrl),
    },
    role: wire.role,
    status: wire.status,
    mutedUntil: wire.mutedUntil ?? null,
    joinedAt: wire.joinedAt,
  };
}

export function toClubPost(wire: Wire): ClubPost {
  return {
    id: wire.id,
    clubId: wire.clubId,
    body: wire.body,
    type: mapType(wire.type),
    visibility: (wire.clubVisibility ?? "PUBLICO").toUpperCase() as ClubPost["visibility"],
    pinned: wire.pinned ?? false,
    featured: wire.featured ?? false,
    scheduledFor: wire.scheduledFor ?? null,
    status: (wire.clubStatus ?? "PUBLICADO").toUpperCase() as ClubPost["status"],
    author: {
      id: wire.profile?.id ?? "",
      displayName: wire.profile?.displayName ?? "Desconocido",
      avatarUrl: resolveStorageUrl(wire.profile?.avatarUrl),
    },
    likes: (wire.likes ?? []).map((l: Wire) => l.profileId),
    comments: (wire.comments ?? []).map((c: Wire) => ({
      id: c.id,
      postId: wire.id,
      body: c.body,
      author: {
        id: c.profileId,
        displayName: c.profile?.displayName ?? "Miembro",
      },
      createdAt: c.createdAt,
      likes: (c.likes ?? []).map((l: Wire) => l.profileId),
    })),
    poll: wire.poll
      ? {
          id: `${wire.id}-poll`,
          question: wire.body,
          options: wire.poll.options.map((o: Wire, i: number) => ({
            id: o.id,
            text: o.text,
            position: i,
            votes: (o.votes ?? []).map((v: Wire) => v.profileId),
          })),
        }
      : null,
    createdAt: wire.createdAt,
  };
}

export function toClubEvent(wire: Wire): ClubEvent {
  return {
    id: wire.id,
    clubId: wire.clubId,
    title: wire.title,
    description: wire.description ?? "",
    type: wire.type,
    startsAt: wire.startsAt,
    endsAt: wire.endsAt,
    location: wire.location ?? null,
    meetingUrl: wire.meetingUrl ?? null,
    maxAttendees: wire.maxAttendees ?? null,
    confirmedCount: wire.confirmedCount ?? 0,
    waitlistCount: wire.waitlistCount ?? 0,
    myAttendance: wire.myAttendance?.status ?? null,
    status: wire.status,
  };
}

export function toEventAttendance(wire: Wire): EventAttendance {
  return {
    id: wire.id,
    eventId: wire.eventId,
    profile: {
      id: wire.profileId,
      displayName: "Yo",
    },
    status: wire.status,
    createdAt: wire.createdAt,
  };
}

export function toLiveSession(wire: Wire): LiveSession {
  return {
    id: wire.id,
    clubId: wire.clubId,
    eventId: wire.eventId ?? null,
    title: wire.title,
    scheduledStartAt: wire.scheduledStartAt,
    status: wire.status,
    embedUrl: resolveStorageUrl(wire.embedUrl),
    speakers: (wire.speakers ?? []).map((s: Wire) => ({
      id: s.profileId,
      displayName: s.profile?.displayName ?? "Ponente",
    })),
    chat: (wire.chatMessages ?? []).map((m: Wire) => toLiveChatMessage(m)),
  };
}

export function toLiveChatMessage(wire: Wire): LiveChatMessage {
  return {
    id: wire.id,
    sender: { id: wire.senderProfileId, displayName: "Miembro" },
    body: wire.body,
    sentAt: wire.sentAt,
  };
}

export function toClubNotification(wire: Wire): ClubNotification {
  return {
    id: wire.id,
    clubId: wire.clubId,
    type: wire.type,
    payload: wire.payload ?? "",
    readAt: wire.readAt ?? null,
    createdAt: wire.createdAt,
  };
}

export function toClubInvitation(wire: Wire): ClubInvitation {
  return {
    id: wire.id,
    clubId: wire.clubId,
    token: wire.token,
    profile: null,
    expiresAt: wire.expiresAt,
    usedAt: wire.usedAt ?? null,
  };
}

export function mapType(wireType: string | null | undefined): ClubPost["type"] {
  switch (wireType?.toUpperCase()) {
    case "IMAGEN": return "IMAGEN";
    case "VIDEO": return "VIDEO";
    case "ENCUESTA": return "ENCUESTA";
    case "ANUNCIO": return "ANUNCIO";
    default: return "TEXTO";
  }
}