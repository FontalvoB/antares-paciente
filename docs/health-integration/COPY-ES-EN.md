# Copy ES / EN — Conecta tu accesorio (Apple Health / Health Connect)

## Convenciones para i18n

- En este repo la **clave de i18n es el texto en español** (`t("Texto en español")`), con
  traducción en `src/i18n/en.json` y espejo en `src/i18n/es.json`. La columna **ES** es la clave
  literal; el ID `hc.*` es solo referencia para este documento y para QA.
- Interpolación con llaves: `{app}`, `{when}`, `{date}`, `{count}` (formato ya usado por `t()`).
- Tras añadir cadenas: `npm run i18n:check`.
- Tono: bienestar, acompañamiento, tuteo, frases cortas. **Prohibido**: médico, clínico,
  diagnóstico, tratamiento, medir/medición (para el accesorio), paciente, alerta de salud,
  "detecta", "previene". Usar: accesorio de bienestar, estimaciones, monitoreo, seguimiento.
- Nombres de plataforma: iOS ES "Apple Health" + "app Salud" cuando se refiere a la app; EN "Apple
  Health" / "the Health app". Android: "Health Connect" en ambos idiomas. Nunca "HealthKit".
- Las cadenas iOS y Android se muestran solo en su plataforma.

## 1. Pantalla y hero

| ID                           | ES (clave)                                                                        | EN                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| hc.title                     | Conecta tu accesorio                                                              | Connect your wearable                                                                      |
| hc.kicker                    | Accesorio de bienestar                                                            | Wellness wearable                                                                          |
| hc.hero.subtitle.ios         | Tus datos llegan a Copp Adresd a través de Apple Health.                          | Your data reaches Copp Adresd through Apple Health.                                        |
| hc.hero.subtitle.android     | Tus datos llegan a Copp Adresd a través de Health Connect.                        | Your data reaches Copp Adresd through Health Connect.                                      |
| hc.hero.diagramLabel.ios     | Tu accesorio guarda datos en Apple Health y Copp Adresd los lee con tu permiso.   | Your wearable saves data to Apple Health, and Copp Adresd reads it with your permission.   |
| hc.hero.diagramLabel.android | Tu accesorio guarda datos en Health Connect y Copp Adresd los lee con tu permiso. | Your wearable saves data to Health Connect, and Copp Adresd reads it with your permission. |
| hc.node.wearable             | Tu accesorio                                                                      | Your wearable                                                                              |
| hc.node.ios                  | Apple Health                                                                      | Apple Health                                                                               |
| hc.node.android              | Health Connect                                                                    | Health Connect                                                                             |
| hc.node.app                  | Copp Adresd                                                                       | Copp Adresd                                                                                |

## 2. Selector de app (chips)

| ID                   | ES (clave)                                                                                             | EN                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| hc.apps.label        | ¿Qué accesorio usas?                                                                                   | Which wearable do you use?                                                                      |
| hc.apps.oura         | Oura                                                                                                   | Oura                                                                                            |
| hc.apps.ultrahuman   | Ultrahuman                                                                                             | Ultrahuman                                                                                      |
| hc.apps.fitbit       | Fitbit                                                                                                 | Fitbit                                                                                          |
| hc.apps.garmin       | Garmin                                                                                                 | Garmin                                                                                          |
| hc.apps.samsung      | Samsung Health                                                                                         | Samsung Health                                                                                  |
| hc.apps.applewatch   | Apple Watch                                                                                            | Apple Watch                                                                                     |
| hc.apps.other        | Otro                                                                                                   | Other                                                                                           |
| hc.apps.selected     | Guía para {app}                                                                                        | Guide for {app}                                                                                 |
| hc.apps.fitbitIos    | Fitbit no comparte datos con Apple Health de forma oficial. Puedes registrar tus datos a mano.         | Fitbit doesn't officially share data with Apple Health. You can log your data manually.         |
| hc.apps.appleWatch   | Tu Apple Watch ya guarda datos en Apple Health. Solo falta el paso 3.                                  | Your Apple Watch already saves data to Apple Health. Only step 3 is left.                       |
| hc.apps.otherIos     | Si la app de tu accesorio no menciona Apple Health, es posible que no comparta datos con la app Salud. | If your wearable's app doesn't mention Apple Health, it may not share data with the Health app. |
| hc.apps.otherAndroid | Si la app de tu accesorio no menciona Health Connect, es posible que no comparta datos.                | If your wearable's app doesn't mention Health Connect, it may not share data.                   |

