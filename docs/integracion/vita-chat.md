# Vita — entrega APP

Rama `feature/vita-chat-ux`, base Bienestar F3 `2f85790`. Implementación local;
sin push, deploy, configuración remota de ElevenLabs ni cambios a los carriles originales.
Contratos leídos: MISION-APP, proposal/design/tasks/UX-UI, CONTRATOS-VITA BACK v1.1,
RESPUESTA-AI-CONTRATO, RESPUESTA-BACK-AI, POC-TRANSPORTE-VOZ,
POC-TRANSCRIPT-PROVEEDOR e INTEGRACION. Se incorpora el acuerdo posterior de
Luis sobre supportsVitaVoice y legacy vinculado.
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

POST voice/session declara `supportsVitaVoice:true`; es capacidad del consumidor,
no activación del motor remoto. BACK traduce a supports_vita_voice; los clientes
antiguos sin campo siguen en legacy según el contrato, con default false.
`VoiceSession` acepta threadId/sessionId/sessionToken/expiresAt/runtimeMode además
de los campos legados:

| Respuesta | Tratamiento APP |
| --- | --- |
| Legacy/default sin sessionId | Conexión anterior y transcripción RAM; un threadId informativo debe coincidir |
| Legacy/default con sessionId y threadId coincidente | Grupo vinculado y cierre remoto; sin variable secreta |
| Vita con hilo, conversación, sesión, token y expiración futura válidos | Conexión con `dynamicVariables.secret__vita_session_token` |
| sessionId sin hilo, hilo ajeno o Vita incompleta | Cierre sin conectar ni abrir fallback |

No se envía JWT a ElevenLabs ni se configura el agente remoto.

Al cerrar se solicita `DELETE /api/v1/chat/voice/session/{sessionId}` usando el
JWT capturado al abrir. No usa refresh ni credenciales de la cuenta siguiente.
Se descarta cualquier callback antiguo. Si se pierde la red o el servidor crea
una sesión cuya respuesta no llega, la expiración del servidor sigue siendo la
garantía de limpieza; la app no afirma revocación remota sin respuesta.
Tras respuesta de cierre satisfactoria se vuelve a pedir historial únicamente
para el propietario y el hilo originales todavía activos. Una lectura temprana
vacía no bloquea esa segunda consulta. En legacy vinculado el servidor debe
importar el transcript confiable de su conversación previamente vinculada; la APP
no aporta conversaciones arbitrarias ni texto de bot, ni reinvoca al agente.

Primera página y paginación conservan `messageId/channel/status/revision`.
`hydrateChat` y `prependChatMessages` reconcilian por ID y revisión, nunca por texto.
response_id no se usa como alias de identidad canónica.

**No se presume correlación entre event_id/response_id y ordinal/chunk.id.** Para
sesiones Vita o legacy vinculadas validadas, se registra el sessionId del servidor. Mientras
están activas, los mensajes provider son la fuente visible de esa sesión. Tras
cerrarla y recargar, un snapshot que contiene IDs canónicos
`voice:{sessionId}:…` sustituye el grupo provisional de esa sesión; el sufijo es
opaco para el cliente, sin interpretar ordinales o eventos del proveedor;
el resto se recupera por paginación. No se mezclan dos fuentes visibles ni se
infieren correspondencias entre frases. Las sesiones ajenas no se sustituyen.

