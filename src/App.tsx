import { APPOINTMENTS_ENABLED } from "./utils/appointmentsVisibility";
import { LanguageQuerySync } from "./components/LanguageQuerySync";
import { AchievementCenter } from "./components/achievements/AchievementCenter";
import { setupIonicReact, IonApp, IonSpinner } from "@ionic/react";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useReducedMotion,
} from "framer-motion";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "urql";
import { queryClient } from "./utils/queryClient";
import { createCommunityClient } from "./graphql/client";
import {
  consumePendingRoomAppointmentId,
  registerForPush,
  syncPushLanguage,
} from "./utils/pushNotifications";
import { fetchMyAppointments } from "./utils/appointmentsApi";
import { mapAppointmentToListed } from "./data/appointments";
import { AppProvider, useApp } from "./context/AppContext";
import { LegalConsentProvider } from "./context/LegalConsentContext";
import { AiDisclosureProvider } from "./context/AiDisclosureContext";
import { WearableProvider } from "./context/WearableContext";
import { HealthProvider } from "./context/HealthContext";
import { HEALTH_ENABLED } from "./utils/features";
import { I18nProvider, useI18n } from "./i18n/I18nContext";
import { useKeyboardInset } from "./hooks/useKeyboardInset";
import { useStatusBarContrast } from "./hooks/useStatusBarContrast";
import { useTabletLayout } from "./hooks/useTabletLayout";
import { PanicOverlay } from "./components/PanicOverlay";
import { SosQuickAccess } from "./components/SosQuickAccess";
import { SosLayer } from "./components/SosLayer";
import { VoiceOverlay } from "./components/VoiceOverlay";
import { VitaWelcome } from "./components/VitaWelcome";
import { ToastHost } from "./components/ToastHost";
import { OfflineBanner } from "./components/common/OfflineBanner";
import { DailyProtocolReminder } from "./components/DailyProtocolReminder";
import { LoginPage } from "./pages/LoginPage";
import { ConsentPreviewPage } from "./pages/ConsentPreviewPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { TestsPage } from "./pages/TestsPage";
import { WellnessHome } from "./features/wellness/home/WellnessHome";
import { WellnessProtocol } from "./features/wellness/protocol/WellnessProtocol";
import { WellnessDiet } from "./features/wellness/nutrition/WellnessDiet";
import { WellnessGoalPage } from "./features/wellness/goal/WellnessGoalPage";
import { WellnessExercise } from "./features/wellness/exercise/WellnessExercise";
import { WellnessCloseDay } from "./features/wellness/checkin/WellnessCloseDay";
import { checkinOwner, syncCheckins } from "./features/wellness/checkin/checkin-store";
import { AppointmentsPage } from "./pages/AppointmentsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { BodyProfilePage } from "./pages/BodyProfilePage";
import { NutritionPage } from "./pages/NutritionPage";
import { AcademyPage } from "./pages/AcademyPage";
import { InfinitoPage } from "./pages/InfinitoPage";
import { WearablePage } from "./pages/WearablePage";
import { HealthAccessoryPage } from "./pages/HealthAccessoryPage";
import { ChatPage } from "./pages/ChatPage";
import { ProfilePage } from "./pages/ProfilePage";
import { MedicalSourcesPage } from "./pages/MedicalSourcesPage";
import { MedicationsPage } from "./pages/MedicationsPage";
import { AvatarPage } from "./pages/AvatarPage";
import { ProgramPage } from "./pages/ProgramPage";
import { CommunityPage } from "./pages/CommunityPage";
import { VirtualRoomPage } from "./pages/VirtualRoomPage";
import logoLetras from "./assets/LogoConLetras.png";

setupIonicReact({ mode: "ios" });

const TRANSITION = { duration: 0.26, ease: [0.22, 1, 0.36, 1] } as const;

