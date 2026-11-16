# Historial Vita — entrega APP local

Fecha: 14/11/2026. Rama: `fix/vita-history-app-20261114`.
Implementación: `19ebafe2d924eacdc3f9f080a20270d2ecee07b5`.
Contrato: `openspec/changes/vita-asistente-integral/HISTORIAL-MENSUAL.md`
del repositorio compartido. Solo se modificó este worktree. Sin push,
despliegue, cambios de prompts, proveedor, backend ni control de tab1.

## Comportamiento implementado

- Acción secundaria de 44 × 44 px en la cabecera existente. Confirmación
  `IonAlert`, progreso, error con reintento y éxito `IonToast`, con ES/EN.
  Explica qué se elimina y que planes, resultados, documentos e historia
  clínica se conservan. El orb y sus estilos no se modifican.
- La confirmación queda vinculada al usuario/hilo mostrado al abrirla.
  Cancelar no detiene la llamada ni envía DELETE. Una segunda pulsación
  durante el cierre de la alerta no inicia operaciones simultáneas.
- `clearThreadMessages`: `DELETE /api/v1/threads/{threadId}/messages`,
  con JWT, señal de cancelación y propietario esperado en `apiFetch`.
  Sin cuerpo, `userId` ni consentimiento de lectura. Usa el refresh
  existente, vinculado a la cuenta original. HTTP fallido, 204, respuesta
  incompleta, revisión inválida, fecha inválida o hilo distinto se rechazan.
- GET y DELETE normalizan `threadId`, `historyRevision`, `clearedAt` y
  `resetReason` en camelCase/snake_case. GET antiguos siguen siendo
  compatibles: no se inventa revisión 0 ni se toma un vacío degradado
  como prueba de borrado.
- Antes de borrar se invalidan generaciones, stream, reintento y sesiones
  locales. Se interrumpen Web Speech/TTS y el micrófono. Para ElevenLabs,
  `endSession()` devuelve `void`: se espera **onDisconnect**, con límite de
  5 segundos, y la revocación HTTP de la sesión. Una credencial emitida
  tarde se drena/revoca. Si no se confirma el cierre, no sale DELETE de
  historial; la operación puede reintentarse.
- Solo un DELETE confirmado vacía los mensajes locales, conservando el
  `threadId`. Se reinician paginación, cursores, adjuntos pendientes, scroll,
  aviso de mensajes nuevos y baseline de no leídos. Si falla, no hay toast
  de éxito ni vaciado optimista de los mensajes.
- Una generación propia del historial invalida callbacks de voz,
  tokens/done, hidrataciones GET, páginas antiguas y resultados de archivos
  o cámara. Las peticiones GET de la página y el stream se abortan; otros
  resultados en vuelo se descartan. Un documento ya recibido por el servidor
  no se elimina: se conserva su naturaleza clínica.
- Una revisión remota mayor reinicia la caché incluso con `messages: []`
  y sin `lastMessage`. Se rechazan snapshots de revisión inferior, y los
  que no traen revisión después de haber observado un corte. Se comprueba
  al leer/abrir el chat, regresar a primer plano/resume y antes de cada
  turno nuevo. El preflight añade un GET pequeño (`limit: 1`, sin importar
  voz) por turno. Un reintento o turno de voz anterior al corte no continúa.
  La actualización normal de transcripciones no borra el borrador del usuario.

## Verificación ejecutada

| Comando | Resultado observado |
| --- | --- |
| `npm ci --ignore-scripts --no-audit --no-fund` | 306 paquetes, instalación propia en este worktree. Sin junctions ni borrados recursivos. Lockfiles conservados. |
| `npm run test -- --maxWorkers=4` | 209 archivos, **1.750 tests pasaron**, 131,09 s. |
| `npm run test -- src/context/__tests__/chatConsolidation.test.tsx` | Tras añadir la guarda final de confirmación/hilo: **37/37**, 5,87 s. Incluye un test adicional al total de la pasada completa anterior. |
| `npm run build` | TypeScript y Vite correctos; advertencia de chunks mayores de 1.300 kB. |
| `npm run lint` | Exit 0; 26 warnings en patrones existentes (entre ellos `only-export-components` de AppContext). Sin errores. |
| `npm run i18n:check` | 1.772 claves usadas, 3.850 claves EN, **0 faltantes**, 2.078 huérfanas. |
| Paridad JSON ES/EN con Node | `esOnly: []`, `enOnly: []`. Se añadieron seis pares de textos. |
| `python e2e/vita-history.py` | **6/6**: ES/EN × 320/390/1440 px, sin desbordamiento ni excepciones JS. Botón CSS de 44 px; la entrada animada puede medir 43,99 px durante un fotograma. |
| `git diff --check` | Sin errores de espacios. |

