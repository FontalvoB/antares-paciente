# KAN-136 — Adaptación de diseño del onboarding Agentic Wellness IA

> Lead de diseño · 2026-11-24 · Estado: **decidido** (modo YOLO, sin preguntas abiertas).
> Fuentes: prototipo `app-objetivo-ejercicio-nutricion (1).html`, Guía del desarrollador v5.2,
> `AGENTS.md`, skills `ionic-theme|components|forms|responsive`, `theme/variables.css`,
> `theme/global.css`, `LoginPage.tsx`, `OnboardingPage.tsx`, `features/wellness/{CONTRACT.md,domain/*,wellness.css}`.

## 0. Principio rector

El prototipo aporta **arquitectura de información y copy**. No aporta estética. La pantalla
final debe ser indistinguible del resto de COPP-ADRESD:

| Del prototipo SE TOMA                                      | Del prototipo NO SE TOMA                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Orden de pasos, preguntas Sí/No, compuerta, avisos legales | Paleta `--or/--bl2/--navy` propia, naranja como color de acción                     |
| Copy base (reescrito a lenguaje de bienestar)              | Emojis como iconografía (⬇️ 💪 🎯 🐢 🚶 🌱 🥛)                                      |
| "Responde Sí o No a cada pregunta"                         | `.hero` con gradiente `#14244D→#2B5BB5`, sombras de "teléfono", `.phone`            |
| Bloqueos por edad/IMC/"Sí"                                 | Densidad 14px/1.45 con cards de 10px de padding; `.chip` como botón Sí/No           |
| Aviso legal en 5 viñetas                                   | KPIs técnicos ("Mifflin-St Jeor", "peso proyectado al día 365", "tiempo a tu meta") |
|                                                            | Botón "Ver ejemplos" (es del demo, no del producto)                                 |
|                                                            | Dark mode (la app no lo tiene; ver `AGENTS.md`)                                     |

**Sistema visual obligatorio** (ya existe, no se crea nada nuevo):

- Contenedor: `.screen.onb-page` + `header.onb-head` (marca, `.onb-stepper`, `h1.onb-head-title`, `p.onb-head-sub`) + `.screen-scroll.no-nav.onb-body` + `.onb-stack` (cascada) + `.onb-foot > .onb-foot-row`.
- Bloques: `section.onb-card` con `tone-*` + `.onb-card-head` (`.onb-card-ico` con `IonIcon` outline).
- Campos: `.field > label` + `IonInput.fld` / `IonSelect.fld` (estilo `.onb-page ion-input.fld`).
- Notas: `.onb-trust-safe|info|warn` para confianza/ayuda; `.auth-alert` (`role="alert"`) para errores de servidor.
- Objetivo: `.wl-step-head`, `.wl-title`, `.wl-sub`, `.wl-progress`, `.wl-options/.wl-option`, `.wl-chips/.wl-chip`, `.wl-field-grid`, `.wl-question` + `.wl-answer-row/.wl-answer`, `.wl-note-*`, `.wl-gate/.wl-gate-issue`, `.wl-summary/.wl-kpi-grid/.wl-kpi`.
- Botones: `IonButton className="bt bt-primary"` (píldora navy 54px) y `bt-ghost` para Atrás.
- Tipografía: Space Grotesk en títulos (`.onb-head-title`, `.wl-title`, `.display`), Inter en cuerpo. Iconos `ionicons/icons` outline.

## 1. Contradicciones prototipo ↔ guía v5.2 / issue (se elige la guía)

| #   | Prototipo                                                 | Guía / issue                                                  | Decisión                                                                                              |
| --- | --------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | PAR-Q de **5** preguntas                                  | PAR-Q de **7** (§2.2, criterio 1)                             | 7 preguntas (`PARQ_QUESTIONS`, ya en dominio).                                                        |
| 2   | Actividad dentro de "Tus datos"; ritmo en paso propio     | Contrato: paso 2 = actividad **+** ritmo                      | Paso 2 combina actividad y ritmo. "Tus datos" solo antropometría.                                     |
| 3   | "Sí" bloquea **sin salida**                               | Un "Sí" muestra "Consulta primero a tu médico" + confirmación | "Sí" ⇒ aviso + checkbox de confirmación (`doctorConfirmed` / `nutritionistConfirmed`).                |
| 4   | Resumen con peso proyectado día 365 y semanas a la meta   | §7 FTC: sin resultados garantizados                           | **No se muestran** proyecciones de peso ni semanas estimadas. `estimatedWeeks` no se pinta.           |
| 5   | "Con esto **la IA** ajusta calorías…"                     | §1: la IA no decide calorías ni ejercicios                    | Copy: "Con esto calculamos…". Nunca atribuir decisiones a la IA.                                      |
| 6   | Copy "ganar masa limpia", "marcar sin perder músculo"     | §7: sin promesas                                              | Reescrito en §3 (orientación, no resultado).                                                          |
| 7   | Términos sin versión ni fecha visibles                    | Contrato: versión y fecha-hora visibles                       | Se muestra `WELLNESS_TERMS_VERSION` y fecha-hora local al aceptar.                                    |
| 8   | Ritmo "max" ausente pero parametrizado                    | Tipos: `max` existe, UI v1 no lo ofrece                       | Solo Suave y Moderado.                                                                                |
| 9   | Mensaje IMC en dominio: "Elige **mantener** o subir masa" | No existe objetivo "mantener" en `WellnessGoal`               | Copy de UI: "Elige _Subir masa muscular_ o consulta a un profesional". Ver riesgo R2 (ajustar clave). |

## 2. Mapa pantalla por pantalla

