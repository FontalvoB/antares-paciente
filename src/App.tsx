import { setupIonicReact, IonApp, IonSpinner } from "@ionic/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "urql";
import { createCommunityClient } from "./graphql/client";
import {
  consumePendingRoomAppointmentId,
  registerForPush,
} from "./utils/pushNotifications";
import { fetchMyAppointments } from "./utils/appointmentsApi";
import { mapAppointmentToListed } from "./data/appointments";
import { AppProvider, useApp } from "./context/AppContext";
import { ProfilePage as PreviewProfile } from "./pages/ProfilePage";
import { NutritionPage as PreviewNutrition } from "./pages/NutritionPage";
import { useQueryClient } from "@tanstack/react-query";
import { programKeys } from "./hooks/queryKeys";
import { nutritionKeys } from "./hooks/queryKeys";
import type { ProgramSnapshotDto } from "./services/program/types";
import type { MyNutritionPlanDto } from "./services/nutrition/my-nutrition-plan-service";
import { WearableProvider } from "./context/WearableContext";
import { I18nProvider, useT } from "./i18n/I18nContext";
import { useKeyboardInset } from "./hooks/useKeyboardInset";
import { useTabletLayout } from "./hooks/useTabletLayout";
import { PanicOverlay } from "./components/PanicOverlay";
import { VoiceOverlay } from "./components/VoiceOverlay";
import { ToastHost } from "./components/ToastHost";
import { OfflineBanner } from "./components/common/OfflineBanner";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { TestsPage } from "./pages/TestsPage";
import { HomePage } from "./pages/HomePage";
import { AppointmentsPage } from "./pages/AppointmentsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { BodyProfilePage } from "./pages/BodyProfilePage";
import { NutritionPage } from "./pages/NutritionPage";
import { AcademyPage } from "./pages/AcademyPage";
import { InfinitoPage } from "./pages/InfinitoPage";
import { WearablePage } from "./pages/WearablePage";
import { ChatPage } from "./pages/ChatPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AvatarPage } from "./pages/AvatarPage";
import { ProgramPage } from "./pages/ProgramPage";
import { CommunityPage } from "./pages/CommunityPage";
import { VirtualRoomPage } from "./pages/VirtualRoomPage";
import logoLetras from "./assets/LogoConLetras.png";

setupIonicReact({ mode: "ios" });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: true,
      networkMode: "online",
    },
  },
});

const TRANSITION = { duration: 0.26, ease: [0.22, 1, 0.36, 1] } as const;

// DEV-PREVIEW-TEMPORAL-QA (revertir antes de commit): ?preview=prof|nut
// renderiza la vista con datos de muestra sin backend, para capturas
// Playwright. NO es verdad del servidor.
function previewNutSnapshot(): ProgramSnapshotDto {
  const today = new Date().toISOString().slice(0, 10);
  const at = (h: number, m: number) =>
    `${today}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`;
  return {
    enrollmentId: "preview-enrollment",
    template: {
      id: "preview-template",
      code: "preview",
      name: "Vista previa",
      totalWeeks: 12,
      currentWeekNumber: 3,
      currentWeekStatus: "Active",
      currentWeekStartDateLocal: today,
      currentWeekEndDateLocal: today,
    },
    todayLocalDate: today,
    todayTasks: [
      {
        taskCode: "nut",
        title: "Nutrición",
        short: "",
        points: 10,
        status: "in_progress",
        completedAt: null,
        content: {
          nutritionPlanName: "Plan Mediterráneo 1800",
          dailyCalorieTarget: 1800,
          dailyProteinTarget: 90,
          dailyCarbsTarget: 220,
          dailyFatTarget: 60,
          dailyFiberTarget: 25,
          nutritionMeals: [
            {
              mealType: "Desayuno",
              description: "Avena con frutos rojos y nueces",
              calories: 420,
              proteinG: 18,
              carbsG: 58,
              fatG: 12,
              fiberG: 6,
              notes: "Recomendación del plan clínico",
              sortOrder: 0,
            },
            {
              mealType: "Almuerzo",
              description: "Pechuga a la plancha con quinoa y ensalada",
              calories: 560,
              proteinG: 38,
              carbsG: 52,
              fatG: 14,
              fiberG: 5,
              notes: "Recomendación del plan clínico",
              sortOrder: 1,
            },
            {
              mealType: "Merienda",
              description: "Yogur griego con miel y almendras",
              calories: 180,
              proteinG: 14,
              carbsG: 20,
              fatG: 6,
              fiberG: 1,
              notes: "Recomendación del plan clínico",
              sortOrder: 2,
            },
            {
              mealType: "Cena",
              description: "Salmón al horno con verduras de temporada",
              calories: 480,
              proteinG: 34,
              carbsG: 28,
              fatG: 22,
              fiberG: 4,
              notes: "Recomendación del plan clínico",
              sortOrder: 3,
            },
          ],
          nutritionIntakeLogs: [
            {
              mealCode: "des",
              localDate: today,
              calories: 420,
              proteinG: 18,
              carbsG: 58,
              fatG: 12,
              fiberG: 6,
              source: "manual",
              createdAt: at(8, 30),
            },
            {
              mealCode: "alm",
              localDate: today,
              calories: 560,
              proteinG: 38,
              carbsG: 52,
              fatG: 14,
              fiberG: 5,
              source: "ai_photo",
              createdAt: at(13, 15),
            },
            {
              mealCode: "agua",
              localDate: today,
              waterMl: 750,
              source: "manual",
              createdAt: at(14, 0),
            },
          ],
        },
      },
    ],
    todayPoints: 0,
    todayBonusAvailable: true,
    todayPointsMax: 0,
    xp: { balance: 1250, level: "2", nextLevelAt: 2000 },
    streak: {
      current: 5,
      longest: 9,
      freezesRemaining: 1,
      multiplierActive: 0,
      multiplierEndsAt: null,
      multiplierRemainingHours: 0,
    },
    nextMilestoneDays: 2,
    calendar: [],
  } as unknown as ProgramSnapshotDto;
}

