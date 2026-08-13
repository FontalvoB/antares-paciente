---
name: ionic-navigation
description: Navegación en ANTARES Paciente. Diferencia entre ESTADO DE UI (flow/screen/modal/selectedTab — lo que existe hoy) y NAVEGACIÓN REAL (URL/router/history/back/deep-link — migración futura). Cómo navegar hoy y plan de migración a IonReactRouter. No migrar sin autorización.
---

# Navegación — ANTARES Paciente

## ESTADO ACTUAL vs NAVEGACIÓN REAL (distinción crítica)

| Concepto | ESTADO DE UI (lo que existe HOY) | NAVEGACIÓN REAL (MIGRACIÓN FUTURA) |
|---|---|---|
| Mecanismo | State machine en `AppContext` (`flow` + `screen`) | URL + router (`IonReactRouter` + `IonRouterOutlet`) |
| Variables | `flow` (`onboarding\|tests\|app`), `screen` (11 valores), `modal` (en `useApp()`), `selectedTab` (`BottomNav`) | `route`, `history`, `back`, `deep-link` |
| Cambiar pantalla | `useApp().navigate('book')` | `routerLink` / `useHistory().push('/citas')` |
| Historíal / back nativo | NO existe | `IonBackButton`, `history.back()` |
| Deep-linking | NO existe (sin URLs) | Capacitor lo soporta con rutas reales |
| Persistencia | NO (recargar = volver a onboarding) | URLs persistentes |

**REGLAS:**
- Las recomendaciones de router NO describen lo que ya existe — son **MIGRACIÓN FUTURA**.
- **NO migrar** ahora: prohibido sin autorización explícita (tarea de migración separada y planificada).

## Estado actual (verificado)

`react-router-dom@7.18.2` instalado pero **0 imports**. Navegación en `App.tsx:25-51`:

```tsx
const { flow, screen } = useApp()
if (flow === 'onboarding') return <OnboardingPage />
if (flow === 'tests') return <TestsPage />
switch (screen) {
  case 'book': return <AppointmentsPage />
  case 'hc': return <HistoryPage />
  case 'nut': return <NutritionPage />
  case 'edu': return <AcademyPage />
  case 'infinito': return <InfinitoPage />
  case 'bt': return <WearablePage />
  case 'chat': return <ChatPage />
  case 'prof': return <ProfilePage />
  case 'prog': return <ProgramPage />
  case 'com': return <CommunityPage />
  default: return <HomePage />
}
```

Tipo `Screen` (`types.ts:1-12`): `home, book, hc, nut, edu, infinito, bt, chat, prof, prog, com`. `TabId` (`types.ts:16`): `home, book, nut, chat, prof`.

## Cómo navegar HOY (obligatorio hasta migración)

```tsx
import { useApp } from '../context/AppContext'
const { navigate } = useApp()
navigate('book')   // Screen: 'home'|'book'|'hc'|'nut'|'edu'|'infinito'|'bt'|'chat'|'prof'|'prog'|'com'
```

- Flujos: `finishOnboarding(user)` → `'tests'`, `finishTests()`/`skipTests()` → `'app'`, `logout()` → `'onboarding'` (`AppContext.tsx:219-272`).
- Navegación entre pantallas DEBE pasar por `useApp().navigate` — **no** renderizar páginas directamente.
- Estado de overlays globales (panic, voice) vive en `useApp()` (`modal`), montados en `App.tsx:59-61`.
- **Limitaciones que NO romper**: no hay back button, no hay URLs, recargar pierde todo el estado.

## BottomNav (tabs) — estado actual

`BottomNav.tsx` renderiza 5 tabs custom (`Inicio, Citas, Nutrición, Chat IA, Perfil` — ids `home, book, nut, chat, prof`) + botón SOS flotante, basado en `screen`. No usa `IonTabs`. **MIGRACIÓN FUTURA:** `IonTabs` + `IonTabBar` + `IonTabButton` (requiere router).

## MIGRACIÓN FUTURA — IonReactRouter (plan, NO ejecutar)

Objetivo (app móvil Capacitor con URLs reales):

```tsx
// App.tsx (estructura objetivo)
<IonApp>
  <IonReactRouter>
    <AppProvider>
      <IonRouterOutlet>
        <Route path="/" exact component={HomePage} />
        <Route path="/citas" component={AppointmentsPage} />
        ...
        <Route path="/onboarding" component={OnboardingPage} />
      </IonRouterOutlet>
      <PanicOverlay /> <VoiceOverlay /> <ToastHost />
    </AppProvider>
  </IonReactRouter>
</IonApp>
```

Pasos (cuando se autorice, de forma planificada):
1. Envolver con `IonReactRouter`; convertir `flow`/`screen` en rutas (`/onboarding`, `/tests`, `/app/home`, …).
2. Convertir `BottomNav` en `IonTabBar` + `IonTabButton` con `IonTabs` (5 tabs) y SOS como botón aparte.
3. `navigate(s)` → `routerLink` en `IonButton` o `useHistory().push('/citas')`.
4. `IonBackButton` para el botón ← de `TestsPage.tsx:82-87`.
5. Deep-linking: Capacitor lo soporta con rutas reales.
6. Compatibilidad framer-motion (`Screen.tsx`) con transiciones del router — **PENDIENTE DE VALIDACIÓN**.

## Reglas

1. NO usar react-router hasta que la migración esté autorizada (mantener `navigate()` del contexto).
2. Toda nueva pantalla se registra en 3 lugares: el page en `pages/`, el switch en `App.tsx`, el tipo `Screen` en `types.ts`.
3. No montar overlays fuera de `App.tsx` — los globales viven en `Shell` (`App.tsx:59-61`).
4. No crear navegación paralela (dos formas de cambiar de pantalla) — una sola vía: `useApp().navigate`.
5. Ante deep-linking o back button nativo requeridos → proponer migración a router (plan arriba), no parchear.