Flujo (`OnboardingStage`): `email → emergency → terms → password → objective → ready`.
El `.onb-stepper` del header muestra **5 puntos** (Correo · Emergencia · Términos · Contraseña · Objetivo).
Durante `objective` el punto 5 queda en `now` y el progreso interno de 8 pasos vive en el cuerpo
(`.wl-step-head` + `.wl-progress`), nunca un segundo stepper de puntos.

### 2.1 Paso 1 · Correo (`EmailStep`)

- **Jerarquía**: `h1` título → sub → `onb-card tone-teal` (ico `mailOutline`) con un campo → nota de confianza → CTA fijo.
- **Componentes**: `IonInput type="email" inputmode="email" autocomplete="email" enterkeyhint="next" className="fld"`; CTA `IonButton bt bt-primary` con `IonSpinner` inline mientras `busy`.
- **Cuenta existente** (`existingAccount=true`): en la MISMA card aparece debajo un segundo bloque `.field.onb-pwd` con `IonInput type="password" autocomplete="current-password"` + `IonButton.fld-eye` (patrón de `OnboardingPage`). Encima, `.onb-trust-info` explicando que ya hay cuenta. Enlace secundario `bt-ghost` "¿Olvidaste tu contraseña?" → `onBackToLogin`. El correo queda editable (no bloquear: la persona puede haberse equivocado).
- **Reutiliza**: `.onb-card`, `.field`, `.fld`, `.onb-pwd`, `.fld-eye`, `.onb-trust-info`, `.auth-alert`.
- **No copiar**: nada (el prototipo no tiene este paso); no inventar ilustraciones.

### 2.2 Paso 2 · Contacto de emergencia (`EmergencyStep`)

- **Jerarquía**: título → sub → `EmergencyContactsForm` existente (principal obligatorio, respaldo opcional) → `.onb-trust-warn` con el aviso 911 → CTA.
- **Componentes**: el formulario existente (no duplicar). Validación con `emergencyContactsError` al pulsar Continuar; error en `.auth-alert role="alert"` y foco al primer campo inválido.
- **Reutiliza**: `onb-card tone-panic` (ico `callOutline`) para el principal, `tone-ice` para el respaldo.
- **No copiar**: botón SOS rojo flotante del prototipo (`.fsos`) — aquí no hay sesión ni plan; el SOS real vive en la app.

### 2.3 Paso 3 · Términos (`TermsStep`)

- **Jerarquía**: título → `onb-card tone-teal` con `.onb-doc` (5 viñetas del aviso, scroll propio si excede) → `IonCheckbox` con etiqueta larga → meta "Versión · fecha" → CTA deshabilitado hasta aceptar.
- **Componentes**: `IonCheckbox labelPlacement="end" justify="start"` (área táctil de toda la fila ≥44px). Enlaces a Términos y Privacidad como `IonButton fill="clear" size="small"` que abren `IonModal` (no navegar fuera y perder el borrador).
- **Reutiliza**: `.onb-doc`, `.onb-card`, `.onb-trust-safe` ("Tus respuestas se tratan como datos sensibles de salud").
- **No copiar**: `.note` ámbar con viñetas "•" en texto; checkbox nativo de 20px.

### 2.4 Paso 4 · Contraseña (`PasswordStep`)

- **Jerarquía**: título → `onb-card tone-org` (ico `lockClosedOutline`) con contraseña + medidor `.onb-strength` + `IonProgressBar` + confirmación + checklist `.onb-req` → CTA "Crear cuenta".
- **Componentes**: patrón idéntico a `OnboardingPage` (paso 4 actual) — `autocomplete="new-password"`, `.fld-eye` con `aria-pressed`, requisitos con `aria-describedby`.
- **Reutiliza**: `.onb-pwd`, `.onb-req`, `.onb-req-item(.on)`, `.onb-req-dot`, `.onb-strength`.
- **No copiar**: n/a. **No** usar "Protege tu expediente médico" (copy clínico del onboarding anterior): ver §3.

### 2.5 Objetivo · estructura común (`ObjectiveWizard`, 8 pasos)

- Cabecera de paso en cuerpo: `.wl-step-head` → `.wl-step-count` ("Paso 3 de 8 · Actividad") → `h2.wl-title` → `p.wl-sub`. Debajo `.wl-progress` (`role="progressbar"`, `aria-valuenow`, `aria-valuemin=1`, `aria-valuemax=8`, `aria-valuetext="Paso 3 de 8"`).
- Pie: `.onb-foot-row` → `bt-ghost` "Atrás" (en paso 0: "Salir" → `onExit`) + `bt-primary` "Continuar" (paso 7: "Generar mi plan").
- Validación por paso con `RANGES`/`evaluateGate`: el CTA **no** se deshabilita en silencio; al pulsar con datos inválidos se muestran errores inline y se enfoca el primero. Excepción: Términos (CTA deshabilitado + texto que explica por qué).
- Iconos de opción: `IonIcon` en `.wl-option-ico` — nunca emojis.

#### Paso 0 · Meta

- `role="radiogroup"` `.wl-options` con 3 `.wl-option` (`role="radio"`, `aria-checked`). Iconos: bajar `trendingDownOutline`, masa `barbellOutline`, definir `bodyOutline`.
- Nota `.wl-note-info`: "Puedes cambiarlo después".
- No copiar: emojis, borde 2px azul, fondo `--bl2`.

#### Paso 1 · Tus datos

