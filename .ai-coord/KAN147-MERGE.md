# KAN-147 — Resolución de marcadores tras merge con origin/dev

Rama: `feat/KAN-147-i18n-a11y-unidades` (worktree `.worktrees/kan147`). Fecha: 2026-11-25.
Estado: cambios en el árbol de trabajo, **sin commit ni push** (según instrucción).
No se tocaron `src/features/wellness/home/WellnessHome.tsx` ni `wellness-home.css`.

## Decisiones por fichero

| Fichero | Lado KAN-147 (ours) conservado | Lado KAN-121/dev (theirs) conservado | Ajuste de fusión |
|---|---|---|---|
| `components/objective/steps/DataStep.tsx` | `useI18n` (necesita `lang`), `formatWellnessMeasurement`/`parseWellnessMeasurement`, `UnitPrefs`, `unit` + `usLabel` por campo (lb/in), `style={{ minHeight: 48 }}` (área táctil), `inputs` con flag `us` para no reutilizar texto tecleado en otro sistema de unidades, `issueParams(..., prefs)` | Iconos ionicons en todos los campos (`IonIcon slot="start"`), `hint` → `helperText`, `NUMERIC_FIELDS` tipado, `parseMeasurement`, `readMeasurements` exportado | `parseMeasurement(raw, unit, prefs)` ahora devuelve el valor **métrico** (convierte lb/in → kg/cm); el `onIonInput` y `readMeasurements` comparten esa función, eliminando el parseo duplicado de KAN-147. `readMeasurements` recibe `prefs` (antes guardaba lb/in en el draft como si fueran kg/cm → regresión de unidades). El hint `"1,65 m = 165 cm"` se oculta cuando el campo se muestra en US (sería engañoso junto a "Estatura (in)"); el hint de edad siempre se muestra. `useT` de dev se sustituye por `useI18n` porque se necesita `lang` para formatear. |
| `components/objective/ObjectiveWizard.tsx` | `loadUnitPrefs`, prop `unitOwner`, `prefs` a `DataStep`, `GenerateStep`, `GateNotice` e `issueParams` | `WellnessGoal`, `allowedGoals`, `presentation="paid"`, `onExit` opcional, `className="wl-content"`, `hideAction={paid}`, `GenerateAction` en footer | `readMeasurements(content.current, draft, prefs)` para que el paso "Continuar" convierta unidades igual que el input. Firma final: `{ draft, onChange, gate, generating, onGenerate, onExit?, unitOwner?, allowedGoals?, presentation? }`. |
| `components/objective/steps/GenerateStep.tsx` | `prefs: UnitPrefs` y resumen con `formatWellnessMeasurement` | `GenerateActionProps`, `GenerateAction` exportado sin cambios, `hideAction` | `GenerateStep` acepta `prefs` además de `hideAction`. |
| `goal/WellnessGoalPage.tsx` | `unitOwner={checkinOwner(user)}` (ya sin conflicto) | `{BRAND_NAME}` | Eliminado el literal `t("Copp Adresd")`. La clave i18n `"Copp Adresd"` se mantiene en es/en.json porque `HealthAccessoryPage.tsx` aún la usa. |

## Parámetros eliminados

- Ninguno de KAN-147 quedó obsoleto: dev no reemplazó la estructura de unidades, solo añadió iconos/hints y `readMeasurements`. El único código retirado es el parseo inline duplicado del `onIonInput` de KAN-147, absorbido por `parseMeasurement(raw, unit, prefs)`.
- Sin props ni imports sin usar (oxlint sin hallazgos en los ficheros tocados).

## Observación (fuera de alcance, no modificado)

- `src/pages/WellnessJourneyPage.tsx` (paid journey de dev) no pasa `unitOwner`; las preferencias caen a `draft.email || "local"`. Si se quiere coherencia con el resto de la app, pasar `unitOwner={checkinOwner(user)}` en un cambio aparte.

## Gates

| Gate | Resultado |
|---|---|
| `npm run build` (`tsc -b && vite build`) | OK, 0 errores (solo aviso existente de tamaño de chunk) |
| `npx oxlint` | exit 0, **0 errores**, 29 warnings preexistentes (ninguno en objective/goal) |
| `npm run i18n:check` | **0 claves faltantes** en en.json (5514 claves; huérfanas preexistentes listadas, no bloquean) |
| `npx vitest run src/features/wellness` | 31 ficheros / 234 tests OK |
| `npx vitest run` (suite completa) | **267 ficheros / 2254 tests OK**, 0 fallos |

## E2E tras rediseño

Fecha: 2026-11-25. Script: `e2e/wellness-i18n-a11y.mjs`. Sin commit ni push.
Nota: el merge commit pasó de `7e274cb` a `eaec475` entre tareas (reescrito fuera de esta sesión, ya incluye la resolución de componentes); no lo toqué.

### Recorrido: antes y ahora

