# App Review y privacidad — lectura de Apple Health / Health Connect (1.0)

> Uso interno. No promete aprobación: describe estrategia, textos y riesgos. Los textos finales de
> App Store Connect viven en `../docs/app-review/2026-11-21/` (raíz del workspace); este documento
> **no los modifica**, indica qué habría que ajustar allí.

## 1. Mensaje central

- La versión 1.0 **no se conecta a ningún hardware**: no hay Bluetooth, no hay emparejamiento, no hay `UIBackgroundModes`. `[[CONFIRMAR: build final sin plugin BLE inicializado, sin NSBluetooth*UsageDescription y sin bluetooth-central]]`
- Si el usuario lo autoriza, la app **lee** de Apple Health (HealthKit) en iOS / Health Connect en Android los datos que su accesorio de bienestar ya guardó allí.
- **Solo lectura**; la app no escribe en HealthKit/Health Connect.
- Es opcional: el programa funciona completo con registro manual.

## 2. Qué datos lee y para qué

| Tipo                          | HealthKit (orientativo)  | Health Connect (orientativo) | Uso en la app                  |
| ----------------------------- | ------------------------ | ---------------------------- | ------------------------------ |
| Pasos                         | `stepCount`              | `Steps`                      | Meta diaria de actividad       |
| Distancia                     | `distanceWalkingRunning` | `Distance`                   | Resumen de actividad           |
| Energía activa                | `activeEnergyBurned`     | `ActiveCaloriesBurned`       | Resumen de actividad           |
| Frecuencia cardíaca           | `heartRate`              | `HeartRate`                  | Tendencia diaria (estimación)  |
| Frecuencia cardíaca en reposo | `restingHeartRate`       | `RestingHeartRate`           | Tendencia semanal (estimación) |
| Sueño                         | `sleepAnalysis`          | `SleepSession`               | Hábitos de descanso            |

`[[CONFIRMAR: identificadores reales que solicita codex vía @capacitor/health-fitness v8; eliminar filas no solicitadas]]`.
No se leen SpO2, presión arterial, glucosa, temperatura, ECG ni registros clínicos (decisión D3).

Destino de los datos: `[[CONFIRMAR: (a) solo en el dispositivo, o (b) enviados al backend de Copp Adresd (AWS) para el seguimiento del programa con el equipo de acompañamiento]]`. Si (b): cifrado en tránsito (HTTPS), vinculado a la cuenta, no se comparte con terceros salvo encargados de tratamiento declarados, borrable con la eliminación de cuenta.

Compromisos (deben ser verdad en código y política):

- No se usan para publicidad, marketing ni minería de datos basada en uso.
- No se venden ni se comparten con data brokers.
- No se guardan en iCloud.
- **No se envían a proveedores de IA** (Anthropic, OpenAI, ElevenLabs) en 1.0. `[[CONFIRMAR: el chat IA no recibe métricas leídas de HealthKit/Health Connect como contexto; si las recibe, debe figurar explícitamente en el aviso de IA y en la política (ver §5)]]`
- El usuario puede revocar en Ajustes > Salud > Acceso a datos y dispositivos (iOS) o Health Connect > Permisos de apps (Android).

## 3. Borrador de nota para el revisor (EN, para el campo Notes)

Ajustar en `NOTAS-REVISION-ASC.md` cuando se apruebe. Límite total del campo: 4000 caracteres.

```
HEALTH DATA / NO CONNECTED HARDWARE
Version 1.0 does not connect to any hardware accessory. All Bluetooth functionality has been
removed from this build. Instead, with the user's explicit permission, the app READS (read-only,
no writes) a small set of wellness data that the user's own wearable app has already saved to
Apple Health: steps, distance, active energy, heart rate, resting heart rate and sleep.
This data is shown as estimates to track progress in a wellness program. It is not used for
diagnosis or treatment, advertising, marketing or data mining, and it is not sold or stored in
iCloud. Users can revoke access at any time in Settings > Health > Data Access & Devices.
The feature is optional; the program works fully with manual logging.

HOW TO TEST (no hardware needed)
1. Open the Health app > Browse > Activity > Steps > Add Data, and add a few steps for today.
   Optionally add Heart Rate and Sleep entries the same way.
2. Sign in to Copp Adresd with the demo account above.
3. Tap "Connect" on Home (or Profile > Wearable and wellness data).
4. Tap "Allow reading" > "Continue", enable the categories in the Health sheet and tap Allow.
5. The screen shows "All set! Your wearable is connected" with today's steps.
If no data was added in step 1, the app shows guidance and a "Log manually" option.
The same flow works on iPad (iPadOS 17+, Health app available).
```

`[[CONFIRMAR: textos de botones finales en inglés coinciden con COPY-ES-EN.md; cuenta demo con idioma EN]]`

