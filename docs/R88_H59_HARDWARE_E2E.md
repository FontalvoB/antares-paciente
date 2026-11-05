# E2E físico: R88 y H59

## Punto de partida

- Rama: `feat/diomedes-r88-dual-wearable-e2e`, creada desde
  `origin/dev` (`0466f44788924e5e073b7beb01762521e3dc4163`).
- iPhone: `iPhoneです`. Build local con `sync:dev`, Gateway del Mac.
- Device Hub solo expone simuladores; interacción física a cargo del usuario,
  instalación por Xcode y evidencia mediante logs/diario nativo cuando estén accesibles.
- No se modificaron drivers ni gestión de sesiones al preparar este documento.

## Limitación encontrada antes del ensayo

`WearableContext.connect` detiene la sesión anterior y desconecta su GATT antes
de iniciar la nueva. La asociación y la recuperación actuales son de un único
wearable activo. Mostrar ambos en el escaneo no acredita conexiones simultáneas.
Se debe validar R88 por separado y resolver esta limitación antes de aprobar
la captura concurrente H59/R88.

## Verificación de preparación

- `sync:dev` y build firmado Debug para iPhone físico: aprobados.
- Login demo contra Gateway LAN y `/api/auth/me`: HTTP 200.
- 86 pruebas en seis archivos (sesión, tiempo real, historial, registros y
  mediciones YCBT; ciclo de vida del contexto): aprobadas.
- Pruebas automatizadas no equivalen a evidencia de radio o firmware R88.

## Matriz física pendiente

| Escenario | Evidencia necesaria | Resultado |
| --- | --- | --- |
| R88: descubrimiento | Nombre anunciado, icono compatible y Conectar | Usuario confirma R88 C1BF y permite conectar |
| R88: conexión y lectura | GATT, suscripciones, batería y lectura nueva con hora/origen | Conecta según usuario; lecturas pendientes de confirmar |
| R88: cambio de app y bloqueo | Distinguir sincronización de historial de desconexión real en logs | Pendiente |
| R88: Bluetooth off/on | Popup Activa Bluetooth, pausa y recuperación sin Conectar | Recuperación automática confirmada; popup/pausa no confirmados expresamente |
| R88: fuera de rango y regreso | Recuperación sin perder asociación ni mezclar muestras | Usuario confirma recuperación sin Conectar; mezcla de datos no verificada |
| R88: desconexión explícita | Sin reconexión automática hasta acción manual | Aprobada: 35,8 s medidos, cero conexiones; reconexión manual posterior confirmada |
| R88: force-quit y reapertura | Recuperación al abrir; no prometer conexión tras swipe | Usuario confirma reconexión y batería; proceso nuevo y ConnectPeripheral observados |
| R88 → H59 → R88 | Un único wearable activo; nueva lectura en ambos sentidos | Aprobado físicamente; captura nativa separada verificada |
| Ambos cercanos durante switching | El wearable anterior no se reconecta por su cuenta | Aprobado en la observación de cambio; H59 sin reconexiones tras volver a R88 |
| Conexión simultánea | Dos sesiones activas | Fuera del alcance: usuario solicitó switching |
| Fuente de captura al cambiar | Subscripciones y muestras del dispositivo seleccionado | Aprobado para captura BLE y lectura nueva; fusión de datos entre wearables fuera del alcance |
| Ensayos prolongados | Retención continua de 30 minutos | Dispensados por el usuario; no contar como medición aprobada |

Registrar por caso inicio/fin, acciones exactas, eventos GATT, suscripciones y
muestras originales. Un valor en caché o el texto Conectado no bastan.
No dar por aprobado un intervalo de 30 minutos si no se completó.
El ensayo sin Wi-Fi anterior fue cancelado y no cuenta como aprobado.

## Primera conexión R88 C1BF (05/11/2026)

El usuario confirmó descubrimiento y conexión, con espera percibida de unos
20 segundos frente a H59. Syslog del mismo proceso muestra solicitud de
conexión a las 09:54:20.109, descubrimiento de servicios a las 09:54:22.324
(enlace establecido a más tardar a +2,215 s), suscripciones a las
09:54:23.828/23.908 y escrituras de inicialización desde 09:54:24.000
hasta 09:54:36.456. Las escrituras posteriores continúan desde 09:54:38.648.

