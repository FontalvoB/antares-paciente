import { APPOINTMENTS_ENABLED } from "../utils/appointmentsVisibility";
import { CHAT_UNAVAILABLE_MESSAGE } from "../services/chat/chat-service";
import { isConfirmedText, mergeChatHistory } from "../utils/chatHistory";
import type { HistoryMessage } from "../utils/chatHistory";
import { upsertVoiceMessage as mergeVoiceMessage } from "../utils/voiceMessages";
import { App } from "@capacitor/app";
import { resetSessionQueryCache } from "../utils/queryClient";
import { sessionUserId } from "../utils/sessionIdentity";
import { queueVitaWelcome } from "../utils/vitaWelcome";
import { Capacitor } from "@capacitor/core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getAccessToken,
  getMe,
  isAccessTokenExpired,
  logoutUser,
  onSessionInvalid,
  restoreSession,
} from "../utils/authApi";
import {
  fetchMyPatientProfile,
  toUserProfile,
} from "../utils/patientProfileApi";
import { refreshAccessToken } from "../utils/apiClient";
import {
  isLegalConsentError,
  legalConsentMessage,
  requireLegalConsent,
  resetLegalConsentSession,
} from "../utils/legalConsents";
import { unregisterPushDevice } from "../utils/pushNotifications";
import {
  fetchThreadState,
  clearThreadMessages,
  streamChatMessage,
} from "../utils/threadApi";
import type { ThreadState } from "../utils/threadApi";
import { sendChatMessage as sendAttachmentChat } from "../services/chat/chat-service";
import type { PendingVitaAttachment } from "../services/chat/vita-attachments-service";
import {
  cancelAppointment as cancelAppointmentApi,
  createRequest,
  fetchMyAppointments,
  fetchMyContext,
  fetchMyRequests,
  fetchProfessionalsCatalog,
  fetchSpecialties,
  hasRealSession,
  rescheduleAppointment as rescheduleAppointmentApi,
  type AppointmentDto,
  type AppointmentRequestDto,
  type ProfessionalCatalogItem,
  type SpecialtyDto,
} from "../utils/appointmentsApi";
import {
  buildRealAppointments,
  realProfessionalByType,
  realTeamFromCatalog,
  type ListedAppointment,
  type TeamProfessional,
} from "../data/appointments";
import { useI18n, useT } from "../i18n/I18nContext";
import type {
  ChatImageAttachment,
  ChatMessage,
  ChatSuggestion,
  Flow,
  ProgramDay,
  ProgramTaskId,
  Screen,
  NavigationTarget,
  ToastKind,
  ToastState,
  UserProfile,
} from "../types";
import { weekdayMondayIndex } from "../utils/dates";
import {
  ACTIVE_PROGRAM_TASKS,
  DAY_BONUS_PTS,
  isComingSoonTask,
} from "../data/program";
import type { MedicalSourceSectionId } from "../data/medicalSources";

/** Baseline por usuario del conteo de mensajes ya vistos del chat. */
const CHAT_LAST_SEEN_PREFIX = "antares:chat-last-seen:";

