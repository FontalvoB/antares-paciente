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
import { registerForPush } from "./utils/pushNotifications";
import { AppProvider, useApp } from "./context/AppContext";
import { I18nProvider } from "./i18n/I18nContext";
import { PanicOverlay } from "./components/PanicOverlay";
import { VoiceOverlay } from "./components/VoiceOverlay";
import { ToastHost } from "./components/ToastHost";
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

function Router() {
  const { flow, screen, authLoading } = useApp();

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
  const { flow, navigate, setActiveThreadId } = useApp();
  const pushStarted = useRef(false);

  // Al entrar a la app (flow === 'app') se registra el dispositivo para push.
  // Al tocar una notificación se navega al chat para ver el mensaje inyectado.
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
    });
  }, [flow, navigate, setActiveThreadId]);

  return (
    <div className="app-stage">
      <div className="app-shell">
        <Router />
        <PanicOverlay />
        <VoiceOverlay />
        <ToastHost />
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
            <IonApp>
              <Shell />
            </IonApp>
          </AppProvider>
        </I18nProvider>
      </QueryClientProvider>
    </Provider>
  );
}