## 4. Cómo probar sin hardware

**iOS / iPadOS (17+)**

1. App Salud > Explorar > Actividad > Pasos > **Añadir datos** (repetir con Frecuencia cardíaca, Sueño).
2. Abrir Copp Adresd > Conectar > Autorizar lectura > Permitir.
3. Esperado: estado éxito con los pasos añadidos. Para probar vacío: no añadir datos o desactivar el permiso en Ajustes > Salud.
4. Simulador: HealthKit funciona en el simulador de iOS; añadir datos en la app Salud del simulador.

**Android (13 / 14+)**

1. Android 13: instalar Health Connect desde Play Store. Android 14+: viene integrado.
2. Añadir datos: Health Connect no ofrece entrada manual en todas las versiones; usar una app que escriba (p. ej. Google Fit/Fitbit/Samsung Health) o la app de pruebas **Health Connect Toolbox** de Google. `[[CONFIRMAR: herramienta usada por QA]]`
3. Abrir Copp Adresd > Conectar > Autorizar lectura > Permitir.
4. Probar también: denegar dos veces, revocar desde Health Connect, desinstalar Health Connect (Android 13).

## 5. Relación con las guías de App Store

| Guía             | Qué exige                                                                                                                                                   | Cómo se cubre / qué falta                                                                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1.4.1**        | Apps de salud que pueden dar datos inexactos; hardware conectado necesita documentación.                                                                    | Sin hardware conectado. Datos presentados como estimaciones de terceros, sin rangos clínicos ni alertas. No se leen métricas percibidas como médicas (D3).                             |
| **2.1**          | App completa y probable por el revisor.                                                                                                                     | Instrucciones de prueba sin hardware (§3/§4). Cuenta demo funcional. Estado vacío con salida manual.                                                                                   |
| **2.5.1**        | HealthKit solo para su propósito, y la integración debe identificarse claramente en la UI y en el texto de marketing.                                       | UI nombra "Apple Health". **Falta**: la descripción de App Store hoy habla de "accesorio por Bluetooth"; debe cambiar a "lee datos de Apple Health con tu permiso". Ver §7.            |
| **5.1.1 (i–ii)** | Política de privacidad accesible; consentimiento; minimización; datos solo para el propósito declarado.                                                     | Pre-permiso con lista exacta de datos y propósito; solo los tipos que se muestran. Política debe incluir la sección HealthKit (§6). Etiquetas de privacidad de App Store actualizadas. |
| **5.1.2 (i)**    | Divulgar y obtener permiso explícito antes de compartir datos personales con terceros, incluida IA de terceros.                                             | Datos de salud **no** van a IA en 1.0 (D10). Si se envían al backend propio, declararlo. Si en el futuro van a IA: añadirlo al aviso de IA existente antes de enviar.                  |
| **5.1.2 (vi)**   | Datos de HealthKit no pueden usarse para marketing, publicidad ni minería de datos por uso, ni por terceros.                                                | Compromiso explícito en política, plist y UI (`hc.privacy.body`).                                                                                                                      |
| **5.1.3 (i)**    | Datos de salud no se usan ni divulgan a terceros para publicidad/marketing; solo para mejorar la gestión de la salud/bienestar o investigación con permiso. | Uso limitado a mostrar progreso del programa.                                                                                                                                          |
| **5.1.3 (ii)**   | No escribir datos falsos o inexactos en HealthKit; no guardar información personal de salud en iCloud.                                                      | Solo lectura (D1). `[[CONFIRMAR: ningún dato de salud en iCloud/CloudKit/backup en la nube de Apple]]`                                                                                 |

Etiquetas de privacidad (App Privacy en ASC): declarar **Health & Fitness → Health / Fitness**, uso "App Functionality", vinculado a la identidad si va al backend, **no tracking**. `[[CONFIRMAR: según destino de §2]]`.
Google Play: formulario de declaración de permisos de Health Connect y Data safety. `[[CONFIRMAR: responsable y estado]]`.

## 6. Texto mínimo para la política de privacidad

Añadir a la política publicada (ES/EN). `[[CONFIRMAR: URL de la política y quién la publica]]`.

**ES**

