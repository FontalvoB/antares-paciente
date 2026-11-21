# Revisión UX / copy / estados — integración Apple Health / Health Connect

> Revisión estática del working tree (sin commit) del 2026-11-21, contrastada con
> [UX-FLOW.md](UX-FLOW.md), [COPY-ES-EN.md](COPY-ES-EN.md) y
> [CHECKLIST-IMPLEMENTACION.md](CHECKLIST-IMPLEMENTACION.md). No se ejecutó la app ni los tests;
> no se editó código. Las líneas citadas corresponden al estado actual sin commit y pueden
> desplazarse.

## Resumen

| Área                                    | Semáforo    | Comentario                                                                                                                                                                                     |
| --------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flujo iOS (permiso opaco, vacío, éxito) | 🟢 Verde    | El estado `unknown` está bien modelado; iOS nunca dice "denegado". `toShare: []`: la afirmación "solo lectura" es verdadera.                                                                   |
| Flujo Android                           | 🟡 Amarillo | Falta tratar la doble denegación y la denegación parcial; la activity de rationale no está verificada.                                                                                         |
| Mapeo de datos                          | 🔴 Rojo     | El sueño se parte en la medianoche y se guarda en el backend por día calendario; no hay garantía de que el día local del cliente coincida con el del servidor.                                 |
| Copy / App Review                       | 🟡 Amarillo | Las cadenas `NSBluetooth*` siguen diciendo "conectarse a tu anillo". El aviso de IA ya declara datos de salud, pero los documentos de revisión y la política dicen lo contrario.               |
| a11y / responsive                       | 🟢/🟡       | Base correcta (foco inicial, aria-live, 44 px, safe areas). Detalles menores en los chips, el `dl` a 320 px y la jerarquía de headings.                                                        |
| i18n                                    | 🟢 Verde    | Las 223 claves usadas (incluidas las dinámicas `t(label)`/`t(purpose)`) existen en es/en.                                                                                                      |
| Sync / persistencia                     | 🟢/🟡       | Guard de lectura en vuelo, fingerprint por día, sesión ligada a `userId` y abort al invalidar la sesión: correcto. Riesgos: zona horaria, bucle de `save-failed` sin inscripción, rendimiento. |

**Veredicto:** apto para TestFlight interno. **No enviar a revisión** sin resolver H1, H2 y H3 y
sin pasar las pruebas manuales P1–P6.

---

## Hallazgos

### 🔴 Altos

**H1 — El sueño se reparte entre dos días y se guarda mal en el backend**
`src/services/health/health-service.ts:193` y `:214-236`, `:244`.
Una noche de 23:00 a 07:00 queda como 1 h en el día A y 7 h en el día B. Así, "hoy" muestra solo
la parte después de medianoche y "ayer" mezcla dos noches. `healthDeviceMetrics` envía ese
`sleepMinutes` por día calendario, mientras que el backend documenta que el valor del día es "el
sueño de la última sesión" (`RecordDeviceMetricsCommand.cs:84-90`). Resultado: el historial y la
UI subestiman o mezclan noches.
**Recomendación:** atribuir cada sesión (o la unión de intervalos de una misma noche) al **día
local de su fin** (día en que despierta) y no recortar por medianoche. Para la ventana, leer desde
`from − 18 h`. En UI: "Sueño de anoche" con formato `7 h 12 min`. Añadir tests: noche que cruza
medianoche, siesta y dos fuentes solapadas.

**H2 — Las cadenas Bluetooth del binario contradicen "1.0 no se conecta a hardware"**
`ios/App/App/Info.plist:31-34`, `ios/App/App/{es,en}.lproj/InfoPlist.strings:2-3`.
`@capacitor-community/bluetooth-le` sigue en `package.json` y las cadenas dicen "conectarse a tu
anillo o banda… leer tu frecuencia cardíaca". El revisor de 1.4.1 lee el plist. Además, el
documento de revisión no puede afirmar "sin Bluetooth" si el plugin sigue enlazado.
**Recomendación (en orden de preferencia):**
(a) excluir el plugin BLE del build iOS 1.0 (`ios.includePlugins` en `capacitor.config.ts`, o
quitar la dependencia en la rama de release) y eliminar `NSBluetooth*`;
(b) si no es viable, reescribir las cadenas de forma neutra y verdadera, sin anillo ni métricas
(ver "Textos que deben cambiar") y, en la nota al revisor, decir "la app no se conecta a
accesorios en 1.0; el código Bluetooth está inactivo" en lugar de "se eliminó Bluetooth".

