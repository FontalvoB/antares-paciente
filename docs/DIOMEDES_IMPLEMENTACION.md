# Cambios asignados a Diomedes

La entrega cubre los 13 puntos marcados con Diomedes, incluidos los compartidos.
Los cambios previos de Bluetooth, SOS e idioma se conservan.

| # | Solicitud | Implementación |
|---|---|---|
| 1 | Sin seguro primero y por defecto | El formulario ofrece «Sin seguro» primero; persiste la ausencia de asegurador explícitamente y conserva una póliza existente al editar otros datos. |
| 2 | Dos contactos de emergencia | Principal obligatorio y respaldo opcional, ambos editables y persistidos. SOS guarda ambos destinatarios y solicita SMS, llamada y correo para cada uno; un fallo del principal no bloquea al respaldo. |
| 3 | Consentimiento al final del texto | La aceptación y la continuación requieren llegar al final del documento real; cambiar el documento reinicia la comprobación. |
| 4 | Traducciones y carga de baterías | Se completó ES/EN del contenido inicial sembrado, con skeleton y estado de guardado Ionic. |
| 5 | Análisis de mi perfil | Vita genera una explicación con IA de resultados reales, prioridades, acciones sencillas y preguntas para el equipo; la API conserva el análisis por revisión de resultados e idioma. |
| 6 | IA, revisión, trazabilidad y 30 días | Generación durable después de completar las baterías, revisión de nutrición y publicación de la versión aprobada. La app muestra día y fechas del ciclo. |
| 7 | Aprobación individual y masiva | ERP permite revisar, confirmar y aprobar versiones concretas, con alcance por paciente, control de concurrencia e historial de decisiones. |
| 8 | Plan nutricional y merienda | Acceso visible a desayuno, almuerzo, merienda y cena antes de las metas; cada acceso lleva a su prescripción. Menú por día y ciclo de 30 días. |
| 9 | Ejercicios y multimedia ERP/app | Editor ERP con imagen/video configurados por ejercicio; la estación actual muestra el reproductor pausado desde el inicio y conserva un detalle con las indicaciones reales. |
| 10 | Nutracéutico | Día del programa destacado, foto de referencia, contraste, progreso y opción de preparar una publicación editable. Solo se ofrece compartir una toma confirmada. |
| 11 | Evaluación emocional y sueño | Guarda ánimo, barrera, estrés/motivación contestados, sueño y notas. Ofrece el registro de sueño de un wearable real con fecha de despertar de hoy; la corrección manual cambia el origen. |
| 12 | Pregunta duplicada | Una sola acción de registro en el protocolo. La sección semanal queda como resumen de constancia. |
| 13 | Recordatorio diario | Aviso «Tu salud te espera» en Inicio con actividades pendientes, una vez por inscripción y fecha local. Respeta llamada SOS, voz, consulta, visibilidad y sesiones sin datos reales. |

## Datos y sesiones

- Las respuestas no contestadas de estrés/motivación se omiten; el slider no
  convierte su posición inicial en una respuesta clínica.
- Una marca optimista o una escritura en cola no equivale a confirmación del
  servidor. Nutracéutico y evaluación emocional muestran la sincronización
  pendiente; compartir no publica automáticamente.
- Cambiar de cuenta, cerrar sesión o invalidarla limpia las caches clínicas y
  del programa. El borrador de comunidad vive en memoria, caduca y solo lo
  consume la misma cuenta.
- El estado y el día del plan se actualizan mientras está abierto. El menú
  semanal se repite dentro del ciclo de 30 días según el día del servidor.
- Un estado de revisión o caducidad oculta inmediatamente el menú de cache.
  La revisión del menú debe coincidir con la aprobada; una versión antigua
  espera la descarga de las indicaciones vigentes.

## Verificación

Resultado final de la entrega (04/11/2026):

- App: **1188 pruebas aprobadas**. Permanece un fallo anterior en
  `NotificationsModal.test.tsx`, cuya expectativa «Esta semana» depende del
  día de ejecución; no corresponde a los cambios de esta entrega.
