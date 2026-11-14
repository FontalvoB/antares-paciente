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