## 3. Pasos

| ID                     | ES (clave)                                                                                     | EN                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| hc.steps.label         | Paso {count} de 3                                                                              | Step {count} of 3                                                                             |
| hc.step1.title         | Abre la app de tu accesorio                                                                    | Open your wearable's app                                                                      |
| hc.step1.body          | Comprueba que tiene datos recientes de hoy o de anoche.                                        | Check that it has recent data from today or last night.                                       |
| hc.step2.title.ios     | Activa la sincronización con Apple Health                                                      | Turn on syncing with Apple Health                                                             |
| hc.step2.title.android | Activa la sincronización con Health Connect                                                    | Turn on syncing with Health Connect                                                           |
| hc.step2.body.ios      | En los ajustes de esa app, busca Apple Health o "Apps conectadas" y permite que escriba datos. | In that app's settings, look for Apple Health or "Connected apps" and allow it to write data. |
| hc.step2.body.android  | En los ajustes de esa app, busca Health Connect y permite que escriba datos.                   | In that app's settings, look for Health Connect and allow it to write data.                   |
| hc.step2.note          | Ese permiso es para tu accesorio. Copp Adresd solo lee.                                        | That permission is for your wearable. Copp Adresd only reads.                                 |
| hc.step3.title         | Vuelve y autoriza la lectura                                                                   | Come back and allow reading                                                                   |
| hc.step3.body.ios      | Toca "Autorizar lectura", activa las categorías y toca Permitir.                               | Tap "Allow reading", turn on the categories and tap Allow.                                    |
| hc.step3.body.android  | Toca "Autorizar lectura", activa los permisos en Health Connect y toca Permitir.               | Tap "Allow reading", turn on the permissions in Health Connect and tap Allow.                 |
| hc.step.openApp        | Abrir {app}                                                                                    | Open {app}                                                                                    |
| hc.step.done           | Hecho                                                                                          | Done                                                                                          |

## 4. Botones y enlaces

| ID                     | ES (clave)                | EN                          |
| ---------------------- | ------------------------- | --------------------------- |
| hc.cta.authorize       | Autorizar lectura         | Allow reading               |
| hc.cta.continue        | Continuar                 | Continue                    |
| hc.cta.notNow          | Ahora no                  | Not now                     |
| hc.cta.refresh         | Actualizar                | Refresh                     |
| hc.cta.retry           | Reintentar                | Try again                   |
| hc.cta.tryAgain        | Intentar de nuevo         | Try again                   |
| hc.cta.goHome          | Ir al inicio              | Go to home                  |
| hc.cta.manual          | Registrar a mano          | Log manually                |
| hc.cta.noWearable      | No tengo accesorio        | I don't have a wearable     |
| hc.cta.whatWeRead      | Qué datos leemos          | What data we read           |
| hc.cta.manage          | Gestionar permiso         | Manage permission           |
| hc.cta.howToRevoke     | Cómo quitar el permiso    | How to remove permission    |
| hc.cta.openSettingsIos | Revisar permisos en Salud | Check permissions in Health |
| hc.cta.openHc          | Abrir Health Connect      | Open Health Connect         |
| hc.cta.installHc       | Instalar Health Connect   | Install Health Connect      |
| hc.cta.seeGuide        | Ver guía de mi app        | See my app's guide          |
| hc.cta.authorizeAgain  | Autorizar de nuevo        | Allow again                 |
| hc.cta.connectWearable | Conectar accesorio        | Connect wearable            |
| hc.cta.privacyPolicy   | Política de privacidad    | Privacy policy              |

## 5. Pre-permiso y tipos de dato