El contexto solo publica connected después de `session.start`; YCBT espera
nueve comandos en serie, pausas de 400 ms entre escrituras, una espera de
autenticación de 3 s y una pausa final de 1 s. Esto explica una parte
sustancial de la espera percibida, sin acreditar que todas las pausas puedan
eliminarse con seguridad. No se modificaron tiempos ni se declaró lectura
real aprobada sin confirmar datos actuales. Log: /tmp/diomedes-r88-native.log.

### Batería e historial antiguo

El usuario confirmó batería visible y las tres tarjetas (FC, SpO2, presión)
con «Hace 720 h». Se trata de antigüedad mostrada, no cantidad de historial.
Aún no se atribuye a datos antiguos reales o reloj/decodificación incorrectos.
La copia del diario nativo confirmó captura R88 habilitada, dos suscripciones
YCBT (C1/C3), cero descartes y cero notificaciones pendientes al copiar.
No acredita por sí sola una lectura fisiológica actual. Siguiente comprobación:
medición manual de FC con el anillo puesto y verificación de marca nueva.

### FC manual: valor nuevo confirmado

Tras pedir una medición manual con el R88 puesto, el usuario confirmó que
aparece un valor nuevo. Queda acreditado el recorrido de medición de FC
según observación del usuario; no se registró todavía el valor numérico ni
la marca temporal exacta. SpO2 y presión actuales siguen pendientes.
La antigüedad de 720 h de los datos iniciales no se considera resuelta
únicamente porque haya llegado una medición manual.

### SpO2 y presión manuales

El usuario confirmó resultado positivo al pedir una nueva medición SpO2
y confirmó un número tras solicitar presión arterial. No se documentaron
valores ni timestamps exactos, y esto no valida precisión clínica. FC/SpO2
con resultado nuevo reportado; presión con resultado numérico reportado.
Siguiente caso: cambiar de app unos 10 s y volver sin Conectar, verificando
retención del enlace y ausencia de overlay completo de historial automático.

### Cambio breve de app

El usuario confirmó que al cambiar a otra app unos 10 s y volver Reloj
permanece Conectado. No equivale a la prueba de bloqueo de 5/30 minutos.
Se prepara baseline para bloqueo cronometrado; no iniciar tiempo hasta que
el usuario confirme pantalla bloqueada.

### Bloqueo cronometrado R88: intervalo completo

Inicio UTC 2026-11-05T15:05:24.103485+00:00; duración observada 323.9 s.
Eventos de conexión/cancelación en syslog durante intervalo: 0.
Nuevos arranques de App observados: 0.
Diario antes/después: secuencia [4753] → (4753,); captura [('E0CE868C-34E9-4D0F-DCA5-7E977E8B649B', 1, 0)]; suscripciones 2.
Verificación de UI al desbloquear pendiente. Sin muestras nuevas en el diario
no afirmar recepción continua, aunque se conserve asociación/suscripción.

### Retorno del bloqueo confirmado

El usuario confirmó Conectado al desbloquear tras el intervalo cronometrado
de 323,9 s, sin pulsar Conectar. El intervalo no mostró reconexiones ni
reinicios. La secuencia de notificaciones permaneció en 4753, por lo que
no acredita recepción de mediciones en background. Captura habilitada,
dos suscripciones y cero descartes antes/después.
Siguiente caso: Bluetooth off/on desde Ajustes, popup/pausa y recuperación
R88 sin pulsar Conectar.

### Recuperación Bluetooth off/on

El usuario confirmó reconexión automática tras apagar/encender Bluetooth,
con espera percibida de unos 20 s nuevamente. Syslog: ConnectPeripheral
10:12:36.959 → descubrimiento de servicios 10:12:38.315 (+1,356 s);
escrituras YCBT desde 10:12:41.096, con segunda petición tras espera de
autenticación a 10:12:49.133. Se repite la inicialización, no una espera
de 20 s para establecer el enlace radio. No se han optimizado pausas.
Popup y pausa de búsqueda no confirmados explícitamente en esta respuesta.
Pendiente validar parada explícita sin reconexión automática.

### Desconexión explícita

Usuario confirmó desconexión manual. CancelPeripheralConnection observado
a las 10:14:14.568. Después se cronometraron 35.8 s adicionales
sin pulsar Conectar. Nuevos eventos de conexión: 0.
Diario: dispositivos [], suscripciones 0, pendientes 0.
Resultado: parada explícita aprobada en esta observación.

