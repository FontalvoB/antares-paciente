# Checklist de diseño e implementación — Apple Health / Health Connect (1.0)

> Marcar con evidencia (captura, log, commit o test). Referencias: estados en UX-FLOW §3, copy
> en COPY-ES-EN, revisión en APP-REVIEW-HEALTH. Matriz mínima de dispositivos: iPhone SE/13 mini
> (320–375 pt), iPhone 15 (390 pt), iPad Air 11" (iPadOS 17+), Android 13 (Health Connect app),
> Android 14/15 (Health Connect del sistema).

## 1. Estados (cada uno con captura ES y EN)

- [ ] `unsupported` en web/PWA y en dispositivo sin Salud: solo registro manual, sin errores en consola.
- [ ] `hc_missing` en Android 13 sin Health Connect: botón abre Play Store; al volver (resume) pasa a `available`.
- [ ] `hc_missing` con Health Connect desactualizado (requiere update).
- [ ] `available`: hero, diagrama, chips filtrados por plataforma, pasos 1-2-3, CTA, privacidad, enlace manual.
- [ ] Pre-permiso: lista de tipos = tipos realmente solicitados al plugin (sin extras).
- [ ] "Ahora no" en pre-permiso → toast y vuelta al origen; Home no re-pregunta en 14 días.
- [ ] iOS tras permitir todo → `syncing` → `success` con datos.
- [ ] iOS tras denegar todo → `syncing` → `no_data_ios` (no se muestra "denegado": HealthKit no lo revela).
- [ ] iOS permiso parcial (solo pasos) → `success` mostrando solo pasos; resto de tarjetas en vacío neutro.
- [ ] Android permitir → `success`; denegar → `denied_android`.
- [ ] Android denegar dos veces → "Intentar de nuevo" oculto; "Abrir Health Connect" funciona.
- [ ] `no_data_android` con permiso concedido y Health Connect vacío.
- [ ] `revoked`: Android, quitar permisos desde Health Connect y volver → estado revocado. iOS: desactivar en Ajustes → cae en `no_data_ios`.
- [ ] `error`: simular excepción/timeout (> 15 s) → mensaje + Reintentar; error registrado en logs **sin valores de salud**.
- [ ] `success` muestra "Última lectura" relativa y origen si el plugin lo expone `[[CONFIRMAR]]`.
- [ ] Android: aviso "Verás datos desde {date}" coherente con el límite de ~30 días.

## 2. Permisos y plataforma

- [ ] iOS: entitlement HealthKit activo en el App ID y en `App.entitlements`; capability en Xcode. `[[CONFIRMAR: codex]]`
- [ ] iOS: `NSHealthShareUsageDescription` presente y localizado (COPY §9).
- [ ] iOS: `NSHealthUpdateUsageDescription` ausente salvo que el plugin la exija; si existe, ningún tipo de escritura solicitado.
- [ ] iOS: no se solicitan Clinical Records ni tipos fuera de D2.
- [ ] Android: permisos `android.permission.health.READ_*` solo para los tipos de D2; ningún `WRITE_*`; sin `READ_HEALTH_DATA_IN_BACKGROUND` ni `READ_HEALTH_DATA_HISTORY`.
- [ ] Android: activity de rationale / `VIEW_PERMISSION_USAGE` muestra la política (COPY §10).
- [ ] Android: `<queries>` para el paquete de Health Connect si el plugin no lo añade. `[[CONFIRMAR]]`
- [ ] Android: minSdk compatible con Health Connect (API 28+) y con el plugin. `[[CONFIRMAR]]`
- [ ] La solicitud de permiso solo ocurre tras gesto del usuario (nunca al arrancar).

## 3. Datos, sync y batería

- [ ] Lectura solo en: entrada a la pantalla, resume con la pantalla/Home visible (debounce 2 s) y "Actualizar".
- [ ] Una sola lectura en vuelo; tocar "Actualizar" repetidamente no duplica peticiones ni registros.
- [ ] Pasos/distancia/energía usan agregación del sistema (sin doble conteo iPhone + reloj/anillo). `[[CONFIRMAR: API del plugin]]`
- [ ] Prueba de doble fuente: iPhone + Apple Watch con pasos el mismo día → total igual al de la app Salud.
- [ ] Si se envía al backend: clave idempotente; reenviar el mismo rango no duplica. `[[CONFIRMAR: backend / metrics-outbox]]`
- [ ] Ventana de lectura acotada (hoy + 7 días) e incremental desde última marca.
- [ ] Sin timers ni polling en segundo plano; consumo de batería sin cambios apreciables en 30 min de uso (Xcode Energy Log / Android Battery Historian, lectura cualitativa).
- [ ] Unidades según locale (km/mi, kcal) y zona horaria del dispositivo; sueño que cruza medianoche se asigna a "anoche".
- [ ] Datos de HealthKit no se escriben en iCloud/CloudKit ni en backups gestionados por la app.
- [ ] Payload del chat IA no incluye métricas de HealthKit/Health Connect (D10). `[[CONFIRMAR]]`

