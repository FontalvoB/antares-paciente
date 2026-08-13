# Auditoría Frontend — ANTARES Paciente (Ionic React)

> **Fecha:** 2026-08-13 · **Alcance:** `antares-paciente/` completo (src, theme, config)
> **Método:** lectura de los 27 archivos de `src/` + `index.html`, `package.json`, `capacitor.config.ts`, `tsconfig.app.json`, `.oxlintrc.json`
> **Regla cumplida:** nada inventado — todo lo documentado existe en el código real.

---

## 1. Resumen ejecutivo

La app es una **demo funcional mobile-first** de alta calidad visual (design system propio con variables CSS, animaciones framer-motion, shell tipo teléfono en desktop). Sin embargo:

| Área | Estado |
|---|---|
| Componentes Ionic reales | **Solo 2:** `IonApp` e `IonIcon` (+ `setupIonicReact`) |
| Navegación | **No usa react-router** (instalado pero sin imports). Router propio por estado en contexto |
| Formularios | 100 % HTML nativo (`input`, `select`, `textarea`, `button`) |
| Feedback al usuario | Toast, modales y loading 100 % custom (framer-motion) |
| Datos | 100 % hardcodeados en `data/` y contexto. Sin servicios, sin persistencia |
| Dark mode | No existe (heroes oscuros sobre fondo claro) |
| Responsive | Mobile-first correcto (shell 430px, safe areas, keyboard resize) |

**Conclusión:** es una app *con estilo Ionic* pero *sin componentes Ionic*. La base de estilos (variables `--ion-*`, CSS bundles de Ionic, `setupIonicReact({ mode: 'ios' })`) está lista para migrar los widgets uno a uno.

---

## 2. Stack real (verificado en `package.json`)

| Dependencia | Versión | Uso real |
|---|---|---|
| `@ionic/react` | ^8.8.18 | `IonApp`, `IonIcon`, `setupIonicReact`, CSS bundles |
| `ionicons` | ^8.1.0 | íconos (calendar, leaf, medkit, mic, send…) |
| `react` / `react-dom` | ^19.2.8 | — |
| `react-router-dom` | ^7.18.2 | **INSTALADO, SIN USO** (0 imports) |
| `framer-motion` | ^13.1.0 | transiciones Screen, overlays, toast |
| `@capacitor/*` | ^8.5.0 | app, haptics, keyboard, status-bar (config) |
| `vite` / `typescript` / `oxlint` | ^8.2.0 / ~6.0.2 / ^1.75.0 | build/lint |

Notas tsconfig (`tsconfig.app.json`): `verbatimModuleSyntax` (imports de tipos deben usar `import type`), `noUnusedLocals/Parameters`, **sin `strict: true`**, `erasableSyntaxOnly`.

---

## 3. Mapa de arquitectura actual

