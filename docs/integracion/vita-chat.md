# Vita — entrega APP

Rama `feature/vita-chat-ux`, base Bienestar F3 `2f85790`. Implementación local;
sin push, deploy, configuración remota de ElevenLabs ni cambios a los carriles originales.
Contratos leídos: MISION-APP, proposal/design/tasks/UX-UI, CONTRATOS-VITA BACK v1,
RESPUESTA-AI-CONTRATO, RESPUESTA-BACK-AI, POC-TRANSPORTE-VOZ e INTEGRACION.
El checklist compartido sigue a cargo del coordinador.

## Implementación

- Chat con cabecera compacta, avatar existente, bienvenida solo en vacío, atajos
  secundarios y compositor Ionic multilínea. Conserva SOS, navegación, imágenes,
  documentos, feedback e historial. Autoscroll solo cerca del final; botón para
  mensajes nuevos y compensación al anteponer historial.
- Inicio reutiliza `vita-coach.png` en el lugar del perro. Sin cambios de lógica
  de nutrición/ejercicio, `ProgramPage`, `TodayView` o `NutritionPage`.
- Se mantiene **la ruta existente** `AppContext → streamChatMessage`, sin un
  segundo cliente conversacional. Parser SSE por eventos, UTF-8 fragmentado,
  CR/LF, `data` multilínea, errores nombrados sin `type`, final `done`, respuesta
  canónica opcional, thread, executionId y acciones. EOF sin `done` es error.
  Cancelación libera el reader; no reenvía automáticamente un turno que pudo
  ejecutar herramientas. Reintento explícito conserva el mensaje y el adjunto.
- En nativo se utiliza el fetch web original de Capacitor si está disponible;
  sin él se conserva el transporte bloqueante compatible. Esto requiere prueba
  en WebView/iOS antes de afirmar streaming progresivo en dispositivo.
- `onMessage` consume los tipos públicos instalados del SDK: message, role/source,
  event_id y response_id. Cada frase aparece al recibirla, sin esperar la pareja.
  Upsert por identidad de sesión/emisor/evento; correcciones e interrupciones
  actualizan entidades. Dos frases iguales con IDs distintos se conservan.
  No se inventan parciales del paciente ni se reenvía la transcripción a `/chat`.
- Provider y cuerpo del SDK permanecen fuera del modal de presentación. Minimizar
  y restaurar mantienen sesión; colgar, logout y revocación terminan el SDK.
  El orbe conserva su diseño. ElevenLabs usa su propio `getInputVolume`: se quitó
  la segunda captura getUserMedia/AudioContext que medía el micrófono para el orbe.
  Es una reducción de contención potencial, no una causa acreditada del atasco iOS.

## Contratos de voz e historial

`VoiceSession` acepta threadId/sessionId/sessionToken/expiresAt/runtimeMode además
de los campos legados. En modo Vita exige hilo coincidente, conversación, sesión,
token y expiración válida; contexto incompleto cierra sin conectar ni abrir fallback.
Solo Vita envía `dynamicVariables.secret__vita_session_token`; legacy conserva su
conexión. No se envía JWT a ElevenLabs ni se configura el agente remoto.

Al cerrar se solicita `DELETE /api/v1/chat/voice/session/{sessionId}` usando el
JWT capturado al abrir. No usa refresh ni credenciales de la cuenta siguiente.
Se descarta cualquier callback antiguo. Si se pierde la red o el servidor crea
una sesión cuya respuesta no llega, la expiración del servidor sigue siendo la
garantía de limpieza; la app no afirma revocación remota sin respuesta.

Primera página y paginación conservan `messageId/channel/status/revision`.
`hydrateChat` y `prependChatMessages` reconcilian por ID y revisión, nunca por texto.
Un alias response_id se usa solo ante igualdad exacta con el ID canónico.

**No se presume correlación entre event_id/response_id y ordinal/chunk.id.** Para
sesiones Vita validadas, se registra el sessionId devuelto por el servidor. Mientras
están activas, los mensajes provider son la fuente visible de esa sesión. Tras
cerrarla y recargar, un snapshot que contiene IDs canónicos
`voice:{session_id}:{ordinal}:user|bot` sustituye el grupo provisional de esa sesión;
el resto se recupera por paginación. No se mezclan dos fuentes visibles ni se
infieren correspondencias entre frases. Las sesiones ajenas no se sustituyen.

