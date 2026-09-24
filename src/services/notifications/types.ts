/**
 * Tipos del centro de notificaciones in-app (Fase 11, tareas 2.1–2.5).
 *
 * Contratos espejo del backend (`AppNotification` / paginado de
 * `GET /api/v1/program/notifications`). La identidad del paciente se resuelve
 * server-side desde el JWT: ningún campo lleva ids de paciente o inscripción.
 *
 * verbatimModuleSyntax: los consumidores importan estos tipos con `import type`.
 */

/** Aviso de salud in-app dirigido al paciente autenticado. */
export interface InAppNotification {
  /** Id del aviso (guid del servidor). */
  id: string;
  /** Código de dominio (`appointment_*`, `hydration_*`, `nutrition_*`, `chat_*`, `community_*`, `club_*`, …). */
  type: string;
  /** Título visible del aviso. */
  title: string;
  /** Cuerpo visible del aviso. */
  message: string;
  /** Prioridad del servidor (`low` | `normal` | `high` | `urgent`, texto libre). */
  priority: string;
  /** Canal de origen (`inapp`, `push`, …). */
  channel: string;
  /** Instante de envío (ISO-8601). */
  sentAt: string;
  /** Instante de lectura (ISO-8601) o null si sigue sin leer. */
  readAt: string | null;
}

/** Página de avisos con el conteo de no leídos del paciente. */
export interface PaginatedNotificationsResult {
  items: InAppNotification[];
  unreadCount: number;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
