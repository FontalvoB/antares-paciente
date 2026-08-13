---
name: ionic-rules
description: Reglas globales del frontend ANTARES Paciente (Ionic React). Checklist obligatoria, regla PRIORITARIA Ionic-first, BEFORE CODING y Definition of Done para cualquier tarea de UI. Cargar SIEMPRE antes de modificar el frontend.
---

# Reglas globales — Frontend ANTARES Paciente

Proyecto **Ionic React**: Ionic 8.8 (`@ionic/react ^8.8.18`) + React 19.2 + Capacitor 8 + Vite + TS. Versiones verificadas en `package.json` — no asumir otras. Todo trabajo sobre `antares-paciente/` debe cumplir este archivo.

## BEFORE CODING (leer antes de escribir cualquier código de UI)

Antes de escribir código de UI:

1. Leer `AGENTS.md` (raíz del proyecto).
2. Leer las skills relevantes (ver tabla de abajo).
3. Buscar componentes existentes en `src/components/` (skill `reusable-components`).
4. Buscar el componente Ionic equivalente (skill `ionic-components` — matriz de decisión).
5. Revisar el design system (`src/theme/variables.css` + `global.css`, skill `ionic-theme`).
6. Revisar patrones existentes en páginas similares.
7. Solo después implementar.

## REGLA PRIORITARIA — Ionic-first

> **Antes de crear cualquier elemento de UI con HTML nativo, CSS personalizado o librería externa, el agente DEBE verificar si Ionic proporciona un componente equivalente (matriz en `ionic-components`). Si existe, usarlo.**

Mapeo mínimo (completo en `ionic-components`):

| Elemento nativo / custom | Componente Ionic |
|---|---|
| `<button>` / `.btn` | `IonButton` |
| `<input>` / `.field` | `IonInput` |
| `<select>` / `.field` | `IonSelect` + `IonSelectOption` |
| `<textarea>` | `IonTextarea` |
| checkbox / `.checkbox` | `IonCheckbox` |
| radio | `IonRadioGroup` + `IonRadio` |
| toggle / switch | `IonToggle` |
| date picker / `<input type="date">` | `IonDatetime` (en `IonModal`/`IonPopover`) |
| modal / overlay fullscreen | `IonModal` |
| toast / notificación | `IonToast` |
| alert / confirmación | `IonAlert` |
| loading / spinner | `IonLoading` / `IonSpinner` |
| popover contextual | `IonPopover` |
| action sheet / acciones | `IonActionSheet` |
| tabs / barra inferior | `IonTabs` + `IonTabBar` + `IonTabButton` |
| navegación / rutas / back | `IonReactRouter` + `IonRouterOutlet` + `IonBackButton` (MIGRACIÓN FUTURA — no implementada) |
| menú lateral | `IonMenu` + `IonMenuButton` |
| búsqueda | `IonSearchbar` |
| lista / fila | `IonList` + `IonItem` + `IonLabel` |
| progreso de una línea | `IonProgressBar` |
| segmento / tabs de sección | `IonSegment` + `IonSegmentButton` |
| acordeón | `IonAccordionGroup` + `IonAccordion` |
| avatar | `IonAvatar` |
| chip / badge | `IonChip` / `IonBadge` |
| skeleton loading | `IonSkeletonText` |
| pull-to-refresh | `IonRefresher` |
| infinite scroll | `IonInfiniteScroll` |
| grid responsive | `IonGrid` + `IonRow` + `IonCol` |

### La regla NO es absoluta — excepciones justificadas

Ionic NO es apropiado para (no forzar migración):

- **Elementos puramente decorativos**: emojis de identidad, ilustraciones, rings SVG (kcal `NutritionPage:84-93`), ECG (`WearablePage:114-130`), bar chart semanal.
- **Layouts complejos**: shell de teléfono (`app-shell`), heroes con gradiente, sticky footers.
- **Gráficos / visualizaciones bespoke** (sin librería de charts en el proyecto — no añadir).
- **Tablas especializadas / datos densos** que Ionic no cubre bien.
- **Componentes de dominio**: `PatientCard`, `MealCard`, `PostCard` (clasificación en `reusable-components`).
- **Casos de emergencia con timing propio**: `PanicOverlay` (countdown 5s) — excepción documentada en `ionic-overlays`.

