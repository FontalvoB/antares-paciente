---
name: ionic-architecture
description: Arquitectura del frontend ANTARES Paciente (Ionic React). Estructura de carpetas, convenciones, estado global, navegación por estado, dónde vive cada cosa y qué NO crear. Cárgala antes de cualquier trabajo sustancial en antares-paciente.
---

# Arquitectura — ANTARES Paciente (Ionic React)

App móvil **React 19 + Ionic 8.8 + Capacitor 8 + Vite + TS**. Demo funcional mobile-first, sin backend integrado. Comentarios y docs en **español**.

> **ESTADO ACTUAL** = lo que existe hoy (verificado). **ESTADO RECOMENDADO** = cómo debe escribirse el código NUEVO (Ionic-first, matriz en `ionic-components`). **MIGRACIÓN FUTURA** = cambios planificados pero NO implementados (no asumir que existen). Antes de crear UI: seguir el flujo BEFORE CODING de `ionic-rules`.

## Estructura de `src/`

```
src/
├── App.tsx            # setupIonicReact({mode:'ios'}) + ROUTER POR ESTADO + Shell (overlays)
├── main.tsx           # bootstrap: CSS de Ionic + theme/variables.css + theme/global.css
├── types.ts           # tipos compartidos: Screen, Flow, TabId, UserProfile, ChatMessage, Meal, ...
├── context/
│   └── AppContext.tsx # TODO estado global (useApp) + acciones simuladas
├── pages/             # UNA pantalla por archivo (14): Home, Appointments, History, Nutrition,
│                      # Academy, Infinito, Wearable, Chat, Profile, Program, Community,
│                      # Onboarding, Tests + (Router switch)
├── components/        # Screen, Scroll, BottomNav, ToastHost, PanicOverlay, VoiceOverlay, Forms
├── data/
│   └── tests.ts       # definiciones de los 9 tests de salud
└── theme/
    ├── variables.css  # tokens de diseño (NO editar sin revisar)
    └── global.css     # estilos de TODOS los componentes custom (1059 líneas)
```

## Reglas de estructura

- **Toda pantalla nueva** → archivo en `pages/`, exportada como `NombrePage`, registrada en el switch de `App.tsx` y en `Screen` type de `types.ts`.
- **Toda pieza reutilizable** → `components/`, export nombrada.
- **NO crear** `services/`, `hooks/`, `routes/` por ahora — no existen; si se necesita un helper, va en `components/Forms.tsx` (patrón existente) o en el contexto.
- **`utils/`**: existe `src/utils/dates.ts` (formato de fechas dd/mm/aaaa ↔ ISO) — helpers de presentación puros pueden vivir aquí, con nombre de archivo por dominio (`dates.ts`).
- **Datos simulados** → dentro del archivo (constantes en el page) o en `data/`. No crear APIs falsas.
- **Estado global** → SOLO a través de `useApp()` de `context/AppContext.tsx`. No duplicar estado en props si afecta a 2+ pantallas.
- **Estilos**: clases en `theme/global.css` o `style={{}}` inline para casos únicos. NUNCA CSS modules ni styled-components (no están en el proyecto).

## Navegación (IMPORTANTE — state machine, sin react-router)

`App.tsx:25-51` es un switch sobre `flow` (onboarding|tests|app) y `screen` (11 valores). `react-router-dom` está instalado pero **NO se usa**.

- Cambiar de pantalla: `navigate('book' | 'hc' | 'nut' | 'edu' | 'infinito' | 'bt' | 'chat' | 'prof' | 'prog' | 'com')` desde `useApp()`.
- No hay URLs, historial ni back button nativo. No recargar la página (se pierde todo).
- Los `ScreenId` viven en `types.ts` y en `BottomNav.tsx` hay 5 tabs + SOS.

## Flujos

1. **onboarding** (5 pasos, `OnboardingPage`) → `finishOnboarding(user)` → `flow='tests'`
2. **tests** (9 evaluaciones, `TestsPage`, saltables) → `finishTests()`/`skipTests()` → `flow='app'`
3. **app** → pantallas según `screen` + overlays globales: `PanicOverlay`, `VoiceOverlay`, `ToastHost` montados en `App.tsx:59-61`.

## Layout de una página (patrón obligatorio)

```tsx
import { Screen, Scroll } from '../components/Screen'
export function MiPage() {
  return (
    <Screen>            {/* framer-motion + BottomNav automático */}
      <div className="hero hero-cosmos">…</div>   {/* header con gradiente */}
      <Scroll>…</Scroll>  {/* área scrolleable, padding-bottom para nav */}
    </Screen>
  )
}
```

- `<Screen hideNav>` para pantallas sin BottomNav; `<Scroll noNav>` si no hay nav.
- Sticky footers: `position:absolute; bottom:0` con `env(safe-area-inset-bottom)` (ver `OnboardingPage.tsx:365-374`, `TestsPage.tsx:288-294`).

## Comandos

```bash
npm run dev        # vite --host → http://localhost:5173
npm run build      # tsc -b && vite build
npm run lint       # oxlint (plugins react, typescript, oxc)
npm run sync       # build + npx cap sync
```

Verificar siempre `npm run build` y `npm run lint` tras cambios. tsconfig: `verbatimModuleSyntax` → usar `import type { X }` para tipos.

## Skills relacionadas

`ionic-components`, `ionic-forms`, `ionic-navigation`, `ionic-overlays`, `ionic-responsive`, `ionic-theme`, `reusable-components`, `ionic-rules` — cargar según la tarea. Auditoría completa: `docs/auditoria.md`.