function Router() {
  const { flow, screen, authLoading } = useApp();
  const reducedMotion = useReducedMotion();

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
      case "protocol":
        content = <WellnessProtocol />;
        break;
      case "wellness-diet":
        content = <WellnessDiet />;
        break;
      case "wellness-goal":
        content = <WellnessGoalPage />;
        break;
      case "wellness-exercise":
        content = <WellnessExercise />;
        break;
      case "wellness-checkin":
        content = <WellnessCloseDay />;
        break;
      case "book":
        content = APPOINTMENTS_ENABLED ? (
          <AppointmentsPage />
        ) : (
          <NutritionPage />
        );
        break;
      case "hc":
        content = <HistoryPage />;
        break;
      case "body":
        content = <BodyProfilePage />;
        break;
      case "nut":
      case "program-nut":
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
      case "health-accessory":
        content = HEALTH_ENABLED ? <HealthAccessoryPage /> : <WellnessHome />;
        break;
      case "chat":
        content = <ChatPage />;
        break;
      case "prof":
        content = <ProfilePage />;
        break;
      case "medical-sources":
        content = <MedicalSourcesPage />;
        break;
      case "medications":
        content = <MedicationsPage />;
        break;
      case "avatar":
        content = <AvatarPage />;
        break;
      case "program-podcast":
      case "program-vitals":
      case "program-ejercicio":
      case "program-nutraceutico":
      case "program-emocional":
      case "program-racha":
      case "prog":
        content = <ProgramPage />;
        break;
      case "com":
        content = <CommunityPage />;
        break;
      case "room":
        content = APPOINTMENTS_ENABLED ? (
          <VirtualRoomPage />
        ) : (
          <NutritionPage />
        );
        break;
      default:
        content = <WellnessHome />;
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={
          flow === "app"
            ? `app-${screen.startsWith("program-") ? "prog" : screen}`
            : flow
        }
        className="router-page"
        initial={reducedMotion ? false : { opacity: 0, y: 24, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={
          reducedMotion ? { opacity: 1 } : { opacity: 0, y: -14, scale: 0.985 }
        }
        transition={reducedMotion ? { duration: 0 } : TRANSITION}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}

function Shell() {
  const {
    user,
    flow,
    navigate,
    setActiveThreadId,
    openRoom,
    showToast,
    upcomingAppointments,
  } = useApp();
  const { t, lang } = useI18n();
  const pushStarted = useRef(false);
  const wellnessOwner = checkinOwner(user);

  useEffect(() => {
    if (flow !== "app") return;
    const sync = () => { void syncCheckins(wellnessOwner); };
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [flow, wellnessOwner]);

  // Inset global del teclado virtual (una sola instancia para toda la app).
  useKeyboardInset();
  // Hora/batería legibles: iconos de la barra de estado según el fondo real.
  useStatusBarContrast();
  useTabletLayout();

  // Abre la sala pedida por una notificación push. Resuelve la cita por id
  // contra la lista real del paciente (en cold start el contexto aún puede no
  // tenerla) y solo navega si sigue activa (Confirmed/InProgress); si no está
  // o fue cancelada, avisa con un toast.
  const openRoomFromPush = useCallback(
    async (appointmentId: string) => {
      if (!APPOINTMENTS_ENABLED) return;
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
      language: lang,
      onOpenChat: (targetThreadId) => {
        if (targetThreadId) {
          setActiveThreadId(targetThreadId);
        }
        navigate("chat");
      },
      onOpenMedications: () => navigate("medications"),
      onOpenRoom: (appointmentId) => {
        void openRoomFromPush(appointmentId);
      },
    });
  }, [flow, lang, navigate, setActiveThreadId, openRoomFromPush]);

  // Actualiza el token ya conocido al cambiar idioma/cuenta sin pedir permisos de nuevo.
  useEffect(() => {
    if (flow === "app") void syncPushLanguage(lang);
  }, [flow, lang, user.id]);

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
        <HealthProvider>
          <Router />
        </HealthProvider>
        <VoiceOverlay />
        <ToastHost />
        <VitaWelcome />
        <OfflineBanner />
        {flow === "app" && user.id && <AchievementCenter key={user.id} />}
        {flow === "app" && <DailyProtocolReminder />}
        {/* KAN-137: SOS global por encima de modales, teclado, video y sesión. */}
        <SosLayer>
          <SosQuickAccess />
          <PanicOverlay />
        </SosLayer>
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
    // La sesión siguiente tampoco debe heredar planes, protocolo o registros
    // clínicos de la cache TanStack de la cuenta anterior.
    queryClient.clear();
    setCommunityClientState(createCommunityClient());
  }, []);

  if (
    __DEV_TOOLS__ &&
    new URLSearchParams(window.location.search).has("consent-test")
  ) {
    return (
      <I18nProvider>
        <IonApp>
          <ConsentPreviewPage
            longText={
              new URLSearchParams(window.location.search).get(
                "consent-test",
              ) === "long"
            }
          />
        </IonApp>
      </I18nProvider>
    );
  }

  return (
    <Provider value={communityClientState}>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <LanguageQuerySync />
          <IonApp>
            <LegalConsentProvider>
              <AiDisclosureProvider>
                <AppProvider onResetCommunityClient={resetCommunityClient}>
                  <WearableProvider>
                    <MotionConfig reducedMotion="user">
                      <Shell />
                    </MotionConfig>
                  </WearableProvider>
                </AppProvider>
              </AiDisclosureProvider>
            </LegalConsentProvider>
          </IonApp>
        </I18nProvider>
      </QueryClientProvider>
    </Provider>
  );
}
