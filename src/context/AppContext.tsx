import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getMe, logoutUser, restoreSession } from "../utils/authApi";
import { sendChatMessage } from "../utils/threadApi";
import { useT } from "../i18n/I18nContext";
import type {
  ChatMessage,
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
  hydration: number;
  mealsLogged: string[];
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
  finishLogin: (seed?: Partial<UserProfile>, next?: Flow) => void;
  backToLogin: () => void;
  finishOnboarding: (user: UserProfile) => void;
  finishTests: () => void;
  skipTests: () => void;
  markTest: (id: number) => void;
  showToast: (message: string, kind?: ToastKind) => void;
  openPanic: () => void;
  closePanic: () => void;
  activateSos: () => void;
  openVoice: () => void;
  closeVoice: () => void;
  setHydration: (n: number) => void;
  logMeal: (id: string) => void;
  sendChat: (text: string) => void;
  hydrateChat: (messages: { text: string }[]) => void;
  connectWatch: (name: string) => void;
  disconnectWatch: () => void;
  completeStep: (id: ProgramTaskId, pts: number) => void;
  logout: () => void;
}

const defaultUser: UserProfile = {
  nombre: "María González",
  cedula: "10247381",
  dob: "1988-04-12",
  seguro: "BlueCross BlueShield",
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
  const [toast, setToast] = useState<ToastState | null>(null);
  const [panicOpen, setPanicOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [user, setUser] = useState<UserProfile>(loadSavedUser);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [testsDone, setTestsDone] = useState<number[]>([]);
  const [hydration, setHydration] = useState(7);
  const [mealsLogged, setMealsLogged] = useState<string[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>(() => [
    createWelcomeMessage(loadSavedUser().nombre),
  ]);
  const [watchConnected, setWatchConnected] = useState(false);
  const [watchName, setWatchName] = useState("ANTARES Watch Pro");
  const [program, setProgram] = useState<ProgramDay>({
    podcast: false,
    vitals: false,
    nut: false,
    ejercicio: false,
    nutribiotico: false,
    emocional: false,
  });
  const [programWeek] = useState(12);
  const [streak, setStreak] = useState(22);
  const [weekCheckins, setWeekCheckins] = useState<boolean[]>([
    true,
    true,
    true,
    true,
    false,
    false,
    false,
  ]);
  const [pointsToday, setPointsToday] = useState(0);
  const [pointsTotal, setPointsTotal] = useState(4820);

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
      hydration,
      mealsLogged,
      chat,
      threadId,
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
      setHydration,
      logMeal: (id) =>
        setMealsLogged((prev) => (prev.includes(id) ? prev : [...prev, id])),
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

        void (async () => {
          try {
            const result = await sendChatMessage(text, threadId);
            setChat((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "bot",
                text: result.reply,
                time: nowLabel(),
                threadId: result.threadId || threadId,
              },
            ]);
          } catch (err) {
            console.warn(
              "[chat] Falló respuesta del AI service, usando fallback:",
              err,
            );
            const reply = botReply(text, t);
            setChat((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: reply.role,
                text: reply.text,
                time: nowLabel(),
                threadId,
              },
            ]);
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
    }),
    [
      authLoading,
      flow,
      screen,
      toast,
      panicOpen,
      voiceOpen,
      sosActive,
      user,
      testsDone,
      hydration,
      mealsLogged,
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
      onResetCommunityClient,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