> **Datos de Apple Health y Health Connect.** Si lo autorizas, Copp Adresd lee de Apple Health
> (iOS) o Health Connect (Android) los siguientes datos que tu accesorio de bienestar u otras apps
> guardaron allí: pasos, distancia, energía activa, frecuencia cardíaca, frecuencia cardíaca en
> reposo y sueño. Copp Adresd no escribe datos en Apple Health ni en Health Connect. Usamos estos
> datos únicamente para mostrarte tu progreso y acompañar tus hábitos dentro del programa
> [[CONFIRMAR: "y para que tu equipo de acompañamiento vea tu progreso"]]. Son estimaciones y no
> se usan para diagnosticar ni tratar. No usamos estos datos para publicidad, marketing ni minería
> de datos, no los vendemos, no los compartimos con terceros con esos fines, no los enviamos a
> proveedores de inteligencia artificial y no los almacenamos en iCloud. Puedes revocar el acceso
> en cualquier momento en Ajustes > Salud > Acceso a datos y dispositivos (iOS) o en Health
> Connect > Permisos de apps (Android). [[CONFIRMAR: plazo de conservación y borrado en backend]]

**EN**

> **Apple Health and Health Connect data.** If you allow it, Copp Adresd reads from Apple Health
> (iOS) or Health Connect (Android) the following data that your wellness wearable or other apps
> saved there: steps, distance, active energy, heart rate, resting heart rate and sleep. Copp
> Adresd does not write data to Apple Health or Health Connect. We use this data only to show your
> progress and support your habits within the program [[CONFIRMAR: "and so your support team can
> see your progress"]]. It consists of estimates and is not used for diagnosis or treatment. We do
> not use this data for advertising, marketing or data mining, we do not sell it, we do not share
> it with third parties for those purposes, we do not send it to artificial intelligence
> providers and we do not store it in iCloud. You can revoke access at any time in Settings >
> Health > Data Access & Devices (iOS) or Health Connect > App permissions (Android).
> [[CONFIRMAR: retention period and deletion on the backend]]

Health Connect además exige que esta política sea accesible desde la pantalla de rationale (COPY §10).

## 7. Ajustes necesarios en otros documentos (no editados aquí)

- `DESCRIPCION-APP-STORE.md`: sustituir "Conectar, si quieres, un accesorio de bienestar compatible por Bluetooth…" por algo como "Leer, si lo autorizas, pasos, sueño y frecuencia cardíaca desde Apple Health (los datos que tu accesorio de bienestar ya guarda allí), como estimaciones." Mantener el bloque "no es un dispositivo médico".
- `NOTAS-REVISION-ASC.md`: añadir el bloque §3.
- `POLITICA-PRIVACIDAD-IA.md`: añadir §6 y confirmar que los datos de salud no forman parte del contexto enviado a IA.
- Respuesta a App Review: explicar que 1.0 retira la conexión BLE (resuelve 1.4.1 y 2.1) y que la integración nueva es HealthKit de solo lectura.

## 8. Qué NO afirmar

- Que la app o el accesorio es un **dispositivo médico**, que **diagnostica, trata, cura o previene**, que da **mediciones clínicas** o que es "preciso/validado clínicamente".
- Que la app **no maneja ningún dato de salud**: sí lo hace, con permiso (HealthKit/Health Connect). Negarlo contradice las etiquetas de privacidad y el diálogo de permisos.
- Que la app **se conecta a** o **es compatible con** un anillo concreto (H59/R88 u otro) en 1.0.
- Que la app **sincroniza en segundo plano** o **monitorea continuamente**.
- Que Apple o Google **respaldan, certifican o aprueban** la app.
- Que los datos **no salen del teléfono**, si se envían al backend.
- Que habrá aprobación garantizada; esta estrategia reduce el riesgo, no lo elimina.

## 9. Riesgos de revisión

| Riesgo                                                                                                                                      | Probabilidad         | Mitigación                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| El revisor (a menudo en iPad) no tiene datos en Salud y ve la pantalla vacía → 2.1 "funcionalidad no encontrada".                           | Media                | Instrucciones de "Añadir datos" en Notes; estado vacío claro con salida manual; probar en iPad. |
| Descripción/metadatos siguen hablando de Bluetooth o del anillo → 2.3.1/2.5.1 o reabre 1.4.1.                                               | Alta si no se ajusta | §7 antes de enviar; buscar "Bluetooth", "H59", "R88", "medir" en metadatos y capturas.          |
| Restos de BLE en el binario (permisos `NSBluetooth*`, código que pide Bluetooth al arrancar) → pregunta del revisor o rechazo 2.1/5.1.1.    | Media                | Checklist de build (CHECKLIST §9).                                                              |
| Datos de salud llegan a IA de terceros sin divulgación → 5.1.2(i)/5.1.3.                                                                    | Media                | D10; verificar payload del chat.                                                                |
| Política sin sección HealthKit o etiquetas de privacidad sin Health & Fitness → 5.1.1.                                                      | Media                | §5 y §6.                                                                                        |
| La app del anillo del programa no escribe en Apple Health → usuarios reales sin datos (no es motivo de rechazo, sí de fracaso de producto). | Desconocida          | `[[CONFIRMAR]]` con el proveedor; guía honesta y registro manual.                               |