- Backend: 291 pruebas focalizadas y 93 de multimedia aprobadas. El contrato
  nutricional con la revisión de cache se comprobó nuevamente con 35 pruebas.
- PostgreSQL aislado: 12 escenarios del flujo nutricional, 7 de multimedia y
  la persistencia de la evaluación emocional aprobados.
- ERP: 4 recorridos de revisión/aprobación y 3 de ejercicios aprobados.
  La compilación normal de producción genera las 89 páginas. Las tipografías
  existentes se sirven localmente, con licencias y procedencia en
  `coppaddresd-front/app/fonts/README.md`.
- Servicio IA: 15 pruebas del contrato y validación Ruff aprobadas.
- Builds de app y backend, traducciones ES/EN y APK Android aprobados. El APK
  se reconstruyó el 04/11 y sus chunks JS/CSS coinciden con `dist`.

Las pruebas usan pacientes, mensajes y multimedia de prueba. Se verifican
formularios, consentimiento, resultados, estados, ejercicios, dieta y protocolo
con Ionic real a 375 px (ES), 430 px (EN) y 1024 px. Los escenarios ERP simulan
las APIs. No se envían publicaciones, avisos ni planes a pacientes reales.

Comandos relevantes:

```sh
npm test
npm run i18n:check
npm run lint
npm run build
node .artifacts/forms-qa/verify.mjs
node .artifacts/diomedes-protocol-qa.mjs
```

Los arneses y capturas históricos se generaron con datos ficticios. Las nuevas
revisiones y su evidencia se guardan exclusivamente en directorios temporales
fuera de los repositorios; no forman parte del bundle de producción. Las pruebas del backend incluyen
PostgreSQL local aislado y un contrato de IA simulado, además de pruebas
unitarias de autorización, revisión, contactos, multimedia y evaluación emocional.

## Activación en un entorno

La entrega modifica app, ERP, API, Auth y servicio IA. Se deben desplegar juntos
según el runbook del flujo nutricional y aplicar la migración
`AddNutritionReviewWorkflowAndEmergencyContacts` antes de activar la API nueva.
La migración amplía `emergency_contact` a texto y agrega la persistencia de
generación/revisión; no borra los menús existentes ni inventa aprobaciones.

Asignar a los revisores reales el rol **NutritionReviewer**, acceso ERP y el
alcance profesional de sus pacientes. Actualizar la sesión para cargar los
permisos nuevos. Los planes personales previos requieren revisión explícita;
el historial registra al actor y la fecha de cada decisión o modificación.

Para probar en hardware, compilar y sincronizar Capacitor con `npm run sync`.
El build iOS requiere macOS/Xcode. Las pruebas automáticas de IA validan el
contrato y las transiciones; el contenido nutricional generado sigue pasando
por la revisión del profesional antes de publicarse.


## Refinamientos y verificación integrada (4 de noviembre de 2026)

Los resultados anteriores son históricos, no el resultado de una nueva ejecución
completa. Esta revisión añadió:

- SOS: instantánea durable por contacto con estados independientes por canal,
  outbox e idempotencia por destinatario. La app muestra principal y respaldo
  por separado. Se solicita llamada automática al proveedor para ambos; abrir
  el marcador del teléfono sigue siendo una acción manual. Aceptación del
  proveedor no significa llamada contestada ni SMS entregado.
- Consentimiento: recorrido de navegador con 80 secciones sintéticas. Inicio
  y mitad mantienen las tres aceptaciones bloqueadas; llegar al final permite
  marcarlas y Continuar exige las tres. Esto no acredita una aceptación legal
  persistida de un paciente.
- Perfil: petición real app → API → IA con explicación humana, hasta tres
  prioridades y acciones enlazadas a códigos de resultados. El análisis se
  conserva en PostgreSQL por revisión e idioma. No se fabrica texto si falla
  el proveedor. Nuevos resultados invalidan el análisis anterior.
