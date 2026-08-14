---
name: ionic-components
description: Matriz de decisión de componentes Ionic para ANTARES Paciente. Qué componente usar para cada necesidad (IonButton, IonInput, IonModal, IonToast, IonTabs, etc.), props reales de Ionic 8.8, excepciones y qué NO usar por defecto. Cargar antes de crear cualquier elemento visual.
---

# Componentes Ionic — matriz de decisión

**ESTADO ACTUAL (verificado):** el proyecto solo importa `IonApp` e `IonIcon` (`App.tsx:1`, `BottomNav.tsx:1`, `ChatPage.tsx:1`, `HomePage.tsx:1`, `PanicOverlay.tsx:2`, `VoiceOverlay.tsx:2`). Todo lo demás es HTML/CSS custom. **ESTADO RECOMENDADO:** usar los componentes de abajo en todo desarrollo nuevo. **MIGRACIÓN FUTURA:** los "hoy custom" se migrarán uno a uno con autorización (catálogo completo en `docs/auditoria.md` §6).

Versiones reales (`package.json`): `@ionic/react ^8.8.18`, `ionicons ^8.1.0`, `react-router-dom ^7.18.2` (SIN USO), `framer-motion ^13.1.0`.

## REGLA DE PRIORIDAD

> Antes de crear HTML nativo / CSS custom / librería externa para interacción, formulario, overlay, navegación o feedback → buscar aquí. Si existe componente Ionic → usarlo. Si no encaja, justificar (ver excepciones al final).

## REGLA DE PRESERVACIÓN VISUAL (obligatoria en toda migración)

> **Ionic reemplaza la tecnología del componente, NO su diseño.** El diseño que debe verse ya existe en el proyecto (`theme/variables.css` + `theme/global.css`).

Antes de migrar cualquier componente HTML a Ionic:

1. Identificar el estilo visual existente del componente original (altura, padding, border-radius, borde, tipografía, colores, gradientes, focus).
2. Identificar la clase CSS / token que lo proporciona (`.btn`, `.field`, `.ptrack`, `--teal`, …).
3. Migrar el componente a Ionic.
4. Hacer que el componente Ionic adopte los estilos existentes mediante:
   - **CSS variables de Ionic** (`--border-radius`, `--padding-*`, `--background`, `--border-color`, `--border-width`, `--highlight-color-focused`, `--progress-background`, `--size`…) → valores EXACTOS del diseño original;
   - `::part()` para partes internas cuando las vars no alcancen;
   - clases existentes del proyecto reutilizadas (nunca duplicadas).
5. Comparar visualmente antes/después. Si difiere, ajustar con los mecanismos anteriores — **nunca** volver al HTML anterior ni aceptar el estilo por defecto de Ionic.

**NO rediseñar**: no cambiar tamaños, tipografías, colores, bordes, radios, alturas, espaciados, paddings, layout ni apariencia de formularios/botones sin instrucción explícita.

**Jerarquía de estilos (de mayor a menor prioridad):**

```text
Ionic component (tecnología)
        ↓
CSS variables/props Ionic + tokens existentes (variables.css)
        ↓
clases existentes del proyecto (global.css)
        ↓
CSS específico SOLO si es necesario (nunca duplicar lo que ya existe)
```

Ejemplo verificado (FASE 3): `.field input` (font 15px, padding 12/13px, border 1.5px `--bd`, radius 12px) → `ion-input.fld` con `--border-radius:12px; --border-width:1.5px; --border-color:var(--bd); --padding-*:12px/13px; font-size:15px`. `.btn` (48px alto, radius 12, gradientes) → `ion-button.bt*` con `height:48px` + `--background: linear-gradient(...)` de la marca.

## Shadow DOM y DOM scoped — cómo adaptar estilos (lecciones FASE 3)

Cuando un componente Ionic (Shadow DOM o scoped CSS) no responde a estilos del host:

