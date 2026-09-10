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

> **Regla**: Ionic proporciona comportamiento y primitives de interacción; el design system (variables + global) controla identidad visual cuando sea compatible. Al usar un componente Ionic nuevo: colorear con tokens (`color="primary"` = navy `#142855`, o CSS vars), nunca inventar colores.

> **Capa de adaptación Ionic (FASE 3)**: los componentes Ionic se estilizan con sus CSS variables apuntando a los tokens existentes (`--border-radius: 12px`, `--border-color: var(--bd)`, `--background: linear-gradient(...)`, `--padding-*`, `--highlight-color-focused: var(--teal)`). La sección "FASE 3 — Integración de componentes Ionic" de `global.css` es la única capa de adaptación — toda variante nueva va ahí y reutiliza tokens; no duplicar valores en línea. Regla de preservación visual completa en `ionic-components`.

> **`mode: ios`**: el proyecto configura `setupIonicReact({ mode: 'ios' })`. Los estilos internos de Ionic dependen del modo (ej.: inputs con `min-height:44px`, `fill="outline"` sin borde visible, `.input-bottom` con border-top). El CSS interno de la versión instalada (`node_modules/@ionic/core/dist/esm/*.entry.js`) sirve para entender qué controla qué, pero **nunca es fuente de verdad visual** — la fuente es el design system (`variables.css` + `global.css`).

## Fuentes de verdad

- **Tokens**: `src/theme/variables.css` (variables `--ion-*` + paleta de marca `--brand-*` + tokens semánticos que apuntan a ella)
- **Estilos de componentes**: `src/theme/global.css` (~15800 líneas; los bloques `Acceso` y `Inicio` se añaden al final del archivo para ganar a reglas heredadas)
- Fuentes en `index.html:15-20`: **Inter** (UI) + **Space Grotesk** (display, clase `.display`) + **Sora** (headings alternativos)

## Tokens (`variables.css`)

| Categoría | Variables |
|---|---|
| Ionic | `--ion-font-family`, `--ion-color-primary: #142855` (NAVY, no teal), `--ion-color-secondary: #035d4d`, `--ion-background-color`, `--ion-text-color`, `--ion-safe-area-top/bottom` |
| **Marca (fuente de verdad)** | `--brand-navy #142855`, `--brand-navy-deep #023467`, `--brand-blue-mid #0c4c6b`, `--brand-green #035d4d`, `--brand-green-soft #3d7b72`, `--brand-sky #87aeca`, `--brand-sky-mid #5581a2`, `--brand-sky-deep #4b7086` |
| **Gradientes de marca** | `--grad-brand` (90° navy→green→deep), `--grad-brand-v` (160° vertical), `--grad-sky` (90° sky) — tabla exacta abajo |
| Semánticos (apuntan a la marca) | `--cosmos #04203f`, `--navy/navy-2`, `--blue #0c4c6b`, `--teal #035d4d`, `--ice #87aeca`, `--cyan #5581a2`, `--gold #3d7b72` (**alias de brand-green-soft — NO es oro**), `--pur #6d4fa8`, `--org #d97824`, `--red #d9534f` (cada color con `-l` claro y `-d` oscuro) |
| Neutros | `--wh`, `--g0`, `--g1`, `--bd`, `--tx`, `--mu` |
| Estado | `--panic #e0344f`, `--safe #1d9e75`, `--indigo #3f5fa8` |
| Geometría | `--radius-sm/md/lg/xl` (12/18/22/28px), `--shadow-sm/md` |
| Layout | `--nav-h: calc(78px + safe-area)`, `--ease: cubic-bezier(0.22,1,0.36,1)` |

> **Regla de cambio de paleta**: los tokens semánticos apuntan a la paleta `--brand-*` — cambiar aquí repinta toda la app sin tocar pantallas (`variables.css:21-25`). NO inventar hex nuevos fuera de la paleta.

## Paleta de heroes (headers de pantalla)

```css
.hero-cosmos  /* oscuro espacial (default) */  .hero-navy  /* azul */
.hero-teal    /* verde */                       .hero-pur   /* púrpura */
.hero-indigo  /* índigo */
```

Elegir por página: Chat/Academy/Tests/Program → cosmos; History/Chat → navy; Nutrition → teal; Infinito/Community → pur; Wearable → indigo.

> **Home y Login NO usan heroes**: tienen identidad propia documentada abajo (bloque `Inicio` `.hm-*` y bloque `Acceso` `.auth-*`), sobre fondo blanco.

## Patrones de pantalla — Acceso (login) e Inicio (home)

