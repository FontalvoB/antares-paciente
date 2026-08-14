---
name: ionic-overlays
description: Overlays y feedback en ANTARES Paciente (Ionic React). Guía por componente: IonModal, IonPopover, IonAlert, IonToast, IonLoading, IonActionSheet — cuándo usar, cuándo NO, patrón, lifecycle, cierre e interacción móvil.
---

# Overlays y feedback — ANTARES Paciente

## Regla de oro

> Para cualquier overlay, feedback o confirmación → usar primero la solución Ionic (`IonToast`, `IonModal`, `IonAlert`, `IonLoading`, `IonPopover`, `IonActionSheet`). No construir overlays con framer-motion + divs salvo caso justificado (ver PanicOverlay).

**ESTADO ACTUAL:** toasts, modales y loading son custom (framer-motion). **ESTADO RECOMENDADO:** componentes Ionic en todo desarrollo nuevo. **MIGRACIÓN FUTURA:** reemplazo de `ToastHost`, `VoiceOverlay` y loadings custom.

## Mapa de uso actual → objetivo

| Necesidad | Hoy (custom) | Objetivo Ionic | Archivo |
|---|---|---|---|
| Toast / notificación | `ToastHost.tsx` (framer-motion) + `showToast` en contexto | `IonToast` | `AppContext.tsx:226-229` |
| Modal SOS | `PanicOverlay.tsx` (fullscreen, countdown) | `IonModal` — **evaluar**: excepción justificada (timer emergencia) | `App.tsx:59` |
| Modal voz | `VoiceOverlay.tsx` (fullscreen) | `IonModal` (`presentingElement`, fullscreen) | `App.tsx:60` |
| Loading análisis IA | emoji + `setTimeout` (TestsPage:71-75) | `IonLoading` / `IonSpinner` | `TestsPage.tsx` |
| Loading scan BT | texto "Buscando…" (WearablePage:57) | `IonSpinner` | `WearablePage.tsx` |
| Confirmación cancelar cita | `showToast('…enviada')` (AppointmentsPage:102-108) | `IonAlert` con botones | `AppointmentsPage.tsx` |
| Acciones contextuales | toasts informativos | `IonPopover` / `IonActionSheet` | AcademyPage, InfinitoPage, CommunityPage |

## IonToast — feedback rápido (éxito/info)

- **Cuándo**: mensajes cortos (≤3s), éxito de acción, avisos sin decisión.
- **Cuándo NO**: decisiones → `IonAlert`; errores que requieren acción → `IonAlert`.
- **Patrón** (declarativo, preferido en este proyecto):

```tsx
import { IonToast } from '@ionic/react'
const [open, setOpen] = useState(false)
<IonToast
  isOpen={open}
  message="Evaluación guardada"
  duration={2600}
  color="success"
  onDidDismiss={() => setOpen(false)}
/>
```

- **Patrón** (imperativo, reemplazo directo de `showToast`): `const [present] = useIonToast()` → `present({ message, duration: 2600, color })`.
- **Lifecycle/cierre**: `isOpen` + `onDidDismiss` (siempre cerrar el estado en el handler). `buttons` opcional para acción ("Deshacer").
- **Interacción móvil**: respeta safe areas automáticamente (`position` top/bottom).

## IonModal — pantallas anidadas / fullscreen

- **Cuándo**: pantallas hijas (agente de voz, detalle, formulario largo), contenido que necesita foco.
- **Cuándo NO**: decisión simple → `IonAlert`; acciones de 1 tap → no modal.
- **Patrón**:

```tsx
<IonModal isOpen={voiceOpen} onDidDismiss={closeVoice} className="fullscreen-modal" presentingElement={hostRef.current}>
  …contenido…
</IonModal>
```

- **Lifecycle**: `isOpen` controla; `onDidDismiss` para sincronizar estado; `onWillPresent`/`onWillDismiss` para hooks de animación.
- **Cierre**: `setOpen(false)` (y `onDidDismiss`), botón de cerrar, backdrop (`backdropDismiss`, default true), `canDismiss` (Ionic 8: condicional antes de cerrar).
- **Interacción móvil**: swipe-to-close nativo en iOS (`swipeToClose`); `fullscreen` true para ocupar toda la pantalla; `presentingElement` cuando se abre sobre otra vista; `keepContentsMounted` para preservar estado.
- **Stack**: no anidar modales sin gestionar — usar `presentingElement` o mantener el orden de presentación.

