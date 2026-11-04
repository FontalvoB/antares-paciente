# Extensión nativa BLE de Antares

Extiende `@capacitor-community/bluetooth-le` **8.3.0** (MIT, [upstream](https://github.com/capacitor-community/bluetooth-le)). El parche conserva el transporte existente: no crea otro cliente GATT para un dispositivo ya conectado.

`npm install` / `yarn install` ejecutan `scripts/apply-bluetooth-patches.mjs`. El script valida versión y SHA-256 del código upstream antes de aplicar los cambios. Una segunda ejecución no modifica nada. Para verificar: `npm run native:ble:check`. No usar `--ignore-scripts` en builds nativos. Si se cambia de versión del parche con `node_modules` instalado, reinstalar ese paquete; el instalador rechaza archivos previamente modificados que no corresponden al parche actual.

## Contrato del plugin `BluetoothLe`

- `setupAccessory({deviceId, name, kind})` (iOS): solicita autorización mediante AccessorySetupKit solo por una acción manual. Migra exclusivamente el UUID seleccionado de H59 (`colmi`) o R88 (`ycbt`); un accesorio ya autorizado no presenta otro picker. Devuelve `{supported, authorized}`; antes de iOS 18 devuelve `supported: false`, y cancelar devuelve `authorized: false`. Nunca llamarlo en una reconexión automática.
- `startBackground({deviceId, ownerId, automatic?})`: habilita captura para el propietario; requiere permisos BLE y, en Android, iniciarse desde foreground. Un cambio de propietario elimina los datos y suscripciones anteriores del dispositivo. En Android, `automatic: true` respeta una acción **Detener** previa; solo una conexión manual (`automatic: false`) vuelve a habilitarla.
- `stopBackground({deviceId, forget})`: deja de capturar. `forget: true` elimina asociación, suscripciones y diario. Invocar antes de desconectar intencionalmente o cerrar sesión.
- `getPendingNotifications({deviceId, ownerId, limit, afterSequence?})`: lectura NO destructiva, en orden de llegada. Devuelve `{notifications, droppedCount, lastError?, stoppedByUser?}`. Cada registro incluye `{id, sequence, deviceId, service, characteristic, value, receivedAt}`; `value` es hexadecimal y `receivedAt` son milisegundos Unix. `sequence` es el cursor decimal durable de la fila; pasarlo como `afterSequence` permite avanzar aun con otras filas pendientes. No usar el UUID `id` como cursor. La migración SQLite v1→v2 conserva las filas/suscripciones pendientes.
- `ackNotifications({deviceId, ownerId, ids})`: borra exclusivamente los IDs confirmados por JS **después** de persistir las muestras. Leer o confirmar con otro propietario falla.

El diario SQLite guarda cada notificación antes del callback al WebView. El callback existente despierta al consumidor; los bytes se leen exclusivamente del diario para evitar duplicación. El límite es **20.000 notificaciones por dispositivo**, con contador persistente de descartes. Los errores de escritura aparecen en `lastError`; no deben confundirse con una garantía de conservación. No se registran bytes de salud en logs nativos.

## Comportamiento y límites

- iOS: `bluetooth-central`, identificador de restauración estable y reconstrucción temprana desde AppDelegate cuando Core Bluetooth relanza la app. Los periféricos y delegados restaurados retoman notificaciones y las guardan sin depender del WebView. El diario está excluido de backups y disponible tras el primer desbloqueo.
- Android: foreground service `connectedDevice`, notificación persistente con acción **Detener**, `stopWithTask=false`, conexiones retenidas fuera de Activity y reconexión con suscripciones recordadas. El intento nativo y el de JS comparten el mismo objeto de conexión.
- La reconexión nativa recupera GATT y suscripciones; la negociación específica de H59/R88 y la descarga de historial se verifican de nuevo al abrir la app. No se reproducen comandos antiguos de reloj/autenticación.
- iOS 26 permite el relanzamiento elegible tras swipe/force quit para accesorios autorizados con AccessorySetupKit y solicitudes Bluetooth pendientes; no es una conexión ininterrumpida garantizada. En versiones anteriores, una app forzada a cerrar necesita reapertura manual. Véanse [TN3115 de Apple](https://developer.apple.com/documentation/technotes/tn3115-bluetooth-state-restoration-app-relaunch-rules) y [migración de accesorios](https://developer.apple.com/videos/play/wwdc2024/10203/).
- Android Force Stop y la acción **Detener** se respetan; la optimización del fabricante también puede impedir ejecución continua. Los textos de la notificación usan recursos nativos en inglés/español según el idioma del sistema.
- Ni un servicio ni un diario recuperan una muestra que el teléfono nunca recibió: los huecos de radio necesitan historial en el dispositivo.

## Verificación

Android: `JAVA_HOME=<JDK21> ANDROID_HOME=<SDK> ./gradlew :app:assembleDebug` desde `android/`. Las pruebas de diario (propietario, confirmación, reapertura, cursor, migración y parada explícita) viven en el parche bajo `android/src/androidTest`; ejecutar `./gradlew :capacitor-community-bluetooth-le:connectedDebugAndroidTest` con emulador/dispositivo. No usan BLE real.

iOS requiere Xcode/macOS para compilar y dispositivos físicos para validar BLE. Probar ambos modelos con pantalla bloqueada, cambio de app, swipe, pérdida de rango, Bluetooth apagado/encendido, reinicio de proceso y descarga de historial sin duplicados.
