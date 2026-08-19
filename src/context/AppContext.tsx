import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { logoutUser } from '../utils/authApi'
import { sendChatMessage } from '../utils/chatApi'
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
  chatLoading: boolean
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
    text: 'Hola 👋 Soy tu asistente de salud ANTARES. ¿En qué te puedo ayudar?',
    time: '9:30 AM',
  },
]

const AppContext = createContext<AppState | null>(null)

function nowLabel() {
  return new Date().toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit' })
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
  const [chatLoading, setChatLoading] = useState(false)
  // threadId persistente de la conversación (multi-turno) mientras vive la app.
  // Sin persistencia entre sesiones: se reinicia al recargar (no pedido).
  const threadIdRef = useRef<string | undefined>(undefined)
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
      chatLoading,
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
        if (chatLoading) return
        setChat((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'user', text, time: nowLabel() },
        ])
        setChatLoading(true)
        void (async () => {
          try {
            const result = await sendChatMessage(text, threadIdRef.current)
            threadIdRef.current = result.threadId
            setChat((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: 'bot',
                text: result.reply,
                time: nowLabel(),
                agent: result.agent,
              },
            ])
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error al conectar con el servidor'
            setChat((prev) => [
              ...prev,
              { id: crypto.randomUUID(), role: 'bot', text: msg, time: nowLabel() },
            ])
          } finally {
            setChatLoading(false)
          }
        })()
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
      chatLoading,
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
