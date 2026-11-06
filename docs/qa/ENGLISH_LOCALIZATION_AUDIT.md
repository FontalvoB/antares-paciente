# Auditoría de localización inglesa de la app

Trabajo local en `fix/diomedes-english-app-audit`, desde app `15b3217`,
backend `772c669` y AI `a2d8102`. Después se incorporaron los avances de `dev`
(app `83c8ed9`, backend `daa3619`, AI `5f0e735`), conservando los cambios de la auditoría y los
stashes SOS. Durante la auditoría la app se mantuvo sin commit/push. AI y backend se publicaron con
autorización del usuario y terminaron sus despliegues; véase el rollout.
Build firmado instalado por USB en `iPhoneです` tras la pausa y la indicación
del usuario de continuar. El usuario confirmó el popup Bluetooth íntegramente
en inglés. Después confirmó los controles observados de cámara/selector de
fotos y, tras desplegar los servicios, el contenido nutricional completo en
inglés sin el mensaje técnico. El usuario también confirmó los controles/instrucciones observados de voz y
cualquier prompt mostrado en inglés. El share sheet nativo y los mensajes de
estado observados también fueron confirmados ingleses al abrir y cancelar.
Tras la petición posterior de pull/build, se incorporó app `83c8ed9`, se
preservaron ambos catálogos y la nueva vista nutricional, y se compiló e instaló
otra vez por USB. Build Xcode e instalación aprobados; el bundle contiene el
gateway de producción y la elección explícita `X-App-Language`.

## Evaluaciones EN: corregidas y confirmadas en el teléfono

El usuario reportó “Unable to load your assessments.” Se reprodujo en
producción: assignments/results ES200 (20/57 elementos), ambos EN503
`CONTENT_TRANSLATION_UNAVAILABLE` en unos 0,55 s. La revisión previa de
evaluaciones usó respuestas simuladas y no detectó esta integración productiva.

El runtime desplegado resolvió SDK más nuevos que el entorno local. El cliente
moderno seguía reenviando `temperature` al contrato estructurado que lo
rechazaba. Se reprodujo con SDK real y transporte falso y se verificó la
omisión contra el proveedor real con los 16 textos genéricos de asignaciones,
sin nombres/notas/IDs de pacientes. La corrección distingue configuración
heredada de omisión explícita, conserva proveedor/modelo y fija 70 dependencias
compartidas por Docker/CI, incluidos ambos Dockerfiles. Commit AI `7c0acd0` de
Kenma: 350 tests + Ruff pasan; deployment42276642835 saludable, `ai:38` 1/1.

La nueva prueba productiva **pasa sus 22 GET**: lista, resultados y las nueve
versiones en ES/EN; 50 preguntas y 192 opciones. IDs, orden, valores, scores y
todos los campos ajenos a la proyección traducible son idénticos. Solo lecturas,
sin iniciar ni enviar evaluaciones. Evidencia sin payload clínico:
`Designs/english-app-audit/assessments-live-english-after-fix.json`.

App actualizada: error tipado/reintento específico y conservación de listas,
resultados y progreso solo del idioma confirmado, sin mostrar datos españoles
como ingleses ni perder wizard/borrador. Suite completa 1.481 tests/183 archivos,
lint/i18n/build/sync/release/BLE/Xcode/USB aprobados; 38 assets instalados cotejados.
El usuario reabrió Evaluaciones con EN y revisó una pregunta pendiente y sus
opciones sin enviarla. Confirmó: **“Loads correctly; the question and options
are English”**. El hallazgo productivo y físico queda cerrado. Evidencia:
`Designs/english-app-audit/native-assessments-loading-fixed-user-report.json`.
El usuario autorizó después publicar la app; SOS sigue aparcado.

## Publicación autorizada

El usuario confirmó la pasada física y autorizó merge/push de la app a `dev`.
Se incorporó `483f7df` con la orbe de voz nueva. La combinación aprobó
1.500 tests/187 archivos, lint e i18n; ambos catálogos tienen 3.677 claves.
Los estados sin publicar citados abajo corresponden a checkpoints anteriores.
AI/backend ya están desplegados; el push de la app activa iOS/TestFlight.

## Resultado

Se revisaron todas las rutas declaradas de la app, los catálogos dinámicos y
35 archivos que contienen modales, alertas, popovers u hojas de acciones.
El recorrido utilizó componentes reales y APIs sintéticas aisladas. No es
una certificación de todas las combinaciones de datos, permisos o hardware.