Pruebas nuevas de contrato con servidor HTTP local real:
`src/utils/__tests__/threadHistory.http.test.ts` (12 casos). Ejecutan el
cliente y `apiFetch`, autenticación/serialización y normalización, con
respuestas sintéticas 200/403/404/502/503, payload incompleto y cancelación.
No sustituyen `apiFetch` por un stub.

Las pruebas de contexto/componentes ejercitan cierre SDK/revocación,
timeout sin desconexión, emisión tardía de sesión, confirmación/cancelación,
error ES/EN, doble operación, logout, cambio de hilo, tokens/done tardíos,
página anterior y documento en vuelo, vaciado mensual vacío e idempotencia
de la revisión, y reintento anterior al corte.

El navegador usa la app e Ionic reales, con API y SDK interceptados.
Comprueba cancelación, 503 sin falso éxito, reintento, vaciado mensual
al volver a primer plano y antes del turno, y llamada minimizada con
revocación anterior al DELETE de historial. Bloquea tráfico externo.
Capturas y resultados: [evidencia-vita-historial](evidencia-vita-historial/results.json).

## Límites y verificación de root

- **No se ejecutó la cadena real AI → BACK → app.** No se comprobó el
  borrado real de checkpoints, el barrido mensual a las 00:00 de Bogotá,
  persistencia/reinicio, IDOR, concurrencia entre réplicas ni revocación
  real en ElevenLabs. Corresponden a AI/BACK e integración de root.
- El cliente no programa un borrado mensual con el reloj del dispositivo.
  Observa los metadatos del servidor. Si GET falla o un servidor antiguo
  no los expone, no puede afirmar que ocurrió el corte; mantiene la
  compatibilidad de lectura. La protección del checkpoint y de una
  escritura/importación tardía en servidor depende del contrato AI/BACK.
- No se validó iOS físico/TestFlight, micrófono real ni desconexión del
  SDK contra el proveedor. El timeout local impide declarar cierre
  confirmado cuando falta su evento.
- Vitest imprimió `AbortError` de cierre de happy-dom en tests existentes;
  la suite terminó con exit 0 y sin tests fallidos. En el navegador
  sintético hay respuestas 501 fuera del escenario y avisos existentes
  de React Query (`program/snapshot` sin `queryFn`); las seis páginas no
  emitieron `pageerror`. No se presenta la consola como completamente limpia.
- La CLI Postman disponible rechaza `postman status` con
  `unknown command 'status'`. No se configuraron ni publicaron recursos
  Postman; la evidencia HTTP es la suite local descrita, no una colección
  ejecutada ni un servidor real de negocio.

Para repetir el navegador, iniciar Vite en este worktree en background con
puerto libre 5197 y ejecutar `python e2e/vita-history.py`. `VITA_QA_URL`
permite otro origen local. El runner cierra su Chromium; el servidor
temporal de esta entrega se detuvo al terminar.

## Corrección posterior: idioma inicial de Vita

`voiceSessionStartOptions(session, threadId, language?)` acepta `es`/`en`.
Solo con `runtimeMode: "vita"` y un idioma explícito agrega
`overrides: { agent: { language } }`, forma admitida por el SDK instalado.
Conserva `dynamicVariables.secret__vita_session_token`. Sin idioma explícito
mantiene las opciones anteriores; legacy devuelve exactamente `{ signedUrl }`.
No se envían overrides de prompt, herramientas o identidad.

VoiceOverlay captura el idioma de `useI18n` al comenzar la solicitud y usa
ese mismo valor para la petición de sesión y el inicio del SDK, aunque la
preferencia cambie mientras llega la credencial. Sin cambios visuales.

Verificación de esta corrección: **100/100 tests, 5 archivos**, mediante
`npm run test -- src/utils/__tests__/voiceSessionContract.test.ts src/utils/__tests__/voiceApi.session.test.ts src/components/__tests__/VoiceOverlay.test.tsx src/components/__tests__/VoiceOrb.test.tsx src/context/__tests__/chatConsolidation.test.tsx`.
Incluye Vita integral EN/ES, legacy EN/ES sin cambios y credencial demorada
con cambio de idioma. Build correcto, lint exit 0 (26 warnings existentes),
i18n con 0 claves faltantes y `git diff --check` correcto.

Las pruebas de la app usan SDK/API simulados. Según la confirmación de root
recibida de `vita-eleven-audit` vía MCP, el permiso
`platform_settings.overrides.conversation_config_override.agent.language`
ya estaba en `true` y la lectura posterior confirmó `true`. Ningún otro
permiso cambió. La versión permaneció intacta:
`agtvrsn_0601m7dwk6x3fs7txk78k568ca15`.
Esta evidencia corresponde a la lectura del proveedor, no a una llamada
real ni a una prueba en dispositivo. Root integra por cherry-pick y valida
TestFlight. Commit local separado, sin push.