| Script anterior | Equivalente actual (KAN-121) | Motivo |
|---|---|---|
| `.wh-protocol` → botón «Cerrar el día» en el Home | Home → `.wh-ring-button` («Ver mi plan de bienestar») → `wellness-plan` → etapa `.wh-plan-stages` «Bienestar» → `wellness-checkin` | `.wh-protocol` ya no existe; el anillo abre el plan y el cierre del día cuelga de la etapa «Bienestar». También se llega por el menú «Más opciones», pero el recorrido pedido es el del anillo. |
| — (no se cubría) | Home → `.wh-task` «Ejercicio» → `wellness-exercise` → «Volver al protocolo» → «Volver al inicio» | Entrada actual a ejercicio desde la lista `wh-task-list`. |
| — (no se cubría) | Home → `.wh-task` «Nutrición» → `wellness-diet` («Dieta de hoy») → «Volver al protocolo» → «Volver al inicio» | Entrada actual a dieta. |
| Formulario de cierre, error enfocado, radiogroup `aria-invalid`, unidades kg/cm vs lb/in, foco de Peso, Tab a Cintura, teclado en checkbox y radio, resumen y localStorage métrico | Sin cambios | La pantalla `WellnessCloseDay` (`.wc-scroll`) mantiene su estructura. |

### Criterios que se mantienen o amplían (sin rebajar ninguno)

- Idiomas es/en × viewports 320/390/768; `html[lang]` correcto.
- Cero overflow horizontal: `html`, `.app-shell` y todos los scroll actuales (`.wh-scroll`, `.wp-scroll`, `.wx-scroll`, `.wc-scroll`) más sus h1/h2/labels, comprobados en Home, ejercicio, dieta, plan y cierre (antes solo en el cierre).
- Cero `pageerror`, cero `console.error` y cero avisos `[i18n]`/`[appointments]`/`[thread]` en todo el recorrido.
- Foco visible: contorno sólido de 2 px o más en el campo Peso (como antes) y además en la tarea «Ejercicio» del Home con teclado (Shift+Tab/Tab). En `IonButton` el foco cae en el `<button>` nativo del shadow DOM, así que se mide ese elemento o su host.
- Áreas táctiles de 44×44 px o más: anillo, tareas Ejercicio/Nutrición, «Volver al protocolo», «Volver al inicio», «Volver a Inicio» del plan, etapa «Bienestar», y Peso/síntoma/«Sí»/«Cerrar el día» (como antes).
- Nombres accesibles: todos los controles visitados se localizan por rol + nombre exacto traducido.
- Canal del navegador: `KAN147_CHROMIUM_CHANNEL` o, si no está, `COP_E2E_BROWSER_CHANNEL`.
- Nueva semilla: consentimiento `sensitive-data` (`2026-11-25-draft.1`) en la auditoría local, porque ejercicio y cierre van tras `SensitiveDataScreen` desde KAN-121. Si cambia `WELLNESS_CONSENT_VERSIONS`, hay que actualizar el script.

### Defectos reales de KAN-121 que destapó el E2E (arreglados con aprobación del owner)

| Defecto | Evidencia | Arreglo |
|---|---|---|
| `.wh-screen::before` (fondo decorativo, `inset: 35% -20% -25%` rotado) desbordaba `.app-shell` 136 px en Home y Plan, en los tres viewports (desplazable por programa aunque no se viera) | `scrollWidth 456 / clientWidth 320`, `scrollLeft` máx. 136 | `wellness-home.css`: `overflow: hidden; overflow: clip;` en `.wh-screen`. Recorta el fondo sin crear contenedor desplazable; el diseño no cambia. |
| En inglés, `WellnessPlan` monta `<WellnessPreview title="">` → `t("")` → `[i18n] Missing key for "en"` | Aviso de consola al entrar en el plan (en, todos los viewports) | `WellnessFrame.tsx`: `<h2>{title && t(title)}</h2>`. |

Fuera de alcance (no tocado): el toast «Ya puedes empezar tu protocolo de hoy / Ver protocolo» del Home se ve con poco contraste en la captura `kan147-home-en-320.png`.

### Gates

| Gate | Resultado |
|---|---|
| `node e2e/wellness-i18n-a11y.mjs` (canal `chrome`, Vite en 127.0.0.1:5181) | **6/6 PASS**: es y en × 320/390/768, exit 0. Log: `.ai/operations/2026-11-25-ola4/kan147/e2e-redesign.log`; capturas `kan147-{home,exercise,diet,checkin,checkin-summary,focus-task}-{lang}-{width}.png` |
| `npm run build` | OK, 0 errores |
| `npx oxlint` | exit 0, 0 errores, 29 warnings que ya existían (ninguno en ficheros tocados) |
| `npm run i18n:check` | 0 claves faltantes |
| `npx vitest run` | Con paralelismo por defecto, 1–3 timeouts intermitentes y distintos en cada corrida (AppointmentsLanguage, ChatPage.nutritionFlag, OnboardingPage, ProfilePage). Esos 4 ficheros aislados: 19/19 OK. `--maxWorkers=4`: **267/267 ficheros, 2254/2254 tests OK**. Wellness: 31/234 OK. Son intermitencias por carga, no regresión. |
| Vite | Lanzado desacoplado (lanzador cmd PID 46572, listener node PID 35460 verificado por línea de comandos) y cerrado con `taskkill /T`; puerto 5181 libre. |