- Preparación nutricional: etapas, revisión profesional, duración y acciones
  útiles mientras la dieta está pendiente. Una plantilla histórica sin revisión
  no cuenta como un ciclo personalizado aprobado ni impide generar/publicar
  el nuevo plan. Guardar el editor ERP cierra el diálogo solo tras éxito.
- ERP: prueba sin interceptar APIs, con Auth, backend y una copia aislada de
  PostgreSQL. Edición de una merienda del borrador real generado por IA;
  aprobación individual; nueva edición que revoca la aprobación; aprobación
  masiva exitosa de dos versiones. Se comprobaron las dos filas directamente
  en PostgreSQL y el actor/fecha del historial.
- Chat: orientación práctica ante síntomas leves, opciones genéricas sin receta
  cuando hay información suficiente, instrucciones del producto en lugar de
  pautas numéricas, precauciones y seguimiento por persistencia/empeoramiento.
  Conserva atención urgente para señales de alarma. Cuatro conversaciones
  sintéticas con respuestas reales del modelo cubren autocuidado, OTC, urgencia
  y riesgo de duplicar acetaminofén con enfermedad hepática. No equivalen a
  validación clínica exhaustiva ni prueban todos los fármacos o síntomas.

### Permisos de revisión nutricional

Para ver y editar: `Wellness.View` y `Wellness.Manage`. Para aprobar:
`NutritionPlans.Approve`. `Patients.ViewOwn`, un profesional vinculado y una
asignación activa limitan el acceso a sus pacientes. `Patients.View` permite
alcance global. También se necesita acceso a la aplicación ERP y completar
el onboarding profesional.

El rol sembrado `NutritionReviewer` reúne los permisos propios. En la base local
copiada, antes de preparar las cuentas QA, no tenía usuarios; `Admin` tenía un
usuario y todos los permisos. La prueba creó un revisor con dos pacientes y
sin `Patients.View`, y aprobó con su identidad. No se consultaron los titulares
de roles en producción ni se modificaron permisos de usuarios reales.

### Ejecución reproducible

Los scripts fuente viven en `e2e/`. Credenciales, datos de prueba, vídeos,
capturas, reportes y configuración de servicios quedan en `/tmp`, fuera del
repositorio. El host `CoppAddresd.E2EHost` exige una base `copp_review_` y sustituye
solo los transportes externos de SOS. No realiza llamadas ni envíos reales.

```sh
COP_E2E_FIXTURES=/tmp/.../private-fixtures.json COP_E2E_OUTPUT=/tmp/... node e2e/chat-symptom-guidance.mjs
COP_E2E_FIXTURES=/tmp/.../private-fixtures.json COP_E2E_OUTPUT=/tmp/... node e2e/nutrition-meal-navigation.mjs
COP_E2E_FIXTURE_URL=http://localhost:5173/@fs/tmp/.../fixture.html COP_E2E_OUTPUT=/tmp/... node e2e/diomedes-layout.mjs
```

Los casos SOS/perfil/preparación de `diomedes-review.mjs` permiten seleccionar
`COP_E2E_CASE` y `COP_E2E_PATIENT`; requieren preparar el estado correspondiente.
La prueba ERP `e2e/nutrition-plan-real-db.mjs` requiere dos borradores pendientes
y cambia solo los registros QA. No debe ejecutarse con pacientes de producción.
Los cambios no están desplegados; el APK construido antes de estos refinamientos
no contiene este código nuevo.


## Revisión de la lista completa y H59 físico (04/11/2026)

Esta revisión incluye los 27 puntos de todos los responsables. «Implementado»
indica código presente y comprobaciones automáticas pertinentes; no sustituye
la aceptación visual en el teléfono. Los resultados anteriores permanecen como
histórico y no se cuentan como una nueva ejecución.