```
antares-paciente/
├── index.html                     # fuentes Google (Inter, Space Grotesk), PWA-ish meta
├── capacitor.config.ts            # appId com.antares.paciente, Keyboard resize:body, StatusBar DARK
├── src/
│   ├── main.tsx                   # bootstrap: CSS core de Ionic + theme/variables + theme/global
│   ├── App.tsx                    # setupIonicReact({mode:'ios'}) + router por estado + Shell
│   ├── types.ts                   # Screen, Flow, TabId, UserProfile, ChatMessage, …
│   ├── context/
│   │   └── AppContext.tsx         # TODO el estado global + acciones (navigate, toasts, chat bot simulado)
│   ├── pages/                     # 14 páginas (una por pantalla)
│   │   ├── OnboardingPage.tsx     # flujo 5 pasos (identidad, OTP 123456, familiar, HIPAA, password)
│   │   ├── TestsPage.tsx          # 9 tests de salud + perfil IA simulado
│   │   ├── HomePage.tsx           # dashboard: KPIs, módulos, citas, progreso
│   │   ├── AppointmentsPage.tsx   # citas (data local)
│   │   ├── HistoryPage.tsx        # historia clínica (acordeones)
│   │   ├── NutritionPage.tsx      # plan nutricional, hidratación, tabs, gráficos CSS
│   │   ├── AcademyPage.tsx        # academia BIO
│   │   ├── InfinitoPage.tsx       # INFINITO B2C
│   │   ├── WearablePage.tsx       # reloj (scan simulado, ECG CSS)
│   │   ├── ChatPage.tsx           # chat IA (bot simulado en contexto)
│   │   ├── ProfilePage.tsx        # perfil, equipo, logout
│   │   ├── ProgramPage.tsx        # programa del día (pasos + timer)
│   │   └── CommunityPage.tsx      # feed, perfil, amigos, redes
│   ├── components/
│   │   ├── Screen.tsx             # <Screen/> (wrapper framer-motion + BottomNav) y <Scroll/>
│   │   ├── BottomNav.tsx          # barra inferior custom (5 tabs + SOS)
│   │   ├── ToastHost.tsx          # toast custom (contexto → framer-motion)
│   │   ├── PanicOverlay.tsx       # overlay SOS fullscreen custom
│   │   ├── VoiceOverlay.tsx       # overlay agente de voz fullscreen custom
│   │   └── Forms.tsx              # ScaleList (tests), ChipGrid (chips de selección)
│   ├── data/
│   │   └── tests.ts               # definiciones de los 9 tests (preguntas, opciones)
│   └── theme/
│       ├── variables.css          # tokens: --ion-*, paleta ANTARES, radios, sombras, --nav-h
│       └── global.css             # TODO el CSS de componentes custom (1059 líneas)
```

### Responsabilidades

| Sección | Responsabilidad |
|---|---|
| `pages/` | Una pantalla por archivo, compuesta por `<Screen>` + `<Scroll>` + bloques custom |
| `components/` | Piezas reutilizables de la UI (layout, nav, overlays, feedback) |
| `context/AppContext.tsx` | Estado global + "servicios simulados" (chat bot, sos, toasts, puntos) |
| `data/` | Datos estáticos (tests) |
| `theme/` | Tokens (`variables.css`) y estilos de componentes (`global.css`) |
| `types.ts` | Tipos compartidos |

**NO existen** carpetas `hooks/`, `services/`, `routes/`, `layouts/`, `api/`, `utils/`.

---

## 4. Navegación — hallazgo crítico

**`react-router-dom` está en `package.json` pero no se importa en ningún archivo** (verificado con grep: 0 coincidencias de `react-router`, `IonReactRouter`, `IonRouterOutlet`, `IonTabs`, `IonTabBar`).

La navegación es un **state machine en memoria**:

```tsx
// App.tsx:25-51 — router por switch
const { flow, screen } = useApp()
if (flow === 'onboarding') return <OnboardingPage />
if (flow === 'tests') return <TestsPage />
switch (screen) {
  case 'book': return <AppointmentsPage />
  ...
  default: return <HomePage />
}
```

Consecuencias:
- **Sin URLs** → no hay deep-linking, no hay historial del navegador (botón atrás no funciona), no hay share de pantallas.
- **Sin persistencia** → al recargar la página se vuelve al onboarding (todo el estado vive en React).
- **Imposible usar** `IonTabs`, `IonRouterOutlet`, `IonBackButton`, `IonMenu` (todos requieren router).
- `BottomNav` (custom) es el candidato natural a `IonTabBar`/`IonTabButton`.

---

## 5. Inventario real de componentes Ionic

Verificado por grep de `from '@ionic/react'` — **solo 6 imports**:

| Componente | Dónde |
|---|---|
| `IonApp` | `App.tsx:1` (raíz, requerido por Ionic) |
| `IonIcon` | `BottomNav.tsx:1`, `PanicOverlay.tsx:2`, `VoiceOverlay.tsx:2`, `ChatPage.tsx:1`, `HomePage.tsx:1` |
| `setupIonicReact({ mode: 'ios' })` | `App.tsx:20` |
| CSS bundles Ionic | `main.tsx:3-9` (core, normalize, structure, typography, padding, flex-utils, display) |
| Variables `--ion-*` | `theme/variables.css` (font-family, colors primary/background, safe areas, toolbar) |