function PreviewHarness({ view }: { view: string }) {
  const qc = useQueryClient();
  const seeded = useRef(false);
  if (!seeded.current) {
    seeded.current = true;
    if (view === "nut") {
      qc.setQueryData(programKeys.snapshot, previewNutSnapshot());
      qc.setQueryData(nutritionKeys.myNutritionPlan, previewPlan());
    }
  }
  if (view === "nut") return <PreviewNutrition />;
  return <PreviewProfile />;
}

function previewPlan(): MyNutritionPlanDto {
  return {
    name: "Plan Mediterráneo 1800",
    description:
      "Plan equilibrado rico en vegetales, legumbres y grasas saludables.",
    targetCondition: "Sobrepeso",
    dailyCalorieTarget: 1800,
    dailyProteinTarget: 90,
    dailyCarbsTarget: 220,
    dailyFatTarget: 60,
    dailyFiberTarget: 25,
    dailyWaterMl: 2000,
    mealTiming: "7:00 · 12:30 · 16:00 · 19:30",
    meals: [
      {
        mealType: "Desayuno",
        description: "Bowl energético del día",
        foods: "Avena, frutos rojos, nueces y yogur natural",
        calories: 420,
        proteinG: 18,
        carbsG: 58,
        fatG: 12,
        fiberG: 6,
        notes: "Masticar despacio y sin pantallas",
        suggestedTime: "7:00",
        sortOrder: 0,
      },
      {
        mealType: "Almuerzo",
        description: "Plato principal",
        foods: "Pechuga a la plancha, quinoa y ensalada verde",
        calories: 560,
        proteinG: 38,
        carbsG: 52,
        fatG: 14,
        fiberG: 5,
        notes: "Mitad del plato en vegetales",
        suggestedTime: "12:30",
        sortOrder: 1,
      },
      {
        mealType: "Merienda",
        description: "Merienda ligera",
        foods: "Yogur griego con miel y almendras",
        calories: 180,
        proteinG: 14,
        carbsG: 20,
        fatG: 6,
        fiberG: 1,
        notes: null,
        suggestedTime: "16:00",
        sortOrder: 2,
      },
      {
        mealType: "Cena",
        description: "Cena liviana",
        foods: "Salmón al horno con verduras de temporada",
        calories: 480,
        proteinG: 34,
        carbsG: 28,
        fatG: 22,
        fiberG: 4,
        notes: "Cenar al menos 2 h antes de dormir",
        suggestedTime: "19:30",
        sortOrder: 3,
      },
    ],
    days: null,
  };
}