| # | Solicitud | Resultado actual |
|---|---|---|
| 1 | Sin seguro primero y predeterminado | Implementado en Onboarding; editar un perfil conserva su asegurador existente. |
| 2 | Dos contactos, primero obligatorio | Implementado en formulario, perfil y validación; el segundo puede quedar vacío, pero no incompleto. |
| 3 | Consentimiento habilitado al final | Implementado con ConsentReadGate y tres aceptaciones obligatorias. |
| 4 | Traducciones y carga de baterías | Implementado para contenido inicial ES/EN y carga Ionic; el escaneo i18n no encuentra claves usadas ausentes. Quedan 20 diferencias históricas de paridad. |
| 5 | Propósito en azul | Tema cosmos con acento cian, sin el anterior verde; falta aceptación visual del tono exacto. |
| 6 | Análisis de mi perfil | Implementado con resultados reales, generación de IA y persistencia por revisión/idioma. No se volvió a invocar al proveedor real en esta revisión. |
| 7 | Plan después de completar baterías | El flujo automático nutricional exige completar las asignaciones requeridas. No se encontró un flujo automático equivalente para ejercicio; el alcance de «planes» completo no queda acreditado. |
| 8 | IA → nutricionista → publicación, trazabilidad, 30 días | Implementado para nutrición: borrador, permisos de revisión, actor/fecha/revisión, publicación aprobada y día/fechas del ciclo. Requiere despliegue coordinado y revisores asignados. |
| 9 | Bienvenida personalizada al terminar baterías | Parcial: existe el popup, pero también se abre al elegir Después/saltar tests durante onboarding. No cumple estrictamente esperar a completar todas las baterías. |
| 10 | Misma Vita en bienvenida y chat | Implementado: ambos usan vita-coach.png y la misma identidad. |
| 11 | Aprobación individual y masiva | Implementado; ERP verifica permiso, revisión y conflictos. Los recorridos con API simulada pasaron. |
| 12 | Símbolos de Inicio abren módulos | Implementado mediante navegación a program-*; el cofre abre racha. |
| 13 | Podcast con disposición tipo Spotify | Implementado en PodcastLesson; aceptación visual pendiente. |
| 14 | Podcast detallado en pantalla bloqueada | Pendiente: no hay integración MediaSession/MediaMetadata ni controles de reproducción de sistema en src. Info.plist declara bluetooth-central, no audio. |
| 15 | Imagen completada con signo de interrogación | Los estados completados actuales usan checkmark de IonIcon; falta confirmar visualmente el recurso reportado en el teléfono. |
| 16 | Signos vitales como wearable | Parcial: VitalsLesson usa recursos/estilos del wearable, pero sigue siendo una vista independiente. Paridad visual exacta pendiente. |
| 17 | Plan nutricional y merienda | Implementado: desayuno, almuerzo, merienda y cena, menú aprobado y día del ciclo. |
| 18 | Registrar comida y scroll | Implementado con IonModal/IonContent y formulario renovado; teclado y scroll físico aún requieren aceptación. |
| 19 | Dormir FoodAI o cambiar a proveedor pago | Pendiente: MealFoodFlow sigue llamando analyzeFoodImage y la API conserva FoodAiController. No se encontró sustitución por proveedor de pago. |
| 20 | Ejercicio y otras misiones en vistas completas | Implementado: pantallas program-* con contenido propio y navegación de regreso. |
| 21 | Rutina ERP y foto/video por ejercicio en app | Implementado: editor multimedia, conservación de recursos y demostración con detalle/reproductor. Los tres recorridos ERP pasaron. |
| 22 | Nutracéutico: contraste, foto, día y compartir | Implementado con foto de referencia, día/progreso y borrador editable de comunidad después de confirmar la toma; no publica automáticamente. |
| 23 | Emoción y sueño desde manilla | Implementado el flujo opcional de sueño fechado de hoy y corrección manual. Sueño real H59/firmware nocturno sigue sin comprobarse. |
| 24 | Pregunta duplicada de nutracéutico | Implementado: una acción de registro; la vista semanal muestra resumen. |
| 25 | Racha con animación | Implementado con Motion, progreso y respeto de movimiento reducido; aceptación visual pendiente. |
| 26 | Recordatorio del protocolo | Implementado en Inicio con tareas pendientes, una vez por inscripción/fecha, respetando visibilidad, SOS y voz. |
| 27 | Voz más tecnológica y registro de conversación | Parcial: interfaz presente, pero el callback espera eventos raw user_transcript/agent_response; el SDK instalado entrega MessagePayload con message/role. Además appendChatMessages solo modifica estado React, sin escritura durable al historial remoto. |