- `onb-card tone-teal`: Nombre (`IonInput autocomplete="given-name"`), Sexo (`.wl-chips` radiogroup de 2 `.wl-chip`, con ayuda "Solo para estimar tu gasto energético"), luego `.wl-field-grid` 2 columnas: Edad / Estatura (cm), Peso actual (kg) / Cintura (cm), Peso meta (kg) a ancho completo.
- Numéricos: `IonInput type="number" inputmode="decimal"` (edad `numeric`), sufijo de unidad en `slot="end"` (`<span aria-hidden>`), unidad también en el `label` para lector de pantalla.
- Errores inline bajo cada campo (`helperText`/`errorText` de `IonInput` + clase `ion-invalid ion-touched`).
- No copiar: inputs 9px de padding, `<select>` nativo.

#### Paso 2 · Actividad y ritmo

- Card 1 "Actividad actual": `.wl-options` con 4 `.wl-option` compactas (radiogroup). Sin iconos distintos: usar el mismo `walkOutline` con 1-4 puntos no aporta; mejor solo texto (título + días/semana).
- Card 2 "Ritmo": 2 `.wl-option` (Suave / Moderado), ico `leafOutline` / `speedometerOutline`. Línea secundaria: "−10 % de tus calorías de mantenimiento" calculada desde `PACE_PCT` según objetivo (signo "+" en masa).
- `.wl-note-info`: límites del motor y revisión semanal.
- No copiar: 🐢/🚶, `<select>` de actividad.

#### Paso 3 · Preferencias

- `.wl-chips` con 2 toggles (`role="switch"` NO; usar `aria-pressed` en `.wl-chip` porque son botones independientes): Vegetariana (`leafOutline`), Sin lácteos (`ban` outline dentro del chip, `aria-hidden`).
- `.wl-note-warn`: la app no gestiona alergias (consistente con NQS 3).
- Estado "vacío" válido: ninguna preferencia ⇒ texto bajo chips "Sin preferencias: verás un menú variado".

#### Paso 4 · PAR-Q (7) y Paso 5 · NQS (6)

- Intro `p.wl-sub` + lista de `.wl-question` numeradas (`<fieldset>` + `<legend>` con la pregunta; dentro `.wl-answer-row` con `role="radiogroup"` y dos `.wl-answer` `role="radio"` + `aria-checked`; ver §5).
- Contador visible y anunciado: "4 de 7 respondidas" (`aria-live="polite"`).
- Al marcar **cualquier "Sí"**: aparece al final (no por pregunta, para no saturar) un bloque `.wl-note-warn` con `IonIcon informationCircleOutline` + "Consulta primero a tu médico" + `IonCheckbox` de confirmación. Sin marcar, el gate devuelve `doctor`.
- **Decisión visual Sí/No (cambio recomendado al integrador en `wellness.css`)**: `.wl-answer.is-yes` NO debe pintarse en rojo. Rojo comunica "respuesta incorrecta" e incentiva mentir. Ambos estados seleccionados usan el mismo estilo (`--teal-l` + borde `--teal` + `IonIcon checkmark`). La consecuencia se comunica con la nota naranja, no con el color del botón.
- No copiar: `.chip` rojo relleno para "Sí", texto "bloquea" en la intro (asusta); usar "te pediremos confirmar".

#### Paso 6 · Términos del plan

- Reutiliza el mismo patrón del 2.3 pero con el aviso de bienestar específico del plan (5 viñetas §3.7) en `.onb-doc` + `IonCheckbox` + línea "Versión {version} · aceptado el {fecha}" tras marcar.
- Si los términos del paso 3 de cuenta ya se aceptaron con la misma versión, este paso igualmente se muestra (son el aviso del plan, requerido por el gate `terms`), pero con texto corto y el detalle colapsado en un `IonAccordion`.

#### Paso 7 · Generar

- Si `gate.ok === false`: `GateNotice` = `.wl-gate` con un `.wl-gate-issue` por problema (`IonIcon alertCircleOutline` + mensaje + botón "Ir a {paso}" → `onGoToStep(issue.step)` y foco al `field`). Agrupar issues `unanswered` del mismo paso en uno solo ("Faltan 3 respuestas en Seguridad del ejercicio").
- Si `ok`: resumen previo breve (objetivo, ritmo, preferencias, cada uno con "Editar") en `onb-card` + CTA "Generar mi plan". Durante `generating`: CTA con `IonSpinner` y texto "Preparando tu plan…", resto deshabilitado; skeleton no aplica (pantalla siguiente).
- No copiar: hero con kcal antes de generar (el número lo da el backend, no la UI).

### 2.6 "Tu plan está listo" (`PlanReady`)

- **Jerarquía**: `Mascot pose="success"` + `.onb-done-badge` (patrón del "Registro completado" actual) → `h1` "Tu plan está listo, {nombre}" → sub "Día 1 de 365" → `.wl-kpi-grid` (kcal/día, proteína, carbohidratos, grasas) → `.onb-done-list` (Agua · Fibra · Ejercicio 4 ejercicios/día · "Se ajusta según tus registros diarios") → nota de bienestar `.onb-trust-info` con "Ver aviso" (`IonModal`) → aviso 911 → CTA "Empezar".
- Si hubo "Sí" confirmado: `.wl-note-warn` recordando que confirmó consulta profesional.
- **No mostrar**: IMC, semanas estimadas, peso proyectado, TDEE, nombre de fórmula, gráfico de 365 días.
- Etiqueta en KPIs: "estimado" (p. ej. "≈ 1 850 kcal/día · estimación").
- No copiar: `.hero` gradiente azul, "Primero verás tu plan de Ejercicio…" (orden de pantallas es decisión del shell).

## 3. Microcopy definitivo ES / EN

