# UX Flow — Conectar tu accesorio vía Apple Health / Health Connect

> Objetivo: en **10 segundos** el usuario entiende que (1) su accesorio guarda datos en la app
> nativa de su teléfono, (2) Copp Adresd los **lee** de ahí con su permiso y (3) puede seguir con
> registro manual si no quiere. Copy exacto en [COPY-ES-EN.md](COPY-ES-EN.md) (IDs `hc.*`).

## 1. Entradas

| Entrada         | Ubicación                                                                                          | Comportamiento                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Home · Conectar | Acción rápida que hoy usa `t("Conectar")` en `HomePage.tsx` (condicionada por `WEARABLE_ENABLED`). | Abre la pantalla "Conecta tu accesorio". Si ya está autorizado y con datos, el chip de la acción muestra "Conectado" con punto verde. |
| Home · tarjeta  | Tarjeta de métricas del día (pasos/sueño/FC) cuando no hay datos.                                  | CTA secundario "Conectar accesorio" → misma pantalla. Si hay datos: muestra origen ("Desde Apple Health") y hora de última lectura.   |
| Perfil          | Fila nueva en el bloque "Autorizaciones y privacidad": **"Accesorio y datos de bienestar"**.       | Abre la misma pantalla en modo gestión: estado, tipos de dato autorizados, "Actualizar", "Cómo revocar el permiso".                   |
| Onboarding      | Opcional, no bloqueante. Paso final "¿Usas un anillo o banda?" con "Conectar ahora" / "Más tarde". | `[[CONFIRMAR: si el onboarding de 1.0 incluye este paso]]`                                                                            |

Flag: `[[CONFIRMAR: nombre del flag de la entrada nueva (p. ej. HEALTH_SYNC_ENABLED) y que la pantalla BLE (WearablePage) quede inaccesible en 1.0]]`.

## 2. Anatomía de la pantalla (una sola vista, scroll vertical)

```
┌─────────────────────────────────────┐
│ ← Conecta tu accesorio              │  header Ionic (IonHeader/IonToolbar), back nativo
├─────────────────────────────────────┤
│ ╭─ HERO (grad-brand-v) ───────────╮ │  estado actual en una frase + icono de plataforma
│ │  [◎ anillo] ──→ [Salud] ──→ [C] │ │  diagrama de 3 nodos: accesorio → app nativa → Copp Adresd
│ │  Tus datos llegan a Copp Adresd │ │  (la flecha 2→3 se ilumina al autorizar)
│ │  a través de Apple Health.      │ │
│ ╰─────────────────────────────────╯ │
│  ¿Qué accesorio usas?               │  chips horizontales (scroll-x) filtrados por plataforma
│  [Oura][Ultrahuman][Garmin][Otro…]  │
│                                     │
│  ① Abre la app de tu accesorio      │  stepper vertical; el paso activo expandido
│  ② Activa la sincronización con     │  con instrucciones de la app elegida
│     Apple Health                    │
│  ③ Vuelve y autoriza la lectura     │
│     [ Autorizar lectura ]           │  IonButton expand="block", color primary
│                                     │
│  🔒 Solo leemos. Tú decides.        │  aviso de privacidad corto + "Qué datos leemos"
│                                     │
│  No tengo accesorio · Registrar a mano  │  enlace secundario, siempre visible
└─────────────────────────────────────┘
```

