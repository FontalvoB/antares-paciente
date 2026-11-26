# Módulo `features/wellness` — contrato de KAN-136

**Ejercicio del Motor 365 (KAN-125).** La pantalla usa el día, la fase, la lista
de ejercicios, su dosis y los textos ES/EN de `GET /api/v1/people/me/plan`.
La sesión guardada queda ligada a la cuenta, el día y los ejercicios del plan.
Una pausa, un bloqueo o una carga fallida no activa una rutina local. La rutina
local se conserva para el modo legado sin persona en el Motor 365. El chequeo
previo puede reducir o detener la sesión, sin adelantar desbloqueos ni añadir
ejercicios que no enviara el servidor.

## Sincronización Motor 365 (KAN-153)

El modo real se vincula por la sesión. El día civil, las metas y las versiones
proceden del plan del servidor. Con el consentimiento de datos sensibles, la
lectura de inicio y Año 365 trae cierres y eventos del mismo contexto. El
indicador usa la hora de la última lectura aceptada y señala fallos de
actualización si aún se puede mostrar ese día.

El cierre pendiente conserva fecha, ordinal y persona. Solo se envía por la
ruta condicional a la persona vinculada de esa cuenta. Si la API confirma que
ya existe un cierre distinto, Antares lee ese día y preserva el cierre del
servidor. Puede reintentar la lectura tras un corte. El modo demo guarda sus
datos localmente. Los registros anteriores sin un vínculo de persona
verificable se conservan en el dispositivo para evitar asignarlos a otra cuenta.

Onboarding nuevo de Agentic Wellness IA. Reemplaza el onboarding de cédula/seguro.
El plan real lo calcula el backend (`/v1`, KAN-130); aquí hay mock + vista previa.

## Propiedad de ficheros (evitar conflictos entre agentes)

| Ruta                                                                                                              | Dueño                     |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `domain/**`, `services/**`, `wellness.css`, `OnboardingPage.tsx`, `AppContext.tsx`, `i18n/*.json`, `__tests__/**` | integrador                |
| `components/onboarding/**`                                                                                        | agente `codex-onboarding` |
| `components/objective/**`                                                                                         | agente `codex-objective`  |

Nadie crea ficheros compartidos nuevos. Si falta una primitiva, se usa Ionic o
una clase existente (`.onb-*`, `.card`, `.field`, `.btn`, `.wl-*`).

## Reglas obligatorias

1. Ionic-first: `IonButton`, `IonInput`, `IonSelect`, `IonCheckbox`, `IonIcon`,
   `IonSpinner`, `IonBadge`. HTML custom solo para tarjetas de opción, chips de
   Sí/No y layout (clases `.wl-*` ya definidas).
2. Tokens de `theme/variables.css`. Cero hex sueltos.
3. Textos con `t("texto en español")`; la traducción EN se entrega en un
   markdown de claves, NO se edita `en.json` (single-writer = integrador).
4. Accesibilidad: `aria-label`/`aria-pressed` en opciones y Sí/No, foco visible,
   área táctil ≥44px, `role="alert"` en errores, jerarquía h1/h2.
5. Estados loading/error/vacío contemplados. Sin promesas de resultados ni
   lenguaje clínico (diagnóstico, tratamiento, dosis, cura).
6. TypeScript: `import type`, sin `any`, sin variables muertas.
7. No tocar backend ni ERP.

## Contrato de componentes

### `components/onboarding/`

```tsx
export function EmailStep(props: {
  email: string;
  onEmailChange: (v: string) => void;
  existingAccount: boolean;
  password: string;
  onPasswordChange: (v: string) => void;
  onSubmit: () => void;
  onBackToLogin: () => void;
  busy: boolean;
  error?: string | null;
}): JSX.Element;

export function EmergencyStep(props: {
  primary: WellnessEmergencyContact;
  secondary: WellnessEmergencyContact;
  onPrimaryChange: (v: WellnessEmergencyContact) => void;
  onSecondaryChange: (v: WellnessEmergencyContact) => void;
  onContinue: () => void;
  onBack: () => void;
  disabled?: boolean;
}): JSX.Element;

export function TermsStep(props: {
  accepted: boolean;
  onAcceptedChange: (v: boolean) => void;
  onContinue: () => void;
  onBack: () => void;
  disabled?: boolean;
}): JSX.Element;

export function PasswordStep(props: {
  password: string;
  confirm: string;
  onPasswordChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  busy: boolean;
  error?: string | null;
}): JSX.Element;

export function WellnessStepper(props: {
  current: number;
  total: number;
  labels: string[];
}): JSX.Element;
```