> Claves en español (`t("…")`). EN se entrega aquí; el integrador las vuelca a `en.json`
> (no se toca `es.json`/`en.json` en este ticket). Tono: tuteo, frases cortas, sin jerga clínica.

### 3.1 Comunes

| Uso               | ES                                                                       | EN                                                                        |
| ----------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Marca header      | Copp Adresd                                                              | Copp Adresd                                                               |
| Stepper aria      | Paso {step} de {total}                                                   | Step {step} of {total}                                                    |
| Labels stepper    | Correo · Emergencia · Términos · Contraseña · Objetivo                   | Email · Emergency · Terms · Password · Goal                               |
| CTA               | Continuar                                                                | Continue                                                                  |
| Atrás             | Atrás                                                                    | Back                                                                      |
| Salir (paso 0)    | Salir                                                                    | Exit                                                                      |
| Reintentar        | Reintentar                                                               | Try again                                                                 |
| Error genérico    | No pudimos completar la acción. Revisa tu conexión e inténtalo de nuevo. | We couldn't complete that. Check your connection and try again.           |
| Offline           | Sin conexión. Guardamos lo que llevas; continúa cuando vuelva la red.    | You're offline. Your progress is saved; continue when you're back online. |
| Emergencia (fijo) | En una emergencia llama al 911.                                          | In an emergency, call 911.                                                |
| Bienestar (mini)  | Información general de bienestar. No es consejo médico.                  | General wellness information. Not medical advice.                         |
| Ver aviso         | Ver aviso                                                                | See notice                                                                |
| Cerrar            | Cerrar                                                                   | Close                                                                     |

### 3.2 Paso 1 · Correo

| Uso                     | ES                                                                          | EN                                                                            |
| ----------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Título                  | Empecemos con tu correo                                                     | Let's start with your email                                                   |
| Sub                     | Lo usarás para entrar y recuperar tu cuenta.                                | You'll use it to sign in and recover your account.                            |
| Card                    | Correo electrónico · Solo lo usamos para tu cuenta                          | Email · We only use it for your account                                       |
| Label                   | Correo electrónico                                                          | Email                                                                         |
| Placeholder             | tucorreo@ejemplo.com                                                        | you@example.com                                                               |
| Error vacío             | Escribe tu correo.                                                          | Enter your email.                                                             |
| Error formato           | Revisa el correo: parece incompleto.                                        | Check your email: it looks incomplete.                                        |
| Cuenta existente (nota) | Ya tienes una cuenta con este correo. Escribe tu contraseña para continuar. | You already have an account with this email. Enter your password to continue. |
| Label contraseña        | Contraseña                                                                  | Password                                                                      |
| Error credenciales      | El correo o la contraseña no coinciden.                                     | The email or password doesn't match.                                          |
| Olvidé                  | ¿Olvidaste tu contraseña?                                                   | Forgot your password?                                                         |
| CTA nuevo               | Continuar                                                                   | Continue                                                                      |
| CTA existente           | Entrar                                                                      | Sign in                                                                       |
| Busy                    | Verificando…                                                                | Checking…                                                                     |

### 3.3 Paso 2 · Emergencia

| Uso     | ES                                                                                        | EN                                                                          |
| ------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Título  | ¿A quién avisamos si lo necesitas?                                                        | Who should we contact if needed?                                            |
| Sub     | Un contacto principal y, si quieres, uno de respaldo.                                     | One main contact and, if you like, a backup.                                |
| Card 1  | Contacto principal · Obligatorio                                                          | Main contact · Required                                                     |
| Card 2  | Contacto de respaldo · Opcional                                                           | Backup contact · Optional                                                   |
| Errores | (los de `emergencyContactsError`, ya traducidos)                                          | —                                                                           |
| Nota    | Este contacto no sustituye a los servicios de emergencia. En una emergencia llama al 911. | This contact doesn't replace emergency services. In an emergency, call 911. |

### 3.4 Paso 3 · Términos (cuenta)

| Uso       | ES                                                                                            | EN                                                                                   |
| --------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Título    | Antes de seguir                                                                               | Before you continue                                                                  |
| Sub       | Lee cómo funciona la app y qué hacemos con tus datos.                                         | Read how the app works and what we do with your data.                                |
| Checkbox  | Tengo 18 años o más y acepto los Términos, el Aviso de bienestar y la Política de privacidad. | I'm 18 or older and I accept the Terms, the Wellness Notice and the Privacy Policy.  |
| Meta      | Versión {version} · aceptado el {fecha}                                                       | Version {version} · accepted on {date}                                               |
| CTA off   | Acepta para continuar                                                                         | Accept to continue                                                                   |
| Confianza | Tus respuestas de salud se guardan cifradas y solo las ve tu equipo autorizado.               | Your health answers are stored encrypted and only your authorized team can see them. |

### 3.5 Paso 4 · Contraseña

| Uso          | ES                                                                           | EN                                                                                |
| ------------ | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Título       | Crea tu contraseña                                                           | Create your password                                                              |
| Sub          | Protege tu cuenta y tus datos.                                               | Protect your account and your data.                                               |
| Labels       | Nueva contraseña · Confirmar contraseña                                      | New password · Confirm password                                                   |
| Requisitos   | Mínimo 8 caracteres · Una letra mayúscula · Un número · Un carácter especial | At least 8 characters · One uppercase letter · One number · One special character |
| Coinciden    | Las contraseñas coinciden                                                    | Passwords match                                                                   |
| No coinciden | Las contraseñas no coinciden                                                 | Passwords don't match                                                             |
| Error        | La contraseña no cumple los requisitos                                       | The password doesn't meet the requirements                                        |
| CTA          | Crear cuenta                                                                 | Create account                                                                    |
| Busy         | Creando tu cuenta…                                                           | Creating your account…                                                            |

