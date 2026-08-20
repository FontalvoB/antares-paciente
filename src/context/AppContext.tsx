import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { logoutUser } from '../utils/authApi'
import type {
  ChatMessage,
  CommunityPost,
  Flow,
  ProgramStepId,
  Screen,
  ToastKind,
  ToastState,
  UserProfile,
} from '../types'

interface AppState {
  flow: Flow
  screen: Screen
  toast: ToastState | null
  panicOpen: boolean
  voiceOpen: boolean
  sosActive: boolean
  user: UserProfile
  testsDone: number[]
  hydration: number
  mealsLogged: string[]
  chat: ChatMessage[]
  watchConnected: boolean
  watchName: string
  program: ProgramStepId
  pointsToday: number
  pointsTotal: number
  posts: CommunityPost[]
  navigate: (s: Screen) => void
  finishLogin: () => void
  backToLogin: () => void
  finishOnboarding: (user: UserProfile) => void
  finishTests: () => void
  skipTests: () => void
  markTest: (id: number) => void
  showToast: (message: string, kind?: ToastKind) => void
  openPanic: () => void
  closePanic: () => void
  activateSos: () => void
  openVoice: () => void
  closeVoice: () => void
  setHydration: (n: number) => void
  logMeal: (id: string) => void
  sendChat: (text: string) => void
  connectWatch: (name: string) => void
  disconnectWatch: () => void
  completeStep: (id: keyof ProgramStepId, pts: number) => void
  likePost: (id: string) => void
  addPost: (text: string) => void
  logout: () => void
}

const defaultUser: UserProfile = {
  nombre: 'María González',
  cedula: '10247381',
  dob: '1988-04-12',
  seguro: 'BlueCross BlueShield',
  poliza: 'BCB-20247381',
  grupo: 'GRP-5092',
  email: 'maria.gonzalez@email.com',
  celular: '+1 (786) 555-0100',
  fam1Nombre: 'Pedro González',
  fam1Parentesco: 'Esposo/a',
  fam1Cel: '+1 (786) 555-0192',
  fam1Email: 'pedro.gonzalez@email.com',
}

const seedPosts: CommunityPost[] = [
  {
    id: '1',
    initials: 'CR',
    name: 'Carlos Rodríguez',
    meta: 'Semana 14 · COPP-ADRESD · hace 2h',
    badge: '⭐ BIO+',
    badgeTone: 'teal',
    text: '¡Hoy completé mis 14 minutos de ejercicio! Semana 14 del programa y me siento increíble. Mi glucosa bajó de 108 a 91 mg/dL 🎉',
    likes: 24,
    comments: 8,
    liked: false,
    progress: 'Glucosa 108→91 · ↓17 mg/dL ✅',
  },
  {
    id: '2',
    initials: 'LP',
    name: 'Laura Pedraza',
    meta: 'Semana 8 · COPP-ADRESD · hace 5h',
    badge: 'BIO',
    badgeTone: 'blue',
    text: 'Mi almuerzo de hoy según el plan mediterráneo 🥗 La IA detectó 89% de adherencia. Poco a poco estamos aprendiendo a comer bien sin sufrir 😊',
    likes: 41,
    comments: 15,
    liked: false,
    photo: '🥗🍗🍚',
  },
  {
    id: '3',
    initials: 'JM',
    name: 'Jorge Martínez',
    meta: 'Semana 20 · COPP-ADRESD · ayer',
    badge: '🌟 TOP',
    badgeTone: 'gold',
    text: 'Semana 20 y ya bajé 8.3 kg. Mi HbA1c pasó de 6.4% a 5.6% — salí del rango de prediabetes. Para quienes están empezando: ¡sí se puede!',
    likes: 98,
    comments: 34,
    liked: true,
  },
]

const seedChat: ChatMessage[] = [
  {
    id: 'c1',
    role: 'bot',
    text: 'Hola María 👋 Soy tu agente de salud ANTARES. Tu glucosa de hoy fue 95 mg/dL (prediabetes según ADA 2026). También tienes cita con el Dr. Ramírez a las 3:00 PM. ¿En qué te puedo ayudar?',
    time: '9:30 AM',
  },
  {
    id: 'c2',
    role: 'user',
    text: 'Siento el pecho apretado y me duele el brazo izquierdo',
    time: '9:31 AM',
  },
  {
    id: 'c3',
    role: 'alert',
    text: '🚨 ALERTA MÉDICA DETECTADA\n\nLos síntomas que describes (dolor pecho + brazo izquierdo) pueden indicar un evento cardíaco. Presiona el botón SOS ahora.\n\nEstoy notificando a:\n• Emergencias 911\n• Dr. Carlos Ramírez\n• Pedro González (contacto emerg.)',
    time: '9:31 AM',
  },
]

const AppContext = createContext<AppState | null>(null)

function nowLabel() {
  return new Date().toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit' })
}

