---
name: ionic-components
description: Matriz de decisión de componentes Ionic para ANTARES Paciente. Qué componente usar para cada necesidad (IonButton, IonInput, IonModal, IonToast, IonTabs, etc.), props reales de Ionic 8.8, excepciones y qué NO usar por defecto. Cargar antes de crear cualquier elemento visual.
---

# Componentes Ionic — matriz de decisión

**ESTADO ACTUAL (verificado):** el proyecto solo importa `IonApp` e `IonIcon` (`App.tsx:1`, `BottomNav.tsx:1`, `ChatPage.tsx:1`, `HomePage.tsx:1`, `PanicOverlay.tsx:2`, `VoiceOverlay.tsx:2`). Todo lo demás es HTML/CSS custom. **ESTADO RECOMENDADO:** usar los componentes de abajo en todo desarrollo nuevo. **MIGRACIÓN FUTURA:** los "hoy custom" se migrarán uno a uno con autorización (catálogo completo en `docs/auditoria.md` §6).

Versiones reales (`package.json`): `@ionic/react ^8.8.18`, `ionicons ^8.1.0`, `react-router-dom ^7.18.2` (SIN USO), `framer-motion ^13.1.0`.

## REGLA DE PRIORIDAD

> Antes de crear HTML nativo / CSS custom / librería externa para interacción, formulario, overlay, navegación o feedback → buscar aquí. Si existe componente Ionic → usarlo. Si no encaja, justificar (ver excepciones al final).

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