### 3.6 Objetivo (8 pasos)

Etiquetas de paso: Meta · Tus datos · Actividad · Preferencias · Seguridad: ejercicio · Seguridad: alimentación · Aviso · Generar / Goal · Your details · Activity · Preferences · Safety: exercise · Safety: eating · Notice · Generate.
Contador: "Paso {n} de 8 · {etiqueta}" / "Step {n} of 8 · {label}".

| Paso / uso           | ES                                                                                                                   | EN                                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Título             | ¿Qué te gustaría lograr?                                                                                             | What would you like to work on?                                                                                                                             |
| 0 Sub                | Con esto calculamos tus calorías, proteína y tipo de ejercicio.                                                      | We use this to estimate your calories, protein and exercise type.                                                                                           |
| 0 Bajar              | Bajar de peso — Déficit moderado con proteína alta para cuidar tu músculo.                                           | Lose weight — A moderate deficit with high protein to support your muscle.                                                                                  |
| 0 Masa               | Subir masa muscular — Pequeño superávit y fuerza progresiva.                                                         | Build muscle — A small surplus and progressive strength work.                                                                                               |
| 0 Definir            | Definir — Déficit suave, proteína alta y trabajo de fuerza.                                                          | Tone up — A gentle deficit, high protein and strength work.                                                                                                 |
| 0 Nota               | Puedes cambiarlo después.                                                                                            | You can change this later.                                                                                                                                  |
| 0 Error              | Selecciona tu objetivo.                                                                                              | Select your goal.                                                                                                                                           |
| 1 Título             | Cuéntanos sobre ti                                                                                                   | Tell us about you                                                                                                                                           |
| 1 Sub                | Usamos estos datos solo para estimar tu plan.                                                                        | We only use this to estimate your plan.                                                                                                                     |
| 1 Labels             | Nombre · Sexo · Edad · Estatura (cm) · Peso actual (kg) · Cintura (cm) · Peso meta (kg)                              | Name · Sex · Age · Height (cm) · Current weight (kg) · Waist (cm) · Goal weight (kg)                                                                        |
| 1 Ayuda sexo         | Solo para estimar tu gasto energético.                                                                               | Only used to estimate your energy needs.                                                                                                                    |
| 1 Opciones sexo      | Mujer · Hombre                                                                                                       | Female · Male                                                                                                                                               |
| 1 Ayuda cintura      | Mide a la altura del ombligo, sin apretar.                                                                           | Measure at belly-button level, without pulling tight.                                                                                                       |
| 1 Error rango        | Revisa este dato: debe estar entre {min} y {max} {unidad}.                                                           | Check this value: it must be between {min} and {max} {unit}.                                                                                                |
| 1 Errores vacíos     | (los `messageKey` del dominio: "Indica tu edad.", etc.)                                                              | Enter your age. · Enter your height. · Enter your current weight. · Enter your waist. · Enter your goal weight. · Select your sex to estimate energy needs. |
| 2 Título             | Tu actividad y tu ritmo                                                                                              | Your activity and pace                                                                                                                                      |
| 2 Actividad          | Sedentaria (poco o nada) · Ligera (1–3 días/sem) · Moderada (3–5 días/sem) · Alta (6–7 días/sem)                     | Sedentary (little or none) · Light (1–3 days/wk) · Moderate (3–5 days/wk) · High (6–7 days/wk)                                                              |
| 2 Ritmo              | Suave — {signo}{pct} % de tus calorías de mantenimiento · Moderado — {signo}{pct} % de tus calorías de mantenimiento | Gentle — {sign}{pct}% of your maintenance calories · Moderate — {sign}{pct}% of your maintenance calories                                                   |
| 2 Nota               | El plan nunca supera ±{max} % y se revisa cada semana con tus registros.                                             | The plan never goes beyond ±{max}% and is reviewed weekly with your logs.                                                                                   |
| 2 Error              | Selecciona tu nivel de actividad.                                                                                    | Select your activity level.                                                                                                                                 |
| 3 Título             | ¿Alguna preferencia al comer?                                                                                        | Any eating preferences?                                                                                                                                     |
| 3 Chips              | Vegetariana · Sin lácteos                                                                                            | Vegetarian · Dairy-free                                                                                                                                     |
| 3 Vacío              | Sin preferencias: verás un menú variado.                                                                             | No preferences: you'll see a varied menu.                                                                                                                   |
| 3 Nota               | La app no gestiona alergias ni intolerancias. Si tienes una diagnosticada, consulta a un profesional.                | The app doesn't manage allergies or intolerances. If you have a diagnosed one, talk to a professional.                                                      |
| 4 Título             | Seguridad para el ejercicio                                                                                          | Exercise safety                                                                                                                                             |
| 4/5 Sub              | Responde Sí o No a cada pregunta. Si respondes Sí, te pediremos confirmar que hablaste con un profesional.           | Answer Yes or No to each question. If you answer Yes, we'll ask you to confirm you've talked to a professional.                                             |
| 4/5 Contador         | {n} de {total} respondidas                                                                                           | {n} of {total} answered                                                                                                                                     |
| 4/5 Botones          | Sí · No                                                                                                              | Yes · No                                                                                                                                                    |
| 4 Aviso "Sí"         | Consulta primero a tu médico antes de empezar a hacer ejercicio.                                                     | Talk to your doctor first before you start exercising.                                                                                                      |
| 4 Confirmación       | Ya consulté a un profesional de la salud y puedo hacer actividad física.                                             | I've talked to a health professional and I can do physical activity.                                                                                        |
| 5 Título             | Seguridad para tu alimentación                                                                                       | Eating safety                                                                                                                                               |
| 5 Aviso "Sí"         | Consulta primero a un profesional antes de cambiar tu alimentación.                                                  | Talk to a professional first before changing how you eat.                                                                                                   |
| 5 Confirmación       | Ya consulté a un profesional y puedo seguir un plan de alimentación general.                                         | I've talked to a professional and I can follow a general eating plan.                                                                                       |
| 4/5 Error            | Faltan {n} respuestas.                                                                                               | {n} answers missing.                                                                                                                                        |
| 6 Título             | Aviso importante                                                                                                     | Important notice                                                                                                                                            |
| 6 Checkbox           | Leí el aviso y entiendo que esta app no reemplaza a un profesional de la salud.                                      | I read the notice and understand this app doesn't replace a health professional.                                                                            |
| 7 Título (ok)        | Todo listo para tu plan                                                                                              | Ready to build your plan                                                                                                                                    |
| 7 Sub (ok)           | Revisa tus respuestas. Puedes editarlas antes de generar.                                                            | Review your answers. You can edit them before generating.                                                                                                   |
| 7 Título (bloqueado) | Necesitamos revisar algo                                                                                             | We need to check something                                                                                                                                  |
| 7 Ir a paso          | Ir a {paso}                                                                                                          | Go to {step}                                                                                                                                                |
| 7 Editar             | Editar                                                                                                               | Edit                                                                                                                                                        |
| 7 CTA                | Generar mi plan                                                                                                      | Build my plan                                                                                                                                               |
| 7 Busy               | Preparando tu plan…                                                                                                  | Preparing your plan…                                                                                                                                        |
| 7 Error servidor     | No pudimos preparar tu plan. Tus respuestas siguen guardadas.                                                        | We couldn't prepare your plan. Your answers are still saved.                                                                                                |

