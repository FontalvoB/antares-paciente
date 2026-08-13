---
name: ionic-theme
description: Tema y diseño de ANTARES Paciente. Convivencia de Ionic + design system propio (variables.css + global.css) + Framer Motion: qué controla cada capa, tokens, paleta, dark mode y reglas para no romper identidad visual.
---

# Tema y diseño — ANTARES Paciente

## División de responsabilidades (qué controla cada capa)

| Capa | Controla | Ejemplo |
|---|---|---|
| **Ionic** | Comportamiento e interacción, primitives | `IonButton`, `IonInput`, `IonModal`, `IonToast`, gestures, focus, teclado |
| **`theme/variables.css`** | Tokens de identidad visual | paleta ANTARES, `--ion-*`, radios, sombras, fuentes, `--nav-h` |
| **`theme/global.css`** | Estilos de componentes y layout custom | `.btn`, `.card`, `.hero`, `.bnav`, `.field`, `.chip` |
| **Framer Motion** | Animación de contenido (NO comportamiento Ionic) | transiciones `Screen`, entradas/salidas, microinteracciones |

> **Regla**: Ionic proporciona comportamiento y primitives de interacción; el design system (variables + global) controla identidad visual cuando sea compatible. Al usar un componente Ionic nuevo: colorear con tokens (`color="primary"` = teal, o CSS vars), nunca inventar colores.

> **Capa de adaptación Ionic (FASE 3)**: los componentes Ionic se estilizan con sus CSS variables apuntando a los tokens existentes (`--border-radius: 12px`, `--border-color: var(--bd)`, `--background: linear-gradient(...)`, `--padding-*`, `--highlight-color-focused: var(--teal)`). La sección "FASE 3 — Integración de componentes Ionic" de `global.css` es la única capa de adaptación — toda variante nueva va ahí y reutiliza tokens; no duplicar valores en línea. Regla de preservación visual completa en `ionic-components`.

> **`mode: ios`**: el proyecto configura `setupIonicReact({ mode: 'ios' })`. Los estilos internos de Ionic dependen del modo (ej.: inputs con `min-height:44px`, `fill="outline"` sin borde visible, `.input-bottom` con border-top). El CSS interno de la versión instalada (`node_modules/@ionic/core/dist/esm/*.entry.js`) sirve para entender qué controla qué, pero **nunca es fuente de verdad visual** — la fuente es el design system (`variables.css` + `global.css`).

## Fuentes de verdad

- **Tokens**: `src/theme/variables.css` (variables `--ion-*` + paleta ANTARES)
- **Estilos de componentes**: `src/theme/global.css` (1059 líneas)
- Fuentes en `index.html:15-20`: **Inter** (UI) + **Space Grotesk** (display, clase `.display`)

## Tokens (`variables.css:1-51`)

| Categoría | Variables |
|---|---|
| Ionic | `--ion-font-family`, `--ion-color-primary`, `--ion-background-color`, `--ion-text-color`, `--ion-safe-area-top/bottom` |
| Cosmos (fondo espacial) | `--cosmos: #06091a`, `--cosmos-2`, `--navy`, `--navy-2` |
| Marca | `--teal: #1d9e75`, `--gold: #d4af37`, `--pur: #7c3aed`, `--blue: #1b6ca8`, `--org: #e87b2b`, `--red: #e24b4a` (cada color con `-l` claro y `-d` oscuro) |
| Neutros | `--wh`, `--g0`, `--g1`, `--bd`, `--tx`, `--mu` |
| Estado | `--panic: #ff2d55`, `--safe: #30d158`, `--indigo: #6366f1` |
| Geometría | `--radius-sm/md/lg/xl` (10/14/18/24px), `--shadow-sm/md` |
| Layout | `--nav-h: calc(72px + safe-area)`, `--ease: cubic-bezier(0.22,1,0.36,1)` |

## Paleta de heroes (headers de pantalla)

```css
.hero-cosmos  /* oscuro espacial (default) */  .hero-navy  /* azul */
.hero-teal    /* verde */                       .hero-pur   /* púrpura */
.hero-indigo  /* índigo */
```

Elegir por página: Home/Chat/Academy/Tests/Program → cosmos; History/Chat → navy; Nutrition → teal; Infinito/Community → pur; Wearable → indigo.

