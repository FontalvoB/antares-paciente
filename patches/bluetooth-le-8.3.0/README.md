# Extensión nativa BLE de Antares

Extiende `@capacitor-community/bluetooth-le` **8.3.0** (MIT, [upstream](https://github.com/capacitor-community/bluetooth-le)). El parche conserva el transporte existente: no crea otro cliente GATT para un dispositivo ya conectado.

`npm install` / `yarn install` ejecutan `scripts/apply-bluetooth-patches.mjs`. El script valida versión y SHA-256 del código upstream antes de aplicar los cambios. Una segunda ejecución no modifica nada. Para verificar: `npm run native:ble:check`. No usar `--ignore-scripts` en builds nativos. Si se cambia de versión del parche con `node_modules` instalado, reinstalar ese paquete; el instalador rechaza archivos previamente modificados que no corresponden al parche actual.

La configuración actual de la app usa permiso Bluetooth general: no declara
`NSAccessorySetupKitSupports`. Los métodos ASK siguientes devuelven
`supported: false` en ese modo y no activan sesiones ni pickers. La búsqueda
normal conserva un único botón y lista todos los anuncios BLE entregados por
el sistema. La captura background ordinaria y SQLite siguen activos; no se
promete relanzamiento tras force-quit mediante ASK en este modo.

## Contrato del plugin `BluetoothLe`

- `accessoryCapabilities()` (iOS): informa disponibilidad de AccessorySetupKit sin iniciar Core Bluetooth.
- `selectAccessory()` (iOS): alta explícita mediante `ASPickerDisplayItem` para H59 y R88. No requiere un UUID previo y no usa la ruta de migración. Devuelve `{supported, devices}`; cancelar devuelve lista vacía. Se espera al cierre del picker y al estado autorizado. La app lista el resultado para una conexión posterior; la búsqueda no inicia captura. Cerrar el picker conserva los accesorios autorizados, sin esperar al radio ni al handshake GATT.
- `authorizedAccessories()` (iOS): devuelve los accesorios autorizados persistidos por iOS, incluidos los desconectados, sin escaneo ni picker. Los iOS anteriores a 18 devuelven `supported: false` para conservar el listado Bluetooth previo. La app sigue conservando un solo wearable activo por cuenta.

- `setupAccessory({deviceId, name, kind})` (iOS): solicita autorización mediante AccessorySetupKit solo por una acción manual. Migra exclusivamente el UUID seleccionado de H59 (`colmi`) o R88 (`ycbt`); un accesorio ya autorizado no presenta otro picker. Devuelve `{supported, authorized}`; antes de iOS 18 devuelve `supported: false`, y cancelar devuelve `authorized: false`. Nunca llamarlo en una reconexión automática.
- `startBackground({deviceId, ownerId, automatic?})`: habilita captura para el propietario; requiere permisos BLE y, en Android, iniciarse desde foreground. Un cambio de propietario elimina los datos y suscripciones anteriores del dispositivo. En Android, `automatic: true` respeta una acción **Detener** previa; solo una conexión manual (`automatic: false`) vuelve a habilitarla.
- `stopBackground({deviceId, forget})`: deja de capturar. `forget: true` elimina asociación, suscripciones y diario. Invocar antes de desconectar intencionalmente o cerrar sesión.
- `getPendingNotifications({deviceId, ownerId, limit, afterSequence?})`: lectura NO destructiva, en orden de llegada. Devuelve `{notifications, droppedCount, lastError?, stoppedByUser?}`. Cada registro incluye `{id, sequence, deviceId, service, characteristic, value, receivedAt}`; `value` es hexadecimal y `receivedAt` son milisegundos Unix. `sequence` es el cursor decimal durable de la fila; pasarlo como `afterSequence` permite avanzar aun con otras filas pendientes. No usar el UUID `id` como cursor. La migración SQLite v1→v2 conserva las filas/suscripciones pendientes.
- `ackNotifications({deviceId, ownerId, ids})`: borra exclusivamente los IDs confirmados por JS **después** de persistir las muestras. Leer o confirmar con otro propietario falla.

El diario SQLite guarda cada notificación antes del callback al WebView. El callback existente despierta al consumidor; los bytes se leen exclusivamente del diario para evitar duplicación. El límite es **20.000 notificaciones por dispositivo**, con contador persistente de descartes. Los errores de escritura aparecen en `lastError`; no deben confundirse con una garantía de conservación. No se registran bytes de salud en logs nativos.

## Comportamiento y límites

- Al inicializar iOS, se activa primero la sesión ASK y se consulta su autorización antes de crear Core Bluetooth. `isEnabled` espera hasta tres segundos a `poweredOn` en lugar de interpretar un estado inicial/transitorio como radio apagado. JS distingue `bluetooth-not-ready` de `bluetooth-off`; la UI conserva Agregar wearable cuando todavía no hay un accesorio autorizado. Los listados nativos iniciales se comparten para evitar dos activaciones simultáneas.

- En la conexión manual iOS, el manager de Core Bluetooth de la búsqueda se libera antes de activar AccessorySetupKit. Detener el escaneo no basta: en el iPhone real el sistema rechazaba el picker con `still have pending CBManagers 1`, aunque Bluetooth estuviera permitido. El handoff rechaza enlaces todavía activos, conserva el diario y su propietario, y reconstruye el manager y el periférico al terminar o cancelar. Las llamadas BLE concurrentes reciben un error de operación en curso; los fallos del picker no se presentan como permiso global denegado.
- Una migración silenciosa puede autorizar H59 sin mostrar picker ni emitir su cierre. Se resuelve al completar la migración o la operación y comprobar el UUID autorizado; si hay picker visible se espera su cierre. Un watchdog de 45 segundos invalida una autorización atascada antes de reconstruir Core Bluetooth.

- iOS: `bluetooth-central`, identificador de restauración estable y reconstrucción temprana desde AppDelegate cuando Core Bluetooth relanza la app. Los periféricos y delegados restaurados retoman notificaciones y las guardan sin depender del WebView. El diario está excluido de backups y disponible tras el primer desbloqueo.
- Android: foreground service `connectedDevice`, notificación persistente con acción **Detener**, `stopWithTask=false`, conexiones retenidas fuera de Activity y reconexión con suscripciones recordadas. El intento nativo y el de JS comparten el mismo objeto de conexión.
- La reconexión nativa recupera GATT y suscripciones; la negociación específica de H59/R88 y la descarga de historial se verifican de nuevo al abrir la app. No se reproducen comandos antiguos de reloj/autenticación.
- iOS 26 permite el relanzamiento elegible tras swipe/force quit para accesorios autorizados con AccessorySetupKit y solicitudes Bluetooth pendientes; no es una conexión ininterrumpida garantizada. En versiones anteriores, una app forzada a cerrar necesita reapertura manual. Véanse [TN3115 de Apple](https://developer.apple.com/documentation/technotes/tn3115-bluetooth-state-restoration-app-relaunch-rules) y [migración de accesorios](https://developer.apple.com/videos/play/wwdc2024/10203/).
- Android Force Stop y la acción **Detener** se respetan; la optimización del fabricante también puede impedir ejecución continua. Los textos de la notificación usan recursos nativos en inglés/español según el idioma del sistema.
- Ni un servicio ni un diario recuperan una muestra que el teléfono nunca recibió: los huecos de radio necesitan historial en el dispositivo.

## Verificación

Android: `JAVA_HOME=<JDK21> ANDROID_HOME=<SDK> ./gradlew :app:assembleDebug` desde `android/`. Las pruebas de diario (propietario, confirmación, reapertura, cursor, migración y parada explícita) viven en el parche bajo `android/src/androidTest`; ejecutar `./gradlew :capacitor-community-bluetooth-le:connectedDebugAndroidTest` con emulador/dispositivo. No usan BLE real.

iOS requiere Xcode/macOS para compilar y dispositivos físicos para validar BLE. Probar ambos modelos con pantalla bloqueada, cambio de app, swipe, pérdida de rango, Bluetooth apagado/encendido, reinicio de proceso y descarga de historial sin duplicados.


### Estado de radio iOS

getBluetoothState devuelve on/off/unknown/resetting/unauthorized/unsupported
a partir del CBCentralManager actual. initialize no exige poweredOn en la
configuración general: permite registrar cambios con Bluetooth apagado y
conserva los rechazos reales de permisos. isEnabled mantiene su contrato booleano;
JS consulta el estado completo para no confundir inicialización con poweredOff.