- **Plataforma detectada**: iOS → solo "Apple Health" / "app Salud". Android → solo "Health Connect". Web/PWA → estado "No disponible en este dispositivo" + registro manual.
- **Hero**: gradiente `--grad-brand-v`, texto blanco, radio `--wellness-radius`. El diagrama de 3 nodos es el elemento de comprensión principal: comunica "tu accesorio no se conecta a nosotros; pasa por tu app de salud".
- **Chips de app**: seleccionar uno reescribe el contenido de los pasos ① y ② con la guía específica (§5). Default: ninguno seleccionado → guía genérica. Persistir la elección localmente (conveniencia, try/catch).
- **Stepper**: pasos ① y ② son informativos (con botón "Abrir {app}" solo si se confirma que el deep link funciona `[[CONFIRMAR: deep links por app; si no, omitir el botón]]`). El paso ③ contiene el CTA principal.
- **Componentes Ionic** (regla Ionic-first del repo): `IonButton`, `IonChip` (o `IonSegment` scrollable), `IonList`/`IonItem` para tipos de dato, `IonModal` (sheet) para "Qué datos leemos", `IonToast` para confirmaciones breves, `IonProgressBar` indeterminada para sincronizando. Hero y diagrama son decorativos/de identidad (excepción permitida).

## 3. Máquina de estados

Fuentes de verdad del estado: plugin (`[[CONFIRMAR: nombres reales de métodos y valores de retorno de @capacitor/health-fitness v8 para disponibilidad, estado de permiso, solicitud y lectura]]`) + resultado de la última lectura.

| ID                | Estado                                       | Cómo se detecta                                                                                                                                    | Hero / mensaje                                                        | CTA principal                             | Secundario                            |
| ----------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------- |
| `unsupported`     | No disponible                                | Web, o iPad/iPhone donde Salud no está disponible, o Android < mínimo de Health Connect. `[[CONFIRMAR: API de disponibilidad]]`                    | `hc.state.unsupported.*`                                              | Registrar a mano                          | —                                     |
| `hc_missing`      | Health Connect no instalado / desactualizado | Android ≤ 13 sin la app Health Connect, o proveedor que requiere actualización. `[[CONFIRMAR: el plugin expone el SDK status]]`                    | `hc.state.hcMissing.*`                                                | Instalar Health Connect (Play Store)      | Registrar a mano                      |
| `available`       | Disponible, permiso no pedido                | Disponible y la app nunca solicitó permiso (flag local "ya solicitado" = false).                                                                   | `hc.state.available.*`                                                | Autorizar lectura → pre-permiso           | Qué datos leemos · Registrar a mano   |
| `requested_ios`   | Permiso solicitado (iOS, estado opaco)       | iOS tras mostrar el diálogo. **HealthKit no revela si se denegó la lectura**: siempre se trata como "solicitado" y se intenta leer.                | Pasa a `syncing` → `success` o `no_data_ios`                          | —                                         | —                                     |
| `denied_android`  | Permiso denegado (Android)                   | Health Connect informa permisos no concedidos tras la solicitud.                                                                                   | `hc.state.denied.*`                                                   | Abrir Health Connect                      | Intentar de nuevo · Registrar a mano  |
| `syncing`         | Sincronizando                                | Lectura en curso.                                                                                                                                  | `hc.state.syncing.*` + `IonProgressBar` indeterminada                 | (deshabilitado)                           | —                                     |
| `success`         | Conectado con datos                          | Lectura devolvió ≥ 1 muestra en la ventana (últimos 7 días).                                                                                       | `hc.state.success.*` + resumen (pasos hoy, sueño anoche, FC reciente) | Ir al inicio                              | Actualizar · Gestionar permiso        |
| `no_data_ios`     | Sin datos (iOS)                              | Lectura vacía en iOS. Puede ser: permiso denegado, accesorio no sincroniza o no hay datos. **No se puede distinguir**: el copy cubre ambas causas. | `hc.state.noDataIos.*` con checklist de 2 comprobaciones              | Revisar permisos en Salud                 | Ver guía de mi app · Registrar a mano |
| `no_data_android` | Sin datos (Android, permiso concedido)       | Permiso concedido y lectura vacía.                                                                                                                 | `hc.state.noData.*`                                                   | Ver guía de mi app                        | Actualizar · Registrar a mano         |
| `revoked`         | Permiso revocado                             | Android: permiso antes concedido ya no lo está. iOS: indistinguible → cae en `no_data_ios`.                                                        | `hc.state.revoked.*`                                                  | Autorizar de nuevo / Abrir Health Connect | Registrar a mano                      |
| `error`           | Error                                        | Excepción del plugin o timeout (> 15 s). Nunca tragar: log estructurado sin datos de salud.                                                        | `hc.state.error.*`                                                    | Reintentar                                | Registrar a mano                      |
| `declined`        | El usuario no quiere autorizar               | Pulsa "Ahora no" en el pre-permiso.                                                                                                                | Toast `hc.toast.declined` y vuelve al origen                          | —                                         | —                                     |

