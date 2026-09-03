// Tipos del módulo de Clubes (contrato congelado D1 del change clubes-comunidades).
// Espejo literal entre coppaddresd-front (features/community/clubs/types.ts) y
// antares-paciente (src/graphql/clubs.ts). El backend implementará este contrato.

export type ClubVisibility = "PUBLICO" | "PRIVADO" | "INVITACION";
export type ClubStatus = "ACTIVO" | "ARCHIVADO";
export type ClubMemberRole = "ADMIN" | "MODERADOR" | "MIEMBRO";
export type ClubMemberStatus =
  "ACTIVO" | "PENDIENTE" | "EXPULSADO" | "SILENCIADO";
export type PostVisibility = "PUBLICO" | "PRIVADO";
export type ClubPostType =
  "TEXTO" | "IMAGEN" | "VIDEO" | "ENCUESTA" | "ANUNCIO";
export type ClubPostStatus = "BORRADOR" | "PROGRAMADO" | "PUBLICADO";
export type EventType = "PRESENCIAL" | "VIRTUAL";
export type EventAttendanceStatus =
  "CONFIRMADO" | "LISTA_ESPERA" | "CHECKIN" | "CANCELADO";
export type LiveSessionStatus =
  "PROGRAMADO" | "ACTIVO" | "FINALIZADO" | "CANCELADO";
export type ReportStatus = "PENDIENTE" | "RESUELTO" | "IGNORADO";
export type ReportTargetType = "POST" | "COMENTARIO";

export interface ClubProfile {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface Club {
  id: string;
  slug: string;
  name: string;
  description: string;
  rules: string[];
  objectives: string[];
  category: string;
  tags: string[];
  coverUrl: string | null;
  logoUrl: string | null;
  visibility: ClubVisibility;
  maxMembers: number | null;
  status: ClubStatus;
  memberCount: number;
  myMembership: ClubMemberRole | null;
  createdAt: string;
}

export interface ClubMember {
  id: string;
  clubId: string;
  profile: ClubProfile;
  role: ClubMemberRole;
  status: ClubMemberStatus;
  mutedUntil: string | null;
  joinedAt: string;
}

export interface ClubInvitation {
  id: string;
  clubId: string;
  token: string;
  profile: ClubProfile | null;
  expiresAt: string;
  usedAt: string | null;
}

export interface ClubPollOption {
  id: string;
  text: string;
  position: number;
  votes: string[]; // ids de perfiles que votaron
}

export interface ClubPoll {
  id: string;
  question: string;
  options: ClubPollOption[];
}

export interface ClubComment {
  id: string;
  postId: string;
  body: string;
  author: ClubProfile;
  createdAt: string;
  likes: string[]; // ids de perfiles
}

export interface ClubPost {
  id: string;
  clubId: string;
  body: string;
  type: ClubPostType;
  visibility: PostVisibility;
  pinned: boolean;
  featured: boolean;
  scheduledFor: string | null;
  status: ClubPostStatus;
  author: ClubProfile;
  likes: string[];
  comments: ClubComment[];
  poll: ClubPoll | null;
  createdAt: string;
}

export interface ClubEvent {
  id: string;
  clubId: string;
  title: string;
  description: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  location: string | null;
  meetingUrl: string | null;
  maxAttendees: number | null;
  confirmedCount: number;
  waitlistCount: number;
  myAttendance: EventAttendanceStatus | null;
  status: "ABIERTO" | "LLENO" | "FINALIZADO" | "CANCELADO";
}

export interface EventAttendance {
  id: string;
  eventId: string;
  profile: ClubProfile;
  status: EventAttendanceStatus;
  createdAt: string;
}

export interface LiveChatMessage {
  id: string;
  sender: ClubProfile;
  body: string;
  sentAt: string;
}

export interface LiveSession {
  id: string;
  clubId: string;
  eventId: string | null;
  title: string;
  scheduledStartAt: string;
  status: LiveSessionStatus;
  embedUrl: string | null;
  speakers: ClubProfile[];
  chat: LiveChatMessage[];
}

export interface ClubAnalytics {
  activeMembers: number;
  weeklyGrowth: number; // %
  engagement: number; // % de miembros que interactúan semanal
  topPosts: {
    postId: string;
    title: string;
    likes: number;
    comments: number;
  }[];
  retention: number; // % de miembros que siguen tras 30 días
  eventParticipation: { eventId: string; title: string; confirmed: number }[];
}

export interface ModerationReport {
  id: string;
  clubId: string;
  targetType: ReportTargetType;
  targetId: string;
  targetPreview: string;
  reason: string;
  details: string | null;
  createdAt: string;
  reportedBy: ClubProfile;
  status: ReportStatus;
  resolution: string | null;
}

export interface ModerationLogEntry {
  id: string;
  clubId: string;
  action: string;
  actor: ClubProfile;
  target: ClubProfile | null;
  reason: string;
  createdAt: string;
}

export interface ClubNotification {
  id: string;
  clubId: string;
  type:
    | "SOLICITUD_APROBADA"
    | "INVITACION"
    | "NUEVO_EVENTO"
    | "LIVE_PROGRAMADO"
    | "RECORDATORIO_EVENTO";
  payload: string;
  readAt: string | null;
  createdAt: string;
}

export interface ClubFilter {
  category?: string | null;
  search?: string | null;
  visibility?: ClubVisibility | null;
}