function Router() {
  const { flow, screen, authLoading } = useApp();

  // DEV-PREVIEW-TEMPORAL-QA (revertir antes de commit).
  if (import.meta.env.DEV && typeof window !== "undefined" && !authLoading) {
    const target = new URLSearchParams(window.location.search).get("preview");
    if (target === "prof" || target === "nut") {
      return <PreviewHarness view={target} />;
    }
  }

  if (authLoading) {
    return (
      <div className="screen auth auth-splash">
        <img src={logoLetras} alt="COPP-ADRESD" className="auth-logo" />
        <IonSpinner
          name="crescent"
          color="primary"
          style={{ width: 26, height: 26 }}
        />
      </div>
    );
  }

  let content: ReactNode;

  if (flow === "login") {
    content = <LoginPage />;
  } else if (flow === "onboarding") {
    content = <OnboardingPage />;
  } else if (flow === "tests") {
    content = <TestsPage />;
  } else {
    switch (screen) {
      case "book":
        content = <AppointmentsPage />;
        break;
      case "hc":
        content = <HistoryPage />;
        break;
      case "body":
        content = <BodyProfilePage />;
        break;
      case "nut":
        content = <NutritionPage />;
        break;
      case "edu":
        content = <AcademyPage />;
        break;
      case "infinito":
        content = <InfinitoPage />;
        break;
      case "bt":
        content = <WearablePage />;
        break;
      case "chat":
        content = <ChatPage />;
        break;
      case "prof":
        content = <ProfilePage />;
        break;
      case "avatar":
        content = <AvatarPage />;
        break;
      case "prog":
        content = <ProgramPage />;
        break;
      case "com":
        content = <CommunityPage />;
        break;
      case "room":
        content = <VirtualRoomPage />;
        break;
      default:
        content = <HomePage />;
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={flow === "app" ? `app-${screen}` : flow}
        className="router-page"
        initial={{ opacity: 0, y: 24, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -14, scale: 0.985 }}
        transition={TRANSITION}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}

function Shell() {
  const {
    flow,
    navigate,
    setActiveThreadId,
    openRoom,
    showToast,
    upcomingAppointments,
  } = useApp();
  const t = useT();
  const pushStarted = useRef(false);

  // Inset global del teclado virtual (una sola instancia para toda la app).
  useKeyboardInset();
  useTabletLayout();

  // Abre la sala pedida por una notificación push. Resuelve la cita por id
  // contra la lista real del paciente (en cold start el contexto aún puede no
  // tenerla) y solo navega si sigue activa (Confirmed/InProgress); si no está
  // o fue cancelada, avisa con un toast.
  const openRoomFromPush = useCallback(
    async (appointmentId: string) => {
      const isActive = (status?: string) =>
        status === "Confirmed" || status === "InProgress";
      const loaded = upcomingAppointments?.find((a) => a.id === appointmentId);
      try {
        const { items } = await fetchMyAppointments({ pageSize: 100 });
        const appointment = items.find((a) => a.id === appointmentId);
        if (appointment && isActive(appointment.status)) {
          openRoom(mapAppointmentToListed(appointment));
          return;
        }
        showToast(t("La cita ya no está disponible"));
      } catch {
        // Sin red/sesión: si la cita ya estaba cargada y activa, se entra igual.
        if (loaded && isActive(loaded.status)) {
          openRoom(loaded);
          return;
        }
        showToast(t("No se pudo verificar la cita. Inténtalo de nuevo."));
      }
    },
    [upcomingAppointments, openRoom, showToast, t],
  );

  // Al entrar a la app (flow === 'app') se registra el dispositivo para push.
  // Al tocar una notificación se navega al chat o a la sala según su carga.
  useEffect(() => {
    if (flow !== "app" || pushStarted.current) return;
    pushStarted.current = true;
    void registerForPush({
      onOpenChat: (targetThreadId) => {
        if (targetThreadId) {
          setActiveThreadId(targetThreadId);
        }
        navigate("chat");
      },
      onOpenRoom: (appointmentId) => {
        void openRoomFromPush(appointmentId);
      },
    });
  }, [flow, navigate, setActiveThreadId, openRoomFromPush]);

  // Cold start: la notificación pudo tocarse antes de que este contexto
  // montara; el id encolado se consume una sola vez aquí.
  useEffect(() => {
    if (flow !== "app") return;
    const pendingRoomId = consumePendingRoomAppointmentId();
    if (pendingRoomId) void openRoomFromPush(pendingRoomId);
  }, [flow, openRoomFromPush]);

  return (
    <div className="app-stage">
      <div className="app-shell">
        <Router />
        <PanicOverlay />
        <VoiceOverlay />
        <ToastHost />
        <OfflineBanner />
      </div>
    </div>
  );
}

export default function App() {
  // Cliente urql de la comunidad en estado de React: se recrea en cada
  // transición de autenticación para limpiar la cache y la conexión WS.
  const [communityClientState, setCommunityClientState] = useState(() =>
    createCommunityClient(),
  );

  // Callback estable que reemplaza el cliente por uno nuevo (cache limpia + WS
  // nuevo con el token del usuario actual). Se crea dentro del updater para no
  // recrearlo en cada render.
  const resetCommunityClient = useCallback(() => {
    setCommunityClientState(createCommunityClient());
  }, []);

  return (
    <Provider value={communityClientState}>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <AppProvider onResetCommunityClient={resetCommunityClient}>
            <WearableProvider>
              <IonApp>
                <Shell />
              </IonApp>
            </WearableProvider>
          </AppProvider>
        </I18nProvider>
      </QueryClientProvider>
    </Provider>
  );
}