### Reconexión manual tras parada

Después de la observación de parada explícita sin reconexiones, el usuario
volvió a buscar R88 C1BF, pulsó Conectar y confirmó conexión y batería visible.
La recuperación manual queda aprobada; no se afirmó reducción de latencia.
Siguiente caso: cierre explícito por swipe y reapertura manual sin Conectar.

### Force-quit y reapertura

El usuario confirmó reconexión automática y batería visible al abrir
tras swipe explícito. No implica retención del enlace durante force-quit
ni relanzamiento automático por iOS. Eventos de diagnóstico guardados en
/tmp/diomedes-r88-force-quit-result.json.

### Fuera de rango y regreso

El usuario confirmó recuperación automática al volver a rango sin pulsar
Conectar, en respuesta al recorrido con espera de hasta 60 s. No se midió
latencia exacta de este caso. Evidencia guardada en
/tmp/diomedes-r88-range-result.json.

Pendientes: 30 minutos cronometrados con R88 puesto y pantalla bloqueada;
verificación de recepción y timestamps en background; mejora de latencia
de inicialización; popup/pausa off R88 explícitos; discrepancia de antigüedad
inicial de 720 h. No marcar R88 completo todavía ni inferir soporte concurrente.

### Ensayo prolongado en curso: límite de observabilidad

Inicio UTC 15:20:49.627. El monitor se reanudó tarde: el checkpoint nominal
de 300 s se ejecutó a +1070,6 s. La cobertura de syslog tiene un hueco de
746,9 s entre 10:25:41.506 y 10:38:08.359 local. No atribuir causalidad
exacta ni declarar conexión continua sin evidencia durante ese hueco.
A +1070,6/+1116 s el diario tenía secuencia 5199 frente a 5191 inicial,
captura habilitada, dos suscripciones y cero descartes. Esto prueba aumento
de notificaciones, no ausencia de desconexiones en el tramo sin logs.
Se activó caffeinate para impedir suspensión por inactividad del Mac en
el resto del ensayo; no se intervino la UI del iPhone.

### Intervalo de 30 minutos completado

Duración medida 1800.5 s. Snapshot final: captura habilitada,
dos suscripciones, cero descartes, cero pendientes; secuencia5191→5199.
En los segmentos disponibles no se observaron solicitudes de conexión/cancelación
ni nuevos arranques de App. Huecos mayores de30s: [{"seconds": 746.9, "from": "2026-11-05T10:25:41.505554", "to": "2026-11-05T10:38:08.358570"}].
Las indicaciones observadas del R88 se concentran en los primeros segundos.
No equivale a recepción continua de mediciones durante30min. La retención
ininterrumpida queda inconclusa por el hueco, y la vuelta a foreground queda
pendiente de la confirmación del usuario. Evidencia: /tmp/diomedes-r88-soak-result.json.

### Retorno de 30 minutos: fallo de experiencia y corrección propuesta

El usuario reportó Conectando unos20s al volver, no Sincronizando historial.
Se marca fallido el recorrido de retorno sin reinicialización. App15991 y
WebContent15994 permanecieron. A10:52:41.148 reapareció descubrimiento de
servicios y luego la secuencia YCBT completa hasta10:52:53.200, sin una nueva
solicitud ConnectPeripheral en ese retorno. El enlace nativo ya estaba
conectado al reabrir la sesión; el hueco impide probar retención en todo el
intervalo anterior. No atribuir todos esos20s a conexión radio.

Se reprodujeron dos riesgos de ciclo de vida en pruebas: un callback de caída
antiguo desmonta una sesión ya recuperada nativamente; y el contador de pings
fallidos de antes del bloqueo se arrastra al despertar y desmonta la sesión
al primer tick. La corrección consulta el periférico de nuestro manager iOS
antes de actuar sobre la caída tardía y reinicia el contador de fallos al
cambiar actividad. No reinventa timestamps ni considera recientes las
lecturas viejas. Los fallos de protocolo tras nuevos pings aún fuerzan
recuperación aunque GATT siga conectado. Se protege generación/cuenta frente
a comprobaciones tardías. Esto es una corrección comprobada con regresiones,
no prueba aún de la causa exacta de todos los eventos físicos del retorno.

53 pruebas focalizadas y suite completa1315/161 archivos aprobadas; lint,
build producción y sync:dev aprobados. Parche nativo aplicado desde originales
y comprobado idempotente. Build firmado y nueva verificación física pendientes
al escribir; no declarar resuelto el ensayo prolongado todavía.

