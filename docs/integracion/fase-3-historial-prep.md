# Historial de recomendaciones — preparación 3.19

Entrega en `.worktrees/app-f3`, rama `org/f3-antares-paciente`, desde `bb22669`.
Reutiliza el DTO por ciclo y `NutritionRecommendations` de 3.18-prep.

## Presentación y estados

En Nutrición › Plan, «Ciclos anteriores» aparece después del bloque del ciclo
actual. Cada fila muestra número, período y profesional; un acordeón Ionic abre
la recomendación publicada con texto, fecha, profesional e imágenes. Se mantienen
intactas las URLs firmadas y la protección frente a campos internos/HTML de 3.18.
El mockup oficial de referencia sigue siendo la vista app de
`mockups/referencia-claude-f3-nutricion/nutricion-notas-y-recomendaciones.html`.

`recommendationHistory` es una prop de presentación con una lista local de los
DTO públicos ya definidos, no un contrato de respuesta HTTP. Se conserva el orden
recibido sin modificar los objetos ni inferir cuál es el ciclo actual.

- Lista con ciclos: muestra filas expandibles y reutiliza el mismo bloque de recomendación.
- Lista vacía explícita: «Cuando tu nutricionista publique recomendaciones de ciclos
  anteriores, las encontrarás aquí.»
- Sin fuente conectada (`undefined`/`null`) o indisponibilidad: bloque ausente;
  el plan y el resto de la pantalla permanecen disponibles.

El estado de IA/datos caídos se inyecta con `recommendationsUnavailable`, como en
3.18-prep; no se llama a IA ni se deduce su salud. Ninguna fixture se importa desde
código de producto. La app normal aún no entrega datos a estas props y no presenta
historial de ejemplo. No hay servicio HTTP, consumo real ni e2e.

## Pregunta pendiente para el orquestador / backend 3.10

ARQUITECTURA.md §7.2 congela el DTO **por ciclo** e indica que incluye historial,
pero no especifica el envoltorio de la respuesta ni la separación actual/anteriores.

**¿3.10 devolverá un array de ciclos o un objeto envolvente, y cómo identificará
el ciclo actual frente a los anteriores?** Confirmar también el orden de la lista
antes de conectar los datos. Esta preparación no añade campos `current`, IDs de
revisión, paginación ni filtros de fecha inventados para resolver esa ambigüedad.

## Validación local

- Fixture de 3.18 ampliada con otro ciclo usando exactamente el mismo DTO público.
- Siete pruebas del historial: contenido, lista vacía, fuente ausente, indisponibilidad,
  privacidad, URLs intactas, orden de entrada e inglés (incluye casos parametrizados).
- Tres casos nuevos en NutritionPage: con historial, vacío e IA caída, conservando Plan.
- Suite afectada: **34/34**. Suite completa: **1655/1655 en 204 archivos**.
- Lint/build/i18n correctos; cero claves faltantes, advertencias existentes de lint
  y tamaño de chunks. `git diff --check` correcto.
- Vista aislada del componente real con fixture en Playwright MCP: expansión, vacío
  e indisponibilidad, sin desbordamiento a 320/390/768 px. Imágenes servidas localmente;
  sin API de negocio ni e2e. Capturas en OpenSpec `revision-3.19-prep/`.
  El navegador bloquea el WebSocket HMR de Vite; no se atribuye ese aviso a la API.

Integración pendiente de 3.10 y de confirmar la respuesta real. Sin cambios en
`tasks.md`, sin publicación ni push.