Legacy antiguo sin metadatos vinculados sigue siendo transcripción RAM. Si todavía
no llega un snapshot canónico de la sesión cerrada, se conserva el grupo provisional
sin afirmar persistencia. Nunca se deduplica por texto para ocultar esa limitación.
El POC real de API del proveedor observó transcript[].id null y source_event_id
compartido por user/agent: la identidad fuente debe incluir conversación y rol.
El event_id de agente coincidió en esa muestra; response_id era otro UUID. Esto no
prueba correlación con chunk.id. La sustitución por grupo cerrado evita depender
de esa correlación y conserva frases iguales con identidades distintas.
El segundo POC del coordinador recibió interruption con audio sintético y obtuvo
interrupted:true en API: message de 106 caracteres frente a original_message de
135, con source_event_id que salta de 2 a 14. Se conserva el mensaje visible
corregido; ni esos eventos son ordinales ni original_message acredita audio oído.
La APP ya conecta onAgentResponseCorrection y onInterruption; su regresión sintética
comprueba sustitución por identidad, marca interrupted y rechazo del original tardío.
El modo Vita permanece apagado en los servidores. **4.5 no está acreditada con el
proveedor**: falta integración del importador AI con vínculo server-side, prueba
de lo realmente pronunciado, correcciones/interrupciones persistidas y reapertura
en dispositivo. El pase con la lista client_events de dev/prod (que ya contiene
agent_response_correction) queda a cargo del coordinador; no requiere cambio remoto.
No se abrió
ni reintentó el túnel rechazado por revisión automática del POC del coordinador.

## Acciones y registro explícito

Se consumen acciones `navigate` del contrato BACK v1.1, con destinos cerrados,
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

BACK v1.1 declara los endpoints implementados y verificados localmente; la evidencia
APP es sintética y no acredita despliegue ni roundtrip integrado.
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

Resultados de la entrega visual inicial `dbfde62`:

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
El fallo inicial del postinstall BLE quedó resuelto en el commit independiente
`e4633bf`: el loader normaliza CRLF antes de interpretar hunks. Se verificó una
instalación limpia `npm ci` con postinstall habilitado, aplicación, check e
idempotencia, todos exit 0. No se modificaron hashes, manifest, native.patch,
fuentes nativas, versión del plugin ni locks. Diagnóstico y pruebas en
[ble-loader.md](ble-loader.md); ya no se necesita omitir scripts.

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
  ensayar modo Vita. El contrato ampliado ajusta esa revisión aún no desplegada:
  root debe usar el SQL/modelos regenerados más recientes del carril AI, que incluyen
  vínculo y sincronización. No hay migraciones de APP en este lote.
- El importador AI usa `VITA_TRANSCRIPT_SYNC_ENABLED=false` por defecto y autorización
  interna sync_voice de BACK tras validar consentimiento chat/voz y opt-in del cliente.
  APP no envía esa autorización interna ni llama directamente al proveedor. Un
  transcript aún processing/unavailable conserva los mensajes existentes; una lectura
  posterior puede completar la sincronización. Root debe validar ese roundtrip.
- Mantener apagados los flags del nuevo motor de voz descritos en INTEGRACION
  hasta la prueba integral autorizada. Los POC acreditan transporte, transcript y
  señal de interrupción sintética; no audio móvil. La autorización de push de Luis corresponde
  al coordinador; esta rama no hace push ni cambia configuración remota.
- Integrar **solo por cherry-pick de los commits Vita** sobre F2 punta `5d232b1`
  o dev, a cargo de root. No fusionar esta rama completa: su padre es F3 `2f85790`,
  que no debe publicarse antes de backend 3.1/3.8. Root unirá i18n y probará el
  árbol integrado. La rama y la base originales se conservan sin rebase.
- Handoff exclusivamente por documentos. No se enviaron prompts ni se controlaron
  agentes de tab1; tampoco se hicieron pushes individuales.

## Verificación posterior: compatibilidad de voz

Código separado en `169385b`: negociación de capacidad, legacy vinculado,
reconciliación por grupo y refresco de historial tras cierre. Se probaron ambos
modos, ausencia/incompletitud de metadatos, cambio de cuenta, JWT del propietario,
espera de DELETE y reapertura con frases idénticas sin duplicación ni reenvío al agente.