**Mensajes de compuerta (UI)** — sustituyen/afinan los `messageKey` del dominio:

| Código           | ES                                                                                                                                   | EN                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `terms`          | Falta aceptar el aviso de bienestar.                                                                                                 | You still need to accept the wellness notice.                                                                             |
| `unanswered`     | Faltan {n} respuestas en {paso}.                                                                                                     | {n} answers missing in {step}.                                                                                            |
| `age`            | Esta versión es para personas de 18 años o más. Si escribiste mal tu edad, puedes corregirla.                                        | This version is for people 18 or older. If you mistyped your age, you can fix it.                                         |
| `bmi`            | Con tus datos actuales no ofrecemos un objetivo de bajar o definir. Puedes elegir _Subir masa muscular_ o hablar con un profesional. | With your current details we don't offer a lose or tone-up goal. You can choose _Build muscle_ or talk to a professional. |
| `doctor` (PAR-Q) | Respondiste Sí en seguridad del ejercicio. Confirma que consultaste a tu médico para continuar.                                      | You answered Yes in exercise safety. Confirm you've talked to your doctor to continue.                                    |
| `doctor` (NQS)   | Respondiste Sí en seguridad de la alimentación. Confirma que consultaste a un profesional para continuar.                            | You answered Yes in eating safety. Confirm you've talked to a professional to continue.                                   |

### 3.7 Aviso de bienestar (5 viñetas, `.onb-doc`)

| ES                                                                                                                                                                             | EN                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agentic Wellness IA ofrece información general de bienestar, alimentación y actividad física. No es un dispositivo ni un servicio médico, de nutrición clínica o de dietética. | Agentic Wellness IA provides general wellness, eating and physical-activity information. It is not a medical device or a medical, clinical-nutrition or dietetic service. |
| No diagnostica ni reemplaza la atención de un profesional. No indica ni ajusta medicamentos, suplementos ni dietas especiales.                                                 | It doesn't diagnose or replace care from a professional. It doesn't recommend or adjust medications, supplements or special diets.                                        |
| Habla con un profesional antes de cambiar tu alimentación o empezar a hacer ejercicio, sobre todo si tienes una condición de salud, estás embarazada o tomas medicamentos.     | Talk to a professional before changing how you eat or starting exercise, especially if you have a health condition, are pregnant or take medication.                      |
| Detén el plan y busca atención si sientes dolor o presión en el pecho, falta de aire intensa, desmayo o mareo fuerte. En una emergencia llama al 911.                          | Stop the plan and get help if you feel chest pain or pressure, severe shortness of breath, fainting or strong dizziness. In an emergency, call 911.                       |
| Los resultados varían entre personas y no están garantizados. Las calorías y porciones son estimaciones.                                                                       | Results vary from person to person and aren't guaranteed. Calories and portions are estimates.                                                                            |

> Cambio sobre el prototipo: "No diagnostica, trata, cura ni previene enfermedades" → "No diagnostica ni reemplaza la atención de un profesional". Evita listar verbos prohibidos en la UI del paciente; la formulación legal completa queda en Términos (revisión de abogado, §7 guía).

### 3.8 Tu plan está listo

| Uso       | ES                                                                                                        | EN                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Título    | Tu plan está listo, {nombre}                                                                              | Your plan is ready, {name}                                                                     |
| Sub       | Día 1 de 365                                                                                              | Day 1 of 365                                                                                   |
| KPIs      | kcal/día (estimación) · Proteína · Carbohidratos · Grasas                                                 | kcal/day (estimate) · Protein · Carbs · Fats                                                   |
| Lista     | Agua: {ml} ml · Fibra: {g} g · Ejercicio: 4 ejercicios al día · Se ajusta según lo que registres cada día | Water: {ml} ml · Fiber: {g} g · Exercise: 4 exercises a day · Adjusts to what you log each day |
| Nota "Sí" | Recuerda seguir las indicaciones del profesional que consultaste.                                         | Remember to follow the guidance of the professional you talked to.                             |
| CTA       | Empezar                                                                                                   | Get started                                                                                    |
| Busy      | Entrando…                                                                                                 | Opening…                                                                                       |