**H3 — Contradicción sobre la IA entre la app y los documentos**
`src/context/AiDisclosureContext.tsx:208-210` declara que Vita puede recibir pasos, distancia,
energía activa y sueño. Es una buena práctica bajo 5.1.2(i), y la versión del aviso pasó a
`2026-11-21-health` (fuerza un nuevo consentimiento). Pero `APP-REVIEW-HEALTH.md` §2/§6
(decisión D10) y el borrador de política dicen "no los enviamos a proveedores de IA".
**Recomendación:** decidir una sola verdad. Si se mantiene el envío: actualizar
APP-REVIEW-HEALTH §2/§3/§6/§8, `POLITICA-PRIVACIDAD-IA.md`, la política pública y las etiquetas
App Privacy ("Health & Fitness" compartido con terceros encargados). Confirmar además que la
frecuencia cardíaca **no** llega al backend ni a la IA (hoy no se persiste: correcto, lo dice el
copy del sheet en `HealthAccessoryPage.tsx:578`). Si no se quiere asumir el riesgo: filtrar los
códigos `device` del contexto de IA en el backend y retirar el párrafo.

### 🟡 Medios

**H4 — El día del cliente y el del servidor pueden no coincidir; el upsert puede sobrescribir otro día**
`health-service.ts:248` (`recordedAt` = punto medio del día local) y
`HealthContext.tsx:103-105`. El servidor calcula el día con `enrollment.Timezone` (UTC si es
nulo; `RecordDeviceMetricsCommand.cs:116-127`). Con zona del dispositivo ≠ zona de la inscripción
(viajes, o inscripción sin zona en JP/UTC+9 de madrugada), el POST **ya hizo commit** en otro día
antes de que el cliente detecte `persisted.date !== day.date`. Puede pisar el total del día
anterior con un parcial.
**Recomendación:** enviar la fecha local explícita (`date: "YYYY-MM-DD"` + `timezone` IANA) y
que el servidor la valide; o, como mínimo, que el cliente use la zona de la inscripción.
`[[CONFIRMAR: backend]]`. Test: dispositivo en Asia/Tokyo a las 01:30 con inscripción en
America/Bogota.