### Actualización desde dev durante la corrección

Por instrucción del usuario se ejecutó git pull --no-rebase --autostash origin dev.
Fast-forward0466f44→bcf1f8e, sin conflictos; autostash aplicado correctamente.
Cambios R88 preservados y stubs Android ajenos intactos. La validación1315
corresponde a la base anterior; se repiten checks/build sobre la base actual
antes de instalar el build combinado para la siguiente prueba.

Validación con dev bcf1f8e y correcciones R88:1329 tests/163 archivos,
lint, i18n, verificación de parche BLE, build producción, sync:dev y build
iOS firmado aprobados. Nueva instalación en curso. Prueba física de retorno
prolongado sigue pendiente; no se autoriza marcarla aprobada por tests unitarios.

### Segunda actualización desde dev, con prueba física en espera

A petición del usuario: pull --no-rebase --autostash origin dev,
fast-forward bcf1f8e→4ba62b2 sin conflictos; cambios R88 preservados.
No se instaló build ni se inició timer: el usuario está usando TestFlight.
La validación1329 anterior no acredita esta nueva base. Antes de reinstalar,
regenerar el Info.plist de desarrollo externo desde el plist actual (dev
actualizó CFBundleVersion y verificaciones de release), validar y reconstruir.

### Reanudación tras prueba de TestFlight

El usuario pidió retomar los ensayos. Base app4ba62b2 con fixes R88 locales:
1329 tests/163 archivos, lint, i18n, release:check, native:ble:check, producción,
sync:dev y build iOS firmado aprobados. Plist externo dev regenerado desde
el actual para conservar la corrección de CFBundleVersion incorporada de dev.
Reinstalación por Xcode en curso. Reloj e iPhone los opera el usuario,
pues Device Hub sigue exponiendo solo simuladores. No iniciar el próximo
intervalo de30min hasta confirmación expresa de pantalla bloqueada; ejecutar
monitor bajo caffeinate durante todo el intervalo.

### Cambio a backend de producción por instrucción del usuario

El usuario pidió usar npm run sync (modo production) para continuar.
Base4ba62b2 y fixes R88 locales conservados. sync y release:check aprobados;
build iOS Debug firmado sin INFOPLIST_FILE externo aprobado. Se verificó
el App.app final: contiene https://erp.coppadresd.com y no contiene el
Gateway LAN10.50.30.99:5080; plist binario sin excepciones HTTP locales.
Instalación solicitada sobre iPhoneです. No es un upload a TestFlight.
Los próximos ensayos usan cuenta real de producción y se separan de la
evidencia previa contra backend local/demo. Login prod y repetición física
del retorno largo aún pendientes; no declarar validados por el build.

### Repetición prolongada contra producción iniciada

Usuario confirma pantalla bloqueada; inicio 2026-11-05T18:59:02.132524+00:00, objetivo 2026-11-05T19:29:02.132524+00:00.
Build4ba62b2 con fixes locales, backend https://erp.coppadresd.com.
Monitor ejecutado bajo caffeinate -i, afirmación de energía verificada.
Baseline: R88 habilitado, dos suscripciones, cero descartes/pendientes,
secuencia5595. Evidencia separada: /tmp/diomedes-r88-prod-soak-20261105T185840Z-*.json.
No mezclar con la corrida anterior con hueco de logs y backend local.

Repetición prod interrumpida: el usuario desbloqueó el teléfono antes
de terminar. Se detuvo monitor/caffeinate propios a +227.9 s;
no contar como aprobación de30min ni como fallo del enlace. Evidencia
conservada en /tmp/diomedes-r88-prod-soak-20261105T185840Z-interrupted-result.json.

### Retorno corto y nuevo intento prolongado

Tras interrumpir la primera repetición prod a227,9s, el usuario confirmó
Conectado al volver; es un resultado corto, no30min. Nuevo bloqueo confirmado:
/tmp/diomedes-r88-prod-soak-20261105T190348Z-timing.json, monitor propio bajo caffeinate durante todo el ensayo.
Baseline {"devices": [["E0CE868C-34E9-4D0F-DCA5-7E977E8B649B", 1, 0]], "subscriptions": 2, "pending": 0, "sequence": [5719]}. No iniciar simultaneidad antes de cerrar R88.