| ID                            | ES (clave)                                                                                | EN                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| hc.prePermission.title        | Esto es lo que leeremos                                                                   | Here's what we'll read                                                                    |
| hc.prePermission.body.ios     | Después verás la ventana de Apple Health. Puedes activar solo las categorías que quieras. | Next you'll see the Apple Health screen. You can turn on only the categories you want.    |
| hc.prePermission.body.android | Después verás la ventana de Health Connect. Puedes activar solo los permisos que quieras. | Next you'll see the Health Connect screen. You can turn on only the permissions you want. |
| hc.data.steps                 | Pasos                                                                                     | Steps                                                                                     |
| hc.data.steps.why             | Para tu meta diaria de actividad.                                                         | For your daily activity goal.                                                             |
| hc.data.distance              | Distancia                                                                                 | Distance                                                                                  |
| hc.data.distance.why          | Para ver cuánto te moviste.                                                               | To see how far you moved.                                                                 |
| hc.data.energy                | Energía activa                                                                            | Active energy                                                                             |
| hc.data.energy.why            | Para estimar tu actividad del día.                                                        | To estimate your daily activity.                                                          |
| hc.data.heartRate             | Frecuencia cardíaca                                                                       | Heart rate                                                                                |
| hc.data.heartRate.why         | Para seguir tu tendencia durante el día.                                                  | To follow your trend during the day.                                                      |
| hc.data.restingHr             | Frecuencia cardíaca en reposo                                                             | Resting heart rate                                                                        |
| hc.data.restingHr.why         | Para ver tu tendencia semanal de bienestar.                                               | To see your weekly wellness trend.                                                        |
| hc.data.sleep                 | Sueño                                                                                     | Sleep                                                                                     |
| hc.data.sleep.why             | Para acompañar tus hábitos de descanso.                                                   | To support your rest habits.                                                              |
| hc.data.estimate              | Estimación de tu accesorio                                                                | Estimate from your wearable                                                               |

`[[CONFIRMAR: lista final de tipos según lo que codex solicite al plugin; quitar filas no solicitadas]]`

## 6. Aviso de privacidad

| ID                        | ES (clave)                                                                                                                                       | EN                                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| hc.privacy.short          | Solo leemos. Tú decides.                                                                                                                         | We only read. You decide.                                                                                                                             |
| hc.privacy.body           | Copp Adresd solo lee los datos que autorices; no escribe ni cambia nada en tu app de salud. No vendemos tus datos ni los usamos para publicidad. | Copp Adresd only reads the data you allow; it doesn't write or change anything in your health app. We don't sell your data or use it for advertising. |
| hc.privacy.revoke.ios     | Puedes quitar el permiso cuando quieras en Ajustes > Salud > Acceso a datos y dispositivos > Copp Adresd.                                        | You can remove permission anytime in Settings > Health > Data Access & Devices > Copp Adresd.                                                         |
| hc.privacy.revoke.android | Puedes quitar el permiso cuando quieras en Health Connect > Permisos de apps > Copp Adresd.                                                      | You can remove permission anytime in Health Connect > App permissions > Copp Adresd.                                                                  |
| hc.privacy.wellness       | Tu accesorio es de bienestar: sus datos son estimaciones y no sustituyen la opinión de un profesional.                                           | Your wearable is a wellness device: its data are estimates and don't replace a professional's advice.                                                 |
| hc.privacy.usage          | Usamos estos datos para mostrarte tu progreso en el programa y compartirlo con tu equipo de acompañamiento.                                      | We use this data to show your progress in the program and share it with your support team.                                                            |

`hc.privacy.usage`: `[[CONFIRMAR: si los datos se envían al backend y los ve el equipo; si no, cambiar a "Usamos estos datos solo para mostrarte tu progreso en esta app."]]`

## 7. Estados