interface AppState {
  vitaWelcomePending: boolean;
  dismissVitaWelcome: () => void;
  authLoading: boolean;
  flow: Flow;
  screen: Screen;
  medicalSourcesEntry: {
    section?: MedicalSourceSectionId;
    returnTo: Screen;
  } | null;
  healthReturnTo: "home" | "prof";
  toast: ToastState | null;
  panicOpen: boolean;
  /** Entrada del SOS: cuenta regresiva de 5 s (por defecto) o protocolo directo. */
  panicEntry: "countdown" | "protocol";
  voiceOpen: boolean;
  voiceMinimized: boolean;
  minimizeVoice: () => void;
  upsertVoiceMessage: (message: ChatMessage) => void;
  markVoiceSessionClosed: (sessionId: string, threadId: string) => void;
  registerVoiceSession: (sessionId: string, threadId: string) => void;
  chatHistoryRevision: number;
  chatHistoryEpoch: number;
  chatClearing: boolean;
  clearChat: () => Promise<void>;
  captureChatGuard: () => () => boolean;
  observeChatHistory: (state: ThreadState) => "current" | "reset" | "stale";
  registerVoiceStop: (stop: () => Promise<void>) => () => void;
  refreshChatHistory: (threadId: string) => void;
  chatGenerating: boolean;
  cancelChat: () => void;
  retryChat: () => void;
  sosActive: boolean;
  user: UserProfile;
  testsDone: number[];
  chat: ChatMessage[];
  threadId: string;
  setActiveThreadId: (id: string | null) => void;
  wearableConnected: boolean;
  wearableName: string;
  program: ProgramDay;
  programWeek: number;
  streak: number;
  weekCheckins: boolean[];
  pointsToday: number;
  pointsTotal: number;
  navigate: (
    s: NavigationTarget,
    sourceSection?: MedicalSourceSectionId,
  ) => void;
  /** Compatibilidad con Citas y Chat retirados en KAN-146. */
  openBookingWizard: () => void;
  /** Consumido por AppointmentsPage: true = abrir el wizard al montar. */
  bookingWizardAutoOpen: boolean;
  /** Limpia el flag one-shot de auto-apertura del wizard. */
  clearBookingWizardAutoOpen: () => void;
  finishLogin: (seed?: Partial<UserProfile>, next?: Flow) => void;
  backToLogin: () => void;
  finishOnboarding: (user: UserProfile) => void;
  /**
   * Cierra el onboarding de Agentic Wellness (KAN-136): guarda el perfil y
   * entra directo al Home nuevo, sin la bateria de tests del programa viejo.
   */
  finishWellnessOnboarding: (user: UserProfile) => void;
  /**
   * Re-hidrata el user del contexto desde `/me/patient-profile`
   * (best-effort): lo usa el editor de contacto de emergencia tras guardar.
   */
  refreshPatientProfile: () => Promise<void>;
  finishTests: () => void;
  skipTests: () => void;
  openTests: () => void;
  markTest: (id: number) => void;
  showToast: (message: string, kind?: ToastKind) => void;
  openPanic: () => void;
  closePanic: () => void;
  activateSos: () => void;
  openVoice: () => void;
  closeVoice: () => void;
  sendChat: (
    text: string,
    image?: ChatImageAttachment,
    attachments?: PendingVitaAttachment[],
  ) => void;
  /**
   * Turno de chat para el agente de voz (agente-asistente-citas D4): mismo
   * pipeline que `sendChat` (streaming + fallbacks + persistencia en la
   * lista) pero retornando el mensaje final del bot para vocalizarlo.
   * `null` = el asistente no respondió (la UI de voz lo comunica).
   */
  sendVoiceMessage: (
    text: string,
    image?: ChatImageAttachment,
  ) => Promise<ChatMessage | null>;
  /** Hay mensajes del bot sin ver en el thread (dot en la tab Chat). */
  chatUnread: boolean;
  /** Marca el chat como leído: persiste el conteo remoto actual y apaga el dot. */
  markChatRead: () => void;
  hydrateChat: (messages: HistoryMessage[]) => void;
  /** Captura IDs/propietario/hilo/generación ANTES del GET; devuelve false si ya quedó obsoleto. */
  captureHistoryHydrator: () => (
    messages: HistoryMessage[],
    authoritativeText?: boolean,
  ) => boolean;
  /**
   * Antepone una página de historial ANTERIOR sin deduplicar por texto: un
   * mensaje repetido entre tramos es legítimo (p. ej. dos quick-replies
   * iguales) y no debe perderse.
   */
  prependChatMessages: (messages: HistoryMessage[]) => void;
  appendChatMessages: (
    messages: Array<{
      role: "bot" | "user" | "alert";
      text: string;
      cta?: ChatSuggestion | null;
      kind?: ChatMessage["kind"];
      executionId?: string;
    }>,
  ) => void;
  connectWearable: (name: string) => void;
  disconnectWearable: () => void;
  completeStep: (id: ProgramTaskId, pts: number) => void;
  logout: () => void;
  // ── Citas/telemedicina reales (modo sesión) ──
  /** Modo real: hay sesión JWT (los datos de citas vienen del backend). */
  realMode: boolean;
  /** Próximas citas + solicitudes pendientes (null = demo). */
  upcomingAppointments: ListedAppointment[] | null;
  /** Citas anteriores (completadas/canceladas) (null = demo). */
  pastAppointments: ListedAppointment[] | null;
  appointmentsLoading: boolean;
  appointmentsError: string | null;
  /** Profesional real del catálogo para el tipo de consulta (o el mock). */
  teamProfessional: (typeId: string) => TeamProfessional;
  /**
   * Equipo REAL del catálogo (un activo por rol disponible, sin duplicados).
   * null = catálogo no disponible (demo/sin sesión); [] = sin profesionales
   * activos. Nunca contiene nombres inventados.
   */
  teamProfessionals: TeamProfessional[] | null;
  /**
   * Catálogo de especialidades del ERP (`erp.specialties`, null = aún no
   * cargado). Fuente del Paso 1 del wizard en modo real.
   */
  specialties: SpecialtyDto[] | null;
  /** Catálogo crudo de profesionales (null = aún no cargado). */
  professionalsCatalog: ProfessionalCatalogItem[] | null;
  /**
   * Contexto asistencial del paciente (ids para disponibilidad/solicitudes,
   * null = aún no cargado). `orgId` vacío = backend sin organización
   * resuelta (el modo especialidad lo exige: el wizard lo comunica).
   */
  patientCareContext: {
    patientId: string | null;
    orgId: string;
    clinicId: string | null;
    locationId: string | null;
  } | null;
  refreshAppointments: () => Promise<void>;
  /** Envía la solicitud contra el backend (modo real). Devuelve éxito. */
  submitAppointmentRequest: (input: {
    /** Ruta legacy por tipo mock (demo/compatibilidad). */
    typeId?: string;
    /** Ruta por catálogo: especialidad elegida (veredicto D1). */
    specialtyId?: string;
    /**
     * Profesional elegido por id exacto; `null` = "cualquier profesional
     * disponible" (solicitud sin asignar, la gestiona el ERP). En la ruta
     * legacy se ignora (se resolvía por regex, pendiente de retirar).
     */
    professionalId?: string | null;
    date: string;
    time: string;
    /**
     * Inicio exacto en ISO (start de un slot disponible). Si se provee, se
     * envía tal cual como `preferred_start` (2.A.4); si no, se reconstruye
     * desde `date`+`time` (legado).
     */
    preferredStart?: string;
    reason: string;
    mode: string;
    /** "Urgent" = entrada directa Urgencia (prioridad de triage del staff). */
    priority?: "Normal" | "Urgent";
  }) => Promise<boolean>;
  /** Cancela una cita real. Devuelve éxito. */
  cancelAppointmentById: (id: string, reason: string) => Promise<boolean>;
  /**
   * Reprograma una cita confirmada al inicio indicado (ISO de un slot
   * disponible). El 409 del backend (límite, anticipación, conflicto) vuelve
   * como mensaje presentable. 2.A.5.
   */
  rescheduleAppointmentById: (
    id: string,
    input: { newStart: string; reason?: string | null },
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Abre la sala virtual de una cita. */
  openRoom: (appointment: ListedAppointment) => void;
  closeRoom: () => void;
  roomAppointment: ListedAppointment | null;
}

// No sembrar una identidad ficticia mientras llega el perfil real.
const defaultUser: UserProfile = {
  nombre: "",
  cedula: "",
  dob: "",
  seguro: "",
  poliza: "",
  grupo: "",
  email: "",
  celular: "",
  fam1Nombre: "",
  fam1Parentesco: "",
  fam1Cel: "",
  fam1Email: "",
};

function createWelcomeMessage(
  name = "",
  lang: "es" | "en" = "es",
): ChatMessage {
  const firstName = name.trim().split(" ")[0];
  return {
    id: "welcome",
    role: "bot",
    // Saludo en el idioma de la app: el asistente arranca hablando el idioma
    // que el paciente tiene seleccionado (consistencia con chat/voz).
    text:
      lang === "en"
        ? `Hi${firstName ? ` ${firstName}` : ""} 👋 I'm your Copp Adresd health agent. How can I help you today?`
        : `Hola${firstName ? ` ${firstName}` : ""} 👋 Soy tu agente de salud Copp Adresd. ¿En qué te puedo ayudar hoy?`,
    time: nowLabel(lang),
  };
}

const AppContext = createContext<AppState | null>(null);

function nowLabel(lang: "es" | "en" = "es") {
  return new Date().toLocaleTimeString(lang === "en" ? "en-US" : "es-ES", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AppProvider({
  children,
  onResetSessionCache,
}: {
  children: ReactNode;
  /** Se invoca tras login/logout para recrear el cliente urql de la comunidad. */
  onResetSessionCache?: () => void;
}) {
  const [vitaWelcomePending, setVitaWelcomePending] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const t = useT();
  // Idioma actual de la app: se envía en cada turno de chat (señal explícita
  // para el AI Service — habilita cambiar de idioma a mitad de conversación).
  const { lang } = useI18n();
  const currentLanguage = useRef(lang);
  currentLanguage.current = lang;
  const appointmentRequest = useRef(0);
  const catalogLanguage = useRef(lang);
  const [flow, setFlow] = useState<Flow>("login");
  const [screen, setScreen] = useState<Screen>("home");
  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = useCallback((message: string, kind: ToastKind = "ok") => {
    setToast({ id: Date.now(), message, kind });
    window.setTimeout(() => setToast(null), 2600);
  }, []);
  const [panicOpen, setPanicOpen] = useState(false);
  const [panicEntry, setPanicEntry] = useState<"countdown" | "protocol">(
    "countdown",
  );
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceMinimized, setVoiceMinimized] = useState(false);
  const [chatGenerating, setChatGenerating] = useState(false);
  const chatController = useRef<AbortController | null>(null);
  const chatTurnGeneration = useRef(0);
  const retryTurn = useRef<{
    text: string;
    image?: ChatImageAttachment;
    attachments?: PendingVitaAttachment[];
    userId: string;
    botId: string;
  } | null>(null);
  const [chatHistoryRevision, setChatHistoryRevision] = useState(0);
  const [chatClearing, setChatClearing] = useState(false);
  const historyGeneration = useRef(0);
  const clearingHistory = useRef(false);
  const clearController = useRef<AbortController | null>(null);
  const remoteHistoryRevisions = useRef(new Map<string, number>());
  const voiceStop = useRef<(() => Promise<void>) | null>(null);
  const voiceSessions = useRef(
    new Map<string, { threadId: string; closed: boolean }>(),
  );
  const [sosActive, setSosActive] = useState(false);
  const [user, setUser] = useState<UserProfile>(defaultUser);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [testsDone, setTestsDone] = useState<number[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>(() => [
    createWelcomeMessage(defaultUser.nombre, lang),
  ]);
  const [wearableConnected, setWatchConnected] = useState(false);
  const [wearableName, setWatchName] = useState("Copp Adresd Wearable");
  // TODO: Remove after full migration — legacy in-memory program state
  const [program, setProgram] = useState<ProgramDay>({
    podcast: false,
    vitals: false,
    nut: false,
    ejercicio: false,
    nutraceutico: false,
    emocional: false,
  });
  // TODO: Remove after full migration
  const [programWeek] = useState(0);
  // TODO: Remove after full migration
  const [streak, setStreak] = useState(0);
  // TODO: Remove after full migration
  const [weekCheckins, setWeekCheckins] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]);
  // TODO: Remove after full migration
  const [pointsToday, setPointsToday] = useState(0);
  // TODO: Remove after full migration
  // Inicia en 0 (honesto): el hero del Perfil prefiere snapshot.xp.balance;
  // los incrementos locales de completeStep son continuidad demo tras la
  // confirmación del servidor. El 4820 hardcodeado mostraba XP fabricado.
  const [pointsTotal, setPointsTotal] = useState(0);

  const [catalog, setCatalog] = useState<ProfessionalCatalogItem[] | null>(
    null,
  );
  const [specialties, setSpecialties] = useState<SpecialtyDto[] | null>(null);
  const [patientCtx, setPatientCtx] = useState<{
    patientId: string | null;
    orgId: string;
    clinicId: string | null;
    locationId: string | null;
  } | null>(null);
  const [appointments, setAppointments] = useState<AppointmentDto[] | null>(
    null,
  );
  const [requests, setRequests] = useState<AppointmentRequestDto[] | null>(
    null,
  );
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(
    null,
  );
  const realMode = hasRealSession();

  // ── Indicador de mensajes no leídos del chat ──
  const [chatUnread, setChatUnread] = useState(false);
  /** Último conteo remoto conocido (para persistir al marcar como leído). */
  const lastRemoteCountRef = useRef<number | null>(null);

  // Invalida también respuestas que terminaron después de cambiar de paciente.
  const sessionGeneration = useRef(0);
  const resetPatientSession = useCallback(() => {
    sessionGeneration.current += 1;
    chatController.current?.abort();
    chatController.current = null;
    retryTurn.current = null;
    setChatGenerating(false);
    setVoiceMinimized(false);
    voiceSessions.current.clear();
    historyGeneration.current += 1;
    clearingHistory.current = false;
    setChatClearing(false);
    clearController.current?.abort();
    clearController.current = null;
    remoteHistoryRevisions.current.clear();
    setChatHistoryRevision(0);
    resetLegalConsentSession();
    resetSessionQueryCache();
    setUser(defaultUser);
    setActiveThreadId(null);
    setChat([
      createWelcomeMessage(defaultUser.nombre, currentLanguage.current),
    ]);
    setChatUnread(false);
    lastRemoteCountRef.current = null;
    setTestsDone([]);
    setPatientCtx(null);
    setAppointments(null);
    setRequests(null);
    setCatalog(null);
    setSpecialties(null);
    setAppointmentsLoading(false);
    setAppointmentsError(null);
    setPanicOpen(false);
    setVoiceOpen(false);
    setSosActive(false);
    setToast(null);
    setWatchConnected(false);
    setWatchName("Copp Adresd Wearable");
    setPointsToday(0);
    setPointsTotal(0);
    setProgram({
      podcast: false,
      vitals: false,
      nut: false,
      ejercicio: false,
      nutraceutico: false,
      emocional: false,
    });
    setWeekCheckins([false, false, false, false, false, false, false]);
    setStreak(0);
    setScreen("home");
  }, []);

  const refreshAppointments = useCallback(async () => {
    if (!hasRealSession()) return;
    const generation = sessionGeneration.current;
    const request = ++appointmentRequest.current;
    const language = currentLanguage.current;
    const isCurrent = () =>
      generation === sessionGeneration.current &&
      request === appointmentRequest.current &&
      language === currentLanguage.current;
    setAppointmentsLoading(true);
    setAppointmentsError(null);
    try {
      // Sin organizations/tree: el org id REAL del paciente viene del
      // /telemedicine/me (resuelto por el backend desde su clínica ERP).
      // Llamar al árbol ERP con aud=app daba 403 en cada arranque.
      // Núcleo crítico (citas/solicitudes/contexto) en paralelo; catálogos
      // best-effort independientes para que su fallo no tumbe la vista
      // (QA-010): el wizard degrada a "cualquiera"/reintento en ese caso.
      if (!APPOINTMENTS_ENABLED) {
        const [me, team] = await Promise.all([
          fetchMyContext(),
          fetchProfessionalsCatalog().catch(() => null),
        ]);
        if (!isCurrent()) return;
        setPatientCtx({
          patientId: me.patient?.id ?? null,
          orgId: me.patient?.organizationId ?? "",
          clinicId: me.patient?.clinicId ?? null,
          locationId: me.patient?.locationId ?? null,
        });
        setCatalog(team?.data ?? null);
        setAppointments([]);
        setRequests([]);
        return;
      }
      const [me, appts, reqs] = await Promise.all([
        fetchMyContext(),
        fetchMyAppointments({ pageSize: 100 }),
        fetchMyRequests(),
      ]);
      if (!isCurrent()) return;
      const [catalogData, specialtiesData] = await Promise.all([
        fetchProfessionalsCatalog().catch(() => null),
        fetchSpecialties().catch(() => null),
      ]);
      if (!isCurrent()) return;
      setCatalog(catalogData?.data ?? null);
      setSpecialties(specialtiesData);
      setPatientCtx({
        patientId: me.patient?.id ?? null,
        orgId: me.patient?.organizationId ?? "",
        clinicId: me.patient?.clinicId ?? null,
        locationId: me.patient?.locationId ?? null,
      });
      setAppointments(appts.items);
      setRequests(reqs);
    } catch (err) {
      if (!isCurrent()) return;
      console.warn("[appointments] No se pudieron cargar las citas:", err);
      setAppointmentsError(
        err instanceof Error ? err.message : "No se pudieron cargar las citas",
      );
    } finally {
      if (isCurrent()) setAppointmentsLoading(false);
    }
  }, []);

  // Los catálogos viven fuera de QueryClient: invalida su lectura anterior
  // sin reiniciar sesión, conversación, sala ni formularios al cambiar idioma.
  useLayoutEffect(() => {
    if (catalogLanguage.current === lang) return;
    catalogLanguage.current = lang;
    appointmentRequest.current += 1;
    setCatalog(null);
    setSpecialties(null);
    setChat((messages) =>
      messages.map((message) =>
        message.id === "welcome"
          ? createWelcomeMessage(user.nombre, lang)
          : message,
      ),
    );
    if (flow !== "login" && realMode) void refreshAppointments();
  }, [lang, flow, realMode, refreshAppointments, user.nombre]);

  // Carga inicial una sola vez para los demás consumidores (equipo del
  // perfil, sala): sin esto el catálogo solo existiría tras visitar Citas.
  useEffect(() => {
    if (
      flow !== "login" &&
      realMode &&
      appointments === null &&
      !appointmentsLoading &&
      !appointmentsError
    ) {
      void refreshAppointments();
    }
  }, [
    flow,
    realMode,
    appointments,
    appointmentsLoading,
    appointmentsError,
    refreshAppointments,
  ]);

  // Hidrata el perfil REAL del paciente (contacto, aseguradora, emergencia)
  // en el user del contexto. Sin esto, un paciente sin teléfono en BD veía el
  // mock del defaultUser en el ContactSection y "Guardar contacto" lo
  // persistía como dato real. Best-effort: sin perfil (no provisionado /
  // cuenta sin patient_profiles) se conserva el estado actual. El id/nombre
  // de sesión (auth) no se toca: el perfil trae patient_id, otro dominio.
  const hydratePatientProfile = useCallback(
    async (activeCheck: () => boolean) => {
      try {
        const generation = sessionGeneration.current;
        const profile = await fetchMyPatientProfile();
        if (!activeCheck() || generation !== sessionGeneration.current) return;
        const real = toUserProfile(profile);
        setUser((prev) => ({
          ...prev,
          email: real.email || prev.email,
          cedula: real.cedula,
          dob: real.dob,
          seguro: real.seguro,
          poliza: real.poliza,
          grupo: real.grupo,
          celular: real.celular,
          fam1Nombre: real.fam1Nombre,
          fam1Parentesco: real.fam1Parentesco,
          fam1Cel: real.fam1Cel,
          fam1Email: real.fam1Email,
          fam2Nombre: real.fam2Nombre,
          fam2Parentesco: real.fam2Parentesco,
          fam2Cel: real.fam2Cel,
          fam2Email: real.fam2Email,
        }));
      } catch {
        /* no bloqueante: el perfil aún no existe (paciente sin provisionar) */
      }
    },
    [],
  );

  const teamProfessional = useCallback(
    (typeId: string): TeamProfessional => {
      const typed = (
        ["medica", "psicologia", "nutricion", "urgencia"] as const
      ).find((t) => t === typeId);
      return realProfessionalByType(typed ?? "medica", catalog);
    },
    [catalog],
  );

  // Equipo real del perfil: deriva del catálogo (null = aún no disponible).
  const teamProfessionals = useMemo(
    () => realTeamFromCatalog(catalog),
    [catalog],
  );

  const submitAppointmentRequest = useCallback(
    async (input: {
      typeId?: string;
      specialtyId?: string;
      professionalId?: string | null;
      date: string;
      time: string;
      preferredStart?: string;
      reason: string;
      mode: string;
      priority?: "Normal" | "Urgent";
    }): Promise<boolean> => {
      if (!patientCtx?.patientId) return false;

      // Ruta por catálogo (veredicto D1): especialidad elegida + profesional
      // opcional por id exacto. `professionalId = null` = "cualquier
      // profesional disponible" (el ERP asigna después; no exige catálogo).
      // Sin regex.
      if (input.specialtyId) {
        const selected =
          input.professionalId != null && catalog
            ? catalog.find((p) => p.id === input.professionalId)
            : undefined;
        // Id explícito que no existe en el catálogo → no inventar: abortar.
        if (input.professionalId != null && !selected) return false;
        try {
          await createRequest({
            patientId: patientCtx.patientId,
            organizationId: patientCtx.orgId,
            specialtyId: input.specialtyId,
            ...(selected
              ? {
                  professionalId: selected.id,
                  clinicId: selected.clinicIds[0],
                  locationId: selected.locations[0]?.id,
                }
              : {}),
            // 2.A.4: el slot elegido viaja como preferred_start exacto.
            preferredStart:
              input.preferredStart ??
              new Date(`${input.date}T${input.time}:00`).toISOString(),
            reason: input.reason.trim(),
            priority: input.priority,
          });
          await refreshAppointments();
          return true;
        } catch (err) {
          console.warn("[appointments] No se pudo enviar la solicitud:", err);
          return false;
        }
      }

      // Ruta legacy por tipo (solo demo sin sesión): conserva el
      // comportamiento anterior con los mocks de tipos/equipo.
      if (!input.typeId || !catalog) return false;
      const professional = realProfessionalByType(
        input.typeId as "medica" | "psicologia" | "nutricion" | "urgencia",
        catalog,
      );
      const specialty = catalog.find((p) => p.id === professional.id)
        ?.specialties[0];
      if (!specialty) return false;

      try {
        await createRequest({
          patientId: patientCtx.patientId,
          organizationId: patientCtx.orgId,
          specialtyId: specialty.id,
          professionalId: professional.id,
          clinicId: catalog.find((p) => p.id === professional.id)?.clinicIds[0],
          locationId: catalog.find((p) => p.id === professional.id)
            ?.locations[0]?.id,
          preferredStart: new Date(
            `${input.date}T${input.time}:00`,
          ).toISOString(),
          reason: input.reason.trim(),
        });
        await refreshAppointments();
        return true;
      } catch (err) {
        console.warn("[appointments] No se pudo enviar la solicitud:", err);
        return false;
      }
    },
    [patientCtx, catalog, refreshAppointments],
  );

  const cancelAppointmentById = useCallback(
    async (id: string, reason: string): Promise<boolean> => {
      try {
        await cancelAppointmentApi(id, reason);
        await refreshAppointments();
        return true;
      } catch (err) {
        console.warn("[appointments] No se pudo cancelar la cita:", err);
        return false;
      }
    },
    [refreshAppointments],
  );

  const rescheduleAppointmentById = useCallback(
    async (
      id: string,
      input: { newStart: string; reason?: string | null },
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        await rescheduleAppointmentApi(id, {
          newStart: input.newStart,
          reason: input.reason ?? null,
        });
        await refreshAppointments();
        return { ok: true };
      } catch (err) {
        console.warn("[appointments] No se pudo reprogramar la cita:", err);
        return {
          ok: false,
          error: err instanceof Error ? err.message : undefined,
        };
      }
    },
    [refreshAppointments],
  );