Legacy sigue siendo transcripción RAM. Sin IDs/alias, un backend antiguo no ofrece
reconciliación idempotente; no se deduplica por texto para ocultar esa limitación.
El modo Vita permanece apagado en los servidores. **4.5 no está acreditada con el
proveedor**: faltan correlación observada y prueba de lo realmente pronunciado,
correcciones/interrupciones persistidas y reapertura en dispositivo. No se abrió
ni reintentó el túnel rechazado por revisión automática del POC del coordinador.

## Acciones y registro explícito

Se consumen acciones `navigate` del contrato BACK v1, con destinos cerrados,
fecha y revisión; sin URLs, herramientas de citas ni escrituras emitidas por el modelo.
Cada navegación revalida `GET /api/v1/vita/me/context` y comprueba que el recurso
sigue entre las acciones autorizadas. Las pantallas existentes vuelven a resolver
su contenido actual; la app no calcula planes paralelos.

Solo podcast/ejercicio ofrecen **Registrar que terminé**. Preparación por
`POST /task-completion-proposals` y confirmación Ionic explícita antes de
`POST /task-completion-confirmations`. Cancelar no confirma; abrir/reproducir no
completa ni concede XP. Un único POST en vuelo; reintento manual conserva el token
idempotente. Se manejan revisión obsoleta, 403, 404/default off y 503. El éxito
invalida las queries canónicas del programa y vuelve a leer el contexto; no suma
XP localmente. Un fallo del refresco posterior se distingue de un fallo al registrar.

Los endpoints nuevos están implementándose en BACK; la evidencia APP es sintética.
La carrera de cancelar y reabrir el IonAlert durante el cierre se corrigió separando
`onWillDismiss/onDidDismiss` y bloqueando preparación mientras termina la animación.

## Nutrición e i18n

El flag heredado `VITE_CHAT_NUTRITION_ENABLED` sigue vigente. El build que publique
la capacidad debe fijarlo explícitamente en **true**. En false se ocultan chip y
acción de Nutrición; no se alteró ningún env productivo. Dos pruebas sintéticas
renderizan ChatPage y validan la acción tipada con true/false.
Las claves nuevas se añaden a ES/EN conservando todas las anteriores; lista al final.

## Verificación y capturas

La pasada conjunta y su confirmación se limitaron a 320/390/430/768 px, ES/EN.
Fixtures autenticados sintéticos interceptan todas las APIs y bloquean tráfico
externo. La voz del navegador usa un reemplazo explícito del SDK: prueba el ciclo
de UI y los callbacks, no audio real. Datos de ejemplo solo en fixtures.

Resultados finales:

| Check | Resultado |
| --- | --- |
| `npm run lint` | exit 0, advertencias heredadas |
| `npm run build` | exit 0, aviso de chunks grandes |
| `npm run i18n:check` | exit 0, 0 claves faltantes |
| Vitest completo, `--maxWorkers=8` | 208 archivos, 1676 tests correctos |
| Regresión enfocada posterior | 5 archivos, 60 tests correctos |
| Navegador sintético | 8/8 escenarios, sin errores JS no controlados |

La regresión enfocada cubre además restauración rápida durante el cierre del
modal, callbacks originales tardíos que no deben deshacer una corrección y el
historial vacío que no debe volver a consultarse por cada token. El último pase
completo captura stdout/stderr directamente a un archivo y registra el exit code
nativo, evitando que PowerShell confunda stderr de tests heredados con un fallo.

No se usó una simulación publicada en Postman. El CLI instalado es 1.76.0 y
`postman status` devolvió `unknown command`; se reutilizaron contratos locales,
fixtures HTTP del navegador y las pruebas del parser/cliente, sin setup remoto.
Evidencia reproducible: `node scripts/qa-vita-chat.mjs` con un Vite local ya iniciado;
`VITA_QA_URL` selecciona el puerto. `VITA_QA_BEFORE=1` sirve la copia de la base F3.
Las capturas esperan `ionModalDidPresent/ionModalDidDismiss`, no solo visibilidad.

| Escena | Antes F3 | Después |
| --- | --- | --- |
| Inicio | [Antes](evidencia-vita/antes-inicio-390-es.png) | [Después](evidencia-vita/inicio-390-es.png) |
| Hilo | [Antes](evidencia-vita/antes-hilo-390-es.png) | [Después](evidencia-vita/hilo-390-es.png) |
| Llamada estable | [Antes](evidencia-vita/antes-llamada-390-es.png) | [Después](evidencia-vita/llamada-390-es.png) |