| Check posterior | Resultado |
| --- | --- |
| `npx vitest run --maxWorkers=8` | 209 archivos, 1701 tests, exit 0 |
| Regresión enfocada de voz/historial | 5 archivos, 88 tests, exit 0 |
| `npm run build` | exit 0; aviso heredado de chunks grandes |
| `npm run lint` | exit 0; advertencias heredadas |
| `npm run i18n:check` | exit 0; 0 claves faltantes |
| `npm run native:ble:check` | exit 0 sobre dependencias reinstaladas con postinstall |

Logs locales ignorados: `.vita-voice-compat-all.log`,
`.vita-voice-compat-tests.log`, `.vita-voice-compat-build.log`,
`.vita-voice-compat-lint.log`, `.vita-voice-compat-i18n.log`.
El pase completo registró el código de salida nativo 0 y duró 74,43 s.
Resumen versionado de este seguimiento:
[verificacion-seguimiento.json](evidencia-vita/verificacion-seguimiento.json).

No se añadieron claves i18n, capturas, cambios de diseño ni configuración remota
en este seguimiento. Las pruebas locales usan fixtures; el POC proveedor pertenece
al coordinador y no convierte estos tests en prueba de audio o de backend desplegado.

## Seguimiento: sincronización perezosa y opt-in de texto

El contrato final AI y la ampliación pública solicitada a BACK añaden
`GET /api/v1/threads/{threadId}/messages?...&syncVoice=true`. El helper mantiene
la opción ausente por defecto (servidor default false); ChatPage compatible la
activa al abrir/reabrir o refrescar la página reciente. Las páginas antiguas no
solicitan sincronización, conservando la paginación de ese snapshot. Solo BACK
autoriza sync_voice interno con propiedad y consentimientos actuales chat+voz;
sin consentimiento de voz debe seguir leyendo el texto existente.

Se preservan voiceSyncStatus y los metadatos source/voiceSessionId/
providerMessageId/sourceEventId, incluidos null y status provider_final. La sesión
explícita validada permite reconciliar IDs opacos; el namespace anterior sigue
compatible. Sin ID canónico no se duplica ni sustituye el SDK vinculado.

Un ciclo tiene una lectura inicial y como máximo tres relecturas a 1/2/4 segundos,
solo ante processing/busy y con voz cerrada. Cada HTTP tiene timeout de 10 segundos;
unavailable, null, ausencia de estado, error o timeout paran el ciclo. La reapertura
puede pedir otro sync: no se afirma persistencia por agotar reintentos. Cambiar de
cuenta/hilo, iniciar otro ciclo o desmontar cancela timer/HTTP y descarta respuestas
tardías. El cliente también descarta la respuesta si cambió el JWT capturado.
La consolidación mantiene el scroll actual y no dispara el aviso de mensajes nuevos.

`chatBody`, compartido por sync y SSE, añade `supportsVita:true` a ambos transportes.
BACK debe convertirlo a supports_vita, false por defecto en clientes sin campo.
VITA_RUNTIME_ENABLED solo selecciona el motor para opt-in true; ERP playground y
apps anteriores conservan la ruta previa. No se duplica el parser ni la ruta SSE.

Pruebas de este lote: processing→busy→synchronized con frases iguales e IDs 2/14,
reemplazo por grupo y scroll estable; agotamiento de reintentos; unavailable/legacy
sin metadatos; cancelación/cambio de cuenta/hilo; reopen; timeout; metadatos en ambos
mapas y payload sync/stream aditivo. Regresión enfocada: 4 archivos / 79 tests,
exit 0. Suite completa: 209 archivos / 1720 tests, exit nativo 0, 83,12 s;
log local ignorado `.vita-sync-all-final.log`. Build/lint/i18n exit 0, avisos heredados
y 0 claves faltantes. Estas son pruebas
locales sintéticas; el forwarding/consentimiento BACK y el importador desplegado
siguen sujetos a la validación del árbol integrado por root.

No hay cambios de UI, i18n, env, flags remotos, dependencias ni fuentes nativas.
La regresión adicional de caché de texto tras reapertura se entrega en otro commit.

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
