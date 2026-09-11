import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getMe,
  logoutUser,
  onSessionInvalid,
  restoreSession,
} from "../utils/authApi";
import {
  fetchThreadState,
  sendChatMessage,
  streamChatMessage,
} from "../utils/threadApi";
import {
  cancelAppointment as cancelAppointmentApi,
  createRequest,
  fetchMyAppointments,
  fetchMyContext,
  fetchMyRequests,
  fetchOrganizationsTree,
  fetchProfessionalsCatalog,
  hasRealSession,
  type AppointmentDto,
  type AppointmentRequestDto,
  type ProfessionalCatalogItem,
} from "../utils/appointmentsApi";
import {
  buildRealAppointments,
  realProfessionalByType,
  realTeamFromCatalog,
  type ListedAppointment,
  type TeamProfessional,
} from "../data/appointments";
import { useT } from "../i18n/I18nContext";
import type {
  ChatMessage,
  ChatSuggestion,
  Flow,
  ProgramDay,
  ProgramTaskId,
  Screen,
  ToastKind,
  ToastState,
  UserProfile,
} from "../types";
import { weekdayMondayIndex } from "../utils/dates";
import { DAY_BONUS_PTS } from "../data/program";

const USER_STORAGE_KEY = "antares_user_profile";
/** Baseline por usuario del conteo de mensajes ya vistos del chat. */
const CHAT_LAST_SEEN_PREFIX = "antares:chat-last-seen:";

interface AppState {
  authLoading: boolean;
  flow: Flow;
  screen: Screen;
  toast: ToastState | null;
  panicOpen: boolean;
  voiceOpen: boolean;
  sosActive: boolean;
  user: UserProfile;
  testsDone: number[];
  chat: ChatMessage[];
  threadId: string;
  setActiveThreadId: (id: string | null) => void;
  watchConnected: boolean;
  watchName: string;
  program: ProgramDay;
  programWeek: number;
  streak: number;
  weekCheckins: boolean[];
  pointsToday: number;
  pointsTotal: number;
  navigate: (s: Screen) => void;
  /** Navega a Citas y auto-abre el asistente de solicitud (CTA del chat). */
  openBookingWizard: () => void;
  /** Consumido por AppointmentsPage: true = abrir el wizard al montar. */
  bookingWizardAutoOpen: boolean;
  /** Limpia el flag one-shot de auto-apertura del wizard. */
  clearBookingWizardAutoOpen: () => void;
  finishLogin: (seed?: Partial<UserProfile>, next?: Flow) => void;
  backToLogin: () => void;
  finishOnboarding: (user: UserProfile) => void;
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
  sendChat: (text: string) => void;
  /** Hay mensajes del bot sin ver en el thread (dot en la tab Chat). */
  chatUnread: boolean;
  /** Marca el chat como leído: persiste el conteo remoto actual y apaga el dot. */
  markChatRead: () => void;
  hydrateChat: (messages: { text: string }[]) => void;
  appendChatMessages: (
    messages: Array<{
      role: "bot" | "user" | "alert";
      text: string;
      cta?: ChatSuggestion | null;
      kind?: ChatMessage["kind"];
    }>,
  ) => void;
  connectWatch: (name: string) => void;
  disconnectWatch: () => void;
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
  refreshAppointments: () => Promise<void>;
  /** Envía la solicitud contra el backend (modo real). Devuelve éxito. */
  submitAppointmentRequest: (input: {
    typeId: string;
    date: string;
    time: string;
    reason: string;
    mode: string;
  }) => Promise<boolean>;
  /** Cancela una cita real. Devuelve éxito. */
  cancelAppointmentById: (id: string, reason: string) => Promise<boolean>;
  /** Abre la sala virtual de una cita. */
  openRoom: (appointment: ListedAppointment) => void;
  closeRoom: () => void;
  roomAppointment: ListedAppointment | null;
}

const defaultUser: UserProfile = {
  nombre: "María González",
  cedula: "10247381",
  dob: "1988-04-12",
  seguro: "",
  poliza: "BCB-20247381",
  grupo: "GRP-5092",
  email: "maria.gonzalez@email.com",
  celular: "+1 (786) 555-0100",
  fam1Nombre: "Pedro González",
  fam1Parentesco: "Esposo/a",
  fam1Cel: "+1 (786) 555-0192",
  fam1Email: "pedro.gonzalez@email.com",
};