1. **No asumir que un estilo del host controla el elemento interno.** Cadena real: `HOST → (shadow/scoped) → ELEMENTO REAL`.
2. Determinar los mecanismos disponibles, en orden:
   - **CSS variables de Ionic** documentadas (`--padding-*`, `--border-radius`, `--background`, `--border-color`, `--highlight-color-*`, `--placeholder-*`, `--size`…) — cruzan la frontera del shadow;
   - **`::part()`** — SOLO si el componente lo expone (verificado: `IonSelect` expone `part="icon"` y `part="text"`; `IonInput`/`IonTextarea` NO exponen parts en Ionic 8.8). **No inventar parts** — verificarlas en la fuente o en devtools antes de usarlas;
   - **clases dinámicas reales en el host**: `.has-focus` (input/select/textarea), `.has-value` — usables desde el CSS del proyecto;
   - **propiedades heredables** (`font-*`, `color`, `letter-spacing`): se heredan del host al elemento interno si el interno no las fija.
3. **Ojo con DOM scoped (no shadow)**: los componentes con `shadow: false` (IonInput en v8 — DOM abierto) son alcanzables por selectores del proyecto. Reglas amplias como `.field label` o `.field input` matchean sus internos (`<label class="input-wrapper">`, `.native-input`) y los corrompen → restringir a hijos directos (`.field > label`).
4. **`fill="outline"` NO pinta borde en `mode: ios`** (los vars `--border-*` solo alimentan `.input-bottom`). Para borde visible: dibujarlo en el host y usar `.has-focus` para el estado.
5. El **CSS interno de Ionic no es fuente de verdad** — la fuente de verdad es el diseño existente de la app. El CSS interno solo sirve para entender qué controla qué.
6. **`mode: ios`**: el proyecto usa `setupIonicReact({ mode: 'ios' })` — los estilos internos dependen del modo (p.ej. min-height 44px en inputs, borde solo-top). Revisar el CSS de la versión instalada (`node_modules/@ionic/core/dist/esm/*.entry.js`) antes de concluir que "el CSS no funciona".

## Validación visual — obligatoria tras migrar

`build ✓` + `lint ✓` NO significan migración terminada. Secuencia completa:

```text
Código → Build → Lint → Ejecución real → Comparación visual
```

El criterio final es visual (captura original vs actual). Herramienta del repo: `scripts/probe-ionic.mjs` (puppeteer-core) mide computed styles reales del elemento que renderiza el texto (`ion-input .native-input`) sin abrir navegador manual.

## Regla de no rediseño

> Si un diseño ya existe, NO crear un diseño nuevo para adaptarlo a Ionic.

```text
¿Existe el estilo? → SÍ → Reutilizar/adaptar
                  → NO → Crear únicamente lo necesario
```

## Matriz de decisión

