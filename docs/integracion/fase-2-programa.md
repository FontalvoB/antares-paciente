# Programa móvil — Fase 2

## Rama y contrato

Por instrucción de Luis, `org/f2-antares-paciente` nace de la punta de
`org/f0-antares-paciente`: `8fbb840235afbf45a741f6a9cee55652bcd754d1`.
Es una desviación documentada de la cadena habitual por fase: no hay tareas app
intermedias en F1/F2. Se trabaja en `.worktrees/app-f2`, sin rebase ni push.

Contrato verificado con CodeGraph y los DTO de backend 2.5, commit `c0288b3`:
el snapshot añade `upcoming?` y cada próximo día contiene `date`, `day`,
`weekNumber`, `missions` y `rest?`. Cada misión contiene `type`, `title`,
`contentUnavailable` y referencias opcionales separadas de rutina, medio, plan
y prescripción. No contiene completaciones futuras.

## 2.23 — Lo que viene

TodayView recibe la vista previa del snapshot y presenta hasta seis días mediante
acordeones Ionic. Las fechas conservan el formato `dd/mm/aaaa`; títulos clínicos
se muestran tal como llegan. Se distinguen descansos y contenido pendiente.
Es solo lectura: no permite abrir ni completar misiones futuras.
Si `upcoming` falta, es null o está vacío, no se inventa un calendario.

Pruebas: `TodayViewUpcoming.test.tsx` cubre contrato, ausencia, vacío, cambio de
semana, descanso previsto, contenido pendiente e inglés.

Validación de 2.23: `npm run lint` correcto (advertencias existentes), `npm test`
1620/1620 y `npm run build` correcto. i18n sin claves faltantes. Playwright MCP,
con el componente real e Ionic sobre una fixture de vista previa, verificó apertura
de acordeón y ausencia de desbordamiento a 320/390/768 px. No se escribió en el backend.

## 2.24 — Descanso de ejercicio

Solo `rest === true` declara descanso; su ausencia conserva el comportamiento
anterior. Hoy omite ejercicio y explica el descanso. Abrir Ejercicio directamente
presenta el mismo aviso, sin misión, XP, controles ni rutina en caché. La guardia
de completación y el cronómetro también respetan descanso, incluso si cambia el
snapshot durante una sesión. No se genera completación online ni offline.

Inicio usa las tareas exigibles del snapshot para la rueda y su contador: evita
el acceso residual a ejercicio que detectó 2.6. Un array vacío es autoritativo y
no restaura las seis misiones del catálogo. XP, máximo y bonus siguen viniendo
del backend; no se suman ni descuentan puntos de ejercicio en el cliente.

La fixture reproduce `RestCompletionPostgresTests.cs`, caso
`Descanso_CompleteTaskMaximoRachaReplayYReconciliacion` de backend 2.4:
podcast 10 + nutrición 10 + bonus 50 = máximo 70. Parcial: 10/70, racha 1;
completo: 70/70, bonus otorgado y racha 2. Las pruebas integran ProgramPage y
HomePage con este snapshot, incluyendo estado local contradictorio, acceso
directo, día vacío, cambio a descanso con cronómetro activo e inglés.

Validación de 2.24: `npm run lint` correcto (advertencias existentes), `npm test`
1630/1630 en 201 archivos, `npm run build` correcto (aviso existente de tamaño
de chunks), i18n sin claves faltantes y `git diff --check` correcto.
Playwright MCP verificó los componentes reales con fixture local: dos tarjetas,
cofre de 50, Ejercicio sin controles y rueda de tres nodos sin ejercicio.
Sin desbordamiento a 320/390/768 px. Evidencia en
`openspec/changes/organizar-experiencia-bienestar/revision-2.24/` del workspace.
Esta revisión visual usa una fixture de componentes; no es una prueba end-to-end
contra la API ni escribe datos en ella. El entorno del navegador bloquea el
WebSocket de HMR de Vite; no se atribuye ese aviso a la API o al descanso.