| ID                            | ES (clave)                                                                                                    | EN                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| hc.state.unsupported.title    | No disponible en este dispositivo                                                                             | Not available on this device                                                                                      |
| hc.state.unsupported.body     | Puedes seguir tu programa registrando tus datos a mano.                                                       | You can keep up with your program by logging your data manually.                                                  |
| hc.state.hcMissing.title      | Necesitas Health Connect                                                                                      | You need Health Connect                                                                                           |
| hc.state.hcMissing.body       | Instala o actualiza Health Connect desde Google Play y vuelve aquí.                                           | Install or update Health Connect from Google Play and come back here.                                             |
| hc.state.available.title      | Conecta tu anillo o banda en 3 pasos                                                                          | Connect your ring or band in 3 steps                                                                              |
| hc.state.available.body       | Lo hacemos juntos. Toma menos de un minuto.                                                                   | We'll do it together. It takes less than a minute.                                                                |
| hc.state.syncing.title        | Sincronizando tus datos…                                                                                      | Syncing your data…                                                                                                |
| hc.state.syncing.body         | Esto puede tardar unos segundos.                                                                              | This may take a few seconds.                                                                                      |
| hc.state.success.title        | ¡Listo! Tu accesorio está conectado                                                                           | All set! Your wearable is connected                                                                               |
| hc.state.success.body.ios     | Leemos tus datos desde Apple Health cada vez que abres la app.                                                | We read your data from Apple Health each time you open the app.                                                   |
| hc.state.success.body.android | Leemos tus datos desde Health Connect cada vez que abres la app.                                              | We read your data from Health Connect each time you open the app.                                                 |
| hc.state.success.last         | Última lectura: {when}                                                                                        | Last read: {when}                                                                                                 |
| hc.state.success.source       | Desde {app}                                                                                                   | From {app}                                                                                                        |
| hc.state.success.since        | Verás datos desde el {date}.                                                                                  | You'll see data from {date}.                                                                                      |
| hc.state.noDataIos.title      | Aún no vemos datos                                                                                            | We don't see any data yet                                                                                         |
| hc.state.noDataIos.body       | Revisa dos cosas:                                                                                             | Check two things:                                                                                                 |
| hc.state.noDataIos.check1     | Que la app de tu accesorio esté sincronizando con Apple Health.                                               | That your wearable's app is syncing with Apple Health.                                                            |
| hc.state.noDataIos.check2     | Que Copp Adresd tenga permiso de lectura en Salud.                                                            | That Copp Adresd has read permission in Health.                                                                   |
| hc.state.noData.title         | Aún no hay datos en Health Connect                                                                            | No data in Health Connect yet                                                                                     |
| hc.state.noData.body          | Abre la app de tu accesorio, sincronízala y toca Actualizar.                                                  | Open your wearable's app, sync it and tap Refresh.                                                                |
| hc.state.denied.title         | No tenemos permiso de lectura                                                                                 | We don't have read permission                                                                                     |
| hc.state.denied.body          | Sin permiso no podemos mostrar los datos de tu accesorio. Puedes activarlo en Health Connect o seguir a mano. | Without permission we can't show your wearable's data. You can turn it on in Health Connect or continue manually. |
| hc.state.revoked.title        | El permiso se desactivó                                                                                       | Permission was turned off                                                                                         |
| hc.state.revoked.body         | Ya no leemos datos de tu accesorio. Puedes volver a autorizar cuando quieras.                                 | We no longer read your wearable's data. You can allow it again anytime.                                           |
| hc.state.error.title          | No pudimos leer tus datos                                                                                     | We couldn't read your data                                                                                        |
| hc.state.error.body           | Revisa tu conexión e inténtalo de nuevo en un momento.                                                        | Check your connection and try again in a moment.                                                                  |

## 8. Home, Perfil y toasts

| ID                     | ES (clave)                                              | EN                                                      |
| ---------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| hc.home.quick          | Conectar                                                | Connect                                                 |
| hc.home.connected      | Conectado                                               | Connected                                               |
| hc.home.empty          | Conecta tu accesorio o registra tus datos a mano.       | Connect your wearable or log your data manually.        |
| hc.home.source.ios     | Desde Apple Health                                      | From Apple Health                                       |
| hc.home.source.android | Desde Health Connect                                    | From Health Connect                                     |
| hc.profile.row         | Accesorio y datos de bienestar                          | Wearable and wellness data                              |
| hc.profile.on          | Lectura activada                                        | Reading on                                              |
| hc.profile.off         | Sin conectar                                            | Not connected                                           |
| hc.toast.declined      | Puedes conectarlo cuando quieras desde Perfil.          | You can connect it anytime from Profile.                |
| hc.toast.updated       | Datos actualizados                                      | Data updated                                            |
| hc.toast.noNew         | No hay datos nuevos                                     | No new data                                             |
| hc.onboarding.title    | ¿Usas un anillo o una banda?                            | Do you use a ring or a band?                            |
| hc.onboarding.body     | Conéctalo para ver tus pasos y tu sueño en tu programa. | Connect it to see your steps and sleep in your program. |
| hc.onboarding.now      | Conectar ahora                                          | Connect now                                             |
| hc.onboarding.later    | Más tarde                                               | Later                                                   |