[Llamada minimizada](evidencia-vita/minimizada-390-es.png),
[confirmación explícita](evidencia-vita/confirmacion-390-es.png),
[geometría y peticiones de los ocho escenarios](evidencia-vita/qa-resultados.json).

Límites: teclado simulado por viewport/clase compartida; no es teclado iOS real.
No se verificaron audio/micrófono físico, safe areas de hardware, texto al 200%,
latencias p50/p95, datos clínicos reales ni el roundtrip desplegado BACK→AI→ElevenLabs.
La consola de Inicio muestra avisos preexistentes de queryFn del programa en la
base F3 y en la entrega; no se modificaron los módulos de Bienestar para ocultarlos.

## Entorno local

Servidores temporales propios: actual PID 40948/puerto 5191 y base F3 PID
42844/puerto 5193, ambos detenidos. Sin servidores ajenos detenidos.
El `npm ci` inicial encontró un fallo del postinstall BLE en Device.swift ajeno a
esta misión. Para verificar web se restauraron dependencias con
`npm ci --ignore-scripts`, sin editar parches BLE, locks ni código nativo.

La revisión automática rechazó el borrado recursivo de la copia temporal. Se
conservaron los archivos de base en `test-results/vita-before` y el ZIP en
`test-results/vita-before.zip` (ignorados). Su traslado siguió una junction a
node_modules y afectó dependencias locales: se restauraron desde el lockfile y
se repitieron los checks afectados; la ejecución interrumpida no cuenta como éxito.
La junction residual `.vita-before/node_modules` también queda ignorada. No se
ejecutaron nuevos borrados recursivos ni se alteró la flota original.

## Dependencias para integrar y activar

- BACK compatible antes del consumidor: campos de historial y voz, GET contexto,
  POST propuestas/confirmaciones, DELETE de sesión y propagación SSE de acciones.
  `Vita:TaskCompletionEnabled` es la autoridad de disponibilidad del registro;
  apagado devuelve 404 y la APP lo comunica. La APP no lo activa.
- AI: migración `alembic/versions/fe62a09c1741_vita_voice_sessions.py` para sesiones
  y recibos durables del schema `ai`; revisar/aplicar desde el carril AI antes de
  ensayar modo Vita. No hay migraciones de APP en este lote.
- Mantener apagados los flags del nuevo motor de voz descritos en INTEGRACION
  hasta la prueba integral autorizada. El POC de transporte no acredita correlación
  provider/runtime ni audio móvil. La autorización de push de Luis corresponde
  al coordinador; esta rama no hace push ni cambia configuración remota.
- Integrar **solo por cherry-pick de los commits Vita** sobre F2 punta `5d232b1`
  o dev, a cargo de root. No fusionar esta rama completa: su padre es F3 `2f85790`,
  que no debe publicarse antes de backend 3.1/3.8. Root unirá i18n y probará el
  árbol integrado. La rama y la base originales se conservan sin rebase.
- Handoff exclusivamente por documentos. No se enviaron prompts ni se controlaron
  agentes de tab1; tampoco se hicieron pushes individuales.

## Claves nuevas ES/EN

- `Detener respuesta`
- `Hablar con Vita`
- `Hola, {nombre}`
- `La transcripción se muestra en este chat durante la sesión.`
- `Llamada con Vita`
- `Preparando tu respuesta…`
- `Reintentar respuesta`
- `Respuesta detenida`
- `Respuesta interrumpida`
- `Restaurar llamada`
- `Soy Vita. Pregúntame sobre tu programa y tus hábitos.`
- `Tu coach de salud y bienestar`
- `Ver mensajes nuevos`
- `Evaluaciones`
- `Podcast`
- `Registrar que terminé`
- `Confirmar actividad`
- `¿Confirmas que terminaste esta actividad? Abrirla o reproducirla no la completa.`
- `El contenido cambió. Vuelve a consultarle a Vita.`
- `Ya no tienes autorización para esta acción.`
- `Esta acción todavía no está disponible.`
- `No pudimos completar la solicitud. Inténtalo de nuevo.`
- `Actividad registrada.`
- `Actividad registrada. No pudimos actualizar el programa; vuelve a abrirlo.`
- `La sesión de voz recibida no es válida. Inténtalo de nuevo.`
- `Confirmar`

26 claves nuevas; todas las claves/valores anteriores permanecen intactos.