Nada más. **No se usan** (aunque son los estándar del ecosistema): `IonButton`, `IonInput`, `IonSelect`, `IonModal`, `IonToast`, `IonLoading`, `IonCard`, `IonList`, `IonItem`, `IonTabs`, `IonHeader`, `IonContent`, `IonSegment`, `IonCheckbox`, `IonAccordion`, `IonSearchbar`, `IonProgressBar`, `IonAvatar`, `IonChip`, `IonDatetime`, `IonPopover`, `IonActionSheet`, `IonAlert`, `IonRefresher`, `IonInfiniteScroll`, `IonGrid`, `IonSpinner`…

---

## 6. Catálogo de componentes (auditoría completa)

| # | Elemento | Componente actual | Ionic recomendado | Archivo(s) | Estado |
|---|---|---|---|---|---|
| 1 | App shell | `div.app-stage/.app-shell` (frame teléfono) | `IonApp` + `IonContent` (parcial) | `App.tsx`, `global.css:12-54` | Mantener (frame es feature visual) |
| 2 | Router / navegación | switch por estado en contexto | `IonReactRouter` + `IonRouterOutlet` | `App.tsx:25-51` | **Migrar (crítico)** |
| 3 | Tabs inferiores | `div.bnav` + `<button class="ni">` | `IonTabs` + `IonTabBar` + `IonTabButton` | `BottomNav.tsx` | Migrar (requiere router) |
| 4 | Botón principal | `<button class="btn">` / `btn-primary` etc. | `IonButton` (`expand`, `fill`, `color`) | todas las pages | Migrar |
| 5 | Botón icono redondo | `<button>` + `IonIcon` inline styles | `IonButton` (`fill="clear"`, shape round) | `ChatPage.tsx:94-112`, `VoiceOverlay.tsx:54-90` | Migrar |
| 6 | Inputs de texto | `<input class="field">` | `IonInput` (`label`, `labelPlacement`, `fill`) | `OnboardingPage.tsx:161-200`, `ProgramPage.tsx:99-105` | Migrar |
| 7 | OTP 6 dígitos | 6 `<input class="otp">` con autofocus manual | `IonInput` por dígito (o mantener custom, validar `IonCodeInput`) | `OnboardingPage.tsx:236-252` | Evaluar (PENDIENTE validar `IonCodeInput` en Ionic 8) |
| 8 | Select | `<select class="field">` | `IonSelect` + `IonSelectOption` | `OnboardingPage.tsx:177-181, 269-273` | Migrar |
| 9 | Fecha | `<input type="date">` | `IonDatetime` (en `IonModal`/`IonPopover`) | `OnboardingPage.tsx:172` | Migrar |
| 10 | Checkbox | `<button class="check-row">` + `div.checkbox` | `IonCheckbox` + `IonItem` | `OnboardingPage.tsx:305-310` | Migrar |
| 11 | Textarea | `<textarea>` | `IonTextarea` | `TestsPage.tsx:253`, `ProgramPage.tsx:161`, `CommunityPage.tsx:41` | Migrar |
| 12 | Búsqueda | `<input placeholder="Buscar…">` | `IonSearchbar` | `CommunityPage.tsx:122` | Migrar |
| 13 | Toast | `ToastHost` (framer-motion) + estado en contexto | `IonToast` (imperativo `toastController` o `<IonToast>`) | `ToastHost.tsx`, `AppContext.tsx:226-229` | Migrar |
| 14 | Modal SOS | `PanicOverlay` (overlay fullscreen custom) | `IonModal` fullscreen (`presentingElement`) — o mantener custom por timing de emergencia | `PanicOverlay.tsx` | Evaluar (caso especial) |
| 15 | Modal voz | `VoiceOverlay` (overlay fullscreen custom) | `IonModal` fullscreen | `VoiceOverlay.tsx` | Migrar |
| 16 | Loading "analizando" | emoji + texto + `setTimeout` | `IonLoading` / `IonSpinner` | `TestsPage.tsx:71-75, 111-118` | Migrar |
| 17 | Loading scan BT | texto "Buscando…" | `IonSpinner` | `WearablePage.tsx:57-59` | Migrar |
| 18 | Barra de progreso | `div.ptrack` + `div.pfill` | `IonProgressBar` (`value`, `color`) | `global.css:631-641` (usado en ~8 pages) | Migrar |
| 19 | Tabs de sección | `div.plan-tabs` / `div.com-tab` + `<button>` | `IonSegment` + `IonSegmentButton` (o `IonTabs`) | `NutritionPage.tsx:112-118`, `CommunityPage.tsx:26-31` | Migrar |
| 20 | Acordeón | `div.hc-sec` / `prog-step` custom + estado | `IonAccordionGroup` + `IonAccordion` | `HistoryPage.tsx:72-91`, `ProgramPage.tsx:51-68`, `TestsPage.tsx:200-226` | Migrar |
| 21 | Avatar | `div.avatar` | `IonAvatar` | `AppointmentsPage.tsx:84`, `ChatPage.tsx:36,58`, `ProfilePage.tsx:15`, `CommunityPage.tsx:38,61,97,128` | Migrar |
| 22 | Chip / badge | `span.chip` (+ variantes color) | `IonChip` / `IonBadge` | todas las pages | Migrar |
| 23 | Card | `div.card` (custom padding/shadow) | `IonCard`/`IonCardContent` (opcional — el custom ya es sólido) | todas las pages | Evaluar |
| 24 | Lista de filas | `div.prow` / `row-card` / `food-item` | `IonList` + `IonItem` + `IonLabel` | `ProfilePage.tsx:50-113`, `CommunityPage.tsx:127-139`, `NutritionPage.tsx:140-153`, `HomePage.tsx:187-198` | Migrar |
| 25 | Botón atrás | `<button>←</button>` manual | `IonBackButton` (requiere router) | `TestsPage.tsx:82-87` | Migrar (con router) |
| 26 | Header de pantalla | `div.hero hero-cosmos/navy/teal/pur/indigo` | `IonHeader`+`IonToolbar`+`IonTitle` (opcional — heroes custom son identidad visual) | todas las pages | Evaluar |
| 27 | Ring kcal | `<svg>` custom | Mantener (gráfico bespoke) | `NutritionPage.tsx:84-93` | Mantener |
| 28 | Bar chart semanal | divs CSS | Mantener (sin lib de charts) | `NutritionPage.tsx:191-200` | Mantener |
| 29 | ECG | divs CSS (`Math.sin`) | Mantener (simulación) | `WearablePage.tsx:114-130` | Mantener |
| 30 | Confirmación cancelar cita | `showToast('Solicitud de cancelación enviada')` | `IonAlert` (con botones Confirmar/Cancelar) | `AppointmentsPage.tsx:102-108` | Migrar |
| 31 | Acciones contextuales | toasts informativos | `IonPopover` / `IonActionSheet` | `AcademyPage.tsx`, `InfinitoPage.tsx`, `CommunityPage.tsx` | Migrar |
| 32 | Pull-to-refresh | — (no existe) | `IonRefresher` + `IonRefresherContent` | — | Recomendar (nuevo) |
| 33 | Infinite scroll | — (no existe) | `IonInfiniteScroll` | — | Recomendar (feed Comunidad) |
| 34 | Estado vacío / error / offline | — (no existe) | patrón: estado + retry (custom) | — | Ausente — crear |
| 35 | Dark mode | — (no existe) | `prefers-color-scheme` + variables | `variables.css` | Ausente |
| 36 | Menú lateral | — (no existe) | `IonMenu` + `IonMenuButton` | — | Ausente |
| 37 | Animación entre pantallas | framer-motion (`Screen.tsx`) | — (Ionic anima solo con router) | `Screen.tsx` | Mantener |
| 38 | Skeleton loading | — (no existe) | `IonSkeletonText` | — | Recomendar |
| 39 | Campo password + fuerza | `<input type="password">` + barra custom | `IonInput type="password"` | `OnboardingPage.tsx:341-356` | Migrar |
| 40 | Interruptor | — (no existe; toggles no usados) | `IonToggle` | — | Disponible si se necesita |