  // Listener para sesión invalidada por refresh 401
  useEffect(() => {
    return onSessionInvalid(() => {
      resetPatientSession();
      setVitaWelcomePending(false);
      setFlow("login");
      onResetSessionCache?.();
    });
  }, [resetPatientSession, onResetSessionCache]);

  // Vigilancia proactiva de expiración del access token: si venció, se
  // intenta renovar por la cookie de refresh (single-flight compartido con
  // apiFetch). Un refresh rechazado con 401 dispara clearSessionAndNotify()
  // → listener de arriba → vuelta al login. Así la sesión se cierra aunque el
  // usuario navegue sin disparar llamadas a la API. El token demo no expira.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (cancelled) return;
      const token = getAccessToken();
      if (!token) return;
      if (!isAccessTokenExpired()) return;
      await refreshAccessToken();
    };
    const timer = window.setInterval(() => void check(), 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    void check();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  // Restauración automática de sesión al inicio
  useEffect(() => {
    let active = true;
    const generation = sessionGeneration.current;
    const isCurrent = () => active && generation === sessionGeneration.current;

    async function checkSession() {
      try {
        const session = await restoreSession();
        if (session && isCurrent()) {
          // /me puede fallar sin red. El token restaurado conserva la clave
          // de cuenta necesaria para su wearable y su caché privada.
          const restoredUserId = sessionUserId(session.accessToken);
          if (restoredUserId)
            setUser((prev) => ({ ...prev, id: restoredUserId }));
          try {
            const me = await getMe();
            if (me && isCurrent()) {
              setUser((prev) => {
                const updated: UserProfile = {
                  ...prev,
                  id: me.id || prev.id,
                  email: me.email || prev.email,
                  nombre:
                    `${me.firstName} ${me.lastName}`.trim() || prev.nombre,
                };
                return updated;
              });
            }
          } catch {
            /* no bloqueante */
          }

          // Perfil real del paciente (contacto/aseguradora/emergencia) en
          // segundo término: la pantalla de Perfil y el onboarding muestran
          // la verdad de la BD, nunca el mock del defaultUser.
          if (!isCurrent()) return;
          void hydratePatientProfile(isCurrent);

          setFlow("app");
          onResetSessionCache?.();
        }
      } catch {
        /* sin sesión activa */
      } finally {
        if (active) {
          setAuthLoading(false);
        }
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, [onResetSessionCache, hydratePatientProfile]);

  // Thread estable del paciente: `proactive-<id>`. Se prioriza el id (UUID real)
  // devuelto por el backend/JWT para que coincida con el checkpointer del AI Service.
  // Si no hay id (demo sin auth), usa la cédula o email.
  const computedThreadId = useMemo(
    () =>
      `proactive-${(user.id || user.cedula || user.email || "demo").trim()}`,
    [user.id, user.cedula, user.email],
  );
  const threadId = activeThreadId || computedThreadId;
  const currentThread = useRef(threadId);
  currentThread.current = threadId;

  /** Identificador estable del paciente para la clave de persistencia. */
  const chatUserId = useCallback(
    () => (user.id || user.cedula || user.email || "").trim(),
    [user.id, user.cedula, user.email],
  );

  const captureChatGuard = useCallback(() => {
    const owner = sessionGeneration.current;
    const history = historyGeneration.current;
    const sourceThread = currentThread.current;
    const startedIdle = !clearingHistory.current;
    return () =>
      startedIdle &&
      owner === sessionGeneration.current &&
      history === historyGeneration.current &&
      sourceThread === currentThread.current &&
      !clearingHistory.current;
  }, []);

  // Invalida callbacks y reintentos aunque AbortController llegue tarde.
  const invalidateChatHistory = useCallback(() => {
    historyGeneration.current += 1;
    chatTurnGeneration.current += 1;
    chatController.current?.abort();
    chatController.current = null;
    retryTurn.current = null;
    setChatGenerating(false);
    voiceSessions.current.clear();
    setChatHistoryRevision((revision) => revision + 1);
  }, []);

  const resetChatHistory = useCallback(() => {
    invalidateChatHistory();
    setChat([]);
    setChatUnread(false);
    lastRemoteCountRef.current = 0;
    const uid = chatUserId();
    if (uid) localStorage.setItem(`${CHAT_LAST_SEEN_PREFIX}${uid}`, "0");
  }, [invalidateChatHistory, chatUserId]);

  const observeChatHistory = useCallback(
    (state: ThreadState): "current" | "reset" | "stale" => {
      if (clearingHistory.current || state.threadId !== currentThread.current)
        return "stale";
      const revision = state.historyRevision;
      const seen = remoteHistoryRevisions.current.get(state.threadId) ?? 0;
      if (revision == null) return seen > 0 ? "stale" : "current";
      if (revision < seen) return "stale";
      remoteHistoryRevisions.current.set(state.threadId, revision);
      if (revision > seen) {
        resetChatHistory();
        void voiceStop.current?.().catch(() => {});
        setVoiceOpen(false);
        setVoiceMinimized(false);
        return "reset";
      }
      return "current";
    },
    [resetChatHistory],
  );

  const registerVoiceStop = useCallback((stop: () => Promise<void>) => {
    voiceStop.current = stop;
    return () => {
      if (voiceStop.current === stop) voiceStop.current = null;
    };
  }, []);

  const clearChat = useCallback(async () => {
    if (clearingHistory.current) return;
    const owner = sessionGeneration.current;
    const sourceThread = threadId;
    const controller = new AbortController();
    clearController.current = controller;
    clearingHistory.current = true;
    setChatClearing(true);
    invalidateChatHistory();
    const current = () =>
      owner === sessionGeneration.current &&
      sourceThread === currentThread.current;
    try {
      if (voiceOpen && !voiceStop.current)
        throw new Error("Voice shutdown unavailable");
      await voiceStop.current?.();
      if (!current()) throw new Error("History owner changed");
      setVoiceOpen(false);
      setVoiceMinimized(false);
      const state = await clearThreadMessages(sourceThread, controller.signal);
      if (!current()) throw new Error("History owner changed");
      remoteHistoryRevisions.current.set(sourceThread, state.historyRevision);
      resetChatHistory();
    } finally {
      if (clearController.current === controller) {
        clearController.current = null;
        clearingHistory.current = false;
        setChatClearing(false);
        setChatHistoryRevision((revision) => revision + 1);
      }
    }
  }, [threadId, voiceOpen, invalidateChatHistory, resetChatHistory]);

  /**
   * Turno completo de conversación con el asistente (change
   * agente-asistente-citas D1.2): pinta el mensaje del usuario, hace
   * streaming del bot token a token y, al finalizar, SOBREESCRIBE el texto
   * del turno con la respuesta canónica (`answer`) para que las pasadas
   * duplicadas alrededor de tool-calls jamás queden en la burbuja. Ante
   * cancelación o fallo conserva el turno para reintento explícito. Nunca reenvía
   * automáticamente una petición que pudo ejecutar herramientas. Si falla,
   * muestra indisponibilidad, nunca respuestas clínicas locales. Usado por `sendChat` y por el agente de voz
   * (`sendVoiceMessage`), que necesita el mensaje final para vocalizarlo.
   */
  const runChatTurn = useCallback(
    async (
      text: string,
      image?: ChatImageAttachment,
      retry = false,
      attachments?: PendingVitaAttachment[],
    ): Promise<ChatMessage | null> => {
      if (clearingHistory.current || chatController.current || !text.trim())
        return null;
      chatTurnGeneration.current += 1;
      let controller = new AbortController();
      chatController.current = controller;
      const generation = sessionGeneration.current;
      let history = historyGeneration.current;
      const isCurrent = () =>
        generation === sessionGeneration.current &&
        history === historyGeneration.current &&
        currentThread.current === threadId &&
        !controller.signal.aborted;
      const previous = retry ? retryTurn.current : null;
      const userId = previous?.userId ?? crypto.randomUUID();
      const botId = previous?.botId ?? crypto.randomUUID();
      let painted = "";
      setChatGenerating(true);
      try {
        await requireLegalConsent("chat", lang, controller.signal);
        if (!isCurrent()) return null;
        // Un chat abierto durante el cambio de mes también debe observar el
        // corte antes del siguiente turno, aunque nunca haya salido de pantalla.
        const state = await fetchThreadState(threadId, chatUserId(), {
          limit: 1,
          signal: controller.signal,
        });
        if (!isCurrent()) return null;
        if (state) {
          const observation = observeChatHistory(state);
          if (observation === "stale") {
            showToast(t(CHAT_UNAVAILABLE_MESSAGE), "err");
            return null;
          }
          if (observation === "reset") {
            if (voiceOpen || retry) return null; // Ni la llamada ni un reintento antiguo continúan.
            controller = new AbortController();
            chatController.current = controller;
            history = historyGeneration.current;
            setChatGenerating(true);
          }
        }
        retryTurn.current = { text, image, attachments, userId, botId };
        const userMessage: ChatMessage = {
          id: userId,
          role: "user",
          text,
          time: nowLabel(lang),
          threadId,
          image: image ? { dataUrl: image.dataUrl } : undefined,
          ...(attachments?.length ? { vitaAttachments: attachments } : {}),
        };
        const live: ChatMessage = {
          id: botId,
          role: "bot",
          text: "",
          time: nowLabel(lang),
          threadId,
          delivery: "streaming",
        };
        setChat((prev) => [
          ...prev.filter((m) => m.id !== "welcome" && m.id !== botId),
          ...(!previous ? [userMessage] : []),
          live,
        ]);
        const result = attachments?.length
          ? await sendAttachmentChat(
              text,
              threadId,
              lang,
              attachments.map((attachment) => attachment.attachmentId),
              controller.signal,
            )
          : await streamChatMessage(
              text,
              threadId,
              {
                onToken: (piece) => {
                  if (!isCurrent()) return;
                  painted += piece;
                  const snapshot = painted;
                  setChat((prev) =>
                    prev.map((m) =>
                      m.id === botId ? { ...m, text: snapshot } : m,
                    ),
                  );
                },
              },
              image,
              lang,
              controller.signal,
            );
        if (!isCurrent()) return null;
        const canonical = result.answer ?? result.reply;
        if (!canonical?.trim()) throw new Error("Empty chat response");
        const final: ChatMessage = {
          ...live,
          text: canonical,
          delivery: "received",
          threadId: result.threadId || threadId,
          cta: result.suggestions?.find(
            (suggestion) => suggestion.type === "appointment",
          ),
          executionId: result.executionId,
          actions: result.actions,
          ...(attachments?.length
            ? {
                vitaAttachments: attachments.map((attachment) => ({
                  ...attachment,
                  readable: result.attachments?.find(
                    (item) => item.attachmentId === attachment.attachmentId,
                  )?.readable,
                })),
              }
            : {}),
        };
        setChat((prev) => prev.map((m) => (m.id === botId ? final : m)));
        retryTurn.current = null;
        return final;
      } catch (error) {
        if (
          generation !== sessionGeneration.current ||
          history !== historyGeneration.current ||
          currentThread.current !== threadId
        )
          return null;
        if (controller.signal.aborted) {
          setChat((prev) =>
            prev.map((m) =>
              m.id === botId
                ? {
                    ...m,
                    text: painted || t("Respuesta detenida"),
                    delivery: "interrupted",
                  }
                : m,
            ),
          );
          return null;
        }
        if (isLegalConsentError(error)) {
          setChat((prev) => prev.filter((m) => m.id !== botId));
          showToast(t(legalConsentMessage(error)), "warn");
          return null;
        }
        const code =
          typeof error === "object" && error && "code" in error
            ? error.code
            : null;
        const invalidAttachments =
          attachments?.length &&
          (code === "vita_attachment_not_found" ||
            code === "attachment_limit_exceeded");
        if (invalidAttachments) retryTurn.current = null;
        const failureText = invalidAttachments
          ? code === "attachment_limit_exceeded"
            ? t(
                "Vita no pudo usar tantos adjuntos. Envía menos archivos por mensaje.",
              )
            : t(
                "Uno de los adjuntos ya no está disponible. Vuelve a adjuntarlo.",
              )
          : t(CHAT_UNAVAILABLE_MESSAGE);
        const failed: ChatMessage = {
          id: botId,
          role: "bot",
          text: failureText,
          time: nowLabel(lang),
          threadId,
          kind: "service-error",
          delivery: "failed",
          ...(invalidAttachments ? { retryUnavailable: true } : {}),
        };
        setChat((prev) => prev.map((m) => (m.id === botId ? failed : m)));
        return failed;
      } finally {
        if (chatController.current === controller) {
          chatController.current = null;
          setChatGenerating(false);
        }
      }
    },
    [threadId, t, lang, showToast, chatUserId, observeChatHistory, voiceOpen],
  );

  useEffect(() => {
    return () => {
      chatController.current?.abort();
      clearController.current?.abort();
      retryTurn.current = null;
    };
  }, [threadId]);

  /**
   * Chequea si hay mensajes del bot sin ver (dot en la tab Chat).
   * Fail-safe: sin sesión real, sin thread o ante cualquier error de fetch,
   * chatUnread queda en false — nunca un badge fantasma.
   */
  const checkChatUnread = useCallback(async () => {
    const uid = chatUserId();
    if (!realMode || !uid || !threadId) {
      setChatUnread(false);
      return;
    }
    // Solo se necesita el conteo para el dot: se pide una página de 1 para
    // no descargar el historial completo al entrar a la app.
    const generation = sessionGeneration.current;
    const current = captureChatGuard();
    const state = await fetchThreadState(threadId, uid, { limit: 1 });
    if (generation !== sessionGeneration.current || !current()) return;
    if (state && observeChatHistory(state) !== "current") return;
    if (!state) {
      // Fetch fallido o thread inexistente → no marcar nada.
      setChatUnread(false);
      return;
    }
    lastRemoteCountRef.current = state.messageCount;
    const key = `${CHAT_LAST_SEEN_PREFIX}${uid}`;
    const seenRaw = localStorage.getItem(key);
    if (seenRaw === null) {
      // Primera carga del usuario: se siembra el baseline para no marcar
      // historial viejo como no leído (evita falso positivo en instalación nueva).
      localStorage.setItem(key, String(state.messageCount));
      setChatUnread(false);
      return;
    }
    setChatUnread(state.messageCount > Number(seenRaw));
  }, [chatUserId, realMode, threadId, captureChatGuard, observeChatHistory]);

  /** Marca el chat como leído: persiste el conteo remoto actual y apaga el dot. */
  const markChatRead = useCallback(() => {
    const uid = chatUserId();
    setChatUnread(false);
    if (!uid) return;
    const count = lastRemoteCountRef.current;
    if (count !== null) {
      localStorage.setItem(`${CHAT_LAST_SEEN_PREFIX}${uid}`, String(count));
      return;
    }
    // Sin conteo previo (p. ej. se entró al chat antes del primer check):
    // se toma el conteo remoto para no volver a marcar como no leído.
    if (threadId) {
      const current = captureChatGuard();
      void fetchThreadState(threadId, uid, { limit: 1 }).then((state) => {
        if (state && current() && observeChatHistory(state) === "current") {
          localStorage.setItem(
            `${CHAT_LAST_SEEN_PREFIX}${uid}`,
            String(state.messageCount),
          );
        }
      });
    }
  }, [chatUserId, threadId, captureChatGuard, observeChatHistory]);

  // Check al entrar a la app (sesión activa) y al volver a primer plano.
  useEffect(() => {
    if (flow === "app") void checkChatUnread();
  }, [flow, checkChatUnread]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && flow === "app") {
        void checkChatUnread();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [flow, checkChatUnread]);

  // Resume nativo (Capacitor): solo en plataforma nativa; en web/PWA cubre
  // el visibilitychange.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = App.addListener("resume", () => {
      void checkChatUnread();
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, [checkChatUnread]);

  const builtReal =
    appointments && requests
      ? buildRealAppointments(appointments, requests, specialties ?? undefined)
      : null;

  const navigate = useCallback<AppState["navigate"]>((target) => {
    switch (target) {
      case "home":
      case "protocol":
      case "wellness-diet":
      case "wellness-exercise":
      case "wellness-goal":
      case "wellness-checkin":
      case "wellness-privacy":
      case "prof":
        setScreen(target);
        return;
      default:
        setScreen("home");
    }
  }, []);

  const value = useMemo<AppState>(
    () => ({
      vitaWelcomePending,
      authLoading,
      flow,
      screen,
      medicalSourcesEntry: null,
      healthReturnTo: "home",
      toast,
      showToast,
      panicOpen,
      panicEntry,
      voiceOpen,
      voiceMinimized,
      chatGenerating,
      cancelChat: () => chatController.current?.abort(),
      retryChat: () => {
        const turn = retryTurn.current;
        if (turn)
          void runChatTurn(turn.text, turn.image, true, turn.attachments);
      },
      minimizeVoice: () => setVoiceMinimized(true),
      upsertVoiceMessage: ((history: number) => (message: ChatMessage) => {
        if (
          history !== historyGeneration.current ||
          clearingHistory.current ||
          message.threadId !== currentThread.current
        )
          return;
        setChat((prev) =>
          mergeVoiceMessage(prev, { ...message, time: nowLabel(lang) }),
        );
      })(historyGeneration.current),
      chatHistoryRevision,
      chatHistoryEpoch: historyGeneration.current,
      chatClearing,
      clearChat,
      captureChatGuard,
      observeChatHistory,
      registerVoiceStop,
      refreshChatHistory: (sourceThreadId) => {
        if (sourceThreadId === currentThread.current)
          setChatHistoryRevision((revision) => revision + 1);
      },
      registerVoiceSession: (sessionId, sourceThreadId) => {
        voiceSessions.current.set(sessionId, {
          threadId: sourceThreadId,
          closed: false,
        });
      },
      markVoiceSessionClosed: (sessionId, sourceThreadId) => {
        voiceSessions.current.set(sessionId, {
          threadId: sourceThreadId,
          closed: true,
        });
        setChat((prev) =>
          prev.map((message) =>
            message.voiceSessionId === sessionId &&
            message.threadId === sourceThreadId
              ? { ...message, voiceSessionClosed: true }
              : message,
          ),
        );
      },
      sosActive,
      user,
      testsDone,
      chat,
      threadId,
      chatUnread,
      markChatRead,
      setActiveThreadId,
      wearableConnected,
      wearableName,
      program,
      programWeek,
      streak,
      weekCheckins,
      pointsToday,
      pointsTotal,
      dismissVitaWelcome: () => setVitaWelcomePending(false),
      navigate,
      openBookingWizard: () => setScreen("home"),
      bookingWizardAutoOpen: false,
      clearBookingWizardAutoOpen: () => {},
      finishLogin: (seed, next = "onboarding") => {
        resetPatientSession();
        const generation = sessionGeneration.current;
        setVitaWelcomePending(false);
        const loginUserId = sessionUserId(getAccessToken());
        if (loginUserId) setUser((prev) => ({ ...prev, id: loginUserId }));
        // El primer inicio de sesión por ID siembra el perfil para el onboarding.
        // El login con contraseña (usuario ya registrado o demo) entra directo a la app.
        void (async () => {
          let meId: string | undefined = loginUserId ?? undefined;
          let meName: string | undefined;
          try {
            const me = await getMe();
            if (me?.id) meId = me.id;
            // El nombre también viene del backend (FASE 3: el login por
            // password solo traía el id y el Home saludaba con el mock
            // "María González" — misma corrección que la restauración de
            // sesión de arriba).
            const name = `${me?.firstName ?? ""} ${me?.lastName ?? ""}`.trim();
            if (name) meName = name;
          } catch {
            /* no bloqueante */
          }
          if (generation !== sessionGeneration.current) return;
          setUser((u) => {
            const updated = {
              ...u,
              ...(seed || {}),
              ...(meId ? { id: meId } : {}),
              ...(meName ? { nombre: meName } : {}),
            };
            // La identidad vive en el backend (getMe + JWT); no se persiste
            // localmente para no desincronizar APP ↔ ERP (FASE 1, task 2.1).
            return updated;
          });
          // Contacto/perfil real también tras el login directo: sin esto el
          // ContactSection prefillaba el mock del defaultUser (celular fake)
          // y "Guardar contacto" lo habría persistido como dato del paciente.
          await hydratePatientProfile(
            () => generation === sessionGeneration.current,
          );
        })();
        setFlow(next);
        // Recrea el cliente urql para usar la cache y el WS con el token nuevo.
        onResetSessionCache?.();
      },
      backToLogin: () => {
        resetPatientSession();
        setVitaWelcomePending(false);
        setFlow("login");
        setScreen("home");
      },
      finishOnboarding: (u) => {
        queueVitaWelcome(sessionUserId(getAccessToken()));
        setVitaWelcomePending(true);
        setUser(u);
        setFlow("tests");
      },
      finishWellnessOnboarding: (u) => {
        setUser({ ...u, id: sessionUserId(getAccessToken()) ?? u.id });
        setFlow("app");
        setScreen("home");
      },
      refreshPatientProfile: () => hydratePatientProfile(() => true),
      finishTests: () => setFlow("app"),
      skipTests: () => setFlow("app"),
      // Reabre la batería de evaluación desde la app (un paciente que ya pasó
      // el onboarding puede retomar sus tests pendientes).
      openTests: () => setFlow("tests"),
      markTest: (id) =>
        setTestsDone((prev) => (prev.includes(id) ? prev : [...prev, id])),
      openPanic: () => {
        // KAN-137: cada apertura empieza por la cuenta regresiva de 5 s.
        setPanicEntry("countdown");
        setSosActive(false);
        setPanicOpen(true);
      },
      closePanic: () => {
        setPanicOpen(false);
        setSosActive(false);
      },
      activateSos: () => setSosActive(true),
      openVoice: () => {
        if (!clearingHistory.current) {
          setVoiceMinimized(false);
          setVoiceOpen(true);
        }
      },
      closeVoice: () => {
        setVoiceOpen(false);
        setVoiceMinimized(false);
      },
      sendChat: (text, image, attachments) => {
        void runChatTurn(text, image, false, attachments);
      },
      sendVoiceMessage: (text, image) => runChatTurn(text, image),
      hydrateChat: (messages) => {
        if (messages.length)
          setChat((prev) =>
            mergeChatHistory(
              prev,
              messages,
              threadId,
              new Map(
                [...voiceSessions.current]
                  .filter(([, session]) => session.threadId === threadId)
                  .map(([id, session]) => [id, session.closed]),
              ),
            ),
          );
      },
      captureHistoryHydrator: () => {
        const validHistory = captureChatGuard();
        const owner = sessionGeneration.current;
        const turn = chatTurnGeneration.current;
        const sourceThread = threadId;
        const startedIdle = !chatController.current;
        const retry = retryTurn.current;
        const textIds = new Set(
          chat
            .filter(
              (message) =>
                message.threadId === sourceThread &&
                isConfirmedText(message) &&
                message.id !== retry?.userId &&
                message.id !== retry?.botId,
            )
            .map((message) => message.id),
        );
        const current = () =>
          validHistory() &&
          startedIdle &&
          owner === sessionGeneration.current &&
          turn === chatTurnGeneration.current &&
          sourceThread === currentThread.current &&
          !chatController.current;
        return (messages, authoritativeText = true) => {
          if (!messages.length || !current()) return false;
          setChat((prev) => {
            if (!current()) return prev;
            // Snapshot autoritativo de la página reciente: retirar solo el texto
            // confirmado capturado al iniciar. Las páginas viejas se recargan.
            const remaining = authoritativeText
              ? prev.filter(
                  (message) =>
                    !textIds.has(message.id) || !isConfirmedText(message),
                )
              : prev;
            return mergeChatHistory(
              remaining,
              messages,
              sourceThread,
              new Map(
                [...voiceSessions.current]
                  .filter(([, session]) => session.threadId === sourceThread)
                  .map(([id, session]) => [id, session.closed]),
              ),
            );
          });
          return true;
        };
      },
      prependChatMessages: (messages) => {
        if (messages.length)
          setChat((prev) =>
            mergeChatHistory(
              prev,
              messages,
              threadId,
              new Map(
                [...voiceSessions.current]
                  .filter(([, session]) => session.threadId === threadId)
                  .map(([id, session]) => [id, session.closed]),
              ),
            ),
          );
      },
      appendChatMessages: (msgs) => {
        if (!msgs.length) return;
        const newMsgs: ChatMessage[] = msgs.map((m) => ({
          id: crypto.randomUUID(),
          role: m.role,
          text: m.text,
          time: nowLabel(lang),
          threadId,
          cta: m.cta,
          kind: m.kind,
          executionId: m.executionId,
        }));
        setChat((prev) => {
          const isOnlyWelcome = prev.length === 1 && prev[0].id === "welcome";
          return isOnlyWelcome ? newMsgs : [...prev, ...newMsgs];
        });
      },
      connectWearable: (name) => {
        setWatchConnected(true);
        setWatchName(name);
      },
      disconnectWearable: () => setWatchConnected(false),
      completeStep: (id, pts) => {
        if (isComingSoonTask(id)) return;
        setProgram((p) => {
          if (p[id]) return p;
          const next = { ...p, [id]: true };
          const finished =
            !realMode && ACTIVE_PROGRAM_TASKS.every((task) => next[task.id]);
          const gain = finished ? pts + DAY_BONUS_PTS : pts;
          if (finished) {
            setStreak((s) => s + 1);
            const idx = weekdayMondayIndex();
            setWeekCheckins((days) =>
              days.map((v, i) => (i === idx ? true : v)),
            );
          }
          setPointsToday((n) => n + gain);
          setPointsTotal((n) => n + gain);
          return next;
        });
      },
      logout: () => {
        // Captura el JWT anterior antes de borrarlo; la limpieza no retrasa salir.
        void unregisterPushDevice();
        resetPatientSession();
        setVitaWelcomePending(false);
        setFlow("login");
        setScreen("home");
        setActiveThreadId(null);
        setUser(defaultUser);
        setChat([createWelcomeMessage(defaultUser.nombre, lang)]);
        // logoutUser borra el token antes de esperar la red. Las caches se
        // limpian de inmediato aunque el servidor de logout no responda.
        void logoutUser();
        onResetSessionCache?.();
      },
      realMode,
      upcomingAppointments: builtReal?.upcoming ?? null,
      pastAppointments: builtReal?.past ?? null,
      appointmentsLoading,
      appointmentsError,
      teamProfessional,
      teamProfessionals,
      specialties,
      professionalsCatalog: catalog,
      patientCareContext: patientCtx,
      refreshAppointments,
      submitAppointmentRequest,
      cancelAppointmentById,
      rescheduleAppointmentById,
      openRoom: () => setScreen("home"),
      closeRoom: () => {},
      roomAppointment: null,
    }),
    [
      vitaWelcomePending,
      authLoading,
      resetPatientSession,
      flow,
      screen,
      navigate,
      toast,
      showToast,
      panicOpen,
      panicEntry,
      voiceOpen,
      voiceMinimized,
      chatGenerating,
      chatHistoryRevision,
      chatClearing,
      clearChat,
      captureChatGuard,
      observeChatHistory,
      registerVoiceStop,
      sosActive,
      user,
      testsDone,
      chat,
      wearableConnected,
      wearableName,
      program,
      programWeek,
      streak,
      weekCheckins,
      pointsToday,
      pointsTotal,
      threadId,
      chatUnread,
      markChatRead,
      onResetSessionCache,
      lang,
      runChatTurn,
      realMode,
      builtReal,
      appointmentsLoading,
      appointmentsError,
      teamProfessional,
      teamProfessionals,
      specialties,
      catalog,
      patientCtx,
      refreshAppointments,
      submitAppointmentRequest,
      cancelAppointmentById,
      rescheduleAppointmentById,
      hydratePatientProfile,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