Transiciones clave:

```
entrada ─► detectar disponibilidad
   ├─ no ─────────────► unsupported | hc_missing ──(instaló y volvió: app resume)──► available
   └─ sí ─► ¿ya solicitado?
           ├─ no ─► available ─(Autorizar)─► pre-permiso ─(Continuar)─► diálogo nativo
           │                                   └─(Ahora no)─► declined
           │        diálogo nativo ─► iOS: syncing ─► success | no_data_ios
           │                       └► Android: concedido ─► syncing ─► success | no_data_android
           │                                   denegado ─► denied_android
           └─ sí ─► syncing ─► success | no_data_* | revoked | error
app vuelve a primer plano en la pantalla ─► re-evaluar estado + lectura (debounce 2 s)
```

Reglas:

- **Android, doble denegación**: tras dos rechazos Health Connect deja de mostrar el diálogo. En `denied_android`, si el usuario ya rechazó dos veces, "Intentar de nuevo" se oculta y solo queda "Abrir Health Connect". `[[CONFIRMAR: el plugin expone un intent/método para abrir la configuración de Health Connect]]`
- **Android, historial**: Health Connect solo permite leer por defecto ~30 días anteriores a la primera concesión. Mostrar "Verás datos desde {fecha}" en `success` si el plugin lo permite; no pedir `READ_HEALTH_DATA_HISTORY` en 1.0.
- **iOS**: no reintentar el diálogo; HealthKit solo lo muestra una vez por tipo. "Revisar permisos en Salud" abre Ajustes `[[CONFIRMAR: si se puede abrir directamente Salud o solo app-settings:]]`.
- **Sincronización duplicada**: un solo `in-flight` por pantalla; botones "Actualizar" deshabilitados mientras `syncing`; agregados (suma de pasos/distancia/energía) con APIs de agregación del sistema para evitar doble conteo iPhone + reloj/anillo `[[CONFIRMAR: el plugin ofrece lectura agregada/estadística]]`; si se envía al backend, clave idempotente por (tipo, inicio, fin, origen) `[[CONFIRMAR: dedupe en backend]]`.
- **Batería**: sin polling; ventana de lectura acotada (hoy + 7 días para resumen); lectura incremental desde la última marca guardada.

## 4. Pasos 1-2-3 (versión genérica)

| Paso | iOS                                                                                                           | Android                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| ①    | Abre la app de tu anillo o banda y comprueba que tiene datos recientes.                                       | Igual.                                                                                                 |
| ②    | En sus ajustes, activa **Apple Health** (a veces "Salud" o "Apps conectadas") y permite **escribir** datos.   | En sus ajustes, activa **Health Connect** y permite que la app **escriba** datos.                      |
| ③    | Vuelve aquí y pulsa **Autorizar lectura**. En la ventana de Salud, activa las categorías y toca **Permitir**. | Vuelve aquí y pulsa **Autorizar lectura**. En Health Connect, activa los permisos y toca **Permitir**. |

Microcopy clave del paso ②: el permiso de **escribir** es de la app del accesorio hacia Salud/Health Connect; Copp Adresd solo **lee**. Es el punto de confusión más común: se enfatiza con el diagrama del hero.

## 5. Guía por app (contenido de los chips)

Rutas orientativas a 2026-11; los fabricantes cambian menús. `[[CONFIRMAR: verificar cada ruta en la versión vigente antes de publicar]]`.

