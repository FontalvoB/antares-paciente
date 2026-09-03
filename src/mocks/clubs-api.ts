// API mock del módulo de Clubes: misma forma que consumirá el cliente GraphQL real.
// Estado en memoria + latencia simulada. Reemplazar por urql cuando exista el backend.

import type {
  Club,
  ClubAnalytics,
  ClubEvent,
  ClubFilter,
  ClubInvitation,
  ClubMember,
  ClubNotification,
  ClubPost,
  EventAttendance,
  EventAttendanceStatus,
  LiveChatMessage,
  LiveSession,
  ModerationLogEntry,
  ModerationReport,
  ReportStatus,
} from "../graphql/clubs";
import { createSeeds, NOTIFICATION_SEEDS, REQUEST_PROFILES } from "./clubs-data";

const LATENCY_MS = 300;

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

const CURRENT_PROFILE_ID = "m-1"; // Equipo ANTARES (admin de la consola ERP)

interface Db {
  clubs: Club[];
  members: ClubMember[];
  posts: ClubPost[];
  events: ClubEvent[];
  attendances: EventAttendance[];
  lives: LiveSession[];
  analytics: Record<string, ClubAnalytics>;
  reports: ModerationReport[];
  moderationLog: ModerationLogEntry[];
  requests: { clubId: string; memberId: string; reason: string }[];
  invitations: ClubInvitation[];
  notifications: ClubNotification[];
}

function buildDb(): Db {
  const seeds = createSeeds();
  const db: Db = {
    clubs: [],
    members: [],
    posts: [],
    events: [],
    attendances: [],
    lives: [],
    analytics: {},
    reports: [],
    moderationLog: [],
    requests: [],
    invitations: [],
    notifications: clone(NOTIFICATION_SEEDS),
  };

  for (const seed of seeds) {
    const club = clone(seed.club) as Club;
    club.memberCount = seed.members.filter((m) => m.status === "ACTIVO").length;
    club.myMembership =
      seed.members.find((m) => m.id === CURRENT_PROFILE_ID)?.role ?? null;
    db.clubs.push(club);

    for (const m of seed.members) {
      db.members.push({
        id: m.id,
        clubId: club.id,
        profile: { id: m.id, displayName: m.displayName },
        role: m.role,
        status: m.status,
        mutedUntil: m.mutedUntil,
        joinedAt: m.joinedAt,
      });
    }

    for (const p of seed.posts) {
      db.posts.push({
        id: p.id,
        clubId: club.id,
        body: p.body,
        type: p.type,
        visibility: p.visibility,
        pinned: p.pinned ?? false,
        featured: p.featured ?? false,
        scheduledFor: p.scheduledFor ?? null,
        status: p.status ?? "PUBLICADO",
        author: {
          id: p.authorId,
          displayName: displayNameOf(seed, p.authorId),
        },
        likes: p.likes ?? [],
        comments: (p.comments ?? []).map((c) => ({
          id: c.id,
          postId: p.id,
          body: c.body,
          author: {
            id: c.authorId,
            displayName: displayNameOf(seed, c.authorId),
          },
          createdAt: c.createdAt,
          likes: c.likes ?? [],
        })),
        poll: p.poll
          ? {
              id: `${p.id}-poll`,
              question: p.poll.question,
              options: p.poll.options.map((o, i) => ({
                id: `${p.id}-opt-${i}`,
                text: o.text,
                position: i,
                votes: o.votes,
              })),
            }
          : null,
        createdAt: p.createdAt ?? new Date().toISOString(),
      });
    }

    for (const e of seed.events) {
      const event = clone(e) as unknown as ClubEvent;
      event.clubId = club.id;
      event.confirmedCount = e.confirmed.length;
      event.waitlistCount = e.waitlist.length;
      event.myAttendance = e.confirmed.includes(CURRENT_PROFILE_ID)
        ? "CONFIRMADO"
        : e.waitlist.includes(CURRENT_PROFILE_ID)
          ? "LISTA_ESPERA"
          : null;
      event.status = e.status;
      db.events.push(event);
      for (const pid of e.confirmed) {
        db.attendances.push({
          id: uid("att"),
          eventId: e.id,
          profile: profileOf(seed, pid),
          status: "CONFIRMADO",
          createdAt: isoNow(),
        });
      }
      for (const pid of e.waitlist) {
        db.attendances.push({
          id: uid("att"),
          eventId: e.id,
          profile: profileOf(seed, pid),
          status: "LISTA_ESPERA",
          createdAt: isoNow(),
        });
      }
    }

    for (const l of seed.lives) {
      db.lives.push({
        id: l.id,
        clubId: club.id,
        eventId: l.eventId ?? null,
        title: l.title,
        scheduledStartAt: l.scheduledStartAt,
        status: l.status,
        embedUrl: null,
        speakers: l.speakers.map((sid) => profileOf(seed, sid)),
        chat: l.chat.map((c) => ({
          id: uid("msg"),
          sender: profileOf(seed, c.senderId),
          body: c.body,
          sentAt: c.sentAt,
        })),
      });
    }

    db.analytics[club.id] = clone(seed.analytics);
    for (const r of seed.reports) db.reports.push(clone(r));
    for (const req of seed.requests)
      db.requests.push({
        clubId: club.id,
        memberId: req.memberId,
        reason: req.reason,
      });
  }

  return db;
}