Bloques propios en `global.css`, se cargan al final del archivo para ganar a reglas heredadas. **NO renombrar** (páginas dependen de ellos).

### Login / activación de cuenta (`.auth-*` — `LoginPage.tsx`, `global.css:14263-14763`)

- `.screen.auth` — contenedor blanco; `.auth-scroll` con padding `calc(30px+safe-top) 26px calc(20px+safe-bottom)`.
- `.auth-lang` — `LanguageToggle` absoluto arriba-derecha; `.auth-logo` (`LogoConLetras.png`) centrado `width: min(206px, 54%)`.
- `.auth-title` — titular `clamp(32px,10.5vw,42px)`, weight 300, `#4f5c6e`; `<strong>` en `--brand-navy` (800).
- `.auth-head` — cabecera de pasos: `.auth-back` (círculo 44px `--g1`, navy) + `.auth-head-title` (24px 800 navy) + `.auth-head-sub` (13px `--mu`).
- `.auth-field` — label 12px 700 navy sobre `IonInput`.
- `ion-input.auth-input` — **patrón FASE 3**: fondo `#f1f4f8`, `min-height: 54px`, radius 16, borde `1.5px transparent` en el HOST (no `fill="outline"`, que no pinta borde en iOS), y focus con la clase real `.has-focus` → borde `--brand-green-soft` + fondo blanco.
- `.auth-remember ion-checkbox` — `--size:20px`, radius 7, checked `--brand-green`.
- `.auth-eye` (mostrar/ocultar contraseña, `IonButton fill="clear"` absoluto), `.auth-link-btn` (link 12.5px `--mu`).
- `.auth-otp` — celdas OTP 58px, radius 14, fondo `#f1f4f8`; `:focus` → borde `--brand-green-soft`; `.filled` → borde `--brand-navy`.
- `.auth-contact` — tarjeta de método de contacto (radio custom): fondo `#f1f4f8`, radius 18, borde `1.5px`; `:active` borde `--brand-green-soft`. Icono en `.auth-contact-ico` (blanco, `--brand-blue-mid`).
- `.auth-person` — tarjeta de identidad encontrada: fondo `var(--grad-brand)`, avatar 42px círculo `rgba(255,255,255,.18)`.
- `.auth-note` — aviso shield: fondo `--teal-l`, texto `--teal-d`. `.auth-hint` — texto auxiliar 13.5px `--mu` con `<strong>` navy.
- `.auth-busy` — barra de progreso de acción: fondo `--blue-l`, texto `--brand-blue-mid`, `IonProgressBar` pegado abajo con `--progress-background: var(--brand-green)`.
- `.auth-footer` — pie "Conexión segura": 11px `--mu` + `IonIcon key`.

### CTA principal de acceso (`ion-button.cta-pill` — `global.css:14459-14506`)

Botón píldora de login/activación: `--background: var(--brand-navy)` (pressed `#0d1c3d`), `--border-radius: 999px`, **altura 62px**, shadow `0 14px 30px rgba(20,40,85,.3)`. Compuesto de:
- `.cta-pill-ico` — círculo 46px con gradiente verde `linear-gradient(150deg,#3d7b72,#0f4a44)` (spinner o icono).
- `.cta-pill-label` — texto centrado.
- `.cta-pill-chevrons` — 3 `chevronForward` translúcidos (decorativo, `aria-hidden`).

### Home / Inicio (`.hm-*` — `HomePage.tsx`, `global.css:15045-15396`)

- `.screen-scroll.home` — fondo blanco (sin hero).
- `.hm-head` — header: `.hm-avatar` (iniciales, círculo 48px fondo `--grad-brand-v`, borde blanco, shadow navy), `.hm-icon-btn` (40px icon button navy), `.hm-brand` (`LogoIndividual.png` 40px).
- `.hm-hello` — saludo 26px 800 navy `letter-spacing:-0.8px`; `.hm-date` — 14px `#7d8798` capitalizado.
- `.hm-chips` — fila de chips: `.hm-chip.green` (fondo `--brand-green-soft`) y `.hm-chip.navy` (fondo `--brand-navy`), radius 999, 11.5px 700; convive con `LanguageToggle`.
- `.hm-wheel-card` — tarjeta del `ProtocolWheel`: `width: calc(100% - 32px)` con `margin: 14px 16px 0`, radius 26, fondo `#f1f3f6`; kicker/foot 9px uppercase `#97a2b3`.
- `.hm-metrics` — tarjeta de indicadores: fondo `--brand-navy`, radius 24, scroll-x con `scroll-snap`; `.hm-metric` 33.33% c/u; `.hm-metric-val` (Space Grotesk 23px 700 blanco), `.hm-metric-lbl` (12px `rgba(255,255,255,.72)`), `.hm-metric-bar` (track `rgba(255,255,255,.16)` + relleno `#cfd8e4`).
- `.hm-duo` — grid `0.86fr 1.14fr`: `.hm-quick` (accesos 2×2, contenedor radius 24 fondo `#f1f3f6`; `.hm-quick-btn` navy radius 17, `min-height:62px`; `.panic` con sigla "SOS" en círculo) + `.hm-appt` (cita destacada navy radius 24: `.hm-appt-time` Space Grotesk 18px, `.hm-appt-name` 15px 600, `.hm-appt-meta` 10.5px `.72`, `.hm-appt-chip` píldora `rgba(255,255,255,.14)`, `.hm-appt-people` con `.hm-appt-doc` (`--brand-sky`) y `.hm-appt-add` (blanco); estados loading/error/empty con `IonSkeletonText`).