## 4. i18n y copy

- [ ] Todas las cadenas con `t()`; claves en `es.json` y `en.json`; `npm run i18n:check` en verde.
- [ ] Sin "HealthKit" visible al usuario; "Apple Health"/"app Salud" en iOS, "Health Connect" en Android.
- [ ] Ninguna cadena iOS visible en Android ni viceversa.
- [ ] Búsqueda en `src/` de copy nuevo: sin "médic", "clínic", "diagnós", "tratamiento", "medir", "paciente" (salvo negaciones aprobadas).
- [ ] Sin nombres de hardware (H59, R88, "Bluetooth") en la UI de 1.0.
- [ ] Textos largos en EN y ES no truncan botones a 320 px.
- [ ] Fechas relativas con `Intl.RelativeTimeFormat` en el idioma activo.

## 5. Accesibilidad

- [ ] VoiceOver (iOS) y TalkBack (Android): orden de lectura hero → chips → pasos → CTA → privacidad → manual.
- [ ] Foco inicial en el título; foco vuelve al disparador al cerrar el sheet de pre-permiso.
- [ ] `aria-live="polite"` anuncia sincronizando/éxito; `role="alert"` en error; resume no roba foco.
- [ ] Diagrama con `role="img"` + etiqueta; flechas `aria-hidden`.
- [ ] Stepper como `<ol>` con `aria-current="step"`.
- [ ] Chips: radiogroup (o IonSegment) con estado seleccionado anunciado; objetivos táctiles ≥ 44×44.
- [ ] Contraste AA: texto blanco sobre todo el gradiente del hero; estados con icono + texto, no solo color.
- [ ] Texto a 200 % (Dynamic Type / escala de fuente Android) sin solapes ni CTA cortados.
- [ ] `prefers-reduced-motion: reduce`: sin pulso del diagrama ni count-up; transiciones ≤ 150 ms de opacidad.
- [ ] Teclado/switch control: todos los elementos alcanzables y activables.

## 6. Responsive

- [ ] 320 px: chips en scroll-x con indicador, diagrama con etiquetas apiladas, sin scroll horizontal de página.
- [ ] 390 px: layout de referencia (capturas para revisión).
- [ ] 768 px / iPad vertical y horizontal: contenido centrado ≤ 560 px; sheet de pre-permiso no ocupa ancho completo.
- [ ] Safe areas (notch, home indicator, barra de gestos Android) respetadas.
- [ ] Teclado no aplica (no hay inputs); split view en iPad sin romper layout.

## 7. Visual y motion

- [ ] Solo tokens existentes (`--wellness-*`, `--brand-*`, `--grad-brand-v`, `--teal-l/--teal-d`); sin hex nuevos.
- [ ] Space Grotesk en títulos, Inter en cuerpo; Ionicons.
- [ ] Componentes Ionic para botones, chips/segment, listas, sheet, toast, progress (regla Ionic-first).
- [ ] Sin logotipos de terceros salvo assets y guías oficiales `[[CONFIRMAR]]`.
- [ ] Dark mode: no existe en la app; verificar que el modo oscuro del sistema no rompe contraste (la app fuerza claro).
- [ ] Skeletons en el resumen durante `syncing`; sin spinner central.
- [ ] Haptic ligero solo en éxito.
- [ ] Revisión visual con el subagente `vision-reviewer` sobre capturas 320/390/768.

## 8. Entradas y navegación

- [ ] Home "Conectar" abre la pantalla nueva (no `WearablePage` BLE).
- [ ] Home muestra "Conectado" y origen cuando hay datos; estado vacío con "Registrar a mano" primero.
- [ ] Perfil > "Accesorio y datos de bienestar" abre la pantalla en modo gestión.
- [ ] "Registrar a mano" lleva al registro manual existente `[[CONFIRMAR: destino]]`.
- [ ] Back nativo (gesto iOS / botón Android) vuelve al origen correcto.

## 9. Build de revisión (bloqueante antes de enviar)

- [ ] `WearablePage` BLE inaccesible desde cualquier entrada; plugin BLE no se inicializa; no aparece diálogo de Bluetooth en ningún flujo.
- [ ] `Info.plist` sin `NSBluetoothAlwaysUsageDescription`/`NSBluetoothPeripheralUsageDescription` y sin `UIBackgroundModes` `bluetooth-central` `[[CONFIRMAR: si el plugin BLE sigue enlazado, Apple puede exigir la clave; decidir con codex]]`.
- [ ] Prueba en iPad Air (dispositivo del rechazo) con y sin datos en Salud.
- [ ] Prueba del guion "HOW TO TEST" de APP-REVIEW-HEALTH §3 en build de TestFlight, en inglés.
- [ ] Metadatos ASC, capturas y etiquetas de privacidad actualizados (APP-REVIEW-HEALTH §5 y §7).
- [ ] `npm run build`, `npm run lint`, `npm run test`, `npm run i18n:check` en verde.
- [ ] Tests unitarios de la máquina de estados (cada transición de UX-FLOW §3) y del mapeo de errores del plugin.