type SeedClub = ReturnType<typeof createSeeds>[number];

function displayNameOf(seed: SeedClub, profileId: string): string {
  const member = seed.members.find((m) => m.id === profileId);
  if (member) return member.displayName;
  return REQUEST_PROFILES[profileId] ?? "Miembro ANTARES";
}

function profileOf(seed: SeedClub, profileId: string) {
  return { id: profileId, displayName: displayNameOf(seed, profileId) };
}

function isoNow(): string {
  return new Date().toISOString();
}

let db: Db | null = null;

function getDb(): Db {
  if (!db) db = buildDb();
  return db;
}

function clubById(id: string): Club {
  const club = getDb().clubs.find((c) => c.id === id);
  if (!club) throw new Error(`Club no encontrado: ${id}`);
  return club;
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function fetchClubs(filter: ClubFilter = {}): Promise<Club[]> {
  await delay();
  const { category, search, visibility } = filter;
  return getDb()
    .clubs.filter((c) => {
      if (category && c.category !== category) return false;
      if (visibility && c.visibility !== visibility) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay =
          `${c.name} ${c.description} ${c.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map(clone);
}

export async function fetchClub(id: string): Promise<Club> {
  await delay();
  return clone(clubById(id));
}

export async function fetchMyClubs(): Promise<Club[]> {
  await delay();
  return getDb()
    .clubs.filter((c) => c.myMembership !== null && c.status === "ACTIVO")
    .map(clone);
}

export async function fetchClubMembers(
  clubId: string,
  status?: string,
): Promise<ClubMember[]> {
  await delay();
  return getDb()
    .members.filter(
      (m) => m.clubId === clubId && (!status || m.status === status),
    )
    .map(clone);
}

export async function fetchClubRequests(
  clubId: string,
): Promise<{ memberId: string; displayName: string; reason: string }[]> {
  await delay();
  return getDb()
    .requests.filter((r) => r.clubId === clubId)
    .map((r) => ({
      memberId: r.memberId,
      displayName: REQUEST_PROFILES[r.memberId] ?? "Miembro ANTARES",
      reason: r.reason,
    }));
}

export async function fetchClubFeed(clubId: string): Promise<ClubPost[]> {
  await delay();
  return getDb()
    .posts.filter((p) => p.clubId === clubId && p.status === "PUBLICADO")
    .sort(
      (a, b) =>
        (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
        b.createdAt.localeCompare(a.createdAt),
    )
    .map(clone);
}

/** Posts públicos de todos los clubes (para el feed general de la app). */
export async function fetchPublicClubPosts(): Promise<
  { club: Club; post: ClubPost }[]
> {
  await delay();
  const d = getDb();
  return d.posts
    .filter((p) => p.status === "PUBLICADO" && p.visibility === "PUBLICO")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((post) => ({
      club: clone(d.clubs.find((c) => c.id === post.clubId)!),
      post: clone(post),
    }));
}

export async function fetchAllClubPosts(clubId: string): Promise<ClubPost[]> {
  await delay();
  return getDb()
    .posts.filter((p) => p.clubId === clubId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(clone);
}

export async function fetchClubEvents(clubId: string): Promise<ClubEvent[]> {
  await delay();
  return getDb()
    .events.filter((e) => e.clubId === clubId)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map(clone);
}

export async function fetchEventAttendees(
  eventId: string,
): Promise<EventAttendance[]> {
  await delay();
  return getDb()
    .attendances.filter((a) => a.eventId === eventId)
    .map(clone);
}

export async function fetchClubLiveSessions(
  clubId: string,
): Promise<LiveSession[]> {
  await delay();
  return getDb()
    .lives.filter((l) => l.clubId === clubId)
    .sort((a, b) => a.scheduledStartAt.localeCompare(b.scheduledStartAt))
    .map(clone);
}

export async function fetchClubAnalytics(
  clubId: string,
): Promise<ClubAnalytics> {
  await delay();
  return clone(getDb().analytics[clubId] ?? emptyAnalytics());
}

function emptyAnalytics(): ClubAnalytics {
  return {
    activeMembers: 0,
    weeklyGrowth: 0,
    engagement: 0,
    topPosts: [],
    retention: 0,
    eventParticipation: [],
  };
}

export async function fetchClubReports(
  clubId: string,
): Promise<ModerationReport[]> {
  await delay();
  return getDb()
    .reports.filter((r) => r.clubId === clubId && r.status === "PENDIENTE")
    .map(clone);
}

export async function fetchModerationLog(
  clubId: string,
): Promise<ModerationLogEntry[]> {
  await delay();
  return getDb()
    .moderationLog.filter((e) => e.clubId === clubId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(clone);
}

export async function fetchNotifications(): Promise<ClubNotification[]> {
  await delay();
  return getDb()
    .notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(clone);
}

// ── Mutations ──────────────────────────────────────────────────────────────

export async function createClub(input: {
  name: string;
  slug?: string;
  description: string;
  category: string;
  tags: string[];
  visibility: Club["visibility"];
  maxMembers: number | null;
  rules: string[];
  objectives: string[];
}): Promise<Club> {
  await delay();
  const id = uid("club");
  const club: Club = {
    id,
    slug: input.slug ?? input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name: input.name,
    description: input.description,
    rules: input.rules,
    objectives: input.objectives,
    category: input.category,
    tags: input.tags,
    coverUrl: null,
    logoUrl: null,
    visibility: input.visibility,
    maxMembers: input.maxMembers,
    status: "ACTIVO",
    memberCount: 1,
    myMembership: "ADMIN",
    createdAt: isoNow(),
  };
  getDb().clubs.unshift(club);
  getDb().members.push({
    id: CURRENT_PROFILE_ID,
    clubId: id,
    profile: { id: CURRENT_PROFILE_ID, displayName: "Equipo ANTARES" },
    role: "ADMIN",
    status: "ACTIVO",
    mutedUntil: null,
    joinedAt: isoNow(),
  });
  getDb().analytics[id] = emptyAnalytics();
  return clone(club);
}

export async function updateClub(
  id: string,
  input: Partial<Club>,
): Promise<Club> {
  await delay();
  const club = clubById(id);
  Object.assign(club, input);
  return clone(club);
}

export async function archiveClub(id: string): Promise<Club> {
  await delay();
  const club = clubById(id);
  club.status = club.status === "ACTIVO" ? "ARCHIVADO" : "ACTIVO";
  return clone(club);
}

export async function joinClubDirect(clubId: string): Promise<Club> {
  await delay();
  const club = clubById(clubId);
  const exists = getDb().members.some(
    (m) => m.clubId === clubId && m.id === CURRENT_PROFILE_ID,
  );
  if (!exists) {
    getDb().members.push({
      id: CURRENT_PROFILE_ID,
      clubId,
      profile: { id: CURRENT_PROFILE_ID, displayName: "Equipo ANTARES" },
      role: "MIEMBRO",
      status: "ACTIVO",
      mutedUntil: null,
      joinedAt: isoNow(),
    });
    club.memberCount += 1;
  }
  club.myMembership = "MIEMBRO";
  return clone(club);
}

export async function joinWithInvitation(clubId: string): Promise<Club> {
  return joinClubDirect(clubId);
}

export async function requestMembership(clubId: string): Promise<boolean> {
  await delay();
  const d = getDb();
  const already = d.requests.some(
    (r) => r.clubId === clubId && r.memberId === CURRENT_PROFILE_ID,
  );
  if (!already) {
    d.requests.push({
      clubId,
      memberId: CURRENT_PROFILE_ID,
      reason: "Solicitud desde la app",
    });
  }
  return true;
}

export async function leaveClub(clubId: string): Promise<boolean> {
  await delay();
  const d = getDb();
  const index = d.members.findIndex(
    (m) => m.clubId === clubId && m.id === CURRENT_PROFILE_ID,
  );
  if (index >= 0) {
    d.members.splice(index, 1);
    clubById(clubId).memberCount = Math.max(
      0,
      clubById(clubId).memberCount - 1,
    );
  }
  clubById(clubId).myMembership = null;
  return true;
}

export async function toggleClubPostLike(
  clubId: string,
  postId: string,
): Promise<ClubPost> {
  await delay();
  const d = getDb();
  const post = d.posts.find((p) => p.id === postId && p.clubId === clubId);
  if (!post) throw new Error("Publicación no encontrada");
  const index = post.likes.indexOf(CURRENT_PROFILE_ID);
  if (index >= 0) post.likes.splice(index, 1);
  else post.likes.push(CURRENT_PROFILE_ID);
  return clone(post);
}

export async function addClubComment(
  clubId: string,
  postId: string,
  body: string,
): Promise<ClubPost> {
  await delay();
  const d = getDb();
  const post = d.posts.find((p) => p.id === postId && p.clubId === clubId);
  if (!post) throw new Error("Publicación no encontrada");
  post.comments.push({
    id: uid("c"),
    postId,
    body,
    author: { id: CURRENT_PROFILE_ID, displayName: "Equipo ANTARES" },
    createdAt: isoNow(),
    likes: [],
  });
  return clone(post);
}

export async function voteClubPoll(
  clubId: string,
  pollOptionId: string,
): Promise<ClubPost> {
  await delay();
  const d = getDb();
  const post = d.posts.find(
    (p) =>
      p.clubId === clubId && p.poll?.options.some((o) => o.id === pollOptionId),
  );
  if (!post || !post.poll) throw new Error("Encuesta no encontrada");
  for (const option of post.poll.options) {
    const index = option.votes.indexOf(CURRENT_PROFILE_ID);
    if (index >= 0) option.votes.splice(index, 1);
  }
  const target = post.poll.options.find((o) => o.id === pollOptionId);
  if (target) target.votes.push(CURRENT_PROFILE_ID);
  return clone(post);
}

export async function approveMembership(
  clubId: string,
  profileId: string,
  role: ClubMember["role"] = "MIEMBRO",
): Promise<ClubMember> {
  await delay();
  const d = getDb();
  const requestIndex = d.requests.findIndex(
    (r) => r.clubId === clubId && r.memberId === profileId,
  );
  if (requestIndex >= 0) d.requests.splice(requestIndex, 1);
  let member = d.members.find((m) => m.clubId === clubId && m.id === profileId);
  if (!member) {
    member = {
      id: profileId,
      clubId,
      profile: {
        id: profileId,
        displayName: REQUEST_PROFILES[profileId] ?? "Miembro ANTARES",
      },
      role,
      status: "ACTIVO",
      mutedUntil: null,
      joinedAt: isoNow(),
    };
    d.members.push(member);
  } else {
    member.status = "ACTIVO";
    member.role = role;
  }
  clubById(clubId).memberCount += 1;
  log(clubId, "Solicitud aprobada", profileId, "Ingreso al club");
  return clone(member);
}

export async function rejectMembership(
  clubId: string,
  profileId: string,
): Promise<boolean> {
  await delay();
  const d = getDb();
  const index = d.requests.findIndex(
    (r) => r.clubId === clubId && r.memberId === profileId,
  );
  if (index >= 0) d.requests.splice(index, 1);
  log(
    clubId,
    "Solicitud rechazada",
    profileId,
    "Rechazado por el administrador",
  );
  return true;
}

export async function expelMember(
  clubId: string,
  profileId: string,
): Promise<boolean> {
  await delay();
  const d = getDb();
  const index = d.members.findIndex(
    (m) => m.clubId === clubId && m.id === profileId,
  );
  if (index >= 0) d.members.splice(index, 1);
  clubById(clubId).memberCount = Math.max(0, clubById(clubId).memberCount - 1);
  log(clubId, "Miembro expulsado", profileId, "Expulsado por el administrador");
  return true;
}

export async function muteMember(
  clubId: string,
  profileId: string,
  until: string,
): Promise<ClubMember> {
  await delay();
  const member = getDb().members.find(
    (m) => m.clubId === clubId && m.id === profileId,
  );
  if (!member) throw new Error("Miembro no encontrado");
  member.status = "SILENCIADO";
  member.mutedUntil = until;
  log(
    clubId,
    "Miembro silenciado",
    profileId,
    `Silenciado hasta ${new Date(until).toLocaleDateString()}`,
  );
  return clone(member);
}

export async function unmuteMember(
  clubId: string,
  profileId: string,
): Promise<ClubMember> {
  await delay();
  const member = getDb().members.find(
    (m) => m.clubId === clubId && m.id === profileId,
  );
  if (!member) throw new Error("Miembro no encontrado");
  member.status = "ACTIVO";
  member.mutedUntil = null;
  return clone(member);
}

export async function changeMemberRole(
  clubId: string,
  profileId: string,
  role: ClubMember["role"],
): Promise<ClubMember> {
  await delay();
  const member = getDb().members.find(
    (m) => m.clubId === clubId && m.id === profileId,
  );
  if (!member) throw new Error("Miembro no encontrado");
  member.role = role;
  return clone(member);
}

export async function createClubPost(
  clubId: string,
  input: {
    body: string;
    type: ClubPost["type"];
    visibility: ClubPost["visibility"];
    pinned?: boolean;
    featured?: boolean;
    scheduledFor?: string | null;
    draft?: boolean;
    poll?: { question: string; options: string[] };
  },
): Promise<ClubPost> {
  await delay();
  const status = input.draft
    ? "BORRADOR"
    : input.scheduledFor
      ? "PROGRAMADO"
      : "PUBLICADO";
  const post: ClubPost = {
    id: uid("post"),
    clubId,
    body: input.body,
    type: input.type,
    visibility: input.visibility,
    pinned: input.pinned ?? false,
    featured: input.featured ?? false,
    scheduledFor: input.scheduledFor ?? null,
    status,
    author: { id: CURRENT_PROFILE_ID, displayName: "Equipo ANTARES" },
    likes: [],
    comments: [],
    poll: input.poll
      ? {
          id: uid("poll"),
          question: input.poll.question,
          options: input.poll.options.map((text, i) => ({
            id: uid("opt"),
            text,
            position: i,
            votes: [],
          })),
        }
      : null,
    createdAt: isoNow(),
  };
  getDb().posts.unshift(post);
  return clone(post);
}

export async function updateClubPost(
  id: string,
  input: Partial<ClubPost>,
): Promise<ClubPost> {
  await delay();
  const post = getDb().posts.find((p) => p.id === id);
  if (!post) throw new Error("Publicación no encontrada");
  Object.assign(post, input);
  return clone(post);
}

export async function publishScheduledPost(id: string): Promise<ClubPost> {
  await delay();
  const post = getDb().posts.find((p) => p.id === id);
  if (!post) throw new Error("Publicación no encontrada");
  post.status = "PUBLICADO";
  post.scheduledFor = null;
  return clone(post);
}

export async function deleteClubPost(id: string): Promise<boolean> {
  await delay();
  const d = getDb();
  const index = d.posts.findIndex((p) => p.id === id);
  if (index >= 0) d.posts.splice(index, 1);
  return true;
}

export async function createClubEvent(
  clubId: string,
  input: {
    title: string;
    description: string;
    type: ClubEvent["type"];
    startsAt: string;
    endsAt: string;
    location?: string | null;
    meetingUrl?: string | null;
    maxAttendees: number | null;
  },
): Promise<ClubEvent> {
  await delay();
  const event: ClubEvent = {
    id: uid("ev"),
    clubId,
    title: input.title,
    description: input.description,
    type: input.type,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    location: input.location ?? null,
    meetingUrl: input.meetingUrl ?? null,
    maxAttendees: input.maxAttendees,
    confirmedCount: 0,
    waitlistCount: 0,
    myAttendance: null,
    status: "ABIERTO",
  };
  getDb().events.push(event);
  getDb().notifications.unshift({
    id: uid("n"),
    clubId,
    type: "NUEVO_EVENTO",
    payload: `Nuevo evento: ${input.title}`,
    readAt: null,
    createdAt: isoNow(),
  });
  return clone(event);
}

export async function confirmAttendance(
  eventId: string,
): Promise<EventAttendance> {
  await delay();
  const d = getDb();
  const event = d.events.find((e) => e.id === eventId);
  if (!event) throw new Error("Evento no encontrado");
  const existing = d.attendances.find(
    (a) => a.eventId === eventId && a.id === CURRENT_PROFILE_ID,
  );
  const isFull =
    event.maxAttendees !== null && event.confirmedCount >= event.maxAttendees;
  const status: EventAttendanceStatus = isFull ? "LISTA_ESPERA" : "CONFIRMADO";
  if (existing) {
    existing.status = status;
  } else {
    d.attendances.push({
      id: uid("att"),
      eventId,
      profile: { id: CURRENT_PROFILE_ID, displayName: "Equipo ANTARES" },
      status,
      createdAt: isoNow(),
    });
  }
  if (status === "CONFIRMADO") {
    event.confirmedCount += 1;
    if (
      event.maxAttendees !== null &&
      event.confirmedCount >= event.maxAttendees
    )
      event.status = "LLENO";
  } else {
    event.waitlistCount += 1;
  }
  event.myAttendance = status;
  return clone(
    d.attendances.find(
      (a) => a.eventId === eventId && a.id === CURRENT_PROFILE_ID,
    )!,
  );
}

export async function joinWaitlist(eventId: string): Promise<EventAttendance> {
  await delay();
  const d = getDb();
  const event = d.events.find((e) => e.id === eventId);
  if (!event) throw new Error("Evento no encontrado");
  let attendance = d.attendances.find(
    (a) => a.eventId === eventId && a.id === CURRENT_PROFILE_ID,
  );
  if (!attendance) {
    attendance = {
      id: uid("att"),
      eventId,
      profile: { id: CURRENT_PROFILE_ID, displayName: "Equipo ANTARES" },
      status: "LISTA_ESPERA",
      createdAt: isoNow(),
    };
    d.attendances.push(attendance);
    event.waitlistCount += 1;
  } else {
    attendance.status = "LISTA_ESPERA";
  }
  event.myAttendance = "LISTA_ESPERA";
  return clone(attendance);
}

export async function checkIn(eventId: string): Promise<EventAttendance> {
  await delay();
  const d = getDb();
  const attendance = d.attendances.find(
    (a) => a.eventId === eventId && a.id === CURRENT_PROFILE_ID,
  );
  const event = d.events.find((e) => e.id === eventId);
  if (!attendance) throw new Error("Debes confirmar asistencia primero");
  attendance.status = "CHECKIN";
  event!.myAttendance = "CHECKIN";
  return clone(attendance);
}

export async function scheduleLive(
  clubId: string,
  input: {
    title: string;
    scheduledStartAt: string;
    speakers: string[];
    eventId?: string | null;
  },
): Promise<LiveSession> {
  await delay();
  const live: LiveSession = {
    id: uid("lv"),
    clubId,
    eventId: input.eventId ?? null,
    title: input.title,
    scheduledStartAt: input.scheduledStartAt,
    status: "PROGRAMADO",
    embedUrl: null,
    speakers: input.speakers.map((id) => ({
      id,
      displayName: nameOfProfile(id),
    })),
    chat: [],
  };
  getDb().lives.push(live);
  getDb().notifications.unshift({
    id: uid("n"),
    clubId,
    type: "LIVE_PROGRAMADO",
    payload: `Live programado: ${input.title}`,
    readAt: null,
    createdAt: isoNow(),
  });
  return clone(live);
}

function nameOfProfile(profileId: string): string {
  const member = getDb().members.find((m) => m.id === profileId);
  return (
    member?.profile.displayName ??
    REQUEST_PROFILES[profileId] ??
    "Ponente ANTARES"
  );
}

export async function sendLiveChatMessage(
  liveId: string,
  body: string,
): Promise<LiveChatMessage> {
  await delay();
  const live = getDb().lives.find((l) => l.id === liveId);
  if (!live) throw new Error("Live no encontrado");
  const message: LiveChatMessage = {
    id: uid("msg"),
    sender: { id: CURRENT_PROFILE_ID, displayName: "Equipo ANTARES" },
    body,
    sentAt: isoNow(),
  };
  live.chat.push(message);
  return clone(message);
}

export async function resolveReport(
  reportId: string,
  action: "RESUELTO" | "IGNORADO",
): Promise<boolean> {
  await delay();
  const d = getDb();
  const report = d.reports.find((r) => r.id === reportId);
  if (!report) throw new Error("Reporte no encontrado");
  report.status = action;
  report.resolution =
    action === "RESUELTO" ? "Contenido eliminado" : "Sin acción";
  if (action === "RESUELTO") {
    const postIndex = d.posts.findIndex((p) => p.id === report.targetId);
    if (postIndex >= 0) d.posts.splice(postIndex, 1);
  }
  log(
    report.clubId,
    action === "RESUELTO" ? "Reporte resuelto" : "Reporte ignorado",
    report.reportedBy.id,
    report.reason,
  );
  return true;
}

export async function createInvitation(
  clubId: string,
  expiresAt: string,
): Promise<ClubInvitation> {
  await delay();
  const invitation: ClubInvitation = {
    id: uid("inv"),
    clubId,
    token: Math.random().toString(36).slice(2, 10).toUpperCase(),
    profile: null,
    expiresAt,
    usedAt: null,
  };
  getDb().invitations.push(invitation);
  return clone(invitation);
}

export async function markNotificationRead(id: string): Promise<boolean> {
  await delay();
  const notification = getDb().notifications.find((n) => n.id === id);
  if (notification) notification.readAt = isoNow();
  return true;
}

function log(
  clubId: string,
  action: string,
  targetProfileId: string | null,
  reason: string,
): void {
  const d = getDb();
  const target = targetProfileId
    ? (d.members.find((m) => m.clubId === clubId && m.id === targetProfileId)
        ?.profile ?? {
        id: targetProfileId,
        displayName: nameOfProfile(targetProfileId),
      })
    : null;
  d.moderationLog.unshift({
    id: uid("log"),
    clubId,
    action,
    actor: { id: CURRENT_PROFILE_ID, displayName: "Equipo ANTARES" },
    target,
    reason,
    createdAt: isoNow(),
  });
}

export type { ReportStatus };