**Lista de palabras prohibidas** (revisar en PR con `rg -i`): diagnóstico, diagnosticar (salvo en preguntas NQS/PAR-Q y aviso), tratamiento, tratar, terapéutico, dosis, prescripción, receta, cura, curar, detox, garantizado, "resultados en X semanas", "perderás", "lograrás". EN: diagnose, treatment, treat, therapy, dose, prescription, cure, detox, guaranteed, "you will lose".
Excepción: las preguntas de seguridad conservan "diagnosticado/tratamiento" porque preguntan por la situación de la persona (texto canónico de `questions.ts`), no son claims del producto.

## 4. Estados

| Estado            | Dónde                                                                      | Diseño                                                                                                                                                                                                                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Loading           | Correo, Contraseña, Generar, Empezar                                       | CTA `bt-primary` con `IonSpinner name="crescent"` 16px + texto busy; `aria-busy="true"` en el formulario; campos `disabled`. Nunca overlay `IonLoading` a pantalla completa (rompe contexto).                                                                                                                            |
| Loading inicial   | Montaje de `PlanReady` si el plan llega async                              | Skeleton: `.wl-kpi` con `IonSkeletonText animated` (4 celdas) + 3 líneas en `.onb-done-list`.                                                                                                                                                                                                                            |
| Error validación  | Cualquier paso                                                             | `errorText` de `IonInput` + `ion-invalid ion-touched`; foco al primer inválido; texto concreto (§3).                                                                                                                                                                                                                     |
| Error servidor    | Correo/Contraseña/Generar                                                  | `.auth-alert role="alert"` arriba de la card + "Reintentar". Se conserva todo lo escrito.                                                                                                                                                                                                                                |
| 409 `plan_locked` | Generar                                                                    | Se pinta igual que `gate.ok=false` (`GateNotice`) usando `status.code` del backend; nunca toast genérico.                                                                                                                                                                                                                |
| Vacío             | Preferencias, respaldo de emergencia                                       | Válido: texto neutro ("Sin preferencias…", card de respaldo con "Opcional"). No es error.                                                                                                                                                                                                                                |
| Offline           | Todo el flujo                                                              | `useNetworkStatus()`: banda `.onb-trust-warn` (`cloudOfflineOutline`) bajo el header con el copy offline. Pasos locales (objetivo 0-6) siguen funcionando; CTAs que llaman red (Correo, Contraseña, Generar) se deshabilitan con texto "Necesitas conexión para este paso". El borrador se mantiene en memoria/contexto. |
| Aviso 911         | Emergencia (paso 2), aviso legal (pasos 3 y 6), nota "Sí" PAR-Q, PlanReady | `.onb-trust-warn` con `callOutline`; en PAR-Q "Sí" se añade al final del aviso. No usar `--panic`/rojo salvo el botón SOS real.                                                                                                                                                                                          |

## 5. Accesibilidad (WCAG 2.2 AA)

- **Estructura**: un solo `h1` por pantalla (`.onb-head-title`); `h2.wl-title` por paso del objetivo; `h3` no se usa en cards (usar `strong` de `.onb-card-head`, ya existente).
- **Foco**: al cambiar de paso, foco programático al `h1/h2` del paso (`tabIndex={-1}`) y scroll al inicio del `.onb-body`. Foco visible con `outline 2px var(--teal)` (ya en `.wl-*`); no quitar el anillo de Ionic. Al fallar validación, foco al primer campo inválido; al pulsar "Ir a {paso}" en `GateNotice`, foco al `issue.field`.
- **Orden de tabulación** = orden visual: header (sin elementos enfocables salvo idioma) → título → campos en orden → notas con enlaces → Atrás → CTA. El `.onb-foot` es `position:absolute` pero en DOM va después del contenido. Nada con `tabindex>0`.
- **Sí/No**: cada pregunta es `<fieldset>` + `<legend>` ("Pregunta 3 de 7: …"). `role="radiogroup"` + `role="radio"` + `aria-checked`, navegación con flechas y `aria-labelledby` a la legend. Se elige sobre `aria-pressed` (que pide el CONTRACT) porque Sí/No es exclusivo; `aria-pressed` queda solo para chips independientes. El estado no depende solo de color: icono `checkmark` en la opción seleccionada.
- **Opciones** (`.wl-option`, `.wl-chip` de sexo): `role="radiogroup"` / `role="radio"` / `aria-checked`, flechas cambian selección. Chips de preferencias: `aria-pressed` (independientes).
- **Áreas táctiles**: ≥44×44 px (`.wl-answer`, `.wl-chip` 44px, `.wl-option` 64px, `bt-primary` 54px, `.fld-eye` 44px). `IonCheckbox` con fila completa clicable. Espaciado ≥8px entre targets (2.5.8).
- **Contraste** (verificado contra tokens): `--mu #53657f` sobre blanco ≈ 5.6:1 ✔; `--teal-d` sobre `--teal-l` ✔; `--org-d` sobre `--org-l` ≈ 6:1 ✔. `--red #d9534f` sobre blanco ≈ 3.9:1 ✘ para texto → solo bordes/iconos (y por eso no se usa en "Sí"). Bordes de controles `--bd #dfe6ee` no alcanzan 3:1 (1.4.11): el estado seleccionado se apoya en borde `--teal` + fondo + icono, que sí cumplen.
- **Lectores de pantalla**: `aria-live="polite"` para contador de respuestas y cambios de estado offline; `role="alert"` para errores y bloqueos del gate; `.wl-progress` con `role="progressbar"` + `aria-valuetext`; unidades en el label ("Peso actual en kilogramos"); iconos decorativos `aria-hidden="true"`; mascota `aria-hidden`.
- **Formularios**: `autocomplete` correcto (email, current/new-password, given-name); `inputmode` numérico; no deshabilitar pegar en contraseña (3.3.8 autenticación accesible); errores con texto, no solo color (3.3.1).
- **Reduced motion**: la cascada `.onb-stack` ya respeta `prefers-reduced-motion`; `.wl-progress`/`.wl-option` también. Framer Motion, si se usa en `PlanReady`, debe leer `useReducedMotion()` y desactivar el pop del badge.
- **Zoom/texto 200 %**: `.wl-field-grid` cae a 1 columna ≤360px (existe); verificar que el `.onb-foot` no tape el último campo (padding-bottom 140px existente).
- **Idioma**: `lang` del documento sincronizado con `useI18n().lang`.