- 247 entradas inglesas nuevas y 24 traducciones corregidas.
- 3.675 claves por idioma tras incorporar `dev` y cerrar el texto alternativo
  de imágenes; paridad, parámetros e identidad española validados.
- Ocho descripciones de permisos iOS en inglés y español, registradas en Xcode.
- Corregidos calendarios, días de semana, unidades, errores, etiquetas
  accesibles, opciones dinámicas y selección de idioma de instrucciones.
- La API descartaba instrucciones nutricionales inglesas: `notesEn` conserva
  únicamente parejas vinculadas a su fuente exacta. Una migración nullable
  registra esa procedencia, sin validar o reemplazar instrucciones históricas.
- Cerrados los caminos de contenido publicado, Food AI histórico, OTP y
  preferencia de idioma por dispositivo para push; detalles abajo.

## Cobertura y tipo de evidencia

| Área | Recorrido / comprobación |
| --- | --- |
| Acceso | Login rechazado, recuperación por email, activación por SMS/email, contacto de entrega, OTP y contraseña. Interacciones reales de la UI con respuestas simuladas. |
| Onboarding | Datos personales, fecha, seguro, contactos obligatorios/opcionales, parentesco, consentimiento con scroll y tres aceptaciones, contraseña y validaciones. |
| Evaluaciones | Las nueve evaluaciones, 50 preguntas, cinco tipos de respuesta, introducciones, resultados y análisis de Vita. GET/POST de análisis llevan `language=en`. |
| Inicio | Navegación, rueda de protocolo, avisos, historial de indicadores, menú y recordatorio diario; capturas de rutas y estados. |
| Perfil | Contacto, validación de email, contacto de emergencia y respaldo, privacidad de liga, alias válido/inválido, aviso de eliminación cancelado y logout. |
| Avatar / cuerpo | Composición, progreso, personalización, controles 3D, ropa, cabello, accesorios y registro de peso. Sin nueva medición clínica real. |
| Citas | Los tres pasos de solicitud, motivo y modalidad, selección de fecha/hora y solicitud simulada. Calendario inglés confirmado después del fix. Reprogramación y picker comprobados con regresiones renderizadas y validación de valores ISO. |
| Historia | Ruta, secciones, valores, fechas y estados vacíos; regresiones del historial persistido también ejecutadas. No se inventaron diagnósticos o resultados clínicos. |
| Nutrición | Cuatro pestañas, menú por día, formulario manual, errores, horarios, agua, notas por idioma y menús de foto. Captura física/análisis de comida real no ejecutados. |
| Protocolo | Hoy, racha y recompensas, las cuatro categorías de liga, evolución, seis módulos y estados de error/reintento. |
| Ejercicio | Instrucciones, guía, iniciar/pausar/saltar, detalle del ejercicio, nombre conocido, músculo y equipo. Narrativa clínica libre preservada. |
| Signos vitales | Introducción manual de cuatro métricas, habilitación y guardado simulado; modales de medición revisados. Sin medición física nueva. |
| Nutracéutico | Pendiente, toma confirmada, fecha/hora y borrador comunitario en inglés. Sin publicar el borrador. |
| Emocional | Sin dato de sueño, entrada manual inválida/válida, corrección, selección de ánimo, guardado y confirmación. |
| Reloj | Desconectado, información diagnóstica, búsqueda no soportada y error inglés en navegador. Emparejamiento y permisos del sistema requieren hardware. |
| Chat / voz | Ruta, acciones y textos de adjuntos, errores y configuración lingüística de chat/voz. Usuario confirmó controles/instrucciones observados de voz y prompt íntegramente EN; audio bidireccional/herramientas no certificados. |
| Comunidad | Feed y encuesta, detalle/comentarios, opciones y denuncia, cuatro tipos del compositor, grupos/chats vacíos, descubrimiento, clubes, perfil, categorías y filtros. Acciones con respuestas sintéticas; sin publicación ni mensajes reales. |
| Academia / INFINITO | Pantallas, catálogos de tarjetas y textos de sus acciones. Cobertura adicional de tuplas dinámicas con pruebas AST para evitar nuevos fallbacks. |
| Teleconsulta | Prejoin y formulario de preconsulta; controles de dispositivos y chat de sala también comprobados como componentes reales con estados controlados. Sin conexión WebRTC real. |
| Logros / medios | Centro y tarjeta de logro, formatos de compartir, carga/error/reintento y visor de imagen/video mediante fixture de componentes. Sin compartir externamente. |
| SOS | Interfaz/errores y pruebas de regresión, con transporte aislado. No se enviaron alertas, SMS, email ni llamadas reales. El trabajo de dirección GPS continúa aparcado. |