### Repetición prod: caída real durante bloqueo

En el segundo intento prod (inicio19:03:48.426Z), syslog sin hueco registra
desconexión R88 a14:10:24.534 local, reason708/result307 (no se interpreta
el código sin evidencia). ConnectPeripheral a14:10:29.914 y BLE Connection
Ready para com.coppadresd.mobile a14:10:32.670, app state background-running.
Gap observado~8,14s; no es mero texto de UI. No apareció foreground en
la cobertura inspeccionada. Diario después: R88 habilitado, dos suscripciones,
cero descartes/pendientes, secuencia5719 sin nuevas notificaciones.
Se pidió al usuario confirmar cercanía y bloqueo; respuesta pendiente.
No aprobar retención ininterrumpida de30min. Se mantiene el intervalo para
observar recuperación/retorno; diagnóstico no equivale a aprobación.
/tmp/diomedes-r88-prod-soak-20261105T190348Z-drop-detail.log contiene eventos de caída y enlace recuperado.

Usuario confirmó teléfono bloqueado y anillo cercano (~1m), sin interacción.
Se detuvo el ensayo a +715.9s al estar demostrada una caída
durante el objetivo de retención. Foreground observado antes de detener: 0.
Huecos >30s: []. Resultado: retención ininterrumpida FALLIDA;
recuperación GATT en background observada. Sin nueva lectura no afirmar
recuperación de todo el protocolo. No se modifica/instala código durante
esta observación. Se pide retorno para comprobar UI/protocolo.

### Retorno tras caída real: primer fix insuficiente

Usuario confirmó de nuevo Conectando~20s al regresar tras la caída real del
segundo ensayo prod. Guardar este resultado como fallo del retorno; el primer
fix no lo resolvió. Se reprodujo la secuencia faltante: callback de caída
mientras enlace nativo todavía está desconectado, recuperación nativa
posterior, y vuelta a foreground. La consulta inmediata sola no basta.

Nueva corrección: conservar driver/consumidores mientras la recuperación
nativa iOS está pendiente en background, sin stop/unsubscribe/disconnect JS
ni intentos JS paralelos. Al regresar se consulta el periférico propio;
si está conectado se reutiliza driver y se refresca info/historial; si no,
se mantiene la recuperación normal. Desconectar, logout/cambio de cuenta y
Bluetooth off invalidan el estado pendiente. Una respuesta inicial App.getState
antigua no puede sobrescribir un appStateChange más reciente, y listeners
retirados no publican estado. No se alteraron comandos/timings YCBT ni
se afirma prevención de la caída física.

Regresiones nuevas fallaron antes del fix y pasan después: recuperación
posterior a la caída, fracaso/consulta desconocida al volver, parada manual
durante comprobación pendiente, radio off y estado inicial tardío.59 pruebas
focalizadas; suite completa1335/163 archivos; lint/i18n/nativo/sync producción/
release:check/build iOS firmado aprobados. App.app verificado con backend prod.
Instalación en curso; prueba física corta de caída/recuperación en background
pendiente antes de repetir30min.

### Prueba corta dirigida de recuperación en background

Tras instalar el segundo fix con1335 tests aprobados, el usuario confirmó
bloqueo. Baseline /tmp/diomedes-r88-bg-range-20261105T192604Z-baseline.json; captura R88 habilitada, dos
suscripciones y secuencia6034. Se mantiene el Mac despierto por600s.
Se pide mover solo el anillo fuera de rango y traerlo de vuelta manteniendo
el teléfono bloqueado; se verificará una caída real en logs antes de aprobar.

Caída dirigida confirmada a14:27:48.465 local (reason708/result307),
ConnectPeripheral14:27:53.752 y Connection Ready14:30:07.780 para
com.coppadresd.mobile. No foreground observado antes de recuperar.
La separación incluye tiempo fuera de rango; no confundir~139,3s con
latencia desde el regreso, pues no se cronometró el regreso físico exacto.
Diario después: R88 habilitado, dos suscripciones, cero descartes/pendientes,
secuencia6034 sin cambios. Retorno UI y lectura nueva todavía pendientes.
Evidencia: /tmp/diomedes-r88-bg-range-20261105T192604Z-return-trace.json y -journal-after.json.