**H5 — Bucle de `save-failed` sin inscripción activa; la cuenta demo de revisión**
`HealthContext.tsx:94-110`. Un 404 `NO_ACTIVE_ENROLLMENT` (o cualquier fallo) se convierte en
"Leímos tus datos, pero faltan por guardar en el programa · Reintentar", indefinidamente. El
bucle de guardado también se corta en el primer día fallido.
**Recomendación:** mapear 404/403 a un estado propio sin reintento ("Tus datos se muestran aquí;
se guardarán cuando tu programa esté activo"), seguir con los días restantes y reintentar solo
errores transitorios. Verificar que la **cuenta demo de App Review tenga inscripción activa**:
el revisor no debe ver un error.

**H6 — Android: bucle "Autorizar de nuevo" tras dos denegaciones**
`HealthAccessoryPage.tsx:417-427`. Tras dos rechazos Health Connect deja de mostrar el diálogo:
el launcher vuelve al instante, el estado sigue en `denied` y el botón invita a repetir sin efecto.
**Recomendación:** contar las solicitudes por cuenta (como `copp.health-read-v1.*`). Tras la
segunda denegación, ocultar "Autorizar de nuevo" y promover "Abrir Health Connect" como CTA
principal, con el texto `hc.state.denied.body` + la ruta.

**H7 — Android: activity de rationale / `VIEW_PERMISSION_USAGE` no verificada**
`android/app/src/main/AndroidManifest.xml` (diff) no declara la activity ni el alias. El hook de
`@capacitor/health-fitness` añade permisos y `privacy_policy_url`, pero en `node_modules` no
aparece la activity. Puede venir de la librería nativa transitiva. Sin ella, en Android 14+ el
diálogo de permisos no aparece y Play rechaza la declaración.
**Recomendación:** revisar el manifest fusionado
(`android/app/build/intermediates/merged_manifest/release/...`) en busca de
`androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` y de un `activity-alias` con
`android.intent.action.VIEW_PERMISSION_USAGE` + categoría `android.intent.category.HEALTH_PERMISSIONS`.
Si faltan, añadirlos y que muestren COPY §10.

**H8 — iOS: ruta doble de lectura (plugin oficial + nativo) innecesaria y con riesgo semántico**
`health-service.ts:64-69`, `:151-180`. Para pasos, distancia, energía y FC primero se llama a
`HealthFitness.getData`, que en 1.0.3 exige autorización de **escritura** (error `0101` capturado)
o devuelve bloques que rara vez coinciden exactamente; después se usa el plugin nativo. Además,
`CALORIES_BURNED` podría corresponder a energía total (activa + basal), no a "Energía activa"
`[[CONFIRMAR]]`. Duplica las llamadas al bridge en cada sincronización.
**Recomendación:** en iOS usar solo `WellnessHealth.read` (ya usa `HKStatisticsQuery` con
deduplicación de fuentes). Mantener el plugin oficial solo donde aporte (abrir o desconectar
Health Connect en Android).

**H9 — Rendimiento de la sincronización**
`health-service.ts:192-209`: 5 métricas × 7 días + sueño ≈ 36 llamadas secuenciales (≈ 70 en
iOS por H8) en cada apertura y en cada resume. Riesgo de que "Sincronizando…" dure varios
segundos en dispositivos lentos.
**Recomendación:** una llamada por métrica con buckets diarios (`HKStatisticsCollectionQuery` /
`aggregateGroupByPeriod`), o `Promise.all` por métrica; lectura incremental (solo hoy y ayer en
resume).

**H10 — Home: "Conectar"/"Conectado" depende de haber visitado la pantalla en la sesión**
`HealthContext.tsx:134-146` (sync solo con `screen === "health-accessory"`) y
`HomePage.tsx:605-606`. Tras reabrir la app, un usuario ya autorizado ve "Conectar". Tras revocar
el permiso, sigue viendo "Conectado" hasta volver a la pantalla. No es falso en el sentido de App
Review, pero confunde.
**Recomendación:** basar la etiqueta en "permiso solicitado + última sincronización con datos"
(persistida por cuenta), o hacer una lectura ligera de estado al entrar en Home sin pedir permisos.

### 🟢 Bajos

| #   | Ubicación                                    | Hallazgo                                                                                                                                                                                        | Recomendación                                                                                                     |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| L1  | `HealthAccessoryPage.tsx:267-305`            | El hero ("Tus datos llegan… a través de Apple Health") se muestra también con `unavailable`: contradice el título "No disponible".                                                              | Renderizar el hero solo si `!unavailable`.                                                                        |
| L2  | `HealthAccessoryPage.tsx:226-229`            | `settings-failed` reemplaza el título y se pierde la guía de `no-data`/`denied`. `permission-unknown` dice "No pudimos comprobar el permiso", cuando en realidad falló la apertura del diálogo. | `settings-failed` → toast. Título: "No pudimos abrir la ventana de permisos de Salud".                            |
| L3  | `HealthContext.tsx:69-73`, Kotlin `:75-77`   | En Android, cualquier fallo de `requestRead` (incluido `busy`) se muestra como "No pudimos leer tus datos".                                                                                     | Mapear `busy` a no-op y el resto a "No pudimos abrir Health Connect".                                             |
| L4  | `HealthAccessoryPage.tsx` (estado `partial`) | En Android, el permiso parcial no se comunica.                                                                                                                                                  | Línea "Solo leemos las categorías que autorizaste" + "Gestionar permiso".                                         |
| L5  | `HealthAccessoryPage.tsx:376-404`            | "Frecuencia cardíaca" muestra el **promedio diario** sin decirlo; el sueño en `min` ("432 min").                                                                                                | "Frecuencia cardíaca promedio" / "Average heart rate"; sueño en `h min`.                                          |
| L6  | `HealthAccessoryPage.tsx:367-372`            | `IonChip` no interactivos parecen botones; duplican el sheet.                                                                                                                                   | Lista simple con iconos o eliminar (el sheet ya enumera los datos).                                               |
| L7  | `global.css:196`                             | `dl` en 2 columnas a 320 px: "Frecuencia cardíaca en reposo" ocupa 3 líneas.                                                                                                                    | `@media (max-width: 359px) { grid-template-columns: 1fr }`.                                                       |
| L8  | `HealthAccessoryPage.tsx:311-317`            | Los 3 pasos son `h2` del mismo nivel que el estado y "Registrar a mano": navegar por headings resulta ruidoso.                                                                                  | `h2` "Cómo conectarlo" + pasos como `h3`.                                                                         |
| L9  | `HealthAccessoryPage.tsx:352-365`            | Los errores se anuncian con `polite`.                                                                                                                                                           | `role="alert"` solo cuando `error` ∉ {`no-data`}.                                                                 |
| L10 | `HealthAccessoryPage.tsx:545`                | `authorizeButton.current?.focus()` sobre el host `ion-button`: el foco puede no llegar al botón nativo.                                                                                         | Verificar con VoiceOver/TalkBack; si falla, enfocar `shadowRoot.querySelector("button")` o el heading del estado. |
| L11 | `HealthAccessoryPage.tsx:469-473`            | Rama "Reintentar" inalcanzable (`native && !available && !install && !unavailable && !busy` no ocurre).                                                                                         | Eliminar.                                                                                                         |
| L12 | `HealthAccessoryPage.tsx:432`                | Indentación rota.                                                                                                                                                                               | Formatear.                                                                                                        |
| L13 | `WellnessHealthPlugin.kt:117-122`            | Las etapas `STAGE_TYPE_UNKNOWN` se descartan; una fuente que solo escribe UNKNOWN da 0 de sueño.                                                                                                | Si todas las etapas son UNKNOWN, tratar la sesión completa como sueño.                                            |
| L14 | `WellnessHealthPlugin.swift:88`              | `.strictStartDate` descarta muestras de pasos que empiezan antes de la medianoche.                                                                                                              | Aceptable; documentar.                                                                                            |
| L15 | `android/.../values/strings.xml:7`           | `background_notification_title` = "Measuring your health and fitness data." (inglés, "measuring", tres strings en una línea). Con `disableBackgroundJobs` no debería mostrarse.                 | Confirmar que no se usa; si el hook lo exige, texto neutro y localizado.                                          |
| L16 | `AndroidManifest.xml`                        | Siguen `BLUETOOTH_SCAN` y la ubicación (BLE).                                                                                                                                                   | Solo afecta a Play / Data safety; decidir con la estrategia 1.1.                                                  |
| L17 | i18n                                         | `t(label)`/`t(purpose)` no son detectables por `i18n:check`; hoy existen todas.                                                                                                                 | Mantener la lista `categories` con comentario o test que verifique las claves.                                    |
| L18 | Health Connect URL / política                | `privacyPolicyUrl` apunta a `diomedescerda.github.io`.                                                                                                                                          | Confirmar que es la misma URL de App Store Connect y Play y que contiene la sección HealthKit/Health Connect.     |

### Lo que está bien (no tocar)

- iOS: `requestAuthorization(toShare: [], read: …)` → la afirmación "solo lectura" es verdadera; `healthkit.access` vacío (sin Clinical Records).
- `getHealthPermission` devuelve `unknown` en iOS tras la solicitud; la UI de iOS nunca dice "denegado" y el vacío muestra las dos causas posibles.
- Android: solo permisos `READ_*` de los 6 tipos; `disableBackgroundJobs` y `disableReadHealthDataHistory` en `true`; `SCHEDULE_EXACT_ALARM` y `ACTIVITY_RECOGNITION` eliminados.
- Agregados del sistema (`HKStatisticsQuery` cumulativeSum / `aggregate`) → sin doble conteo iPhone + reloj.
- Concurrencia: `pending` evita lecturas dobles, resume con throttle de 2 s, `AbortController` al invalidar la sesión, `HealthSession` con `key=userId` (cambio de cuenta = estado limpio), flag "solicitado" por cuenta y plataforma, fingerprint por día para no repetir POST, invalidación de queries solo si hubo escritura.
- Solicitud de permiso solo tras gesto del usuario y pre-permiso con todas las categorías, su propósito y la política.
- `WEARABLE_ENABLED=false` en producción oculta "Conectar por Bluetooth"; `UIBackgroundModes` eliminado; `BluetoothLe.restoreBluetoothState` eliminado.
- Foco inicial en `h1`, botones ≥ 44 px, safe areas en header y scroll, sheet con `aria-labelledby` y foco devuelto al disparador.

---

## Textos que deben cambiar antes de publicar

| #   | Dónde                                                                 | Actual                                                                                       | Propuesto ES                                                                                                                                               | Propuesto EN                                                                                                                                  |
| --- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | `NSBluetoothAlwaysUsageDescription` (si el plugin no se excluye, H2)  | "…conectarse a tu anillo o banda de bienestar y leer tu frecuencia cardíaca, pasos y sueño…" | "Copp Adresd no usa Bluetooth en esta versión. Si en el futuro se activa, solo se usará con tu permiso."                                                   | "Copp Adresd doesn't use Bluetooth in this version. If enabled in the future, it will only be used with your permission."                     |
| T2  | `NSBluetoothPeripheralUsageDescription`                               | ídem                                                                                         | igual que T1                                                                                                                                               | igual que T1                                                                                                                                  |
| T3  | Pantalla, `HealthAccessoryPage.tsx:229`                               | "No pudimos comprobar el permiso de lectura"                                                 | "No pudimos abrir la ventana de permisos"                                                                                                                  | "We couldn't open the permissions screen"                                                                                                     |
| T4  | Resultados, `:397` (FC)                                               | "Frecuencia cardíaca"                                                                        | "Frecuencia cardíaca promedio"                                                                                                                             | "Average heart rate"                                                                                                                          |
| T5  | Resultados (sueño)                                                    | "{n} min"                                                                                    | "Sueño de anoche" + "{h} h {m} min"                                                                                                                        | "Last night's sleep" + "{h} h {m} min"                                                                                                        |
| T6  | Estado `save-failed` sin inscripción (H5)                             | "Leímos tus datos, pero faltan por guardar en el programa"                                   | "Tus datos se muestran aquí. Se guardarán en tu programa cuando esté activo."                                                                              | "Your data is shown here. It will be saved to your program once it's active."                                                                 |
| T7  | Android tras 2 denegaciones (H6)                                      | "Autorizar de nuevo"                                                                         | "Activa el permiso en Health Connect > Permisos de apps > Copp Adresd."                                                                                    | "Turn on access in Health Connect > App permissions > Copp Adresd."                                                                           |
| T8  | Android parcial (L4)                                                  | —                                                                                            | "Solo leemos las categorías que autorizaste."                                                                                                              | "We only read the categories you allowed."                                                                                                    |
| T9  | `strings.xml` `background_notification_*` (L15)                       | "Measuring your health and fitness data." / "The app is running in the background."          | Eliminar; si el hook lo exige: "Copp Adresd"                                                                                                               | "Copp Adresd"                                                                                                                                 |
| T10 | `APP-REVIEW-HEALTH.md` §2/§3/§6/§8 y `POLITICA-PRIVACIDAD-IA.md` (H3) | "no los enviamos a proveedores de inteligencia artificial"                                   | "Si usas Vita y lo aceptas en el aviso de IA, el contexto puede incluir tus pasos, distancia, energía activa y sueño. La frecuencia cardíaca no se envía." | "If you use Vita and accept the AI notice, the context may include your steps, distance, active energy and sleep. Heart rate is not sent."    |
| T11 | `APP-REVIEW-HEALTH.md` §3 nota al revisor                             | "All Bluetooth functionality has been removed from this build."                              | — (EN)                                                                                                                                                     | Si H2(a): mantener. Si H2(b): "The app does not connect to any accessory in 1.0; Bluetooth code is present but inactive and never requested." |
| T12 | `APP-REVIEW-HEALTH.md` §3 pasos                                       | "Tap \"Allow reading\" … \"All set! Your wearable is connected\""                            | —                                                                                                                                                          | Alinear con la UI real: "Allow reading" → "Continue" → Health sheet → título "Wellness data updated".                                         |

T1/T2 son un parche: Apple pide que los purpose strings expliquen un uso real (5.1.1), y una
cadena que dice "no se usa" puede generar otra pregunta del revisor. Por eso la opción H2(a),
excluir el plugin y eliminar las claves, es la recomendada.

Nota de copy: "Datos de bienestar actualizados" solo aparece tras una lectura con datos
(`hasData`): **correcto**, no promete sincronización falsa. "Conectado" en Home solo con
`summary.length > 0`: correcto, aunque puede quedar obsoleto (H10).

---

## Pruebas manuales que faltan

| #   | Prueba                                                                                                                                                          | Plataforma                   | Valida   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------- |
| P1  | Build de TestFlight en **iPad Air 11"** con cuenta demo: Salud vacía → vacío con guía; añadir pasos/FC/sueño → datos; idioma EN.                                | iPadOS 17+                   | 2.1      |
| P2  | Noche 23:00–07:00 añadida en Salud y en Health Connect → valor de "anoche" = 8 h; historial del backend del día correcto.                                       | iOS, Android                 | H1       |
| P3  | Cuenta demo de revisión con inscripción activa: sin `save-failed`.                                                                                              | iOS                          | H5       |
| P4  | Revisar el plist del `.ipa` final: sin `UIBackgroundModes`; cadenas `NSBluetooth*` según H2; HealthKit en el provisioning profile (fastlane).                   | iOS                          | H2       |
| P5  | Aceptar el aviso de IA nuevo y revisar el payload real de Vita: incluye o no las métricas `device`; nunca la FC.                                                | iOS                          | H3       |
| P6  | Android 14: solicitud de permiso muestra el diálogo; "Política" desde Health Connect abre el rationale.                                                         | Android 14/15                | H7       |
| P7  | Android: denegar dos veces → la UI deja de ofrecer re-solicitud y abre Health Connect.                                                                          | Android 13/14                | H6       |
| P8  | Android: permitir solo pasos → la UI muestra solo pasos y comunica la denegación parcial.                                                                       | Android                      | L4       |
| P9  | Android 13 **sin** Health Connect instalado → `not-installed` (no `unavailable`); instalar y volver → `available`.                                              | Android 13                   | estado   |
| P10 | Android: desinstalar Health Connect con permiso concedido → `not-installed`; revocar desde HC → `denied`.                                                       | Android 13/14                | revocado |
| P11 | iOS: desactivar categorías en Ajustes tras autorizar → vacío (no "denegado"); "Revisar permisos en Salud" lleva a una pantalla donde se ve el permiso de Salud. | iOS                          | UX iOS   |
| P12 | Zona horaria: dispositivo en Asia/Tokyo 01:30 con inscripción en Bogotá → el día guardado no pisa el día anterior.                                              | iOS/Android                  | H4       |
| P13 | Cambio de cuenta (logout → login con otra) en la pantalla: sin datos ni flag "solicitado" de la cuenta anterior.                                                | ambas                        | sesión   |
| P14 | Pulsar "Actualizar" 5 veces seguidas y volver a primer plano varias veces: 1 lectura en vuelo y sin POST duplicados (proxy de red).                             | ambas                        | sync     |
| P15 | Tiempo de sincronización en un dispositivo de gama baja (objetivo < 3 s).                                                                                       | Android gama baja, iPhone SE | H9       |
| P16 | VoiceOver/TalkBack: orden de lectura, anuncio de cambios de estado, foco tras cerrar el sheet.                                                                  | ambas                        | L9, L10  |
| P17 | 320 / 390 / 768 px y texto al 200 %: diagrama, `dl`, accordion, botones largos en EN.                                                                           | ambas                        | L7       |
| P18 | `prefers-reduced-motion` activado: accordion y progress sin animaciones bruscas.                                                                                | ambas                        | a11y     |
| P19 | Web/PWA con `VITE_HEALTH_ENABLED=true`: solo "No disponible" + registro manual, sin hero ni errores en consola.                                                 | web                          | L1       |
| P20 | `npm run build`, `lint`, `test`, `i18n:check` en verde con el working tree final.                                                                               | CI                           | —        |

---

## Qué NO cambiar (protege la estrategia 1.0 sin hardware)

1. **No reactivar** `VITE_WEARABLE_ENABLED` ni `UIBackgroundModes`/`bluetooth-central` ni `BluetoothLe.restoreBluetoothState` en la rama de 1.0.
2. **No pedir escritura**: mantener `toShare: []` en iOS y solo `READ_*` en Android. No añadir tipos de escritura aunque el plugin oficial los "necesite" para `getData` (mejor eliminar esa ruta, H8).
3. **No añadir** SpO2, presión, glucosa, temperatura, HRV ni ECG; no añadir rangos "normal/anormal" ni alertas.
4. **No mostrar "permiso denegado" en iOS**; conservar el modelo `unknown` + vacío con dos causas.
5. **No activar** lectura en segundo plano (`disableBackgroundJobs`, sin `READ_HEALTH_DATA_IN_BACKGROUND`) ni historial (`disableReadHealthDataHistory`).
6. **No persistir la frecuencia cardíaca** en el backend ni enviarla a la IA sin actualizar antes el aviso y la política.
7. **No pedir permisos al arrancar** la app ni desde Home; solo tras gesto del usuario y pre-permiso.
8. **No volver a nombrar** H59/R88 ni "Bluetooth" en la UI de 1.0 (el botón "Conectar por Bluetooth" debe seguir oculto por flag).
9. **No eliminar el código BLE** del repo: se conserva para 1.1 detrás de flag (excluirlo del build iOS es suficiente).
10. **No cambiar** la clave `copp.health-read-v1.<source>.<userId>` sin migración: perdería el estado "solicitado" y volvería a mostrar el pre-permiso.