## IonAlert — confirmaciones y decisiones

- **Cuándo**: destrucción (cancelar cita, borrar), confirmación con 2+ opciones, errores críticos.
- **Cuándo NO**: feedback informativo → `IonToast`; formulario largo → `IonModal`.
- **Patrón**:

```tsx
<IonAlert
  isOpen={showCancel}
  header="¿Cancelar cita?"
  message="Se notificará al equipo médico."
  buttons={[
    { text: 'Volver', role: 'cancel' },
    { text: 'Cancelar cita', role: 'destructive', handler: () => showToast('Solicitud enviada', 'warn') },
  ]}
/>
```

- **Lifecycle/cierre**: `isOpen` + `onDidDismiss`; roles `cancel` (cierra) y `destructive` (rojo iOS).
- **Interacción móvil**: native dialog — no requiere estilos propios; `inputs` para prompts simples.

## IonLoading / IonSpinner — bloqueo y progreso

- **Cuándo**: operaciones síncronas largas (análisis IA, scan BT, submit); `IonSpinner` para loaders inline en contenido.
- **Cuándo NO**: cargas de datos asíncronas con UI → skeletons (`IonSkeletonText`); barra de progreso → `IonProgressBar`.
- **Patrón**:

```tsx
<IonLoading isOpen={loading} message="Analizando tu perfil…" />
{/* o inline: */}
<IonSpinner name="crescent" />
```

- **Lifecycle/cierre**: `isOpen` + `onDidDismiss`; `dismissOnPageChange` (con router); `backdropDismiss` false (no dejar cerrar accidentalmente).
- **Interacción móvil**: bloquea interacción por defecto (backdrop).

## IonPopover — acciones ancladas a un elemento

- **Cuándo**: menú contextual anclado (3 puntos en card, acciones de post), filtros.
- **Cuándo NO**: 1 sola acción → directa; acciones globales → `IonActionSheet`.
- **Patrón**: `trigger` (id del elemento) o `isOpen` + `event` (anchorage) + `onDidDismiss`.
- **Lifecycle/cierre**: `isOpen` + `onDidDismiss`; cierre con tap fuera (backdrop default).
- **Interacción móvil**: en pantallas pequeñas considerar `IonActionSheet` (bottom sheet nativo) en su lugar.

## IonActionSheet — acciones múltiples (bottom sheet)

- **Cuándo**: 3+ acciones desde un elemento; mejor UX móvil que popover (bottom sheet).
- **Cuándo NO**: acciones ≤2 → `IonAlert`; ancladas a contenido fino → `IonPopover`.
- **Patrón**: `isOpen`, `header`, `subHeader`, `buttons` (con `role: 'destructive'|'cancel'`, `handler`).
- **Lifecycle/cierre**: `isOpen` + `onDidDismiss`; cancel = close.
- **Interacción móvil**: sheet nativo iOS/Android, respeta safe-area bottom.

## PanicOverlay — excepción documentada (MANTENER custom)

`PanicOverlay.tsx` (countdown 5s, ring pulsante, layout de emergencia) es caso especial: migración a `IonModal` posible pero debe **preservar**:
- el countdown con `setInterval` (`PanicOverlay.tsx:11-25`),
- el z-index sobre toda la UI,
- los estilos `.overlay-panic`, `.panic-ring`, animación `panicRing` (global.css:520-548).

Si se migra, validar que `IonModal fullscreen` no añade latencia perceptible en una emergencia. Por defecto: **mantener custom**.

## Reglas

1. Nuevo feedback → componente Ionic, no más divs con AnimatePresence.
2. El estado de apertura de overlays GLOBALES (panic, voice) vive en `useApp()` — no duplicarlo localmente.
3. No anidar `IonModal` sobre `IonModal` sin gestionar stack — usar `presentingElement`.
4. Toasts cortos (≤3s) éxito/info; `IonAlert` decisiones; `IonPopover`/`IonActionSheet` acciones ancladas; `IonLoading` bloqueos.
5. Si el diseño custom aporta (como el ring SOS), mantener el CSS pero dentro del componente Ionic.
6. Siempre `onDidDismiss` → actualizar estado (evitar overlays "fantasma" al re-renderizar).