Evidencia de los pendientes principales:

- Bienvenida: [AppContext](../src/context/AppContext.tsx) activa vitaWelcomePending
  al terminar onboarding; finishTests y skipTests entran al mismo flujo app.
  [VitaWelcome](../src/components/VitaWelcome.tsx) solo comprueba ese flujo y flag.
- Voz: [VoiceOverlay](../src/components/VoiceOverlay.tsx) y appendChatMessages
  en AppContext. El contrato instalado está en
  @elevenlabs/client/dist/types.d.ts, MessagePayload/onMessage. No se encontró
  un webhook de transcripciones ElevenLabs en backend/IA que cierre esa persistencia.
- Nutrición automática: NutritionPlanWorkflow/NutritionPlanGenerationWorker
  del backend y QueueIfReadyAsync al guardar una ejecución de evaluación.
- Podcast: [Lessons](../src/pages/program/Lessons.tsx); búsqueda de MediaSession,
  MediaMetadata y setActionHandler sin resultados en src.
- FoodAI sigue activo en [MealFoodFlow](../src/components/MealFoodFlow.tsx).

Comprobaciones nuevas de esta revisión:

- App completa: **1.274 pruebas / 158 archivos aprobados**. No se reprodujo
  el fallo histórico de NotificationsModal mencionado arriba.
- Backend: **91 pruebas focalizadas aprobadas** de nutrición, multimedia,
  contactos, evaluación emocional y análisis de resultados.
- IA: **24 pruebas aprobadas** de generación/análisis y voz.
- ERP: **7 recorridos aprobados** (4 revisión nutricional, 3 multimedia),
  con APIs interceptadas; no son una nueva prueba contra PostgreSQL real.
- Lint sin errores, build de producción, sync:dev, guardia de release y
  parche BLE aplicado desde upstream limpio e idempotente aprobados.
- Build iOS firmado de desarrollo instalado en iPhoneです desde la rama
  feat/diomedes-care-and-wearables, contra Gateway local. El usuario confirmó
  que aparecen H59 y otros dispositivos, H59_E206 ofrece Conectar y conecta
  mostrando lecturas. Los desconocidos permanecen visibles sin Conectar.
- Diario nativo leído: una captura habilitada, dos suscripciones, secuencia
  262 y cero descartes en la instantánea inicial. La API local devuelve series
  de pasos, distancia y calorías, con escrituras device-metrics observadas.
  No se incluyen valores clínicos ni identificadores de paciente en este reporte.

La búsqueda actual es BLE general con un solo Buscar dispositivo. ASK queda
optativo y desactivado por Info.plist. Se conserva captura/restauración ordinaria
en background; no se promete relanzamiento iOS después de force-quit.
En la prueba breve de pantalla bloqueada, el usuario informó reconexión al volver.
Syslog muestra entrada a background a las 15:09:42, una indicación GATT
entregada a la app a las 15:10:31 y regreso a foreground a las 15:13:17.
El proceso terminó después, a las 15:13:31, y la app volvió a conectar;
el usuario confirmó que también cerró la app desde el selector de aplicaciones.
Por tanto, esa prueba combina bloqueo y cierre explícito, y no aísla background
ordinario. La reconexión al abrir funcionó. El diario alcanzó secuencia
355, con captura habilitada, dos suscripciones y cero descartes. Esto acredita
recepción de al menos un paquete BLE en background, no captura continua
de todas las métricas. Siguen pendientes R88 físico,
30 minutos de background, pérdida de rango, Bluetooth apagado/encendido,
recuperación sin red, reinicio/cambio de cuenta y sueño/historial real.


