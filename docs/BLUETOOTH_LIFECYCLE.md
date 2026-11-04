# Bluetooth: H59_E206 y R88 C1BF

La app conserva un wearable activo por paciente. La banda usa el driver Colmi
y el anillo el driver YCBT existentes; sus parsers y comandos se mantienen.
La identidad, las muestras y los acumulados se separan por cuenta y dispositivo.

## Captura y apertura

1. Una conexión manual puede autorizar el accesorio con AccessorySetupKit en
   iOS 18 o posterior. La migración se limita al UUID elegido. Cancelar no
   inicia captura; una reconexión automática nunca presenta ese selector.
2. Antes de suscribir se activa la captura nativa para la cuenta actual.
   SQLite guarda cada notificación antes de despertar al WebView.
3. JS lee el diario sin borrarlo y decodifica usando la hora original de
   recepción. Los fragmentos quedan pendientes hasta completar la trama.
4. Las muestras se escriben en almacenamiento local antes del ACK nativo.
   Los ACK se agrupan en lotes de hasta 1.000 IDs. Una escritura fallida
   conserva los datos pendientes para reintentar.
5. Al abrir, el resumen muestra inmediatamente los valores locales con fecha
   y hora de captura. La conexión se restablece y se descarga el historial
   del dispositivo para recuperar huecos. Un valor guardado no indica que
   exista conexión en vivo.

Recrear el WebView desacopla los consumidores JS, sin detener la captura
nativa. Cambiar de cuenta o cerrar sesión sí detiene la captura y elimina la
asociación nativa. Desconectar explícitamente olvida el vínculo automático;
las muestras ya normalizadas permanecen en la caché privada de esa cuenta.
Un fallo transitorio no olvida el dispositivo ni vacía las tarjetas.
Un vínculo de una versión anterior sin cuenta asociada requiere seleccionarlo
una vez: no se atribuye automáticamente al paciente que esté usando el teléfono.

El control de conexión espera al cierre de la sesión anterior y al resultado
de cada intento antes del siguiente. El backoff llega a 120 segundos y continúa
mientras la app esté activa. El adaptador encendido y el regreso a foreground
reinician la recuperación. Las tareas de otra sesión o cuenta no pueden
publicar datos ni liberar el candado de una operación nueva.

## Comportamiento de cada plataforma

- **Android:** servicio foreground `connectedDevice`, notificación persistente,
  `stopWithTask=false`, GATT retenido fuera de Activity y recuperación nativa
  de suscripciones. La acción **Detener** se conserva: solo una reconexión
  manual vuelve a habilitarla. Force Stop y las restricciones del fabricante
  pueden impedir que el proceso se reinicie por sí solo.
- **iOS en background:** `bluetooth-central`, identificador estable de Core
  Bluetooth y restauración nativa temprana desde AppDelegate. Las
  notificaciones se guardan aunque el WebView esté suspendido.
- **iOS después de swipe:** la restauración ordinaria no garantiza relanzar
  una app terminada por el usuario. En iOS 26 o posterior, los accesorios
  configurados con AccessorySetupKit pueden ser elegibles para relanzamiento
  si existe trabajo Bluetooth pendiente y llega el evento correspondiente.
  La autorización no concede ejecución continua ni garantiza radio permanente.
  iOS anteriores necesitan volver a abrir la app y recuperar el historial.

Referencias: [Apple TN3115](https://developer.apple.com/documentation/technotes/tn3115-bluetooth-state-restoration-app-relaunch-rules),
[configuración de accesorios](https://developer.apple.com/documentation/accessorysetupkit/discovering-and-configuring-accessories),
[Android BLE en background](https://developer.android.com/develop/connectivity/bluetooth/ble/background).

## Retención y recuperación

- Diario nativo: 20.000 notificaciones por dispositivo, con contador de
  descartes y errores de escritura observables. La app solicita recuperación
  de historial ante un hueco informado por el diario.
- Caché normalizada: 4.096 muestras o siete días. El último valor de cada
  métrica se conserva aparte. Los acumulados diarios retienen 30 días y sus
  claves de deduplicación.
- Los acumulados pendientes de actividad y sueño se reconstruyen desde la
  caché y se reintentan con el endpoint existente `program/me/device-metrics`,
  con su fecha original, incluso tras reiniciar o recuperar la red.
- Los volcados de historial que ocupan varias tramas pueden interrumpirse
  antes de terminar la decodificación. Se vuelven a solicitar al dispositivo;
  el diario no sustituye su protocolo de historial.

El teléfono no puede recuperar una muestra que nunca recibió si el firmware
no la conserva. Hay que comprobar en cada modelo qué métricas registra sin
conexión, su frecuencia y cuántos días retiene. La reconexión nativa restablece
GATT y suscripciones; la negociación específica y los volcados se reafirman
desde el driver al volver a foreground.

## Construcción y validación

El plugin está fijado a 8.3.0. `postinstall` aplica un parche con hashes
verificados; no depende de cambios manuales en `node_modules`. Ver contrato y
mantenimiento en [el parche](../patches/bluetooth-le-8.3.0/README.md).
`npm run native:ble:check` falla si falta aplicarlo.

Se verificaron pruebas de transporte, parsers, replay, almacenamiento, ingesta
y lifecycle; build de producción, lint, i18n y guardas de release. Android
compiló y sus seis pruebas instrumentadas de SQLite pasaron en Android 17.
La suite completa tiene un fallo ajeno a Bluetooth en
`NotificationsModal.test.tsx`: el fixture de hace tres días puede caer en la
semana anterior y el test espera siempre «Esta semana».

**Pendiente antes de distribuir:** compilar/archivar iOS con Xcode en macOS y
ejecutar con hardware real, para cada wearable, estos escenarios:

- Conectar desde instalación limpia; repetir conexión y registrar tiempo
  hasta la primera lectura. Cancelar permisos y reintentar.
- Bloquear pantalla y usar otras apps durante al menos 30 minutos; comprobar
  marcas originales al volver y ausencia de duplicados.
- Swipe con Android y con iOS 26 autorizado mediante AccessorySetupKit;
  verificar el diario y las condiciones reales de relanzamiento.
- Alejar/apagar el wearable, volver a rango y comprobar reconexión e historial.
- Apagar/encender Bluetooth, recrear proceso y abrir sin red; recuperar red y
  comprobar los acumulados del día correcto, también tras medianoche.
- Detener desde la notificación Android y verificar que no vuelve a capturar
  hasta reconectar manualmente. Comprobar cierre/cambio de cuenta sin mezcla.

El emulador validó almacenamiento nativo; no validó radio, sensores ni firmware.