Ante duda: preguntar. Justificar por escrito en el PR/comentario por qué se crea HTML custom cuando existe alternativa Ionic.

## Reglas de framework

- **No introducir librería UI adicional** si Ionic resuelve la necesidad (no hay MUI, Chakra, Radix — no añadir).
- **No duplicar componentes**: buscar en `src/components/` y `reusable-components` antes de crear (ver anti-duplicación: `NewButton`/`CustomButton`/`AppButton`/`PrimaryButton` → primero `IonButton`).
- **React + hooks correctos**: `useState`/`useEffect`/`useMemo`, hooks del contexto (`useApp`). Sin librerías de estado extra (no hay Redux/Zustand — mantener).
- **Imports de tipos**: `import type { X }` (exigido por `verbatimModuleSyntax`).
- **TS estricto no activo**: no asumir `strict`; respetar `noUnusedLocals`/`noUnusedParameters` (no dejar vars muertas).

## Reglas de UI/UX

- **Mobile-first** (ver `ionic-responsive`): 375-430px base, touch ≥44px, sin hover-only, safe areas, teclado virtual.
- **Estados siempre**: loading / empty / error para cualquier dato dinámico (patrón aún ausente — crearlo si se toca algo dinámico).
- **Accesibilidad**: `aria-label` en icon-buttons, `:focus-visible`, no bloquear zoom (index.html:8 `user-scalable=no` — PENDIENTE de corrección, WCAG 1.4.4), labels en formularios.
- **Feedback**: `IonToast` para éxito/info corto, `IonAlert` para decisiones, `IonModal` para pantallas anidadas (skill `ionic-overlays`).
- **Framer Motion**: NO reemplazar comportamientos de Ionic (ver `ionic-theme` §Framer Motion).

## Reglas de estilo

- Tokens SIEMPRE desde `theme/variables.css` (skill `ionic-theme`); no hex sueltos.
- Estilos en `theme/global.css` o inline `style={{}}` puntual — sin CSS modules/styled-components.
- Comentarios y textos de UI en **español**.
- Emojis decorativos OK (identidad del diseño); funcionales → `IonIcon` + `ionicons`.

## Reglas de navegación (hasta migrar a router)

- Cambiar pantalla SOLO con `useApp().navigate(id)` (skill `ionic-navigation`).
- Registrar toda pantalla nueva en: page + switch `App.tsx` + tipo `Screen` en `types.ts`.
- Overlays globales SOLO en `Shell` (`App.tsx:59-61`).
- **No migrar a router** sin autorización explícita.

## Reglas de datos

- Sin backend integrado: datos simulados en `data/` o constantes del archivo. NO inventar endpoints.
- Estado global de datos → `useApp()`; no prop-drilling si 2+ pantallas lo usan.
- No persistir sin pedirlo (no hay localStorage ni API).

## Verificación obligatoria al terminar

```bash
npm run lint    # oxlint — sin errores
npm run build   # tsc -b && vite build — debe pasar
```

Y si aplica: `npm run dev` para probar en el shell del navegador (móvil simulado) y `npm run sync` tras cambiar Capacitor.

## Definition of Done — UI (todo desarrollo frontend)

```text
[ ] Revisé si Ionic tiene un componente equivalente.
[ ] Reutilicé componentes existentes.
[ ] No dupliqué componentes.
[ ] La pantalla funciona en móvil.
[ ] La pantalla funciona en desktop.
[ ] Los estados loading están contemplados.
[ ] Los estados empty están contemplados.
[ ] Los estados error están contemplados.
[ ] Los elementos interactivos son táctiles.
[ ] No introduje una librería UI innecesaria.
[ ] Respeté el design system.
[ ] No rompí la navegación existente.
[ ] No introduje HTML custom cuando Ionic ya tiene solución.
[ ] `npm run lint` y `npm run build` pasan.
```