Se preparó una prueba separada de bloqueo sin cerrar la app: instantánea inicial
con captura habilitada, dos suscripciones, secuencia 529, cero pendientes y cero
descartes. El usuario informó reconexión, pero el syslog de este intento muestra
background 15:16:26 → foreground 15:16:32 sin desconexión ni nueva conexión
Core Bluetooth. El diario llegó a secuencia 617, aún con cero descartes.
El intervalo observado es breve; no acredita todavía cinco minutos.
No se modificó el transporte por la reconexión de la prueba combinada.


### Estado visual de conexión frente a antigüedad de lecturas

La vista Wearable usaba sessionStale como señal de desconexión y mostraba
Conectando aunque la fase BLE siguiera connected. Ahora la conexión depende
de la fase real; las lecturas antiguas muestran «Conexión activa. Esperando
nuevas lecturas del dispositivo.». Una fase connecting o un enlace perdido
siguen mostrando su estado correspondiente. Este cambio no prolonga una conexión
física: corrige la representación de la conexión retenida. Tres regresiones
UI nuevas y la suite lifecycle pasaron: 31 pruebas en dos archivos.


### H59: prueba cronometrada de bloqueo sin cerrar la app

El 04/11/2026 se midieron 317 segundos con el iPhone bloqueado y la app en
background, desde 20:21:58 hasta 20:27:15 UTC. Syslog no registró desconexión,
reconexión ni reinicio del proceso durante el intervalo. Una indicación GATT
llegó a la sesión de la app a las 15:25:30 hora local, sin retorno a foreground.
El diario avanzó de secuencia 1004 a 1005; conservó captura habilitada, dos
suscripciones y cero descartes. No quedaron notificaciones pendientes al copiarlo.

Este resultado acredita retención del enlace y recepción BLE en background
durante esta prueba de cinco minutos. No acredita medición continua de todas
las métricas: solo se recibió una notificación en ese intervalo. Al desbloquear, el usuario vio
«Sincronizando historial». Syslog confirma foreground a las 15:28:06 con el
mismo proceso y sin ninguna desconexión/nueva conexión; llegaron notificaciones
BLE después del retorno. El usuario confirmó que el historial terminó,
la vista permaneció Conectado y las lecturas se actualizaron sin pulsar Conectar.
La prueba de bloqueo y retorno de cinco minutos queda aprobada. Siguen pendientes la prueba prolongada
de 30 minutos, R88 físico y los escenarios de pérdida de rango, radio apagado,
red y cambio de cuenta. La prueba no incluyó cierre desde el selector de apps.


### H59: Bluetooth del iPhone apagado/encendido

El usuario confirmó recuperación automática y lecturas sin pulsar Conectar.
Syslog registró desconexión a las 15:30:10, intento de conexión a las 15:30:20
y conexión completada a las 15:30:21 en la misma sesión/proceso; después llegaron
notificaciones BLE. La app recuperó el enlace al volver de Ajustes tras el ciclo
del radio. Este escenario queda aprobado; no sustituye pérdida de rango o
apagado del wearable, que mantienen el Bluetooth del teléfono encendido.


### H59: apagado y encendido del wearable

El usuario confirmó reconexión automática y lecturas sin pulsar Conectar.
Syslog muestra pérdida del enlace a las 15:31:48, intento automático inmediato
y conexión completada a las 15:31:53; después llegaron notificaciones.
Se validó recuperación tras indisponibilidad breve del wearable con el radio
del teléfono activo. La duración observada no fue de 30 segundos; no se
cuenta como ensayo de indisponibilidad prolongada ni de pérdida física de rango.


### Conectar sin respuesta tras restaurar la sesión

El usuario canceló la prueba Wi-Fi y reportó que Conectar no hacía nada.
Se identificó un fallo de arranque: restoreSession conservaba el token local
ante fallo de red, pero AppContext dependía de /me para llenar user.id.
Sin ese ID, WearableContext.connect retornaba sin abrir GATT ni mostrar error.

