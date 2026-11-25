import { LanguageQuerySync } from "./components/LanguageQuerySync";
import { setupIonicReact, IonApp, IonSpinner } from "@ionic/react";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useReducedMotion,
} from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./utils/queryClient";
import { registerForPush, syncPushLanguage } from "./utils/pushNotifications";
import { AppProvider, useApp } from "./context/AppContext";
import { LegalConsentProvider } from "./context/LegalConsentContext";
import { AiDisclosureProvider } from "./context/AiDisclosureContext";
import { WearableProvider } from "./context/WearableContext";
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
import { getAccessToken } from "./utils/authApi";
import { sessionUserId } from "./utils/sessionIdentity";
import { WellnessJourneyPage } from "./pages/WellnessJourneyPage";
import type { PaidGeneration } from "./features/wellness/generation/wellness-journey-api";
import { TestsPage } from "./pages/TestsPage";
import { WellnessHome } from "./features/wellness/home/WellnessHome";
import { WellnessProtocol } from "./features/wellness/protocol/WellnessProtocol";
import { WellnessDiet } from "./features/wellness/nutrition/WellnessDiet";
import { WellnessGoalPage } from "./features/wellness/goal/WellnessGoalPage";
import { WellnessExercise } from "./features/wellness/exercise/WellnessExercise";
import { WellnessCloseDay } from "./features/wellness/checkin/WellnessCloseDay";
import { WellnessVitals } from "./features/wellness/vitals/WellnessVitals";
import {
  checkinOwner,
  syncCheckins,
} from "./features/wellness/checkin/checkin-store";
import { ProfilePage } from "./pages/ProfilePage";
import logoLetras from "./assets/LogoConLetras.png";

setupIonicReact({ mode: "ios" });

const TRANSITION = { duration: 0.26, ease: [0.22, 1, 0.36, 1] } as const;

function Router() {
  const { flow, screen, authLoading, user } = useApp();
  const reducedMotion = useReducedMotion();
  const paidJourney = import.meta.env.DEV && import.meta.env.VITE_WELLNESS_JOURNEY_DEMO === "true"
    && new URLSearchParams(window.location.search).get("wellnessJourney") === "1";

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

  if (flow === "login" || (paidJourney && flow === "onboarding")) {
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
      case "wellness-vitals":
        content = <WellnessVitals />;
        break;
      case "prof":
        content = <ProfilePage />;
        break;
      // TODO KAN-146: revisar el c?digo legado antes de volver a exponer m?dulos retirados.
      default:
        content = <WellnessHome />;
    }
  }

  const renderScreen = (generation?: PaidGeneration) => (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={flow === "app" ? `app-${screen}` : flow}
        className="router-page"
        initial={reducedMotion ? false : { opacity: 0, y: 24, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={
          reducedMotion ? { opacity: 1 } : { opacity: 0, y: -14, scale: 0.985 }
        }
        transition={reducedMotion ? { duration: 0 } : TRANSITION}
      >
        {generation && screen === "home" ? <WellnessHome paidGeneration={generation} /> : content}
      </motion.div>
    </AnimatePresence>
  );
  if (paidJourney && flow === "app") {
    const accountId = sessionUserId(getAccessToken()) ?? user.id;
    return accountId ? (
      <WellnessJourneyPage key={accountId} userId={accountId}>{renderScreen}</WellnessJourneyPage>
    ) : <LoginPage />;
  }

  return renderScreen();
}

function Shell() {
  const { user, flow, navigate } = useApp();
  const { lang } = useI18n();
  const pushStarted = useRef(false);
  const wellnessOwner = checkinOwner(user);

  useEffect(() => {
    if (flow !== "app") return;
    const sync = () => {
      void syncCheckins(wellnessOwner);
    };
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [flow, wellnessOwner]);

  // Inset global del teclado virtual (una sola instancia para toda la app).
  useKeyboardInset();
  // Hora/batería legibles: iconos de la barra de estado según el fondo real.
  useStatusBarContrast();
  useTabletLayout();

  useEffect(() => {
    if (flow !== "app" || pushStarted.current) return;
    pushStarted.current = true;
    void registerForPush({
      language: lang,
      onOpenHome: () => navigate("home"),
    });
  }, [flow, lang, navigate]);

  // Actualiza el token ya conocido al cambiar idioma/cuenta sin pedir permisos de nuevo.
  useEffect(() => {
    if (flow === "app") void syncPushLanguage(lang);
  }, [flow, lang, user.id]);

  return (
    <div className="app-stage">
      <div className="app-shell">
        <Router />
        <VoiceOverlay />
        <ToastHost />
        <VitaWelcome />
        <OfflineBanner />
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

function resetSessionCache() {
  queryClient.clear();
}

export default function App() {
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
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <LanguageQuerySync />
        <IonApp>
          <LegalConsentProvider>
            <AiDisclosureProvider>
              <AppProvider onResetSessionCache={resetSessionCache}>
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
  );
}
