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