| Necesidad | Preferencia (Ionic) | Alternativa aceptable | No usar por defecto |
|---|---|---|---|
| Botón | `IonButton` | componente propio de dominio | `<button>` + `.btn` |
| Input texto/email/tel/password | `IonInput` | componente propio | `<input class="field">` |
| Select | `IonSelect` + `IonSelectOption` | — | `<select class="field">` |
| Textarea | `IonTextarea` | — | `<textarea>` |
| Checkbox | `IonCheckbox` (+ `IonItem` para hit-area) | — | `<div class="checkbox">` con `<button>` |
| Radio | `IonRadioGroup` + `IonRadio` | — | `<input type="radio">` |
| Toggle / switch | `IonToggle` | — | div custom |
| Fecha | `IonDatetime` en `IonModal`/`IonPopover` | `IonInput` con formato manual | `<input type="date">` |
| Búsqueda | `IonSearchbar` | — | `<input placeholder="Buscar…">` |
| Selector de segmentos / tabs de sección | `IonSegment` + `IonSegmentButton` | `IonTabs` (navegación real) | `<div class="plan-tabs">` con `<button>` |
| Modal / pantalla anidada | `IonModal` | componente de dominio | overlay custom con framer-motion |
| Toast / notificación | `IonToast` (o `useIonToast`) | — | `ToastHost` custom + divs |
| Alert / confirmación | `IonAlert` | — | toast usado como confirmación |
| Loading / bloqueo | `IonLoading` / `IonSpinner` | — | emoji + `setTimeout` |
| Popover contextual | `IonPopover` | `IonActionSheet` (móvil) | div absoluto custom |
| Acciones múltiples | `IonActionSheet` | `IonAlert` | toasts informativos |
| Tabs inferiores | `IonTabs` + `IonTabBar` + `IonTabButton` | `BottomNav` custom (MIGRACIÓN FUTURA, requiere router) | tabs HTML |
| Navegación / rutas / back | `IonReactRouter` + `IonRouterOutlet` + `IonBackButton` | state machine `useApp().navigate` (**ESTADO ACTUAL**) | switch manual nuevo |
| Menú lateral | `IonMenu` + `IonMenuButton` | — | panel custom |
| Lista / fila de datos | `IonList` + `IonItem` + `IonLabel` | `ListRow` propio | `<div class="prow">` |
| Card | `IonCard` + `IonCardContent` | `.card` custom (sólido — evaluar caso a caso) | — |
| Avatar | `IonAvatar` | — | `<div class="avatar">` |
| Chip | `IonChip` / `IonBadge` | — | `<span class="chip">` |
| Progreso de una línea | `IonProgressBar` (`value={0-1}`, `color`) | — | `.ptrack/.pfill` |
| Acordeón | `IonAccordionGroup` + `IonAccordion` | — | `.hc-sec` / `.prog-step` custom |
| Skeleton loading | `IonSkeletonText` | — | spinner/flash manual |
| Pull-to-refresh | `IonRefresher` + `IonRefresherContent` | — | — |
| Infinite scroll | `IonInfiniteScroll` | — | paginación manual sin estado |
| Grid responsive | `IonGrid` + `IonRow` + `IonCol` | flex/grid CSS existente (suficiente en una columna) | — |
| Header de página | `IonHeader` + `IonToolbar` + `IonTitle` | `.hero` custom (identidad visual — mantener) | — |
| Icono | `IonIcon` + `ionicons/icons` (**ya en uso**) | — | emoji para funcionalidad |
| OTP 6 dígitos | 6 `IonInput` `inputmode="numeric" maxlength={1}` | custom actual (funciona) — **PENDIENTE validar `IonCodeInput` en Ionic 8.8** | — |

## Referencia rápida por componente (props reales Ionic 8.8)

### IonButton

```tsx
import { IonButton } from '@ionic/react'
<IonButton expand="block" fill="solid" color="primary" size="default" disabled={!ok} onClick={fn}>
  Texto
</IonButton>
```

- Props: `expand` (block|full), `fill` (solid|outline|clear|default), `color`, `size`, `disabled`, `onClick`, `type="submit"`, `routerLink` (solo cuando exista router).
- Sustituye a: `.btn`, `.btn-primary`, `.btn-teal`, `.btn-gold`, `.btn-pur`, `.btn-panic`, `.btn-ghost`, `.btn-outline`.
- Gradientes de marca: mantener con `style={{ background: 'linear-gradient(...)' }}` sobre el `IonButton` (tokens en `ionic-theme`).

### IonInput / IonTextarea

```tsx
<IonInput
  type="email"
  label="Correo"
  labelPlacement="stacked"
  fill="outline"
  value={form.email}
  onIonInput={(e) => set('email', e.target.value as string)}
  inputmode="email"
  enterkeyhint="next"
/>
```