Nota: `Conectar` ya existe como clave en `es.json`/`en.json`; reutilizar.

## 9. Textos de permiso iOS (Info.plist)

Se localizan con `InfoPlist.strings` (`es.lproj`, `en.lproj`) `[[CONFIRMAR: el proyecto iOS tiene localizaciones de InfoPlist.strings; si no, el valor base de Info.plist debe ir en inglés]]`.

**`NSHealthShareUsageDescription`** (obligatoria para leer)

- ES: `Copp Adresd lee, solo con tu permiso, los pasos, la actividad, el sueño y la frecuencia cardíaca que tu accesorio guarda en Salud, para mostrarte tu progreso en el programa de bienestar. No vendemos estos datos ni los usamos para publicidad.`
- EN: `Copp Adresd reads, only with your permission, the steps, activity, sleep and heart rate your wearable saves to Health, to show your progress in the wellness program. We don't sell this data or use it for advertising.`

**`NSHealthUpdateUsageDescription`** (solo si el plugin exige la clave aunque no se pidan tipos de escritura)

- Recomendación: **omitirla** si no se solicita ningún tipo de escritura (decisión D1). `[[CONFIRMAR: si @capacitor/health-fitness v8 falla o App Store Connect avisa sin esta clave]]`
- Si es obligatoria, ES: `Copp Adresd no guarda datos en Salud en esta versión. Solo los guardaría si en el futuro tú decides añadir un registro y lo autorizas.`
- EN: `Copp Adresd doesn't save data to Health in this version. It would only do so if, in the future, you choose to add a record and allow it.`

## 10. Health Connect — rationale (Android)

Health Connect exige que la app muestre su política de privacidad / justificación de permisos
(activity que responde a `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` y, en Android 14+,
alias con `android.intent.action.VIEW_PERMISSION_USAGE` + categoría `HEALTH_PERMISSIONS`).
`[[CONFIRMAR: cómo lo resuelve el plugin (activity propia, WebView a la política o pantalla in-app)]]`

| ID                 | ES (clave)                                                                                                                                                           | EN                                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| hc.rationale.title | Por qué Copp Adresd pide acceso a Health Connect                                                                                                                     | Why Copp Adresd asks for Health Connect access                                                                                                       |
| hc.rationale.body1 | Copp Adresd lee pasos, distancia, energía activa, frecuencia cardíaca, frecuencia cardíaca en reposo y sueño que tu accesorio de bienestar guarda en Health Connect. | Copp Adresd reads steps, distance, active energy, heart rate, resting heart rate and sleep that your wellness wearable saves to Health Connect.      |
| hc.rationale.body2 | Los usamos para mostrarte tu progreso y acompañar tus hábitos dentro del programa. Son estimaciones del accesorio y no se usan para diagnosticar ni tratar.          | We use them to show your progress and support your habits in the program. They are estimates from the wearable and aren't used to diagnose or treat. |
| hc.rationale.body3 | No escribimos datos en Health Connect, no vendemos tus datos y no los usamos para publicidad.                                                                        | We don't write data to Health Connect, we don't sell your data and we don't use it for advertising.                                                  |
| hc.rationale.body4 | Puedes quitar el permiso cuando quieras en Health Connect > Permisos de apps > Copp Adresd.                                                                          | You can remove permission anytime in Health Connect > App permissions > Copp Adresd.                                                                 |
| hc.rationale.link  | Lee nuestra política de privacidad completa                                                                                                                          | Read our full privacy policy                                                                                                                         |

Nota: `hc.rationale.body2` usa "diagnosticar ni tratar" solo en negación, igual que la ficha de App Store.