## Componentes de diseño (clases en global.css — NO renombrar)

- `.kicker` (eyebrow dorado, 10px uppercase), `.h1`/`.h2` (Space Grotesk), `.sub` (blanco 62 %)
- `.chip` + variantes: `.chip-glass`, `.chip-gold`, `.chip-teal`, `.chip-blue`, `.chip-org`, `.chip-red`, `.chip-pur`
- `.card` + `.card-accent` con tonos `ac-teal/blue/gold/pur/panic/org/ind` (borde superior 3px)
- `.btn` + variantes: `.btn-primary`, `.btn-teal`, `.btn-gold`, `.btn-pur`, `.btn-panic`, `.btn-ghost`, `.btn-outline`
- `.ptrack`/`.pfill` (progreso), `.avatar`, `.ico`, `.display`
- `.ct`/`.cs` (título/subtítulo de card), `.sec` (separador de sección)

> Estas clases seguirán existiendo mientras no se migre el custom. Componentes NUEVOS: Ionic + tokens (no usar `.btn` nuevo, ver `ionic-components`).

## Spacing y medidas

- Paddings de página: 14-16px (`padding: '0 14px'` / `16px` patrón en pages). Login/Home: bloques propios (ver arriba).
- Cards: `padding: 13px 12px`, radius `--radius-md` (18px). Acceso/Home usan radios mayores: 16-26px.
- Gap estándar entre cards: 8-10px
- Altura mínima de botones: 48px (`.btn`); CTA de acceso píldora: 62px.
- Fuentes: UI 11-15px, títulos 18-26px, display en métricas 23px.

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
- El diseño usa heroes oscuros sobre fondo claro (`--g0`); **Home y Login usan fondo blanco** (`.home`/`.auth`).
- **Si se pide dark mode** (MIGRACIÓN FUTURA): añadir bloque `@media (prefers-color-scheme: dark)` en `variables.css` redefiniendo `--g0/g1/bd/tx/mu` y `--ion-background-color`, y validar `.card`/`.field`/`.bnav` (tienen fondos blancos fijos). Verificar `IonToggle`/`IonDatetime` no presentes aún.

## Reglas

1. **Nuevos colores** → variable en `variables.css`; nunca hex sueltos en JSX/global.css (salvo gradientes en `style={{}}` — patrón existente).
2. **Nunca tocar fuentes** (Inter/Space Grotesk/Sora) sin aprobación — son identidad. Inter = UI, Space Grotesk = display/valores métricos (clase `.display`, `.hm-metric-val`), Sora = headings alternativos.
3. No reescalar `--nav-h` (78px) ni `--radius-*` sin validar en móvil real.
4. Gradientes de marca (definidos en `variables.css:34-36`, replicarlos tal cual):
   - `--grad-brand`: `linear-gradient(90deg, #0c4c6b 0%, #3d7b72 32%, #023467 100%)`
   - `--grad-brand-v`: `linear-gradient(160deg, #023467 0%, #0c4c6b 58%, #3d7b72 100%)`
   - `--grad-sky`: `linear-gradient(90deg, #87aeca 0%, #5581a2 62%, #4b7086 100%)`
5. Accesibilidad de color: contrastes de texto sobre heroes ya validados; no oscurecer `--mu` para texto de 11px.
6. Al migrar a componentes Ionic, mapear colores con `color="primary"` (**navy `#142855`**) o CSS vars — no inventar colores.
7. Gradientes del diseño sobre componentes Ionic: `style={{ background: 'linear-gradient(...)' }}` o clase propia — el token vive en `variables.css`.