| App / accesorio  | iOS → Apple Health                                                                              | Android → Health Connect                                                                     | Visible en                |
| ---------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------- |
| Oura             | App Oura → Perfil/Ajustes → Apps conectadas / Integraciones → Apple Health → activar.           | App Oura → Ajustes → Apps conectadas → Health Connect → activar.                             | iOS, Android              |
| Ultrahuman       | App Ultrahuman → Perfil → Integraciones / Apps conectadas → Apple Health → activar.             | App Ultrahuman → Perfil → Integraciones → Health Connect → activar.                          | iOS, Android              |
| Fitbit           | **Sin sincronización oficial con Apple Health.** Mostrar aviso y sugerir registro manual.       | App Fitbit → Perfil/Ajustes → Health Connect → activar.                                      | Android (iOS: solo aviso) |
| Garmin           | Garmin Connect → Más → Ajustes → Apps conectadas → Apple Health → activar.                      | Garmin Connect → Ajustes → Apps conectadas → Health Connect `[[CONFIRMAR: disponibilidad]]`. | iOS, Android              |
| Samsung Health   | No existe en iOS (chip oculto).                                                                 | Samsung Health → Ajustes → Health Connect → activar permisos de escritura.                   | Solo Android              |
| Apple Watch      | Automático: el reloj guarda en Salud. Solo paso ③.                                              | No aplica (chip oculto).                                                                     | Solo iOS                  |
| Otro / Mi anillo | Guía genérica §4 + "Si tu app no menciona Apple Health, puede que no comparta datos con Salud." | Guía genérica §4 + "Si tu app no menciona Health Connect…".                                  | iOS, Android              |

Anillo/banda entregado por el programa: `[[CONFIRMAR: nombre de la app oficial del fabricante y si escribe en Apple Health / Health Connect]]`. Si sí, añadir chip con el nombre comercial de **la app** (no del modelo de hardware, decisión D8) y ponerlo primero. Si no, la guía debe decirlo con honestidad y ofrecer registro manual.

## 6. Sin accesorio o sin autorización

- Enlace persistente "No tengo accesorio · Registrar a mano" en todos los estados (excepto `syncing`), que lleva al registro manual existente de mediciones `[[CONFIRMAR: destino exacto (pantalla de mediciones / historial)]]`.
- "Ahora no" en el pre-permiso → toast `hc.toast.declined` ("Puedes conectarlo cuando quieras desde Perfil") y vuelta al origen. Sin re-preguntar en 14 días desde Home (el usuario puede entrar por Perfil cuando quiera).
- Ninguna función del programa se bloquea por no conectar. Las tarjetas de Home sin datos muestran estado vacío con "Registrar a mano" como primer CTA y "Conectar accesorio" como segundo.

## 7. Pre-permiso (sheet antes del diálogo nativo)

`IonModal` tipo sheet (breakpoints 0.75/1), título `hc.prePermission.title`, lista de tipos de dato (icono + nombre + para qué en una línea), aviso de privacidad (`hc.privacy.*`), botones "Continuar" (primary) y "Ahora no" (fill clear). No preseleccionar ni ocultar el "Ahora no". El sheet no imita la UI del sistema (evitar parecer el diálogo de Apple/Google).

## 8. Accesibilidad (WCAG 2.2 AA)