function botReply(text: string): { role: ChatMessage['role']; text: string } {
  const t = text.toLowerCase()
  if (t.includes('pecho') || t.includes('brazo') || t.includes('urgencia') || t.includes('síntoma')) {
    return {
      role: 'alert',
      text: 'Detecté un posible síntoma de alarma. Si el dolor es intenso, activa SOS. Mientras tanto: siéntate, no te acuestes plana y avisa a tu contacto de emergencia.',
    }
  }
  if (t.includes('comer') || t.includes('plan') || t.includes('comida')) {
    return {
      role: 'bot',
      text: 'Hoy tu plan es dieta mediterránea 1,800 kcal. Cena sugerida: sopa de lentejas + pan integral, antes de las 7:30 PM. Adherencia actual: 88%.',
    }
  }
  if (t.includes('cita') || t.includes('agendar')) {
    return {
      role: 'bot',
      text: 'Tu próxima cita es hoy 3:00 PM con Dr. Carlos Ramírez (telemedicina). Puedo recordártela 30 min antes. Para una nueva cita usa Solicitar cita en el módulo Citas.',
    }
  }
  if (t.includes('progreso')) {
    return {
      role: 'bot',
      text: 'Semana 12/24 · IMC 26.4 (↓1.2) · HbA1c 5.9% · adherencia 88% · 840 pts. Vas por buen camino hacia 65 kg e HbA1c < 5.7%.',
    }
  }
  if (t.includes('medit') || t.includes('ansiedad') || t.includes('infinito')) {
    return {
      role: 'bot',
      text: 'Prueba 4-7-8: inhala 4, retén 7, exhala 8. En INFINITO tienes frecuencias y mindfulness. El video PSICO de hoy dura 12 min.',
    }
  }
  return {
    role: 'bot',
    text: 'Entendido. Puedo ayudarte con tu plan nutricional, citas, medicamentos, progreso o activar SOS. ¿Qué necesitas ahora?',
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [flow, setFlow] = useState<Flow>('login')
  const [screen, setScreen] = useState<Screen>('home')
  const [toast, setToast] = useState<ToastState | null>(null)
  const [panicOpen, setPanicOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [sosActive, setSosActive] = useState(false)
  const [user, setUser] = useState<UserProfile>(defaultUser)
  const [testsDone, setTestsDone] = useState<number[]>([])
  const [hydration, setHydration] = useState(7)
  const [mealsLogged, setMealsLogged] = useState<string[]>([])
  const [chat, setChat] = useState<ChatMessage[]>(seedChat)
  const [watchConnected, setWatchConnected] = useState(false)
  const [watchName, setWatchName] = useState('ANTARES Watch Pro')
  const [program, setProgram] = useState<ProgramStepId>({
    vitals: false,
    nut: false,
    ejercicio: false,
    psico: false,
    comunidad: false,
  })
  const [pointsToday, setPointsToday] = useState(0)
  const [pointsTotal, setPointsTotal] = useState(840)
  const [posts, setPosts] = useState<CommunityPost[]>(seedPosts)

  const value = useMemo<AppState>(
    () => ({
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
      pointsToday,
      pointsTotal,
      posts,
      navigate: (s) => setScreen(s),
      finishLogin: () => setFlow('onboarding'),
      backToLogin: () => {
        setFlow('login')
        setScreen('home')
      },
      finishOnboarding: (u) => {
        setUser(u)
        setFlow('tests')
      },
      finishTests: () => setFlow('app'),
      skipTests: () => setFlow('app'),
      markTest: (id) => setTestsDone((prev) => (prev.includes(id) ? prev : [...prev, id])),
      showToast: (message, kind = 'ok') => {
        setToast({ id: Date.now(), message, kind })
        window.setTimeout(() => setToast(null), 2600)
      },
      openPanic: () => {
        setSosActive(false)
        setPanicOpen(true)
      },
      closePanic: () => {
        setPanicOpen(false)
        setSosActive(false)
      },
      activateSos: () => setSosActive(true),
      openVoice: () => setVoiceOpen(true),
      closeVoice: () => setVoiceOpen(false),
      setHydration,
      logMeal: (id) => setMealsLogged((prev) => (prev.includes(id) ? prev : [...prev, id])),
      sendChat: (text) => {
        const reply = botReply(text)
        setChat((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'user', text, time: nowLabel() },
          { id: crypto.randomUUID(), role: reply.role, text: reply.text, time: nowLabel() },
        ])
      },
      connectWatch: (name) => {
        setWatchConnected(true)
        setWatchName(name)
      },
      disconnectWatch: () => setWatchConnected(false),
      completeStep: (id, pts) => {
        setProgram((p) => ({ ...p, [id]: true }))
        setPointsToday((n) => n + pts)
        setPointsTotal((n) => n + pts)
      },
      likePost: (id) =>
        setPosts((list) =>
          list.map((p) =>
            p.id === id
              ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
              : p,
          ),
        ),
      logout: () => {
        void logoutUser()
        setFlow('login')
        setScreen('home')
      },
      addPost: (text) =>
        setPosts((list) => [
          {
            id: crypto.randomUUID(),
            initials: 'MG',
            name: user.nombre,
            meta: 'Semana 12 · COPP-ADRESD · ahora',
            badge: '⭐ BIO',
            badgeTone: 'gold',
            text,
            likes: 0,
            comments: 0,
            liked: false,
          },
          ...list,
        ]),
    }),
    [
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
      pointsToday,
      pointsTotal,
      posts,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
