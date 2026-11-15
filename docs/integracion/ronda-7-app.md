# Ronda 7 — APP: acceso, fechas y contexto del plan

## Base y R7-10

Rebase autorizado de `org/f3-antares-paciente` sobre F2 `c536bba`, que incorpora
2.24b. No hubo conflictos. Los nueve commits F3 conservaron sus parches según
`git range-diff`; la punta previa `af6f13c` corresponde a `190493a` tras el rebase.
La integración aceptada `5f86c52` corresponde a `d68e67f`.

La suite completa inmediatamente posterior al rebase pasó **1684/1684**, 207
archivos. Son los 1681 anteriores más los tres tests de 2.24b. El origen de
«No queryFn» es `DailyProtocolReminder`: observaba `programKeys.snapshot` con
`enabled:false` y sin queryFn. Ahora hereda `queryFn:getSnapshot` de 2.24b, sin
activar otra lectura ni modificar el contrato. No se parchea de nuevo el hook.

El harness de la APP monta también `DailyProtocolReminder` real con QueryClient;
su observador está presente en los recorridos de Nutrición y no emite el aviso.
Las demás fuentes se aíslan: esta comprobación no acredita el backend real.

## R7-12 — acceso sin acción inerte

Se conserva el refresh compartido y el puente existente que devuelve al login
si la sesión no se puede recuperar. La tarjeta y el historial solo ofrecen
Reintentar cuando existe una acción ejecutable. En 401/403 se muestra el mensaje
de acceso y se retira el botón inerte; no se introduce otra navegación al login.
En errores recuperables la acción sigue haciendo refetch real del envoltorio.

## R7-13 — fechas legibles por idioma

Recomendaciones, ciclos anteriores y el período del detalle del plan usan
`Intl.DateTimeFormat` con mes abreviado y locale ES/EN: «19 nov 2026» / «Nov 19,
2026»; «21 sept – 20 oct 2026» / «Sep 21 – Oct 20, 2026». `sept` es la abreviatura
de Intl para es-ES. Si cambia el año, el rango incluye ambos años.

Los nuevos helpers de `utils/dates.ts` mantienen el día del prefijo ISO sin
desplazarlo por la zona horaria del dispositivo. No se modifican ISO persistido,
cabeceras, atributos `data-published-at` ni el formato numérico de otros módulos.
Un dato inválido no lanza error ni se transforma en otro día.

## R7-14 — nombre y rol separados

La APP recibe `professionalName` como nombre puro y añade el rol con la clave
existente `Nutricionista` (ES) / `Dietitian` (EN). No traduce ni recorta nombres,
no envía un rol nuevo ni añade campos al DTO. Se alinean fixture y pruebas con
el ajuste del backend acordado para R7-14. La corrección del nombre concatenado
en el servidor pertenece al carril back; no se modificó ese repositorio.

## R7-16 — badge y diferencias autorizadas con el mockup

El badge usa **solo** `MyNutritionPlanDto.cycleNumber`, opcional, junto con
`currentDay`: «Ciclo N · día X». Sin número conocido mantiene «Día X», sin
inventar un ciclo ni deducir n+1. Nunca toma el número de la recomendación, que
corresponde al ciclo revisado. El harness prueba plan 3/día 4 frente a cierre 1,
y también la ausencia de cycleNumber. El servidor puede omitir el campo mientras
no lo publique en el contrato de plan; esa ausencia está soportada.

Por la instrucción del owner se conserva la navegación existente, aunque el
artboard muestre solo Hoy/Plan:

- **Ver plan completo / volver al resumen:** mantiene acceso a porciones, horarios,
  notas, menús por día y metas ya disponibles. No desaparece al simplificar Plan.
- **Menú •••:** conserva Semana e Historial de registros en la hoja de acciones;
  no son el historial de recomendaciones, que sigue teniendo su propio enlace.
- **Subtítulo del resumen:** muestra el nombre real del plan, sin fabricar otro
  ciclo ni estado clínico.
- **Barra inferior existente:** conserva sus destinos, incluido Chat. El mockup
  no autoriza sustituirlo por Progreso ni cambiar la navegación global.

El badge puede envolver en una segunda línea a 320 px, sin desbordamiento. Esto
conserva título y número legibles sin comprimir controles.

## Verificación de la sesión rotada y límites

El 15-11-2026 se conservó y revisó el diff pendiente, con HEAD `190493a`.
`git merge-base --is-ancestor c536bba HEAD` terminó en 0; `git range-diff`
confirmó los nueve parches F3 equivalentes. La suite final pasó **1695/1695**
en **208 archivos** (`node node_modules/vitest/vitest.mjs run --reporter=dot
--silent`, 59,73 s). El modo silent evita los voluminosos volcados diagnósticos
de Ionic/happy-dom; las aserciones y el reporte de fallos siguen activos.
Lint, i18n (cero claves faltantes) y build terminaron en 0. Se conservan avisos
del proyecto en lint y de tamaño de chunks en build.

Playwright MCP ejecutó **90/90 recorridos**, 15 × 320/390/768 × ES/EN, con **84
peticiones HTTP** del contrato 3.10. Además de los casos previos de carga/vacío/
error/renovación/401, cubre badge presente/ausente, rol por idioma, plan completo,
Semana/Historial y retorno, y `DailyProtocolReminder` real. La espera del menú
usa el evento de cierre de Ionic para no reabrir antes de que termine la salida.

Consola del recorrido sano final completamente limpia, sin «No queryFn»,
pageerrors ni red inesperada; sin overflow. HTTP 401/403/503 inyectados se registran
separados y no se presentan como consola vacía. Capturas estables y JSON de
resultados en OpenSpec `revision-app-r7/rotated/` (`results.json` y
`clean-console.json`); también se capturaron detalle ES/EN y menú. La sesión
rotada usó una sola pestaña de Playwright y su servidor propio en 5182, sin
intervenir tabs/panes ajenos. No se obtuvo traza de performance.

Esta revisión usa HTTP stub con DTO real y cliente/hook reales. El e2e completo
3.20 contra ERP/back/Storage/identidades reales sigue correspondiendo a codex-front.
No se escribe ese spec ni se cambia `tasks.md`; no hay push ni publicación.