function loadSavedUser(): UserProfile {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UserProfile>;
      return { ...defaultUser, ...parsed };
    }
  } catch {
    /* fallback a defaultUser */
  }
  return defaultUser;
}

function createWelcomeMessage(name = "María"): ChatMessage {
  const firstName = name.trim().split(" ")[0] || "María";
  return {
    id: "welcome",
    role: "bot",
    text: `Hola ${firstName} 👋 Soy tu agente de salud ANTARES. ¿En qué te puedo ayudar hoy?`,
    time: nowLabel(),
  };
}

const AppContext = createContext<AppState | null>(null);

function nowLabel() {
  return new Date().toLocaleTimeString("es-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function botReply(
  text: string,
  t: (s: string, p?: Record<string, string>) => string,
): { role: ChatMessage["role"]; text: string } {
  const lower = text.toLowerCase();
  if (
    lower.includes("pecho") ||
    lower.includes("brazo") ||
    lower.includes("urgencia") ||
    lower.includes("síntoma")
  ) {
    return {
      role: "alert",
      text: t(
        "Detecté un posible síntoma de alarma. Si el dolor es intenso, activa SOS. Mientras tanto: siéntate, no te acuestes plana y avisa a tu contacto de emergencia.",
      ),
    };
  }
  if (
    lower.includes("comer") ||
    lower.includes("plan") ||
    lower.includes("comida")
  ) {
    return {
      role: "bot",
      text: t(
        "Hoy tu plan es dieta mediterránea 1,800 kcal. Cena sugerida: sopa de lentejas + pan integral, antes de las 7:30 PM. Adherencia actual: 88%.",
      ),
    };
  }
  if (lower.includes("cita") || lower.includes("agendar")) {
    return {
      role: "bot",
      text: t(
        "Tu próxima cita es hoy 3:00 PM con Dr. Carlos Ramírez (telemedicina). Puedo recordártela 30 min antes. Para una nueva cita usa Solicitar cita en el módulo Citas.",
      ),
    };
  }
  if (lower.includes("progreso")) {
    return {
      role: "bot",
      text: t(
        "Semana 12/24 · IMC 26.4 (↓1.2) · HbA1c 5.9% · adherencia 88% · 840 pts. Vas por buen camino hacia 65 kg e HbA1c < 5.7%.",
      ),
    };
  }
  if (
    lower.includes("medit") ||
    lower.includes("ansiedad") ||
    lower.includes("infinito")
  ) {
    return {
      role: "bot",
      text: t(
        "Prueba 4-7-8: inhala 4, retén 7, exhala 8. En INFINITO tienes frecuencias y mindfulness. El video PSICO de hoy dura 12 min.",
      ),
    };
  }
  return {
    role: "bot",
    text: t(
      "Entendido. Puedo ayudarte con tu plan nutricional, citas, medicamentos, progreso o activar SOS. ¿Qué necesitas ahora?",
    ),
  };
}

export function AppProvider({
  children,
  onResetCommunityClient,
}: {
  children: ReactNode;
  /** Se invoca tras login/logout para recrear el cliente urql de la comunidad. */
  onResetCommunityClient?: () => void;
}) {
  const [authLoading, setAuthLoading] = useState(true);
  const t = useT();
  const [flow, setFlow] = useState<Flow>("login");
  const [screen, setScreen] = useState<Screen>("home");
  // Flag one-shot: el CTA del chat pide abrir Citas con el wizard ya abierto.
  const [bookingWizardAutoOpen, setBookingWizardAutoOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [panicOpen, setPanicOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [user, setUser] = useState<UserProfile>(loadSavedUser);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [testsDone, setTestsDone] = useState<number[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>(() => [
    createWelcomeMessage(loadSavedUser().nombre),
  ]);
  const [watchConnected, setWatchConnected] = useState(false);
  const [watchName, setWatchName] = useState("ANTARES Watch Pro");
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
  const [programWeek] = useState(12);
  // TODO: Remove after full migration
  const [streak, setStreak] = useState(22);
  // TODO: Remove after full migration
  const [weekCheckins, setWeekCheckins] = useState<boolean[]>([
    true,
    true,
    true,
    true,
    false,
    false,
    false,
  ]);
  // TODO: Remove after full migration
  const [pointsToday, setPointsToday] = useState(0);
  // TODO: Remove after full migration
  const [pointsTotal, setPointsTotal] = useState(4820);

  const [catalog, setCatalog] = useState<ProfessionalCatalogItem[] | null>(
    null,
  );
  const [patientCtx, setPatientCtx] = useState<{
    patientId: string | null;
    orgId: string;
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
  const [roomAppointment, setRoomAppointment] =
    useState<ListedAppointment | null>(null);
  const realMode = hasRealSession();

  // ── Indicador de mensajes no leídos del chat ──
  const [chatUnread, setChatUnread] = useState(false);
  /** Último conteo remoto conocido (para persistir al marcar como leído). */
  const lastRemoteCountRef = useRef<number | null>(null);
  /** Pantalla anterior: detecta la entrada a "chat" para auto-limpiar. */
  const prevScreenRef = useRef<Screen>(screen);

  const refreshAppointments = useCallback(async () => {
    if (!hasRealSession()) return;
    setAppointmentsLoading(true);
    setAppointmentsError(null);
    try {
      const [me, appts, reqs, catalogData, orgs] = await Promise.all([
        fetchMyContext(),
        fetchMyAppointments({ pageSize: 100 }),
        fetchMyRequests(),
        fetchProfessionalsCatalog(),
        fetchOrganizationsTree().catch(() => null),
      ]);
      setCatalog(catalogData.data);
      setPatientCtx({
        patientId: me.patient?.id ?? null,
        orgId: (orgs?.[0]?.id ?? "") || "5fde219a-89ea-4cf9-be48-379e8b1042cb",
      });
      setAppointments(appts.items);
      setRequests(reqs);
    } catch (err) {
      console.warn("[appointments] No se pudieron cargar las citas:", err);
      setAppointmentsError(
        err instanceof Error ? err.message : "No se pudieron cargar las citas",
      );
    } finally {
      setAppointmentsLoading(false);
    }
  }, []);

  // Con sesión real, refresca citas/catálogo al entrar a la app (Home o Citas)
  // y cuando la pantalla de citas se vuelve visible. No en la sala (la cita
  // activa vive en el contexto).
  useEffect(() => {
    if (realMode && screen !== "room" && !appointments) {
      void refreshAppointments();
    }
  }, [realMode, screen, appointments, refreshAppointments]);

  useEffect(() => {
    if (!realMode) return;
    const onFocus = () => {
      if (screen === "book") void refreshAppointments();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [realMode, screen, refreshAppointments]);

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
      typeId: string;
      date: string;
      time: string;
      reason: string;
      mode: string;
    }): Promise<boolean> => {
      if (!patientCtx?.patientId || !catalog) return false;
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

  // Listener para sesión invalidada por refresh 401
  useEffect(() => {
    return onSessionInvalid(() => {
      setFlow("login");
      setScreen("home");
      localStorage.removeItem(USER_STORAGE_KEY);
    });
  }, []);

  // Restauración automática de sesión al inicio
  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const session = await restoreSession();
        if (session && active) {
          try {
            const me = await getMe();
            if (me && active) {
              setUser((prev) => {
                const updated: UserProfile = {
                  ...prev,
                  id: me.id || prev.id,
                  email: me.email || prev.email,
                  nombre:
                    `${me.firstName} ${me.lastName}`.trim() || prev.nombre,
                };
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
                return updated;
              });
            }
          } catch {
            /* no bloqueante */
          }

          setFlow("app");
          onResetCommunityClient?.();
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
  }, [onResetCommunityClient]);

  // Thread estable del paciente: `proactive-<id>`. Se prioriza el id (UUID real)
  // devuelto por el backend/JWT para que coincida con el checkpointer del AI Service.
  // Si no hay id (demo sin auth), usa la cédula o email.
  const computedThreadId = useMemo(
    () =>
      `proactive-${(user.id || user.cedula || user.email || "demo").trim()}`,
    [user.id, user.cedula, user.email],
  );
  const threadId = activeThreadId || computedThreadId;

  /** Identificador estable del paciente para la clave de persistencia. */
  const chatUserId = useCallback(
    () => (user.id || user.cedula || user.email || "").trim(),
    [user.id, user.cedula, user.email],
  );

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
    const state = await fetchThreadState(threadId, uid);
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
  }, [chatUserId, realMode, threadId]);

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
      void fetchThreadState(threadId, uid).then((state) => {
        if (state) {
          localStorage.setItem(
            `${CHAT_LAST_SEEN_PREFIX}${uid}`,
            String(state.messageCount),
          );
        }
      });
    }
  }, [chatUserId, threadId]);

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

  // Al entrar a la pantalla de chat se marca como leído (una vez por entrada).
  useEffect(() => {
    const prev = prevScreenRef.current;
    prevScreenRef.current = screen;
    if (screen === "chat" && prev !== "chat") {
      markChatRead();
    }
  }, [screen, markChatRead]);

  const builtReal =
    appointments && requests
      ? buildRealAppointments(appointments, requests)
      : null;

  const value = useMemo<AppState>(
    () => ({
      authLoading,
      flow,
      screen,
      toast,
      panicOpen,
      voiceOpen,
      sosActive,
      user,
      testsDone,
      chat,
      threadId,
      chatUnread,
      markChatRead,
      setActiveThreadId,
      watchConnected,
      watchName,
      program,
      programWeek,
      streak,
      weekCheckins,
      pointsToday,
      pointsTotal,
      navigate: (s) => setScreen(s),
      openBookingWizard: () => {
        setBookingWizardAutoOpen(true);
        setScreen("book");
      },
      bookingWizardAutoOpen,
      clearBookingWizardAutoOpen: () => setBookingWizardAutoOpen(false),
      finishLogin: (seed, next = "onboarding") => {
        // El primer inicio de sesión por ID siembra el perfil para el onboarding.
        // El login con contraseña (usuario ya registrado o demo) entra directo a la app.
        void (async () => {
          let meId: string | undefined;
          try {
            const me = await getMe();
            if (me?.id) meId = me.id;
          } catch {
            /* no bloqueante */
          }
          setUser((u) => {
            const updated = {
              ...u,
              ...(seed || {}),
              ...(meId ? { id: meId } : {}),
            };
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
            return updated;
          });
        })();
        setFlow(next);
        // Recrea el cliente urql para usar la cache y el WS con el token nuevo.
        onResetCommunityClient?.();
      },
      backToLogin: () => {
        setFlow("login");
        setScreen("home");
      },
      finishOnboarding: (u) => {
        setUser(u);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(u));
        setFlow("tests");
      },
      finishTests: () => setFlow("app"),
      skipTests: () => setFlow("app"),
      // Reabre la batería de evaluación desde la app (un paciente que ya pasó
      // el onboarding puede retomar sus tests pendientes).
      openTests: () => setFlow("tests"),
      markTest: (id) =>
        setTestsDone((prev) => (prev.includes(id) ? prev : [...prev, id])),
      showToast: (message, kind = "ok") => {
        setToast({ id: Date.now(), message, kind });
        window.setTimeout(() => setToast(null), 2600);
      },
      openPanic: () => {
        setSosActive(false);
        setPanicOpen(true);
      },
      closePanic: () => {
        setPanicOpen(false);
        setSosActive(false);
      },
      activateSos: () => setSosActive(true),
      openVoice: () => setVoiceOpen(true),
      closeVoice: () => setVoiceOpen(false),
      sendChat: (text) => {
        const userMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "user",
          text,
          time: nowLabel(),
          threadId,
        };

        // Si solo estaba el saludo inicial, se remueve para dar paso a la conversación
        setChat((prev) => {
          const isOnlyWelcome = prev.length === 1 && prev[0].id === "welcome";
          return isOnlyWelcome ? [userMsg] : [...prev, userMsg];
        });

        // Vía bloqueante como respaldo del streaming (misma respuesta final).
        const tryBlockingChat = async (): Promise<ChatMessage | null> => {
          try {
            const result = await sendChatMessage(text, threadId);
            const suggestion = result.suggestions?.find(
              (s) => s.type === "appointment",
            );
            return {
              id: crypto.randomUUID(),
              role: "bot",
              text: result.reply,
              time: nowLabel(),
              threadId: result.threadId || threadId,
              cta: suggestion,
            };
          } catch {
            return null;
          }
        };

        void (async () => {
          // Streaming: el mensaje del bot se crea vacío y se rellena token
          // a token. Si el stream falla sin haber pintado nada, se intenta
          // la vía bloqueante y al final el fallback local.
          const liveId = crypto.randomUUID();
          let painted = "";
          setChat((prev) => [
            ...prev,
            { id: liveId, role: "bot", text: "", time: nowLabel(), threadId },
          ]);
          const appendToken = (piece: string) => {
            painted += piece;
            const snapshot = painted;
            setChat((prev) =>
              prev.map((m) => (m.id === liveId ? { ...m, text: snapshot } : m)),
            );
          };
          try {
            const result = await streamChatMessage(text, threadId, {
              onToken: appendToken,
            });
            const suggestion = result.suggestions?.find(
              (s) => s.type === "appointment",
            );
            setChat((prev) =>
              prev.map((m) =>
                m.id === liveId
                  ? {
                      ...m,
                      text: result.reply,
                      threadId: result.threadId || threadId,
                      cta: suggestion,
                    }
                  : m,
              ),
            );
          } catch (err) {
            if (!painted) {
              // Sin streaming ni respuesta: se retira el vacío y va el fallback.
              setChat((prev) => prev.filter((m) => m.id !== liveId));
              const reply = await tryBlockingChat();
              if (reply) {
                setChat((prev) => [...prev, reply]);
              } else {
                // Safari serializa Error como {}: loguear el mensaje para ver
                // el status real (p. ej. "Error al enviar mensaje (401)").
                console.warn(
                  "[chat] Falló respuesta del AI service, usando fallback:",
                  err instanceof Error ? err.message : err,
                );
                const local = botReply(text, t);
                setChat((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    role: local.role,
                    text: local.text,
                    time: nowLabel(),
                    threadId,
                  },
                ]);
              }
            }
          }
        })();
      },
      hydrateChat: (messages) => {
        // Mensajes del bot ya inyectados en el thread por el backend (push
        // proactivo). Si el chat solo tiene el mensaje de bienvenida por defecto,
        // lo reemplazamos con el mensaje real de la sesión.
        if (!messages.length) return;
        setChat((prev) => {
          const isOnlyWelcome = prev.length === 1 && prev[0].id === "welcome";
          const stamped = messages.map((m) => ({
            id: crypto.randomUUID(),
            role: "bot" as const,
            text: m.text,
            time: nowLabel(),
            threadId,
          }));

          if (isOnlyWelcome) {
            return stamped;
          }

          const existing = new Set(prev.map((m) => m.text));
          const fresh = stamped.filter((m) => !existing.has(m.text));
          if (!fresh.length) return prev;
          return [...fresh, ...prev];
        });
      },
      appendChatMessages: (msgs) => {
        if (!msgs.length) return;
        const newMsgs: ChatMessage[] = msgs.map((m) => ({
          id: crypto.randomUUID(),
          role: m.role,
          text: m.text,
          time: nowLabel(),
          threadId,
          cta: m.cta,
          kind: m.kind,
        }));
        setChat((prev) => {
          const isOnlyWelcome = prev.length === 1 && prev[0].id === "welcome";
          return isOnlyWelcome ? newMsgs : [...prev, ...newMsgs];
        });
      },
      connectWatch: (name) => {
        setWatchConnected(true);
        setWatchName(name);
      },
      disconnectWatch: () => setWatchConnected(false),
      completeStep: (id, pts) => {
        setProgram((p) => {
          if (p[id]) return p;
          const next = { ...p, [id]: true };
          const finished = (Object.keys(next) as ProgramTaskId[]).every(
            (k) => next[k],
          );
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
        setFlow("login");
        setScreen("home");
        setActiveThreadId(null);
        setUser(defaultUser);
        setChat([createWelcomeMessage(defaultUser.nombre)]);
        localStorage.removeItem(USER_STORAGE_KEY);
        // Cierra sesión en el servidor y luego recrea el cliente urql (cache
        // limpia + WS nuevo) para no servir datos del usuario anterior.
        void logoutUser().then(() => onResetCommunityClient?.());
      },
      realMode,
      upcomingAppointments: builtReal?.upcoming ?? null,
      pastAppointments: builtReal?.past ?? null,
      appointmentsLoading,
      appointmentsError,
      teamProfessional,
      teamProfessionals,
      refreshAppointments,
      submitAppointmentRequest,
      cancelAppointmentById,
      openRoom: (appointment) => {
        setRoomAppointment(appointment);
        setScreen("room");
      },
      closeRoom: () => setRoomAppointment(null),
      roomAppointment,
    }),
    [
      authLoading,
      flow,
      screen,
      bookingWizardAutoOpen,
      toast,
      panicOpen,
      voiceOpen,
      sosActive,
      user,
      testsDone,
      chat,
      watchConnected,
      watchName,
      program,
      programWeek,
      streak,
      weekCheckins,
      pointsToday,
      pointsTotal,
      threadId,
      chatUnread,
      markChatRead,
      onResetCommunityClient,
      t,
      realMode,
      builtReal,
      appointmentsLoading,
      appointmentsError,
      teamProfessional,
      teamProfessionals,
      refreshAppointments,
      submitAppointmentRequest,
      cancelAppointmentById,
      roomAppointment,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