---

## 7. Otros hallazgos

### Estados de UI
- **Loading:** solo 2 simulados (TestsPage IA, WearablePage scan). Sin skeletons, sin `IonSkeletonText`.
- **Empty states:** inexistentes (Comunidad sin posts, citas vacías, etc. no tienen estado).
- **Errores:** no hay manejo de error visible (todo es demo); validaciones de formulario solo con `showToast` inline.

### Responsive / móvil
- Shell teléfono: `max-width 430px` desktop, 100 % en `<480px` (`global.css:36-54`). Correcto mobile-first.
- Safe areas: `env(safe-area-inset-*)` en hero, bnav, overlays, sticky footers ✓.
- Keyboard: `Keyboard.resize: 'body'` en Capacitor ✓; pero inputs no usan `IonInput` (perderían el scroll-into-view automático de Ionic).
- **`user-scalable=no` y `maximum-scale=1`** en `index.html:8` → bloquea zoom, problema de accesibilidad (WCAG 1.4.4).
- `user-select: none` global (`variables.css:67`) → puede dificultar selección de texto en la app (ej. códigos, resultados).

### Dark mode
- No hay `prefers-color-scheme`. Los heroes son oscuros por diseño, el contenido es claro. `--ion-*` sin variantes oscuras.

### Accesibilidad
- Icon-buttons sin `aria-label` (mic, send, ✕ cancelar, like, comment).
- `:active` como único feedback (sin `:focus-visible`).
- Fuentes: Inter (UI) + Space Grotesk (display) vía Google Fonts (`index.html:15-20`) — **requiere red**; para móvil offline considerar local bundling.
- `lang="es"` ✓.