## Componentes de diseño (clases en global.css — NO renombrar)

- `.kicker` (eyebrow dorado, 10px uppercase), `.h1`/`.h2` (Space Grotesk), `.sub` (blanco 62 %)
- `.chip` + variantes: `.chip-glass`, `.chip-gold`, `.chip-teal`, `.chip-blue`, `.chip-org`, `.chip-red`, `.chip-pur`
- `.card` + `.card-accent` con tonos `ac-teal/blue/gold/pur/panic/org/ind` (borde superior 3px)
- `.btn` + variantes: `.btn-primary`, `.btn-teal`, `.btn-gold`, `.btn-pur`, `.btn-panic`, `.btn-ghost`, `.btn-outline`
- `.ptrack`/`.pfill` (progreso), `.avatar`, `.ico`, `.display`
- `.ct`/`.cs` (título/subtítulo de card), `.sec` (separador de sección)

> Estas clases seguirán existiendo mientras no se migre el custom. Componentes NUEVOS: Ionic + tokens (no usar `.btn` nuevo, ver `ionic-components`).

## Spacing y medidas

- Paddings de página: 14-16px (`padding: '0 14px'` / `16px` patrón en pages)
- Cards: `padding: 13px 12px`, radius `--radius-md` (14px)
- Gap estándar entre cards: 8-10px
- Altura mínima de botones: 48px (`.btn`)
- Fuentes: UI 11-15px, títulos 18-22px, display en métricas 16-22px

## Iconos y emojis

- Funcionales → `IonIcon` + `ionicons/icons` (mic, send, calendar, leaf, medkit, person, chatbubbleEllipses, home, school, infinite, bluetooth, people, clipboard, call, micOff, checkmarkCircle, close).
- Decorativos → emojis permitidos (patrón dominante del diseño: 🩺 🥗 🧠 ∞).

## Framer Motion — regla específica

> **NO usar Framer Motion para reemplazar comportamientos que Ionic ya proporciona** (modales, toasts, loaders, alerts tienen animaciones nativas).

- **Usar** para: transiciones de pantalla (`Screen.tsx` — patrón existente), animaciones de contenido (rings, ECG, barras), microinteracciones, entradas/salidas de elementos custom, animaciones específicas del producto.
- **Evitar** animaciones que interfieran con: navegación Ionic, gestos, scroll, modales, tabs e interacción móvil.
- No animar con framer-motion lo que Ionic anima solo (ej. `VoiceOverlay` → al migrar a `IonModal`, eliminar `AnimatePresence`).
- Compatibilidad framer-motion + router Ionic: **PENDIENTE DE VALIDACIÓN** (no migrar hasta confirmar).

## Dark mode — NO EXISTE (estado real)

- No hay `prefers-color-scheme` ni variantes oscuras de `--ion-*`.
- El diseño usa heroes oscuros sobre fondo claro (`--g0`).
- **Si se pide dark mode** (MIGRACIÓN FUTURA): añadir bloque `@media (prefers-color-scheme: dark)` en `variables.css` redefiniendo `--g0/g1/bd/tx/mu` y `--ion-background-color`, y validar `.card`/`.field`/`.bnav` (tienen fondos blancos fijos). Verificar `IonToggle`/`IonDatetime` no presentes aún.

## Reglas

1. **Nuevos colores** → variable en `variables.css`; nunca hex sueltos en JSX/global.css (salvo gradientes en `style={{}}` — patrón existente).
2. **Nunca tocar fuentes** (Inter/Space Grotesk) sin aprobación — son identidad.
3. No reescalar `--nav-h` ni `--radius-*` sin validar en móvil real.
4. Gradientes de marca: teal `#0c3d2c→#1d9e75`, gold `#8b6914→#d4af37`, pur `#2d1b69→#7c3aed`, navy `#0d2b4b→#1b6ca8`, cosmos `#06091a→#1a0a3c` — replicarlos tal cual.
5. Accesibilidad de color: contrastes de texto sobre heroes ya validados; no oscurecer `--mu` para texto de 11px.
6. Al migrar a componentes Ionic, mapear colores con `color="primary"` (teal) o CSS vars — no inventar colores.
7. Gradientes del diseño sobre componentes Ionic: `style={{ background: 'linear-gradient(...)' }}` o clase propia — el token vive en `variables.css`.