- **Foco**: al entrar, foco en el `h1` de la pantalla. Al cambiar de estado, mover foco al título del hero solo si el cambio lo provocó el usuario (tras autorizar o reintentar); cambios por resume no roban foco. Al cerrar el sheet de pre-permiso, devolver el foco al botón que lo abrió.
- **aria-live**: región `aria-live="polite"` con el texto de estado (`syncing` → "Sincronizando datos…", `success` → "Conectado. Última lectura hace X"). `error` usa `role="alert"`. No anunciar el contador de progreso.
- **Diagrama del hero**: `role="img"` con `aria-label` = `hc.hero.diagramLabel`. Flechas decorativas `aria-hidden`.
- **Stepper**: lista ordenada `<ol>`; paso activo con `aria-current="step"`; números no solo por color.
- **Chips**: grupo con `role="radiogroup"` + `aria-label` (`hc.apps.label`) o `IonSegment`; cada chip ≥ 44×44 px de área táctil.
- **Tamaños**: texto base 16 px, mínimo 14 px en metadatos; soporta Dynamic Type / escala de fuente 200 % sin truncar CTA (botones con wrap, sin altura fija).
- **Contraste**: texto blanco sobre `--grad-brand-v` (#023467 → #3d7b72) : el extremo más claro (#3d7b72) da ≈ 4.9:1 (pasa AA justo); no usar texto blanco con opacidad < 1 ni `--wellness-on-dark-muted` para texto pequeño sobre esa zona. `--wellness-muted` (#52677e) sobre blanco ≈ 5.8:1 OK. Estados usan `--wellness-success|warning|error` + icono + texto, nunca solo color.
- **Reduced motion**: con `prefers-reduced-motion: reduce` el pulso del diagrama y el "count-up" del resumen se desactivan; transiciones de estado = cambio instantáneo u opacidad ≤ 150 ms. Framer Motion: respetar `useReducedMotion`.
- **Anchos**: 320 px (chips en scroll-x con fade lateral, diagrama apila etiquetas debajo de los nodos, CTA ancho completo); 390 px (layout de referencia); 768 px / iPad (contenido centrado `max-width: min(560px, 100%)`, consistente con el token existente; diagrama horizontal con etiquetas al lado). Safe areas con `--ion-safe-area-*`. Sin scroll horizontal de página.

## 9. Micro-interacciones y tono visual

- **Diagrama vivo**: nodos accesorio → Salud/Health Connect → Copp Adresd. En `available` la flecha 2→3 está punteada en `--brand-sky`; al autorizar se "rellena" de izquierda a derecha (300 ms ease-out, `--wellness-transition`) y el nodo Copp Adresd recibe un halo `--wellness-success-bg`. Es la recompensa visual del flujo.
- **Sincronizando**: un pulso suave (opacidad 0.6↔1, 1.2 s) recorre la flecha 1→2→3. Nada de spinners centrales; skeletons en el resumen.
- **Éxito**: haptic ligero (`@capacitor/haptics` impact light, ya en dependencias) + resumen con count-up de 600 ms en pasos. Sin confeti.
- **Error / vacío**: tarjeta `--wellness-warning-bg` o `--wellness-error-bg` con icono de Ionicons, título humano, causa probable y una acción. Tono: sereno, nunca alarmista.
- **Chips**: estado seleccionado `--teal-l` fondo / `--teal-d` texto (patrón ya usado en la app). Cambio de guía con crossfade de 150 ms.
- **Tipografía**: títulos Space Grotesk, cuerpo Inter (fuentes existentes). Iconos Ionicons (`watch-outline`, `heart-outline`, `footsteps-outline`, `moon-outline`, `lock-closed-outline`).
- **Logos de terceros**: no usar logotipos de Apple Health, Health Connect, Oura, etc. salvo con sus guías de marca y assets oficiales (`[[CONFIRMAR: si se usará el badge oficial "Works with Apple Health"]]`); por defecto, texto + icono genérico.
- **Dark mode**: no existe en la app; no diseñar variante.

## 10. Datos mostrados tras conectar

- Resumen: pasos de hoy, sueño de anoche (duración), frecuencia cardíaca más reciente y en reposo, con la etiqueta "Estimación de tu accesorio" y el origen (`Desde Apple Health · {app}` si el plugin expone la fuente `[[CONFIRMAR]]`).
- Sin rangos de "normal/anormal", sin alertas, sin colores de riesgo. Tendencias neutrales ("+1.200 pasos que ayer").
- Fecha/hora relativa de última lectura ("hace 5 min") con `Intl.RelativeTimeFormat` según idioma.
