# Alineación app con Claude Design — 3.18 y 3.19

Referencia oficial: `mockups/referencia-claude-f3-nutricion-app/` del change.
Se leyeron README, siete PNG y HTML fuente. D0014 resuelve la pregunta dejada
por los prep: el cliente recibe `{ current, previous }`, con DTO público por ciclo.
No se filtra por fechas en el cliente ni se añade contexto de programa.

## 3.18 — Plan y recomendaciones

Se sustituye la entrada de props independientes por `recommendations` del tipo
`NutritionRecommendationsResponseDto`. La fixture usa el mismo envoltorio y solo
vive en pruebas. No hay GET nuevo ni activación del consumo real de 3.10.

| Artboard | Adaptación |
| --- | --- |
| 1, Plan con recomendación | Hoy/Plan como navegación principal; banner de revisión; resumen del plan; profesional con iniciales, publicación y texto; tres imágenes con pies; fila Ver ciclos anteriores. |
| 2, sin recomendaciones | `current:null` muestra el título y la explicación amable exacta de la referencia; no se inventa una recomendación. |
| 3, fuente no disponible | Error dentro del bloque, con Reintentar; plan y registros siguen disponibles. |
| 6, adjuntos | Leer más/menos para texto largo; imagen fallida con pie conservado y Actualizar; sin galería si no hay imágenes. |
| 7, 320 px | Cabecera del plan puede envolver la etiqueta; galería de tres columnas, pies con salto de línea, botones táctiles y ningún desbordamiento. |

El resumen reutiliza la selección de día/comidas de `NutritionPlanTab`; «Ver plan
completo» conserva porciones, horarios, notas, días y metas existentes. Semana e
Historial de registros siguen accesibles desde «Más secciones de nutrición».
La navegación global existente y el aviso nutricional se conservan; el aviso queda
después del contenido principal de Plan, sin cambiar su texto.

Los números del mockup son ilustrativos. `current.cycleNumber` identifica el ciclo
revisado y se muestra como «Cierre del ciclo n» en la recomendación. El resumen del
plan muestra solo el día conocido de su contrato: no tiene número de ciclo y no
puede tomarlo de la recomendación ni deducirlo sumando uno.
Se mantiene la regla del repo de fechas `dd/mm/aaaa`.

`onRetryRecommendations` es un callback de presentación, usado para reintentar la
fuente y renovar adjuntos. No se añaden parámetros a una URL firmada ni se reintenta
con una firma modificada. El futuro adaptador de 3.10 debe volver a consultar el
envoltorio y entregar las URLs renovadas. Sin callback, la acción se deshabilita.
El mensaje se presenta como texto y los campos internos inesperados no se imprimen.

Validación de 3.18: 50/50 pruebas afectadas; suite completa 1657/1657, 204 archivos;
lint/build/i18n correctos (avisos existentes de lint y tamaño de chunks, cero claves
faltantes). Playwright MCP con la pantalla real y fuentes de datos sustituidas por
fixtures verificó 36 combinaciones de seis estados × tres anchuras × ES/EN, sin
desbordamientos. Las imágenes se sirvieron localmente, sin API de negocio. El
bloqueo de WebSocket HMR del navegador se distingue de errores de producto.

## 3.19 — Ciclos anteriores

La fila de Plan abre una subvista local con cabecera, botón de retorno y navegación
global conservada. No se añaden rutas ni contexto de programa. `previous` se presenta
en el orden recibido de D0014, con tarjetas separadas, etiqueta «Ciclo N», período,
badge «Anterior» y primera tarjeta expandida. Se reutiliza `NutritionRecommendations`
con presentación histórica: profesional/publicación, texto e imágenes, sin repetir
el título del bloque actual. «Ocultar» contrae y devuelve foco a la cabecera.

El vacío usa el copy exacto del artboard 5. Ante un fallo de fuente después de abrir
el historial se mantiene el retorno a Plan y el reintento local. No se muestra la
fila «Programa anterior» ni se deduce programa a partir de fechas o números.

Validación de 3.19: 53/53 pruebas afectadas; suite completa 1660/1660, 204 archivos;
lint/build/i18n correctos, cero claves duplicadas o faltantes. Playwright MCP verificó
18 combinaciones adicionales de historial con datos/vacío/error × 320/390/768 × ES/EN,
con expansión, contracción, reintento y retorno, sin desbordamientos. Junto a 3.18,
son 54 comprobaciones visuales. La pantalla real se renderizó con fuentes de datos
sustituidas por fixtures, sin API de negocio. Capturas finales de los siete artboards
(el 6 tiene dos capturas) y ejemplos EN en OpenSpec `revision-app-f3-alineacion/`.

## Pendiente de consumo real

Matiz final de D0014: el mensaje pertenece al ciclo revisado. `current` es la
publicación más reciente por `published_at`, aunque el período de ese ciclo ya haya
terminado; `previous` contiene las anteriores por `published_at` descendente. El
cliente respeta esa selección y orden, sin filtrar por vigencia ni ordenar por
número de ciclo. La regresión usa una publicación tardía del ciclo 1 como actual
y los ciclos 2 y 3 como anteriores en orden de publicación, distinto del numérico.
Validación del ajuste: 40/40 pruebas focalizadas de pantalla y recomendaciones,
suite completa 1661/1661 en 204 archivos, lint sin errores, build correcto e i18n
sin claves faltantes. No se cambia el resto de la UI ni se conecta el consumo real.

Cuando codex-back cierre 3.10: confirmar prefijo/ruta y binding real de D0014,
conectar la carga/refetch y `onRetryRecommendations`, verificar URLs firmadas y
autorización en el backend y ejecutar QA integral. La lista `previous` llega ya
seleccionada y ordenada por el backend. No se implementa «Programa anterior».
No se modifica `tasks.md`, no se publica la app y no se hace push.