### Datos / servicios
- 100 % estático: `data/tests.ts`, arrays inline en pages, `seedPosts`/`seedChat`/`botReply` en `AppContext.tsx`. **No hay capa de servicios ni fetch.** Sin persistencia (recargar = perder todo).
- `Botón de pánico`, `chat`, `watch` — simulaciones con `setTimeout`/`setInterval`.

### Reutilización
- Componentes ya compartidos: `Screen`, `Scroll`, `BottomNav`, `Forms` (ScaleList/ChipGrid), `useApp()`.
- Patrones duplicados que deberían extraerse: banner CTAs de Home (2 bloques casi idénticos), cards de módulos, `prow` (list row), header `hero` + `chips`, botones con icono.

---

## 8. Recomendaciones (no ejecutadas — solo auditoría)

1. **[Crítico] Migrar a `IonReactRouter`**: desbloquea tabs nativos, back button, deep-linking y persistencia de rutas. Requiere reestructurar `App.tsx` y `BottomNav`.
2. **[Alto] Migrar feedback a `IonToast`/`IonLoading`/`IonAlert`** — reemplaza ToastHost y reduce código custom.
3. **[Alto] Formularios a `IonInput`/`IonSelect`/`IonDatetime`/`IonCheckbox`** — ganan manejo de teclado móvil, labels flotantes y focus styling gratis.
4. **[Medio] Segmentos y acordeones Ionic** (`IonSegment`, `IonAccordionGroup`) para tabs de Nutrition/Community e History.
5. **[Medio] Persistencia**: localStorage o API real (backend existe, sin integración).
6. **[Medio] Estados vacíos/error/loading** estándar + `IonSkeletonText`.
7. **[Bajo] Dark mode** vía `prefers-color-scheme`.
8. **[Bajo] Accesibilidad**: `aria-label` en icon-buttons, `focus-visible`, quitar `user-scalable=no`.