## 6. Riesgos de confusión y mitigación

| #   | Riesgo                                                                                                           | Mitigación                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Edad <18**: la persona cree que la app "falló" o miente sobre su edad.                                         | Aviso inline en el campo Edad al salir del foco (no esperar al paso 7) con copy neutral + "si escribiste mal tu edad, corrígela". Sin culpa ni lenguaje de rechazo. El gate repite el mensaje con "Ir a Tus datos". Checkbox de términos dice "Tengo 18 años o más" (coherente). |
| R2  | **IMC <18.5 con bajar/definir**: mencionar "IMC" sin contexto alarma; el dominio sugiere "mantener" (no existe). | No mostrar el número de IMC. Mensaje §3.6 `bmi` con salida concreta: botón "Elegir Subir masa muscular" que fija `goal="masa"` y vuelve al paso 0 resaltado. **Acción integrador**: cambiar `messageKey` de `gate.ts` (quitar "mantener").                                       |
| R3  | **"Sí" en PAR-Q/NQS** pintado en rojo ⇒ "respuesta mala" ⇒ incentivo a mentir.                                   | Estado seleccionado idéntico para Sí y No; consecuencia en nota naranja agrupada al final; copy "te pediremos confirmar", no "bloquea". Checkbox de confirmación explícito, nunca preseleccionado.                                                                               |
| R4  | Confundir confirmación "ya consulté" con aceptar términos.                                                       | La confirmación vive dentro del aviso naranja del paso PAR-Q/NQS, con texto específico (médico vs profesional de alimentación). Términos solo en pasos 3 y 6.                                                                                                                    |
| R5  | **Términos sin aceptar**: CTA gris sin explicación.                                                              | CTA muestra "Acepta para continuar" mientras está deshabilitado; checkbox con etiqueta completa; tras aceptar se muestran versión y fecha-hora.                                                                                                                                  |
| R6  | Dos términos (cuenta paso 3 y aviso del plan paso 6) parecen duplicados.                                         | Títulos distintos ("Antes de seguir" vs "Aviso importante"); el paso 6 resume y colapsa el detalle en `IonAccordion`.                                                                                                                                                            |
| R7  | Dos indicadores de progreso (5 puntos + 8 pasos).                                                                | Header fijo en punto 5 "Objetivo"; dentro, barra fina + "Paso n de 8". Nunca otro stepper de puntos.                                                                                                                                                                             |
| R8  | Peso meta incoherente con objetivo (meta > peso actual con "bajar").                                             | Validación suave en paso 1: nota `.wl-note-warn` "Tu peso meta es mayor que tu peso actual. ¿Quieres elegir Subir masa muscular?" (no bloquea; el motor lo maneja).                                                                                                              |
| R9  | Leer kcal como prescripción.                                                                                     | Etiqueta "estimación", aviso mini de bienestar con "Ver aviso", sin TDEE ni nombre de fórmula.                                                                                                                                                                                   |
| R10 | Correo de cuenta existente lleva a crear una segunda cuenta.                                                     | Detección en paso 1 cambia CTA a "Entrar" y muestra contraseña en la misma card; enlace a recuperar contraseña.                                                                                                                                                                  |
| R11 | Número de emergencia: app en Colombia usa 123 en `PanicOverlay`.                                                 | El onboarding v1 (mercado EE. UU., guía §7) usa **911** fijo. Si se habilita Colombia, interpolar el número desde la lógica de país de `PanicOverlay` (fuera de alcance).                                                                                                        |
| R12 | Hex sueltos en `wellness.css` (`#fff`, `#8f2c2a`) contradicen "cero hex".                                        | Integrador: `#fff` → `var(--wh)`; `#8f2c2a` → token nuevo en `variables.css` o `var(--red)` solo en bordes. No bloquea diseño.                                                                                                                                                   |

## 7. Acciones para el integrador (no ejecutadas aquí)

1. `wellness.css`: `.wl-answer.is-yes` = mismo estilo que `.is-no`; reemplazar hex por tokens (R3, R12).
2. `gate.ts`: `messageKey` de `bmi` sin "mantener" (R2).
3. Volcar EN de §3 a `en.json` y correr `npm run i18n:check`.
4. `PlanReady`: no renderizar `bmi` ni `estimatedWeeks` aunque vengan en `PlanPreview`.
5. QA visual con `vision-reviewer` sobre capturas 375×812 y 320×568 de cada pantalla.