- Evento: `onIonInput` / `onIonChange` — NO `onChange` (React no lo recibe del web component).
- `type`: text, email, tel, password, number, url. `inputmode="numeric"` para teclado numérico.
- Label: `labelPlacement="stacked"` en el propio `IonInput` (patrón moderno; `IonLabel` solo dentro de `IonItem` legacy).
- Sustituye a `input.field`.

### IonSelect

```tsx
<IonSelect label="Seguro" labelPlacement="stacked" value={v} onIonChange={(e) => set(e.detail.value)}>
  <IonSelectOption value="A">A</IonSelectOption>
</IonSelect>
```

- `interface="action-sheet"` / `"popover"` mejoran la UX móvil vs picker por defecto.

### IonDatetime

- NO va directo en la página: va dentro de `IonModal` o `IonPopover` (patrón estándar).
- `onIonChange={(e) => set(e.detail.value as string)}`.

### IonCheckbox / IonRadioGroup

```tsx
<IonItem>
  <IonCheckbox checked={ok} onIonChange={(e) => set(e.detail.checked)} />
  <IonLabel>Texto</IonLabel>
</IonItem>
<IonRadioGroup value={v} onIonChange={(e) => set(e.detail.value)}>
  <IonRadio value="a">A</IonRadio>
</IonRadioGroup>
```

### IonIcon (ya en uso)

```tsx
import { IonIcon } from '@ionic/react'
import { mic, send } from 'ionicons/icons'
<IonIcon icon={mic} style={{ fontSize: 28 }} />
```

- Íconos SIEMPRE de `ionicons/icons` (instalado). Emojis solo decorativos.

### Otros

- `IonSegment`: `value` + `onIonChange` + `<IonSegmentButton value="x">`.
- `IonAccordionGroup` (`value`, `multiple`): `<IonAccordion value="x"><IonItem slot="header">…</IonItem><div slot="content">…</div></IonAccordion>`.
- `IonProgressBar`: `value={0..1}` o `type="indeterminate"`.
- `IonSpinner`: `name="crescent|dots|lines"`.
- `IonSearchbar`: `value`, `onIonInput`, `placeholder`, `debounce`.
- `IonList`/`IonItem`: `IonItem` con `button` para filas táctiles, `detail` para chevron.
- `IonAvatar`/`IonChip`: wrappers de imagen/badge — usar dentro de `IonItem` cuando aplique.

## Reglas de uso

1. Importar SIEMPRE de `@ionic/react` — nunca los web components en minúscula (`<ion-button>`).
2. `IonApp` envuelve toda la app (JSX `App.tsx:70`) y `setupIonicReact({ mode: 'ios' })` se llama una sola vez (`App.tsx:20`) — no repetir.
3. Personalización puntual con `style={{}}` o clases propias en `global.css`; no romper tokens de `variables.css`.
4. Tras migrar un custom → verificar que el CSS duplicado (`.btn`, `.ptrack`, etc.) no quede huérfano en `global.css`.
5. Emojis: decorativos OK; funcionales → `IonIcon`.

## Excepciones — NO usar Ionic (justificado)

- **Gráficos bespoke**: ring kcal SVG (`NutritionPage:84-93`), bar chart (`:191-200`), ECG (`WearablePage:114-130`). Sin librería de charts — no añadir.
- **Shell y frame de teléfono** (`app-shell`), heroes con gradiente, sticky footers: layout propio.
- **PanicOverlay**: emergencia con countdown 5s y z-index crítico — mantener custom (detalle en `ionic-overlays`).
- **Cards de dominio** (`.card` con variantes de acento): mantener como base visual; `IonCard` solo si aporta.
- **Cualquier elemento sin equivalente razonable en Ionic 8.8** → crear Primitive (ver `reusable-components`), justificándolo.

## PENDIENTE DE VALIDACIÓN

- `IonCodeInput` en Ionic 8.8 (OTP) — verificar antes de usar.
- `IonProgressBar` con gradientes teal→gold del diseño.
- Compatibilidad `framer-motion` (Screen) con transiciones del router al migrar.