Usuario confirmó Conectado al volver tras la caída/recuperación
nativa dirigida. El handoff UI queda aprobado para este caso; tiempo
exacto no medido. Verificación de lectura nueva del driver conservado
pendiente. No convertir este éxito en retención sin caídas de30min.

Usuario confirmó una nueva FC con marca reciente tras volver del caso
de caída/recuperación dirigida. Handoff y recuperación funcional del driver
aprobados en este caso. Descubrimiento de servicios solo a14:30:07.863
(recuperación nativa), antes del foreground14:30:51.401; no se repitió
descubrimiento al volver. No aprobar retención continua ni simultaneidad.

### Límite del diagnóstico de la caída cercana

No se confirmó la causa exacta de reason708/result307. Las trazas muestran
parámetros iniciales supervisionTimeout72 que después cambian a600 al
completar GATT; no diagnosticar usando solo el valor transitorio inicial.
Referencia primaria consultada: Apple QA1931
https://developer.apple.com/library/archive/qa/qa1931/ .
No se añadieron keepalives inventados ni comandos de medición continua para
ocultar una caída. La recuperación UI y la FC nuevas están confirmadas
para el ensayo dirigido; queda pendiente una corrida sostenida completa
con el segundo fix, manteniendo condiciones de distancia controladas.

### Corrida sostenida con el segundo fix

Usuario confirmó bloqueo y anillo puesto a~50cm del teléfono. Ensayo
/tmp/diomedes-r88-stable-20261105T193733Z-timing.json; inicio19:37:33.152Z, objetivo20:07:33.152Z.
Monitor bajo caffeinate; no modificar ni instalar build durante el intervalo.
Baseline {"devices": [["E0CE868C-34E9-4D0F-DCA5-7E977E8B649B", 1, 0]], "subscriptions": 2, "pending": 0, "sequence": [6174]}. Backend prod, base4ba62b2/fix1335tests.

Corrida sostenida segundo fix: nueva caída14:40:00.555 local,
ConnectPeripheral14:40:05.877 y Connection Ready14:40:48.273.
Objetivo sin caídas FALLIDO; recuperación nativa observada. Se detiene
a+388.5s. No hubo foreground en la traza inspeccionada
antes del evento. Condición solicitada~50cm; distancia no medida por el agente.
No repetir30min sin investigar causa; se pregunta batería y se revisa
referencia de protocolo. Evidencia /tmp/diomedes-r88-stable-20261105T193733Z-failure-result.json.

### Clasificación nativa y siguiente diagnóstico

En cada nuevo intento, bluetoothd incrementa getNumDisconnectionsBySignalQuality
para el UUID R88: cuenta1 tras caída14:10, cuenta2 tras fuera de rango
dirigido14:27 y cuenta3 tras caída14:40. Esto es clasificación del sistema,
no medición RSSI ni prueba definitiva de causa. PowerLogger solo lista
com.coppadresd.mobile para esas caídas; la traza inspeccionada no muestra
CancelPeripheralConnection de la app antes de las caídas no provocadas.
Se pide porcentaje de batería para descartar esa variable antes de tocar
comandos o timers. Referencia YCBT pública revisada: PulseLoopiOS, archivos
YCBTDriver/Coordinator/Protocol; sus quirks R10M no se aplican al R88 sin
evidencia. No se hicieron nuevos cambios de producto durante este diagnóstico.

### Corrección del usuario y cierre de ensayos prolongados

El usuario aclaró que olvidó la condición y se alejó fuera de rango en la
última corrida; después confirmó Conectado. Reclasificar esa corrida
193733Z como inválida para retención a distancia fija, no como fallo
concluyente del enlace cercano. La caída/recuperación observadas siguen
siendo evidencia útil de recuperación tras pérdida de rango. No extender
esta aclaración retroactivamente al ensayo190348Z, donde confirmó cercanía.

El usuario pidió dejar los ensayos de30min y consideró suficiente la
comprobación actual. No repetirlos. La verificación completa sin caídas
durante30min queda dispensada por el usuario, no aprobada por medición.
Handoff de recuperación y FC nueva sí están confirmados físicamente.
Continuar con escenarios H59/R88 según alcance de simultaneidad pendiente.

### Alcance de dos dispositivos aclarado

El usuario pidió probar SWITCHING, no conexiones simultáneas. No implementar
múltiples sesiones ni fusión de datos. La limitación de una sesión activa
es el comportamiento a probar: R88→H59→R88, sin reconexión del anterior,
mezcla de tarjetas/cachés ni captura con dispositivo equivocado.
Primer baseline: /tmp/diomedes-wearable-switch-20261105T195434Z-baseline.json. No repetir pruebas30min.

