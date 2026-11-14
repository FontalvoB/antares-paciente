# 3.18/3.19 — consumo del autoservicio 3.10

Contrato verificado con CodeGraph y el código de backend `5cc5369`:
`GET /api/v1/me/nutrition/cycles/recommendations`, JWT `aud=app`. Sin parámetros
ni IDs de paciente/ciclo/programa. Respuesta `{ current, previous }`, DTO público
exacto de D0014: ciclo revisado, período, publicación, profesional, mensaje
publicado y adjuntos `{ url, caption }`. `current` es la última publicación por
`published_at`; se conserva el orden recibido de `previous`, sin filtrar por fechas.
Solo el backend selecciona imágenes visibles y firma URLs de cinco minutos.

## Implementación

- `nutrition-recommendations-service.ts` usa `apiFetch` real, `GET`, `no-store`,
  cancelación y cabeceras `X-App-Language`/`Accept-Language` de la selección ES/EN.
  El identificador de sesión solo protege la respuesta local contra cambios de
  cuenta; nunca se envía como ID en la petición.
- `useNutritionRecommendations` mantiene caché en memoria por cuenta e idioma,
  sin reutilizar datos entre proyecciones. Cancela/descarta al invalidar sesión;
  una respuesta tardía de otra cuenta no se muestra. Al desmontar se descarta
  la caché de este recurso (`gcTime:0`).
- Se relee a los cuatro minutos mientras está activo en primer plano, antes de
  caducar las firmas. El refetch normal al volver a foco/reconectar se conserva.
  «Actualizar» ante `ionError` vuelve a pedir el envoltorio completo: no se
  reconstruye la URL, no se añade un cache-buster y la nueva URL remonta la imagen.
- `NutritionPage` conecta el hook con `NutritionPageContent`, que conserva Plan,
  Hoy y la navegación existente. Ninguna fixture se importa en ejecución normal.
  La vista separada permite mantener las pruebas de presentación y Foto IA.
- La carga tiene skeleton propio; el plan sigue usable. 200 con `current:null`
  muestra el vacío amable. 404 sin perfil, 5xx y red son indisponibilidad, nunca
  una respuesta vacía inventada. Un fallo de refetch oculta el contenido previo.
- 401 utiliza el único refresh compartido de `apiFetch`; si falla, invalida sesión
  para el puente existente de autenticación. La vista muestra sesión caducada.
  403 muestra falta de acceso sin contenido anterior. Ambos deshabilitan el
  reintento del bloque y el polling de una consulta fallida por acceso; no hay
  bucle de refresh. No se imprime el detalle interno recibido del servidor.

## Validación

`npm test`: **1681/1681**, 206 archivos. `npm run lint`, `npm run build` e
`npm run i18n:check` verdes, cero claves faltantes. Permanecen los avisos conocidos
de lint/chunks y el ruido de teardown de happy-dom; no son consola de navegador.

Las pruebas de contrato usan el servicio, `apiFetch` y auth reales con respuestas
HTTP sustituidas en `fetch`: ruta sin IDs, DTO exacto, Bearer, idioma, firmas
intactas, current null, 401 recuperable/definitivo, 403/404/503. Las del hook cubren
refetch, renovación a cuatro minutos, ES/EN, respuesta tardía de otra cuenta,
invalidez de sesión y recuperación de refetch fallido. Las de presentación
comprueban carga y errores de acceso sin datos previos.

Playwright MCP: **72/72 recorridos, 84 peticiones HTTP**, 320/390/768 × ES/EN.
La pantalla, el hook, el servicio, `apiFetch`, auth, QueryClient e Ionic son reales.
Solo el endpoint 3.10 y sus imágenes se interceptan con el DTO real; otras fuentes
de Plan/programa se aíslan para que el servidor local no afecte la revisión.
Se probaron carga sin bloquear Plan, publicación tardía, traducción servida por
cabecera, plan completo, historial/orden/acordeones/retorno, vacío, 503 y reintento,
403 en historial y Plan, imagen 403 y renovación por GET, 401 con un refresh y
sesión nueva. Sin desbordamiento ni errores JS/pageerrors/red inesperados.

El flujo sano final tiene consola completamente limpia. Los estados de fallo
inyectados conservan sus entradas HTTP 401/403/503 esperadas en consola/red; no
se ocultan ni se confunden con errores de producto. Capturas estables de los seis
formatos y registro completo en OpenSpec `revision-app-f3-integracion/` (66 PNG,
JSON de peticiones sin tokens y consola sana/fallos separados).

Chrome-devtools MCP se intentó para diagnóstico: el perfil compartido estaba
ocupado. No se cerró el navegador ajeno ni se obtuvo traza de performance; consola
y red se inspeccionaron con Playwright MCP. Postman CLI instalado no reconoce
`postman status`; no se creó infraestructura externa para esta comprobación local.

## Límite de esta entrega y 3.20

La sonda local al gateway 5080 devolvió **502**, y la API principal 5122 no estaba
escuchando. No se cambió ni levantó el backend compartido. Se usó la alternativa
autorizada de fixture HTTP basada en `5cc5369`, sin sustituir el servicio/hook del
cliente por dobles y sin inyectar recomendaciones mediante props al page conectado.

**El e2e completo es 3.20**: backend F3 corriendo con datos publicados reales,
JWT real, propiedad/aislamiento entre pacientes, selección y traducción almacenada,
firmas válidas/caducadas de Storage y su renovación. La evidencia de fixture HTTP
valida integración y manejo de estados del cliente; no acredita esas garantías del
servidor. Sin push, despliegue ni cambios en `tasks.md`.