`EmergencyStep` reutiliza `../../components/EmergencyContactsForm` (ya existe,
no duplicar) y `utils/emergencyContacts` para validar principal/respaldo.

### `components/objective/`

```tsx
export function ObjectiveWizard(props: {
  draft: ObjectiveDraft;
  onChange: (patch: Partial<ObjectiveDraft>) => void;
  gate: GateResult | null;
  generating: boolean;
  onGenerate: () => void;
  onExit: () => void;
}): JSX.Element;
```

El wizard posee el índice de paso (0-7) y valida cada paso antes de avanzar con
`RANGES`/`evaluateGate` del dominio. Al pulsar "Generar plan" llama `onGenerate`.
Si `gate` viene con `ok:false`, muestra los `issues` con `GateNotice` y un botón
que salta al paso indicado (`issue.step`). El paso 8 incluye el botón de generar.

```tsx
export function GateNotice(props: {
  gate: GateResult;
  onGoToStep: (step: number) => void;
}): JSX.Element;
```

Orden de pasos (`OBJECTIVE_STEP`): meta(0) → datos(1) → actividad(2, incluye
ritmo) → preferencias(3) → PAR-Q(4) → NQS(5) → términos(6) → generar(7).

## Criterios de aceptación que la UI debe hacer visibles

- Sin todas las respuestas no se genera plan; se explica qué falta.
- Edad < 18: mensaje y salida (volver/cambiar datos).
- IMC < 18.5 con bajar/definir: mensaje y opción de elegir masa.
- Cualquier "Sí" en PAR-Q/NQS: "Consulta primero a tu médico" + checkbox de
  confirmación; sin confirmar no se genera.
- Términos: versión y fecha-hora visibles.
- ES/EN completo y unidades métricas (US queda para KAN-147).

## KAN-136 y KAN-142 — generación en segundo plano

- Después de validar el objetivo, el onboarding guarda las respuestas y el
  snapshot, solicita el trabajo idempotente y abre Inicio.
- Inicio consulta `generation/useGeneration.ts` para mostrar avance, bandeja y
  reintento parcial. El mock persiste el trabajo en `wellness.generation.v1`.
- El contrato de integración propuesto está en
  [KAN-136-142-handoff-diomedes.md](../../../docs/kan/KAN-136-142-handoff-diomedes.md).

## KAN-144 — cambiar objetivo desde Perfil

- Entrada: Perfil → "Mi plan" → fila **Objetivo** → pantalla `wellness-goal`
  (`goal/WellnessGoalPage.tsx`): confirmación → `ObjectiveWizard` precargado →
  resumen de cambios (objetivo, kcal, proteína, carbos, grasas) → Home.
- `WellnessPlanSnapshot` incluye ahora `version` y los datos del objetivo
  (`sex`, `age`, `heightCm`, `weightKg`, `waistCm`, `targetWeightKg`, `activity`,
  `pace`, `vegetarian`, `dairyFree`). `normalizePlanSnapshot` rellena defaults
  para snapshots anteriores (versión 1, datos `null`).
- `savePlanSnapshot` archiva el plan vigente en `wellness.plan.versions.v1`
  (`{ version, changedAt, snapshot }`) y sube la versión.
- `changePlanObjective` (`state/goal-change.ts`) conserva `startDate`: el día N
  continúa. No toca `wellness.protocol.v1` ni `wellness.batteries.v1`.
- PAR-Q/NQS y términos NO se precargan: se vuelven a responder en cada cambio.
