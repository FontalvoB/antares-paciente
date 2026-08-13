import { setupIonicReact, IonApp } from '@ionic/react'
import { AppProvider, useApp } from './context/AppContext'
import { PanicOverlay } from './components/PanicOverlay'
import { VoiceOverlay } from './components/VoiceOverlay'
import { ToastHost } from './components/ToastHost'
import { OnboardingPage } from './pages/OnboardingPage'
import { TestsPage } from './pages/TestsPage'
import { HomePage } from './pages/HomePage'
import { AppointmentsPage } from './pages/AppointmentsPage'
import { HistoryPage } from './pages/HistoryPage'
import { NutritionPage } from './pages/NutritionPage'
import { AcademyPage } from './pages/AcademyPage'
import { InfinitoPage } from './pages/InfinitoPage'
import { WearablePage } from './pages/WearablePage'
import { ChatPage } from './pages/ChatPage'
import { ProfilePage } from './pages/ProfilePage'
import { ProgramPage } from './pages/ProgramPage'
import { CommunityPage } from './pages/CommunityPage'

setupIonicReact({ mode: 'ios' })

function Router() {
  const { flow, screen } = useApp()

  if (flow === 'onboarding') return <OnboardingPage />
  if (flow === 'tests') return <TestsPage />

  switch (screen) {
    case 'book':
      return <AppointmentsPage />
    case 'hc':
      return <HistoryPage />
    case 'nut':
      return <NutritionPage />
    case 'edu':
      return <AcademyPage />
    case 'infinito':
      return <InfinitoPage />
    case 'bt':
      return <WearablePage />
    case 'chat':
      return <ChatPage />
    case 'prof':
      return <ProfilePage />
    case 'prog':
      return <ProgramPage />
    case 'com':
      return <CommunityPage />
    default:
      return <HomePage />
  }
}

function Shell() {
  return (
    <div className="app-stage">
      <div className="app-shell">
        <Router />
        <PanicOverlay />
        <VoiceOverlay />
        <ToastHost />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <IonApp>
        <Shell />
      </IonApp>
    </AppProvider>
  )
}