Los estados controlados de componentes no equivalen a una llamada, envío,
lectura Bluetooth o captura de cámara reales. Se conservaron nombres, textos
de pacientes y valores canónicos del API; no se traducen para persistirlos.

## Validación

- Suite final tras incorporar `dev` y los fixes residuales: **1.472 tests, 182 archivos, todos aprobados** con
  `npm test -- --maxWorkers=1 --no-file-parallelism --pool=forks`.
- Lint, comprobación de traducciones, typecheck/build de producción,
  `release:check` y `native:ble:check`: aprobados; warnings existentes.
- Catálogo: paridad, identidad ES, placeholders, catálogos dinámicos y
  registro/propósitos de permisos nativos cubiertos por regresiones.
- Build de simulador iOS y build firmado para iPhone: aprobados. Los ocho
  permisos localizados se comprobaron dentro de `App.app/en.lproj` y
  `App.app/es.lproj` del producto compilado. Instalación física por USB aprobada.
- Servicio AI: **329 tests aprobados antes de la última integración**, después
  **338 tests aprobados** al incorporar los avances de `dev`; Ruff limpio y prueba HTTP real del
  proveedor con cuatro textos sintéticos. Primera respuesta 3,533 s; repetición
  0,004 s desde cache. Se revisaron cifras, unidades, horarios y negaciones;
  no se enviaron datos de pacientes.
- Backend tras integrar `dev` y proteger compatibilidad: **1.883 tests aprobados, 105 omisiones existentes que dependen del
  entorno, cero fallos**. Incluye traducción HTTP/MVC, OTP, Food AI,
  nutrición/procedencia y push. Las tres migraciones y la propiedad concurrente
  de tokens se probaron en bases PostgreSQL nuevas y aisladas; se añadió la
  comprobación real del snapshot nutricional (cinco tests).
  Esas pruebas aisladas no modificaron la base principal ni producción. El
  despliegue autorizado posterior sí aplicó las migraciones de producción
  antes de activar la API, como se registra al final. Log de la suite:
  `/tmp/diomedes-explicit-language-guard-unit.log`.

Tres intentos anteriores de suite completa sufrieron workers que no
arrancaron; uno además agotó el tiempo de un test de Historia. Los tres
archivos afectados por el último intento pasaron aparte (26 tests), antes
de la suite final completa aprobada. No se contabilizan esos intentos como
verdes. Los logs viven en `/tmp/diomedes-english-*`.

El servicio Preview perdió pestañas durante el trabajo. La evidencia de
identidad conserva **132 snapshots** y las 50 preguntas; cuatro estados
finales de overlays se ejecutaron pero sus últimas capturas se perdieron.
El reporte de care distingue su manifiesto previo al reinicio de las
capturas finales retenidas. No se presenta evidencia perdida como PNG
conservado. La verificación final del calendario también consta en la
traza de herramientas y en regresiones renderizadas.

Evidencia conservada fuera de Git, en
`Designs/english-app-audit/` de la raíz del workspace:

- `diomedes-identity-browser-coverage.json`.
- `diomedes-care-browser-coverage.json`.
- `diomedes-english-browser-baseline.json` y `diomedes-english-browser-pass1.json`.
- `diomedes-english-dictionary-invariants.json`.
- `diomedes-english-native-localization-report.json`.
- `diomedes-ai-content-translation-real-provider.json`.

## Cierre de los gaps de contenido

1. **Contenido del ERP:** negociación `Accept-Language`/`language`, con lista
   explícita de campos de presentación en nutrición, snapshot/podcast/ejercicio,
   evaluaciones/resultados/historial, notificaciones, nombres de métricas y
   catálogos de especialidades/profesiones. Se clona la respuesta después de
   autorizar; se conservan IDs, códigos, cantidades, fechas, unidades y texto
   libre de pacientes. La profesión fuente no se usa como etiqueta traducible:
   `professionalTypeDisplayName` evita cambiar la clasificación de profesionales.
2. **Traducción interna:** endpoint AI protegido por clave interna, contrato
   estructurado, lotes acotados, protección de cantidades/unidades/códigos/
   placeholders/marcado, cancelación y timeout. Los errores incompletos o de
   proveedor producen `CONTENT_TRANSLATION_UNAVAILABLE` recuperable; no un
   éxito parcial español. La traducción no crea una nueva aprobación clínica.
