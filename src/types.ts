export type Screen =
  | "home"
  | "book"
  | "hc"
  | "nut"
  | "edu"
  | "infinito"
  | "bt"
  | "chat"
  | "prof"
  | "prog"
  | "com"
  | "room";

export type Flow = "login" | "onboarding" | "tests" | "app";

export type TabId = "home" | "book" | "nut" | "chat" | "prof";

export type ToastKind = "ok" | "warn" | "err" | "info";

export interface ToastState {
  id: number;
  message: string;
  kind: ToastKind;
}

export interface UserProfile {
  id?: string;
  nombre: string;
  cedula: string;
  dob: string;
  seguro: string;
  poliza: string;
  grupo: string;
  email: string;
  celular: string;
  fam1Nombre: string;
  fam1Parentesco: string;
  fam1Cel: string;
  fam1Email: string;
  ciudad?: string;
}

/**
 * Sugerencia de acción emitida por el backend en la respuesta de chat
 * (camelCase, ASP.NET default). v1: solo "appointment".
 */
export interface ChatSuggestion {
  type: string;
  ctaText: string;
  reason?: string | null;
  urgency?: string;
}

export interface ChatMessage {
  id: string;
  role: "bot" | "user" | "alert";
  text: string;
  time: string;
  /** Thread estable al que pertenece el mensaje (proactive-<id>). */
  threadId?: string;
  /** CTA adjunto al mensaje del bot (ej. sugerencia de agendar cita). */
  cta?: ChatSuggestion | null;
}

export interface Appointment {
  id: string;
  doctor: string;
  role: string;
  when: string;
  mode: string;
  motivo: string;
  seguro: string;
  emoji: string;
  accent: string;
  status: "hoy" | "prox" | "done";
  dateLabel: string;
}

export interface MealItem {
  emoji: string;
  name: string;
  sub: string;
  macros: { c?: string; p?: string; g?: string };
}

export interface Meal {
  id: string;
  emoji: string;
  title: string;
  time: string;
  planKcal: number;
  items: MealItem[];
  carbs: number;
  protein: number;
  fat: number;
  fiber: number;
}

export interface CommunityPost {
  id: string;
  initials: string;
  name: string;
  meta: string;
  badge: string;
  badgeTone: "teal" | "blue" | "gold";
  text: string;
  likes: number;
  comments: number;
  liked: boolean;
  progress?: string;
  photo?: string;
}

export interface Friend {
  initials: string;
  name: string;
  meta: string;
  gradient: string;
}

export type ProgramTaskId =
  "podcast" | "vitals" | "nut" | "ejercicio" | "nutraceutico" | "emocional";

export type ProgramDay = Record<ProgramTaskId, boolean>;