### PENDIENTE DE VALIDACIÓN
- Disponibilidad de `IonCodeInput` (o equivalente) para OTP en la versión instalada de Ionic 8.
- Comportamiento de `IonProgressBar` con gradientes (el design usa gradientes teal→gold).
- `IonCard` vs `.card` custom: mantener custom si no aporta.
- `framer-motion` + router de Ionic: compatibilidad de transiciones al migrar navegación.

---

## Fase 3 — Migración Ionic

> **Fecha:** 2026-08-13 · **Alcance:** migración progresiva de HTML/CSS custom → componentes Ionic (Ionic 8.8.18), preservando diseño, lógica y navegación.
> **Regla aplicada:** Ionic-first, no Ionic-everything. Cada cambio responde "¿Ionic tiene una solución adecuada?".
> **Verificación:** `npm run build` + `npm run lint` pasan tras cada grupo.

### 3.1 Componentes migrados

| Componente Ionic | Instancias | Reemplaza | Archivos |
|---|---|---|---|
| `IonButton` | ~22 | `<button class="btn btn-*">` (primarios, teal, gold, pur, panic, ghost, outline, circulares) | Onboarding, Tests, Chat, Program, Community, Appointments, Academy, Infinito, Wearable, VoiceOverlay |
| `IonInput` | 13 | `input.field`, `input.vital-inp`, input chat | Onboarding, Program, Chat |
| `IonSelect` + `IonSelectOption` | 2 | `select.field` (seguro, parentesco) | Onboarding |
| `IonCheckbox` | 3 | `.checkbox` custom en `.check-row` (consentimientos HIPAA) | Onboarding |
| `IonTextarea` | 4 | `<textarea>` (tests propósito, comunidad, programa) | Tests, Community, Program |
| `IonDatetime` (en `IonModal`) | 1 | `<input type="date">` (fecha nacimiento) | Onboarding |
| `IonProgressBar` | 19 | `.ptrack/.pfill` (fuerza password, hero, macros, semanal, academia) | Onboarding, Tests, Home, Nutrition, Academy, Program |
| `IonToast` | 1 | `ToastHost` custom (framer-motion) | `components/ToastHost.tsx` |
| `IonAlert` | 1 | toast usado como confirmación de cancelación | Appointments |
| `IonLoading` | 2 | bloques emoji+setTimeout (análisis IA, scan BT) | Tests, Wearable |
| `IonModal` | 2 | `VoiceOverlay` custom fullscreen; contenedor de `IonDatetime` | VoiceOverlay, Onboarding |
| `IonSearchbar` | 1 | `<input>` "Buscar amigos" | Community |

**Total: 12 tipos de componentes Ionic nuevos (~47 instancias).** El proyecto pasa de usar 2 componentes Ionic (`IonApp`, `IonIcon`) a 15.

### 3.2 Archivos modificados