### Preferencia de búsqueda actualizada durante switching

El usuario pidió compatibles primero y después precisó: vista normal SOLO
compatibles, modo avanzado (Modo diagnóstico existente) TODOS. Se aplica
el mismo predicado de compatibilidad a listado/count/empty state;
diagnóstico conserva desconocidos deshabilitados y prioriza compatibles
antes de paired/RSSI. El último guardado tampoco adelanta un desconocido
a un compatible. No se cambió el permiso/escaneo nativo general ni ASK.
29 comprobaciones existentes de descubrimiento/compatibilidad/página, lint,
i18n, sync producción, release:check y build iOS firmado aprobados.
Instalación del build con backend prod solicitada; verificación física de
modos y cambio R88→H59→R88 pendientes.

### Primer cambio a H59 confirmado

El usuario confirmó conexión H59 con el build de búsqueda normal/diagnóstico.
Diario a2026-11-05T20:01:07.590747+00:00: solo DC74EDA5-B174-7E81-B481-A0F622CB6EA7
habilitado, dos suscripciones Colmi (6e40fff0 y de5bf728), cero descartes
y pendientes. R88 E0CE868C ya no figura para captura. Esto confirma cambio
de captura, no descarta por sí solo un vínculo Bluetooth de otra app.
Lecturas H59 actuales y retorno H59→R88 todavía pendientes. Evidencia /tmp/diomedes-switch-h59-20261105T200107Z-result.json.

Usuario confirmó lecturas H59 después de pulsar Medir todo.
Se aprueba la obtención manual de lecturas tras el cambio; no inferir
actualización automática sin esa acción. Se comprueba si la marca de FC
sigue renovándose al terminar la secuencia, antes del retorno a R88.

Usuario confirmó que la marca de FC H59 sigue refrescando sin volver
a pulsar Medir todo al terminar la secuencia. Actualización automática
posterior al disparo manual confirmada; no equivale a confirmar inicio
automático desde la primera conexión sin Medir todo.
Se inicia retorno H59→R88, baseline /tmp/diomedes-switch-r88-20261105T200355Z-baseline.json.

### Retorno H59→R88

Usuario confirmó R88 conectado y batería visible. Diario a2026-11-05T20:04:57.808730+00:00:
[["E0CE868C-34E9-4D0F-DCA5-7E977E8B649B", 1, 0]]; dos suscripciones YCBT (C1/C3), H59 ausente
de captura; descartes/pendientes cero. Evidencia /tmp/diomedes-switch-r88-20261105T200355Z-result.json.
Lectura R88 nueva tras el retorno pendiente.

## Cierre de switching

Usuario confirmó FC nueva tras H59→R88. Captura final: solo R88 habilitado,
dos suscripciones, cero descartes/pendientes; no aparece una nueva conexión
H59 después de iniciar el cambio. Resultado R88→H59→R88 aprobado para
selección, conexión y lecturas. H59 renueva FC automáticamente después de
Medir todo; inicio automático sin esa acción no se afirmó.

La captura nativa se aisló por dispositivo en los dos cambios observados.
No se verificó fusión clínica/estadística entre dispositivos ni precisión
médica; no es soporte simultáneo. La prueba larga no se declara aprobada: el
usuario dispensó repetirla y la última caída coincidió con salir de rango.
Los resultados y límites históricos se conservan arriba.

Validación del código: suite completa1335/163 archivos antes del ajuste de
lista;29 verificaciones focalizadas de compatibilidad/descubrimiento/página
después de filtrar normal y priorizar compatibles. Lint, i18n, sync producción,
release:check y build iPhone firmado aprobados. Build actualizado instalado
con https://erp.coppadresd.com. Cambios locales en
feat/diomedes-r88-dual-wearable-e2e; no commit/push/merge nuevo solicitado.

### Verificación final del alcance acordado

Suite completa sobre el estado final, incluido filtro/orden de lista:
1335 pruebas/163 archivos aprobados. git diff --check, parche BLE aplicado
y release:check aprobados. Build firmado prod instalado previamente.
Listo para commit/PR/revisión del alcance switching; sin commit/push/merge
nuevo. Ensayos30min dispensados por usuario, no aprobados por medición.