3. **Nutrición histórica:** el hash de fuente vincula `InstructionsEn` con
   `Instructions`. Filas antiguas sin procedencia no se presentan como inglés
   vigente; se traduce la fuente actual. Las ediciones futuras no reutilizan
   una traducción de otra fuente. Migración Up/Down/Up con 1.001 planes
   históricos y un plan nuevo, conservando contenido y filas hijas.
4. **Food AI:** `NameEn` nullable para análisis nuevos; históricos resueltos por
   inglés persistido, identidad exacta de catálogo curado y traductor. Se
   conservan nombre fuente, porciones, nutrientes y feedback. Up/Down/Up con
   2.000 filas históricas; sin backfill inventado ni sustitución de alimentos.
5. **OTP:** idioma opcional de activación/recuperación, asunto/HTML/texto plano
   ES/EN y locale de Twilio Verify en envío/reenvío. Nombres escapados en HTML;
   transporte fake en pruebas, sin enviar SMS o emails reales.
6. **Push:** preferencia ES/EN por dispositivo, actualización de token sin
   repetir permisos/listeners y preparación de variantes antes de enviar. Se
   prefieren plantillas bilingües revisadas; SOS usa copia fija, sin LLM.
   La reasignación entre cuentas y la limpieza al salir están aisladas para
   impedir que un cierre anterior borre el token de la cuenta nueva. Los
   registros canónicos, prioridad, dedupe, rutas y chat único se conservan.
7. **Cambio de idioma:** peticiones y reintentos usan el idioma vigente;
   caches inactivas se eliminan, lecturas activas se cancelan/revalidan sin
   desmontar contenido confirmado. Pruebas con `ProgramPage` real conservan
   mediciones sin guardar, ánimo/sueño/nota, ejercicio y audio. Evaluaciones,
   Food AI y catálogos locales descartan respuestas tardías; la página siguiente
   del picker y un profesional seleccionado fuera del top también se actualizan.
   Si falla la actualización, el borrador permanece junto al aviso de reintento.
8. **Compatibilidad ERP/clientes anteriores:** el cliente envía `X-App-Language`
   con la elección explícita. La API exige además `aud=app`; un idioma automático
   del navegador/SO no cambia lecturas antiguas. Los editores ERP conservan la
   fuente canónica y no reciben nombres traducidos como si fueran valores para
   guardar. Calidad, región y prioridad del idioma mantienen el mismo presupuesto
   de timeout entre cliente y servidor; cubierto también después de renovar auth.

La entrega debe coordinar los tres repos: servicio AI primero, API y migraciones
después, app al final. El build de revisión mantiene el backend de producción
solicitado anteriormente; no despliega los cambios del servidor por instalarlo.

## Comprobaciones físicas confirmadas y límites

Xcode y las herramientas USB detectan `iPhoneです` (`00008101-001809991186001E`).
Device Hub sigue listando solo simuladores y rechaza abrir ese ID con
`No device ... on 'This machine'`; refrescar no lo resolvió. No se automatizó la
UI física por una vía alternativa. El usuario confirmó English en los ajustes
de idioma de la app en iOS, pidió esperar mientras usa el teléfono y después
indicó continuar. Se comprobó de nuevo USB y se instaló el build corregido.

El usuario confirmó en el build instalado, con EN seleccionado y Bluetooth
apagado desde Ajustes, que el popup está íntegramente en inglés:
`Turn on Bluetooth` / `Got it`. Esta evidencia es una observación manual
reportada por el usuario; no es una captura de Device Hub ni confirma por sí
sola el emparejamiento, las lecturas o una nueva solicitud de permiso de iOS.

En la siguiente comprobación, el usuario reportó `propuesta determinista
pendiente de revision` y las comidas en español en Nutrición con EN activo.
**El hallazgo reportado se cerró después del despliegue**, no con la instalación
del frontend por sí sola: tras publicar AI/API, pasar migraciones/rollouts y
refrescar ES→EN, el usuario confirmó que todo era inglés y el mensaje técnico
ya no aparecía. Evidencia manual en
`Designs/english-app-audit/native-nutrition-deployed-english-user-report.json`.
El origen exacto es `NutritionDraftClient`, cuyo fallback conserva esa narrativa
al aprobar. Esa frase no demuestra por sí sola que la dieta no esté aprobada.