| Archivo | Cambios |
|---|---|
| `src/pages/OnboardingPage.tsx` | inputs→IonInput, selects→IonSelect, fecha→IonDatetime+IonModal, checkboxes→IonCheckbox, fuerza password→IonProgressBar, botones→IonButton |
| `src/pages/ChatPage.tsx` | input→IonInput, mic/send→IonButton circulares, pánico→IonButton |
| `src/pages/ProgramPage.tsx` | inputs vitales→IonInput, textarea→IonTextarea, 6 botones→IonButton, hero→IonProgressBar |
| `src/pages/CommunityPage.tsx` | textarea→IonTextarea, publicar/mensaje→IonButton, búsqueda→IonSearchbar |
| `src/pages/TestsPage.tsx` | loading→IonLoading, 7 barras→IonProgressBar, 3 botones→IonButton, textarea→IonTextarea |
| `src/pages/AppointmentsPage.tsx` | recordatorio/cancelar→IonButton, cancelación→IonAlert |
| `src/pages/AcademyPage.tsx` | 3 botones→IonButton, 3 barras→IonProgressBar |
| `src/pages/InfinitoPage.tsx` | botón UPPER MIND→IonButton |
| `src/pages/WearablePage.tsx` | scan/desconectar→IonButton, scan→IonLoading |
| `src/pages/HomePage.tsx` | 4 barras progreso semanal→IonProgressBar |
| `src/pages/NutritionPage.tsx` | macros+historial→IonProgressBar (5) |
| `src/components/ToastHost.tsx` | reescrito: framer-motion→`IonToast` declarativo |
| `src/components/VoiceOverlay.tsx` | reescrito: overlay custom→`IonModal` fullscreen + IonButton |
| `src/theme/global.css` | sección "FASE 3": overrides de diseño para ion-button/input/select/textarea/progress/toast/loading/modal/searchbar/checkbox; eliminado CSS huérfano (`.ptrack/.pfill/.toast`) |

### 3.3 Componentes que permanecen custom (excluidos justificadamente)

**COMPONENTE EXCLUIDO DE MIGRACIÓN — resumen** (cada uno con motivo técnico):

| Elemento | Clase(s) | Motivo |
|---|---|---|
| `PanicOverlay` (SOS completo) | `.overlay-panic`, `.panic-ring` | Emergencia con countdown 5s (`setInterval`), z-index crítico sobre toda la UI y animación pulsante propia; `IonModal` añadiría latencia y capa de presentación en un flujo donde cada ms importa. Migración documentada como posible pero desaconsejada |
| Selección por chips | `.tq-opt`, `.choice`, `.sig-ch`, `.qrchip`, `.hyd-glass`, prioridades tests | Selectores de dominio con estados sel/unsel propios y touch 40px+; `IonChip`/`IonButton` no replican el grid de selección múltiple sin sobre-ingeniería CSS |
| Tabs de sección | `.ptab` (Nutrición), `.com-tab` (Comunidad) | Estilo tab-underlined con borde inferior; equivalentes reales son `IonSegment` (visual distinto) o `IonTabs` (requiere router). **MIGRACIÓN FUTURA** → `IonSegment` con CSS override |
| Acordeones | `.hc-sec` (Historia), `.prog-step` (Programa), SISTEMAS (Tests) | Layout propietario (header con gradiente, estados done, grid de síntomas) con estado local; `IonAccordionGroup` no preserva el look sin reescribir el CSS completo. **MIGRACIÓN FUTURA** evaluada |
| Filas de lista | `.prow` (Perfil), `.row-card` (Comunidad), filas de citas | Rows de dominio con icono+texto+chevron; `IonList/IonItem` cambian paddings/bordes. **MIGRACIÓN FUTURA** → `IonList/IonItem` |
| Cards y módulos | `.card`, `.card-accent`, `ts-card`, banners gradiente (Home, Tests) | Diseño propio sólido con variantes de acento (auditoría: "Evaluar — mantener custom si no aporta"); `IonCard` no aporta y añade estilos por defecto |
| Avatares | `.avatar` | Decorativo (iniciales/emoji con gradientes); `IonAvatar` es para imágenes |
| Chips/badges de marca | `.chip` + 8 variantes | Identidad visual centralizada en CSS con 8 tonos; `IonChip` tendría que ser re-estilizado por variante sin ganancia funcional |
| OTP 6 dígitos | `.otp` | Autofocus encadenado `nextElementSibling` incompatible con shadow DOM de `IonInput`; `IonCodeInput` sin validar en Ionic 8.8 |
| Firma DocuSign | botón firma | Zona de firma bespoke (90px, dashed border) — no es un botón de acción |
| Botones header | back "←", "Después", like/comment, icon-rows | Chips de header/interacción inline del diseño |
| `BottomNav` | `.bnav`, `.ni` | **Grupo 5 — ver 3.5** |
| `Forms.tsx` (ScaleList/ChipGrid) | `.tq-opt`, `.choice` | Componentes de dominio de tests (ver selección por chips) |
| Banners de acción (Home: pánico, voz, programa) | botones con gradiente + layout interno | Layout complejo (icono+2 líneas de texto+chevron) que `IonButton` no alinea sin romper la composición |