La restauración ahora obtiene el ID del token ya guardado por Auth (claim
nameidentifier que emite TokenService; también admite sub). Se usa como clave
local de la misma cuenta; no valida firma ni concede permisos, que siguen
siendo responsabilidad del servidor y del refresh existente. /me continúa
aportando los datos del perfil. El login también tiene identidad desde el
primer momento, sin esperar al perfil. Logout conserva la limpieza de cuenta.
Si no existe una identidad utilizable, Conectar muestra un error de sesión
en vez de terminar silenciosamente; no inicia captura sin propietario.

Verificación nueva: **1.283 pruebas en 159 archivos aprobados**, lint sin errores,
i18n sin claves usadas ausentes, sync:dev, build de producción y build iOS
firmado aprobados. El build se instaló en iPhoneです. Casos nuevos: identidad
.NET/sub, tokens inválidos, restauración sin /me, limpieza al salir, login
sin perfil y error visible sin dueño. Comprobación física del nuevo build
pendiente. La prueba de captura/subida offline quedó sin completar por
instrucción del usuario; no se considera aprobada. El arranque lento observado
antes no se modificó como parte de esta corrección de identidad.


La corrección de identidad de sesión se comprobó en el iPhone: el usuario
confirmó conexión automática al abrir el build corregido, sin pulsar Conectar.
Syslog registró intento a las 15:43:14, enlace completado a las 15:43:16 y
notificaciones posteriores. Se recuperó el comportamiento físico afectado
por el retorno silencioso de Conectar; no se considera una aprobación del
ensayo Wi-Fi cancelado.


### H59: desconexión explícita respetada

El primer intento quedó inconcluso porque el usuario pulsó Conectar otra vez;
no fue una reconexión automática inesperada. En el segundo, confirmó Desconectar
y dejó el dispositivo sin reconectar. Syslog muestra desconexión a las 15:47:12
y ninguna conexión posterior hasta la comprobación de las 15:50:52. Además se
midió un intervalo controlado de 37 segundos sin intentos ni notificaciones.
La instantánea nativa contiene cero dispositivos en captura, cero suscripciones
y cero notificaciones pendientes. La parada explícita queda aprobada; se pidió
reconexión manual al terminar la observación.


El usuario confirmó que Buscar dispositivo → H59_E206 → Conectar restauró
el enlace y las lecturas tras la parada explícita. Se completa el ciclo
manual desconectar/reconectar. Se preparó una prueba prolongada de 30 minutos;
el resultado no se cuenta hasta comprobar la duración real y los eventos.


### Retorno a la app: historial automático sin modal

En el intento de prueba prolongada, el usuario interpretó Sincronizando historial
como reconexión. Syslog muestra un único proceso y ninguna desconexión/nueva
conexión: background 15:54:04 → foreground 15:57:50, aproximadamente 226 segundos.
El intento no acredita 30 minutos. El modal aparecía por el refresco de historial
automático de foreground aunque el enlace siguiera conectado.

WearablePage ahora reserva la vista completa de progreso para el toque explícito
en Sincronizar ahora. Los refrescos automáticos mantienen Reloj visible, con
Conectado y el indicador de actividad del botón. Se conserva la descarga de
historial y su serialización; no se modifica la conexión ni se omiten registros
por ocultar el modal automático. Cancelar una solicitud manual invalida su
progreso para que no reaparezca por una operación automática posterior.


La actualización de historial sin modal automático pasó 50 pruebas focalizadas
en tres archivos, lint, sync:dev, build de producción y build iOS firmado.
Se instaló en iPhoneです para comprobar el cambio de app en hardware.
La prueba prolongada de 30 minutos sigue pendiente; el intervalo corto
anterior solo acredita retención durante ese intervalo y no se amplía por
interpretar la pantalla de sincronización como una reconexión.


El usuario confirmó en el build nuevo que, al cambiar de app y volver,
Reloj permanece visible con Conectado sin la vista completa automática
de historial. Se aprueba el cambio de comportamiento visual en hardware;
la descarga automática sigue activa.