Se verificaron los campos de descripción, alimentos y notas de cuatro comidas
en seis pruebas HTTP de ambas rutas reales. La prueba adicional con proveedor
real tradujo el texto reportado y seis textos sintéticos de comidas en 3,515 s,
conservando cantidades y unidades; evidencia
`diomedes-nutrition-translation-reported-case.json`. La proyección pública también
separa seis líneas exactas de boilerplate interno de las indicaciones clínicas,
para no mostrar un estado técnico de revisión después de aprobar. Conserva el
texto fuente/auditoría, notas específicas, cantidades y aprobación; cuatro
regresiones de query y una prueba real de snapshot PostgreSQL lo comprueban.

AI/API ya se desplegaron y el usuario releyó el plan en el teléfono con éxito. El usuario comprobó después cámara, cualquier prompt observado y el selector
de fotos, cancelando sin tomar/seleccionar una imagen: confirmó que todos los
controles observados eran ingleses. Esta evidencia manual cubre lo mostrado;
no demuestra que iOS haya vuelto a solicitar un permiso ya otorgado.

La prueba real de volumen detectó un timeout que los casos pequeños no mostraban:
56 fuentes únicas respondían 503 tras 30,268 s. El servicio ahora divide trabajo
en sublotes acotados, con cuatro llamadas máximas compartidas, plazo total de
28 s y cache solo después de validar todo. El mismo caso pasó en 15,414 s y el
caso máximo revisado de 64 fuentes pasó en 16,755 s, preservando IDs, orden y
195 fragmentos protegidos; repetición desde cache 0,001 s. Se añadió un glosario
acotado por tokens para singular/plural de `carbohidrato complejo` tras detectar
una traducción semánticamente incorrecta del proveedor. La política de cache v2
no reutiliza esa salida anterior. Son observaciones sintéticas con el proveedor
configurado, sin pacientes, cambio de modelo o garantía general de equivalencia.

El usuario confirmó en Watch con H59 conectado y EN activo que todo el texto
observado era inglés: conexión/batería, etiquetas de medición, historial y
detalles, sin desconectar. Evidencia manual en
`Designs/english-app-audit/native-h59-connected-english-user-report.json`.
Después de cambiar de H59 a R88, el usuario confirmó también todo el texto
observado en inglés: conexión/batería, mediciones, historial y detalles.
Evidencia: `Designs/english-app-audit/native-r88-connected-english-user-report.json`.
La pasada física de traducciones planificada para ambos wearables pasa. Los controles/instrucciones
observados de voz y cualquier prompt mostrado fueron confirmados ingleses
por el usuario. También confirmó controles del share sheet y mensajes de
estado ingleses, abriendo y cancelando sin elegir app/destinatario. Cámara y selector de fotos
observados ya fueron confirmados ingleses por el usuario. No se certifican
con el navegador o con la inspección del bundle. El audio bidireccional, transcripción y herramientas de voz, videollamadas,
entrega FCM/APNs, entrega externa al compartir y SMS/email reales tampoco se presentan como
verificados por las pruebas con sinks fake ni por observar la interfaz de voz. No se ejecutaron envíos reales de alertas, mensajes/posts comunitarios o
llamadas a terceros como prueba de traducción. El resultado del share sheet
se conserva en `Designs/english-app-audit/native-share-sheet-english-user-report.json`. El trabajo SOS de dirección GPS sigue aparcado.