### 3.4 Problemas encontrados y solucionados

1. **`IonButton` vs `.btn`**: el CSS existente de `.btn` (padding, display, border-radius) choca con las custom props internas de `ion-button`. Solución: variantes propias `bt bt-*` (`.bt-primary/.bt-teal/.bt-gold/.bt-pur/.bt-panic/.bt-ghost/.bt-outline/.bt-sm/.bt-mini/.bt-round*`) que mapean los gradientes de marca vía `--background` — diseño idéntico.
2. **Doble toggle en checkboxes**: `IonCheckbox` dentro del `<button class="check-row">` burbujea el click y anula el toggle. Solución: `onClick={(e) => e.stopPropagation()}` en el checkbox + `onIonChange` para el estado.
3. **Fecha**: `IonDatetime` devuelve ISO con hora → normalizado con `.split('T')[0]` para mantener el formato `YYYY-MM-DD` de `UserProfile`.
4. **`IonProgressBar` con gradientes**: los gradientes teal→gold se logran con `--progress-background: linear-gradient(...)` — validado.
5. **CSS huérfano**: eliminados `.ptrack/.pfill/.toast` (sin uso tras la migración).
6. **Estructura TSX**: al quitar el bloque de loading emoji quedó un `)}` colgante en TestsPage (TS1381) — corregido.
7. **IonToast con emojis**: el emoji de severidad ahora viaja en el `message` (IonToast v8 no tiene slot de icono) — mismo feedback visual.

### 3.5 Grupo 5 — Tabs y navegación (MIGRACIÓN ARQUITECTÓNICA FUTURA)

`BottomNav` (5 tabs + SOS) sigue custom **a propósito**: convertirlo a `IonTabs`/`IonTabBar`/`IonTabButton` requiere `IonReactRouter` + `IonRouterOutlet` (cambia la arquitectura de navegación por estado de `AppContext`). Documentado en `ionic-navigation` — **no se ejecutó** (requiere autorización y tarea planificada).

### 3.6 Métricas

```text
HTML UI antes:  ~90 elementos custom (botones, inputs, selects, textareas, checkboxes, progreso, toast, overlays)
HTML UI después: ~40 (selectores de dominio, cards, tabs de sección, listas, avatares, chips, OTP, PanicOverlay — todos justificados)

Componentes Ionic antes: 2 (IonApp, IonIcon)
Componentes Ionic después: 15 tipos (IonApp, IonIcon, IonButton, IonInput, IonSelect, IonSelectOption,
                            IonCheckbox, IonTextarea, IonDatetime, IonProgressBar, IonToast, IonAlert,
                            IonLoading, IonModal, IonSearchbar)

Componentes migrados: 12 tipos / ~47 instancias
Componentes custom justificados: 17 grupos (documentados en 3.3)
Migraciones futuras: IonTabs+router (crítico), IonSegment, IonList/IonItem, IonAccordion, IonChip, IonAvatar, OTP/IonCodeInput
```

### 3.7 Notas de verificación visual pendiente

- Ejecutar `npm run dev` y revisar a ojo: botones con gradiente, inputs `fill="outline"` con focus, modal de fecha, modal de voz, toast dark, searchbar compacto (posibles desviaciones de 1-2px que el build no detecta).
- `IonButton` con gradiente y estado `:active` (hover/ripple) — verificar sensación táctil en móvil.
- Landscape y teclado móvil en `IonInput` (auto scroll-into-view) — beneficios esperados de la migración.