El usuario precisó después que el enlace se conserva al cambiar de app y
solo se pierde al cerrarla desde el selector. El trace coincide: retornos
16:04:55 y 16:05:09 sin nueva conexión; cierre del proceso a las 16:05:16
y enlace nuevo completado a las 16:05:18 tras abrirlo. Este build usa Bluetooth
general, sin ASK; no promete relanzarse automáticamente después de force-quit.
La observación confirma el comportamiento de uso normal y de reapertura,
pero no completa el intervalo prolongado de 30 minutos.


### Bluetooth apagado: mensaje claro y pausa real

El usuario reportó búsquedas/conexiones persistentes y rechazó «Bluetooth aún
no está listo…». Se añadió estado nativo explícito para separar poweredOff de
un manager desconocido/resetting. El arranque iOS puede observar el radio
apagado; el listener informa el estado inicial y se consulta al volver de Ajustes.
Off confirmado cancela escaneo, pausa backoff y bloquea conexiones hasta on.
La asociación del dispositivo se conserva para recuperar al encender.
La vista usa el diseño existente: Bluetooth apagado, Activa Bluetooth y una
indicación breve de Ajustes, con Buscar dispositivo deshabilitado. No hay
botones nuevos ni la explicación técnica anterior.
Pruebas: 1.291/159 archivos aprobados; verificación física pendiente.


El build con estado explícito de radio pasó lint, i18n, sync:dev, build de
producción y build iOS firmado; el parche se verificó desde upstream limpio
y se instaló en iPhoneです. Se solicita comprobar Bluetooth apagado sostenido
antes de volver a activarlo; esa validación física sigue pendiente.


El usuario confirmó que el estado apagado se detecta y la búsqueda se detiene,
pero rechazó su presentación. Se conservaron la lógica y las acciones
deshabilitadas; se retiraron el título grande Activa Bluetooth, la explicación
del hero y el mensaje rojo duplicado. El hero conserva su diseño normal,
el estado del encabezado sigue siendo discreto y una sola IonNote bajo
Buscar dispositivo indica «Enciende Bluetooth en Ajustes.», con icono pequeño
y color de texto secundario. Los once tests de WearablePage pasaron.
La aceptación visual de esta presentación está pendiente.


La versión con nota discreta pasó once pruebas UI, lint, i18n, sync:dev,
build de producción y build iOS firmado. Se instaló en iPhoneです para revisar
la presentación conservando Bluetooth apagado.


### Presentación final solicitada: popup Bluetooth

El usuario pidió expresamente un popup en lugar de la nota inline. Se usa
IonAlert estándar: «Activa Bluetooth», «Enciende Bluetooth en Ajustes para
conectar tu wearable.» y una acción Entendido. Se muestra al entrar en Reloj
con off confirmado o al pasar a off; al descartarlo no reaparece por renders
mientras siga apagado. Al pasar a on se cierra y se permite un nuevo aviso
si vuelve a apagarse. Un estado unknown/no listo no abre este popup.
Se retiraron la nota inline y sus estilos; no se añadió un botón principal.
La pausa de escaneo/reintentos se conserva. Trece pruebas UI aprobadas,
con casos de apertura, cierre, no repetición y recuperación de radio.


El popup solicitado pasó trece pruebas UI, lint, i18n, sync:dev, build de
producción y build iOS firmado. Se instaló en iPhoneです; comprobación
física de presentación y recuperación al encender pendientes.


El usuario confirmó en el iPhone que el popup Activa Bluetooth aparece con
el radio apagado, incluyendo la instrucción de Ajustes y Entendido.
Presentación física del popup aprobada; recuperación posterior al encender
pendiente de esta repetición.


El usuario confirmó el ciclo final del popup: Entendido → Bluetooth encendido
en Ajustes → retorno a Reloj sin Conectar. H59 se reconectó automáticamente,
las lecturas se actualizaron y el aviso permaneció cerrado. La detección
del radio apagado, pausa de búsqueda/reintentos, popup y recuperación al
encender quedan comprobados en el iPhone físico. El ensayo prolongado real
de 30 minutos y R88 físico continúan pendientes; la prueba Wi-Fi sigue excluida.
