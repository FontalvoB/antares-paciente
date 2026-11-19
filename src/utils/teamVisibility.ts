/**
 * Visibilidad del equipo profesional en el Perfil (KAN-96).
 *
 * Decisión de producto: mientras el equipo clínico no esté habilitado para la
 * app, la sección "Equipo Copp Adresd" muestra SOLO a Vita. Los profesionales
 * siguen implementados y se reactivan por configuración de build
 * (`VITE_TEAM_PROFESSIONALS_ENABLED=true`) sin tocar la UI.
 *
 * Mismo patrón que `APPOINTMENTS_ENABLED`: constante de producto leída en
 * build-time; nunca se decide en runtime con datos del paciente.
 */
export const TEAM_PROFESSIONALS_ENABLED =
  import.meta.env.VITE_TEAM_PROFESSIONALS_ENABLED === "true";