Los diálogos del sistema respetan el idioma de app que decide iOS; el selector
JavaScript no lo sobrescribe. Se siguen las localizaciones y ajustes soportados
por [Apple](https://developer.apple.com/localization/), sin alterar permisos o
usar overrides privados. El audio/vídeo editorial y las conversaciones originales
mantienen su idioma de autoría; esta auditoría localiza la interfaz y el contenido
de presentación, sin doblar grabaciones ni reescribir conversaciones.

## Entrega de servicios y cierre residual (2026-11-06)

Con autorización, AI y backend están publicados en `dev`. La primera ejecución
backend falló por un test dependiente de `appsettings.Development.json`; el
arreglo usa el ejemplo versionado, sin secretos. El siguiente run pasó
1.883/413/149 tests (principal/Telemedicina/Comunidad), migraciones antes de
activar API y los cuatro rollouts COMPLETED 1/1. AI vigente `73dbb59` conserva
la auditoría `848ab9d` y los arreglos posteriores de narrativa. Salud pública
200 y plan sin JWT401 son comprobaciones de disponibilidad/control de acceso,
no de contenido clínico. Receipt: `Designs/english-app-audit/deployed-english-services-receipt.json`.

La pasada residual corrigió cadenas alcanzables de conversaciones directas/
grupales, fallback de error comunitario y textos alternativos de dos imágenes,
conservando mensajes/nombres de autor. Se corrigió también el valor identidad
de una clave histórica española. Revisión estática adicional: 293 archivos,
sin otro literal alcanzable confirmado; no sustituye las pruebas de interfaz.

Nueva suite: 1.472 tests/182 archivos aprobados, lint/i18n sin fallos,
3.675 claves/idioma. Build/sync de producción, release/BLE, Xcode e instalación
USB aprobaron. Los 38 assets web del bundle instalado coinciden exactamente
con la salida verificada. App sigue sin commit/push y SOS sigue aparcado.
Receipt: `Designs/english-app-audit/final-local-english-ios-receipt.json`.

Comprobación adicional de las conversaciones que faltaban: tres regresiones de
interacción con `ConversationModal` real, `I18nProvider`/diccionarios reales y
cliente URQL con exchange en memoria. Se recorren controles peer/grupo EN,
botón de mensaje nuevo por suscripción, cambio EN↔ES manteniendo el mismo
composer/borrador, miembros/agregar/renombrar/eliminar/salir abiertos y cancelados,
y selector vacío cuando todos ya pertenecen al grupo. Nombres/mensajes fuente
intactos; cero envíos/mutaciones. El shell DOM de Ionic sustituye las hojas
nativas de Stencil en happy-dom; no certifica su presentación física. Las tres
pruebas pasan además de la suite completa anterior de 1.472. Solo añadió tests;
el código del build instalado no cambió.

## Cierre de la pasada de traducciones observada

El usuario confirmó EN en popup Bluetooth, cámara/selector de fotos, Nutrición
y su misión después del despliegue, interfaz/instrucciones de voz, share sheet
abierto/cancelado y estados conectados tanto H59 como R88. No quedan hallazgos
de traducción conocidos abiertos en los recorridos revisados. La suite completa
aprobada tiene 1.472 tests/182 archivos, más tres regresiones posteriores de
conversaciones aprobadas por separado. Build local actualizado instalado en
iPhoneです; AI/backend desplegados. La app permanece en
`fix/diomedes-english-app-audit`, sin commit/push; publicación espera instrucción
del usuario. SOS sigue aparcado. Los límites de datos/proveedores descritos
arriba permanecen: esta revisión de idioma no certifica entrega real de mensajes,
audio/vídeo bidireccional o todas las combinaciones posibles.

La corrección de carga de evaluaciones queda confirmada con los 22 GET reales
y la observación posterior en iPhoneです. Estado vigente: 1.481 tests de app
(incluyen las tres regresiones de conversaciones), 350 tests AI con runtime
productivo, AI7c0acd0 desplegado saludable y nueva app instalada. No quedan
hallazgos de traducción conocidos abiertos en los recorridos revisados. La
publicación de la app sigue esperando una instrucción del usuario; no se
hicieron submits clínicos para verificar esta corrección.

## Integración final para publicar en dev

Auditoría guardada como `607d926` de Kenma y merge con `483f7df`. Se resolvieron
tres conflictos: catálogos ES/EN conservan todas las 3.675 entradas de auditoría
y agregan las dos claves de voz; FoodResultCard conserva aserciones acotadas
al chip correcto y el comentario upstream. Se preservaron las 14 rutas de voz
no solapadas (solo se limpiaron cinco líneas de whitespace en el shader).
102 archivos del backup de auditoría permanecen byte a byte iguales; los otros
cinco tienen únicamente la integración/documentación esperada. Los 12 stashes
anteriores, incluido SOS, siguen intactos. Backup verificado:
`/tmp/diomedes-english-prepublish-63ff3ilt/manifest.json`.

La suite combinada aprueba 1.500 tests/187 archivos y ambos catálogos suman
3.677 claves, sin faltantes. El usuario autorizó el push a `dev`, que activa
el workflow iOS/TestFlight. Una validación local aprobada no significa que el
IPA ya esté procesado por App Store Connect; consultar el workflow de la
revisión publicada para ese resultado. No se enviaron mensajes ni alertas reales.

La combinación final con `483f7df` aprobó también build/sync de producción,
release/BLE y Xcode firmado. Se cotejaron los 40 assets web de la
compilación nativa con la salida verificada, sin diferencias ni sobrantes.
El merge/push a `dev` está autorizado; disponibilidad en TestFlight depende
del resultado del workflow de la revisión publicada.
