# App web de pruebas — coppadresd-app-test

Verificado el **2026-11-04**. **Recorrido clínico terminado**: OTP real → onboarding → 9/9 tests → PendingAssignment → narrativa ES/EN real → Aplicar por UI → semana 1 activa → tarea emocional por UI, **+120 XP y racha 1**. El primer intento limitado al alta Auth se conserva como antecedente. Véase la continuación al final, incluidos los hallazgos de repetición de tests e indicadores.

## URL y recursos nuevos

**https://d1rmzt4ao2pn78.cloudfront.net**

Cuenta `933629770820`, perfil AWS CLI `fya-root`. S3 en `us-east-2`; CloudFront es global.

| Recurso creado | Identificador / ARN |
| --- | --- |
| Bucket | `coppadresd-app-test-web-933629770820` |
| ARN S3 | `arn:aws:s3:::coppadresd-app-test-web-933629770820` |
| Distribución CloudFront | `E10PNDIZLVIVB` — estado `Deployed`, habilitada |
| ARN CloudFront | `arn:aws:cloudfront::933629770820:distribution/E10PNDIZLVIVB` |
| Origin Access Control | `EA3VZPMAF9SGN`, nombre `coppadresd-app-test-web-oac` |
| Nombre visible de distribución | `CoppAddresd-App-Test` (Comment/DisplayName); tag Name `coppadresd-app-test-web` |

Estado reproducible: [resources.json](../infra/coppadresd-app-test/resources.json) y [distribution-config.json](../infra/coppadresd-app-test/distribution-config.json).

En FASE A solo se crearon esos recursos. No se modificaron buckets, distribuciones/orígenes, ALB, DNS, dominios, secretos ni skills de otros proyectos. El origen `erp.coppadresd.com` es una referencia HTTPS en la distribución NUEVA. En la continuación, el owner habilitó el flag de asignación y autorizó expresamente una excepción acotada de rollout para reparar la narrativa del ai-service; se documenta abajo. No se habilitaron seeders.

## Arquitectura y caché

- S3 tiene static website hosting configurado (`index.html` como índice/error), pero permanece **privado**, con sus cuatro opciones Block Public Access habilitadas.
- CloudFront usa el endpoint REST S3 `coppadresd-app-test-web-933629770820.s3.us-east-2.amazonaws.com`, HTTPS y OAC SigV4. La política del bucket permite `GetObject` únicamente a esta distribución. No es necesario abrir lectura pública ni usar el endpoint website HTTP.
- Behavior default → S3, `Managed-CachingOptimized`, compresión y redirección HTTP→HTTPS. Assets publicados con `public,max-age=31536000,immutable`.
- `/index.html` → S3 con `Managed-CachingDisabled`. HTML con `no-cache,max-age=0,must-revalidate`; `/` tiene el mínimo de 1 segundo de la política default. Las publicaciones invalidan únicamente `/` y `/index.html` de esta distribución.
- `/api/*` y `/storage/*` → `erp.coppadresd.com`, HTTPS, todos los métodos, `Managed-CachingDisabled` (`4135ea2d-6df8-44a3-9df3-4b5a84be39ad`).
- Origin request policy `Managed-AllViewerExceptHostHeader` (`b689b0a8-53d0-40ab-baf2-68738e2966ac`): **todas las cookies, todos los query strings y todos los headers del viewer salvo Host**, incluido Authorization. Host se adapta al origen ERP. Se verificó la política por AWS CLI.
- Certificado CloudFront por defecto; `PriceClass_100`; sin WAF, Lambda, compute, Route53 ni certificados comprados.
- No se aplica una conversión global de errores 403/404 a HTML: los errores API conservan su estado. La app navega por estado, no necesita fallback de rutas del router.

Referencia de AWS: [políticas administradas de origin request](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-origin-request-policies.html).

## Build y publicación

`capacitor.config.ts` usa `webDir: dist`. Se mantienen las variables de `.env.production` y el build nativo existentes.

Se añadió `VITE_WEB_SAME_ORIGIN=true`: únicamente en plataforma **web** devuelve base URL vacía desde `getApiBaseUrl/getAuthBaseUrl/getGatewayBaseUrl`. Las rutas `/api/...` salen al mismo CloudFront. `Capacitor.isNativePlatform()` conserva el gateway absoluto configurado y los fallbacks iOS/Android, incluso si el flag web está habilitado.

```powershell
npm run build:web:test
# Ejecuta npm run build (tsc -b && vite build) en modo production,
# con VITE_WEB_SAME_ORIGIN=true y VITE_DEV_TOOLS=false solo en el proceso hijo.

# Ya ejecutado UNA vez; el script aborta si el bucket/estado preexiste.
python scripts/deploy-test-web.py --create

# Publicar o actualizar exclusivamente el bucket/distribución registrados arriba.
python scripts/deploy-test-web.py --upload
```

El helper exige la cuenta indicada, el nombre exacto de bucket y el tag `Purpose=coppadresd-app-test` de CloudFront; no adopta un bucket existente. Usa `aws s3 sync` para assets y `aws s3 cp` para el HTML con su política de caché. No hace `--delete`.

Build publicado: 257 archivos, **147.668.467 bytes**. El bundle contiene `/api/auth/login` y `/api/v1/program/me/snapshot`. La comprobación en navegador confirma que el flag compila el comportamiento web correcto: cero llamadas API a otro origen. Las URLs nativas pueden seguir presentes en el bundle porque la selección de plataforma ocurre en runtime; no significa que web las utilice.

SHA-256 de `dist/index.html` y del HTML descargado de CloudFront, ambos iguales:

`cfb3933aec48c7bcf6f17b990bf3f422d8c922cf4833cc1f122ee3a5893b22df`

## Sanity y Playwright ejecutados

No hay herramientas MCP `tools.playwright.*` expuestas en esta sesión. Se utilizó la dependencia **Playwright 1.62.1** del repo con Chrome headless y contexto `devices['iPhone 13']`, viewport **390×844** (emulación Chromium, no Safari físico). Se inspeccionaron las capturas.

| Paso real ejecutado | Resultado / evidencia |
| --- | --- |
| GET CloudFront `/` | **200**, `text/html`, 2.352 bytes; hash igual al build local |
| GET `/api/auth/health` | **404** real del origen; esa ruta no está publicada |
| GET `/api/v1/program/me/snapshot` anónimo | **401**, JSON, desafío Bearer del backend; no error DNS/502 |
| Login móvil público | Correcto, 390×844, sin overflow horizontal — [01](test-web-evidence/01-app-login-mobile.png) |
| Activación pública | Muestra identificación → contactos → OTP; no se solicitó OTP — [02](test-web-evidence/02-app-activation-public.png) |
| Recuperación pública | Pantalla operativa, sin enviar códigos — [03](test-web-evidence/03-app-recovery-public.png) |
| Cambio ES→EN | Login en inglés y CTA traducido — [05](test-web-evidence/05-app-login-english.png) |
| Red de la app | POST `/api/auth/refresh` al mismo origen CloudFront; **0 llamadas API cross-origin** |
| Login admin API ERP | **200** con la credencial confirmada por Luis; no se guarda la contraseña ni los tokens |
| Diagnóstico admin aislado a través de CloudFront | Login **200**, refresh por cookie **200**, GET `/api/auth/me` con Bearer **200** |
| Cookie del diagnóstico | HttpOnly=true, Secure=true, Path=`/api/auth`, domain=`d1rmzt4ao2pn78.cloudfront.net`; valores nunca registrados |
| Alta de usuario test | POST `/api/auth/users` **201**, cuenta identificada abajo |
| Login de ese usuario con email/password/application=app | **401**; no tiene acceso app/perfil vinculado |
| Login ERP por UI | Correcto, navegación a `/dashboard` |
| Cola ERP API | GET `/api/v1/program/assignments` **200**, búsqueda `Coppadresd App Test`: **0 pacientes** |
| Cola ERP por UI | `/program/asignacion` **200**, búsqueda real y estado vacío — [04](test-web-evidence/04-erp-assignment-route.png) |

Reporte sanitizado: [results.json](test-web-evidence/results.json). El diagnóstico de cookies usa un contexto **admin ERP aislado**, que se cierra al terminar: no constituye una sesión de paciente ni elude `aud=app`.

Verificación local: **lint 0 errores / 27 advertencias preexistentes**, build production exitoso y **1052/1052 tests en 140 archivos**. Las pruebas de resolución de base URL son 5/5, incluidas web production con proxy y preservación de gateway nativo.

## Antecedente del primer intento: alta Auth sin acceso app

El flujo real de `LoginPage.tsx` es **identificación + contraseña** para usuarios vinculados; envía `documentNumber`, no email. La activación inicial es identificación → contacto → OTP → onboarding. El login por contraseña entra directamente a la app: no recorre el onboarding.

El `CreateUserRequest` actual de Auth acepta `email`, `password`, `firstName`, `lastName` y asignaciones opcionales de roles/permisos. **No acepta `application`, `documentNumber`, ni otorga `UserApplication(app)` o vincula `patient_profiles.user_id`.** Se ajustó la llamada al contrato real. No se inventó un endpoint de grant/provisioning ni se usaron endpoints internos para saltar el OTP.

Cuenta auth creada, exclusivamente para esta prueba:

- Email: `coppadresd-app-test-20261104201149@example.invalid`.
- User ID: `01a1a830-79f5-7ef5-82c3-9afeb3a6cd58`.
- Nombre: `Coppadresd App Test 20261104201149`.
- Sin roles/permisos solicitados, sin perfil de paciente creado, sin acceso app ni sesión válida. Su contraseña aleatoria permaneció solo en memoria; no se guardó. El alta no envió OTP.

En el primer intento se usó un correo admin incorrecto y se probó un override. El owner corrigió posteriormente el contrato: **usar exclusivamente `admin@cooppaddresd.com` + `AdminPassword` de `cooppadresd/auth`**. Esta combinación se verificó con 200 en la continuación. El runner actual aplica esa identidad exacta, sin overrides ni fallback; no se cambió el secreto AWS ni se imprimió su valor.

**En ese primer intento** no se ejecutaron onboarding, batería ni asignación. Sus estados `BLOCKED` en `results.json` son evidencia histórica; el reporte de la continuación es `patient-results.json`, con el paciente autenticado por OTP real.

El owner autorizó después **1–2 SMS reales** a su teléfono y proporcionó el OTP por chat. Se envió **un solo SMS** y la UI lo verificó correctamente; no hubo códigos falsificados ni backend DEV sustituyendo producción. Los datos clínicos de esta ejecución pertenecen a un paciente explícitamente sintético de QA.

## Repetición del helper

```powershell
# Ejecución persistente para permitir OTP humano sin guardar secretos.
# Verificar antes que 17841 está libre; nunca matar un proceso ajeno.
Start-Process node -ArgumentList 'scripts/test-web-e2e.mjs' -WindowStyle Hidden `
  -RedirectStandardOutput '.artifacts/coppadresd-app-test-runner.log' `
  -RedirectStandardError '.artifacts/coppadresd-app-test-runner-error.log'

Invoke-RestMethod http://127.0.0.1:17841/status
# POST /command, JSON {action:...}: prepare -> send -> otp -> onboarding.
# El código real solo se pasa en memoria en {action:'otp',code:...}.
# No escribir ese código en un script, log, captura o archivo de sesión.
# assignment {ui:true,regenerate:true} solicita narrativa por UI.
# assignment {ui:true,apply:true} aplica por UI tras verificar ES y EN.
# task completa la evaluación emocional por UI y verifica snapshot/XP/racha.
# stop cierra los contextos y el servidor local.
```

El helper antiguo se sustituyó por un coordinador de fases y acciones Playwright. Escucha exclusivamente en loopback, rechaza Origin/CORS y requiere JSON; solo permite fases predefinidas, sin eval remoto. AdminPassword, JWT, contraseña inicial y OTP permanecen en memoria del proceso. No se guardan storageState/HAR. El reporte distingue éxito, fallos QA y fases aún pendientes; no transforma un bloqueo en verde. La CLI Postman disponible (1.76.0) no implementa `postman status`; la evidencia LIVE procede de Playwright/fetch/curl, sin publicar colecciones ni instalar/modificar skills.

La versión final del helper no contiene submits clínicos por API: `tests` verifica progreso/resultados mediante GET. Los nueve envíos por API de la fase inicial autorizada quedaron registrados en el reporte; una ejecución futura debe completar los pendientes en el wizard real. Esta herramienta coordina la prueba humana/Playwright; no promete repetir automáticamente tests que la UI deshabilita.

## Costo estimado y retirada

Sin servidores nuevos ni cuotas mensuales fijas del CDN en este despliegue pay-as-you-go. Para QA de hasta **5 GB/día y 50.000 solicitudes/día** en `PriceClass_100`, el presupuesto conservador es **aprox. USD 0,50–0,70/día**, por debajo de USD 1/día, más el costo ya existente del backend. S3 almacena unos 148 MB (del orden de USD 0,004/mes de almacenamiento). El free tier puede reducirlo; no se asume disponible porque la cuenta aloja otros proyectos. Es una estimación bajo ese volumen, **no un tope técnico de facturación**: tráfico superior y uso de IA/backend se facturan aparte.

Fuentes de precios: [CloudFront](https://aws.amazon.com/cloudfront/pricing/) y [S3](https://aws.amazon.com/s3/pricing/). No se contrataron planes mensuales, dominios ni servicios adicionales para imponer un límite.

Para retirar el entorno, operar únicamente sobre la distribución `E10PNDIZLVIVB` (deshabilitar, esperar Deployed y eliminar con su ETag actual), el OAC `EA3VZPMAF9SGN` después de retirar la distribución, y el bucket exacto `coppadresd-app-test-web-933629770820` después de vaciarlo. No se ejecutó retirada. No reutilizar ni ampliar esos comandos a otros buckets/distribuciones de la cuenta.

## Continuación FASE B — resultado real

Reporte vigente: [patient-results.json](test-web-evidence/patient-results.json), `completed=true`, `patient-flow-complete=PASS`. Se usó el mismo navegador móvil persistente durante toda la ejecución; secretos y estado autenticado permanecieron en memoria, sin exportar storageState.

### Contrato de primer inicio y batería

La pantalla del app **Activa tu cuenta** (`LoginPage.tsx`) no acepta tokens de invitación. Su contrato es:

1. `POST /api/auth/id-lookup {documentNumber, application:"app"}`: requiere un perfil de paciente ya creado en ERP y devuelve contactos enmascarados.
2. `POST /api/auth/send-otp {documentNumber, contactId}`: el contacto PHONE se resuelve en el servidor; el cliente no puede sustituir su destino.
3. `POST /api/auth/verify-otp {documentNumber, otp, application:"app", rememberMe}`: al verificar, crea/vincula Identity, `patient_profiles.user_id` y `UserApplication(app)`, y devuelve JWT `aud=app` con refresh HttpOnly.
4. Onboarding: `POST /api/auth/set-first-password` con Bearer y `PUT /api/v1/me/patient-profile`. Actualiza el perfil ERP existente; no crea otro paciente desde el app.
5. La batería inicial se asigna al crear el paciente; `/me/assignments` tiene además fallback de asignación idempotente si no existen tests visibles. El submit real usa `/api/v1/health-tests/me/tests/{id}/start` y `/submit` con opciones del catálogo vigente.

Invitaciones es un flujo distinto, de **primer acceso al ERP/profesional**: `GET /api/auth/invitations/validate?token=...` y `POST /api/auth/invitations/accept {token,password}` son públicos, pero requieren un token legítimo. El enlace `/invitaciones?token=...` solo se devuelve con proveedor Log; en producción se entrega por correo. `POST /api/auth/users` no genera ese enlace ni concede acceso app. No se invocó el endpoint interno de invitaciones ni se extrajo ningún token desde BD/logs.

### Identidad de QA y recorrido

- Paciente sintético: `29f86969-f99f-425d-8bba-20f52134dc8b`; documento `9920261104202616`.
- Nombre: `Coppadresd App Test 20261104202616`; email `coppadresd-app-test-20261104202616@example.invalid`.
- Se creó por `POST /api/v1/patients` como admin, con teléfono del owner autorizado, país `57` y número terminación `4819`. Ese alta no envía OTP.
- Se envió **un único SMS PHONE** por la UI. El owner dio el código en chat, se introdujo en la UI y `verify-otp` respondió 200 con `aud=app`. El código no se guardó ni aparece en capturas.
- Onboarding guardado con 200; una batería y nueve asignaciones. Se estableció contraseña inicial aleatoria, solo en memoria.
- Tests completados: `historia-clinica`, `temperamento`, `nutricional`, `movimiento`, `sueno`, `iac-adresd`, `orp`, `ers`, `bateria-antares`; nueve start y nueve submit con 200.
- Los nueve submits se ejecutaron por API real de la sesión autenticada, conforme a la autorización anterior del owner. Tras su instrucción posterior de usar exclusivamente UI **no se envió ningún submit adicional por API**. Aplicar, regenerar narrativa y completar la tarea se hicieron con interacción Playwright en los controles reales.
- Resultados persistidos: **46**, más **1 alerta high de ORP** del paciente de QA. El perfil normalizado deriva obesidad del fixture sintético (95 kg, 165 cm, cintura 105 cm), con fuentes OMS/NHLBI/ACC-AHA-TOS y VA/DoD. El motor conserva la elección de contenido.

### Flag de asignación y comportamiento observado tras 3/9

La primera comprobación UI tras 3 tests agotó el locator de “Plan pendiente”. La app había vuelto al Home normalmente; el error estaba en el parser: el servidor devuelve `404 {message:"NO_ACTIVE_ENROLLMENT: ..."}`, mientras el cliente solo extraía códigos desde `detail`. Se corrigió `apiClient.ts` para extraer el mismo prefijo desde `message`, con tres pruebas de regresión (message/detail y 404 genérico). No se modificó el wizard, la lógica de salida ni el backend. La corrección se publicó solo en el bucket de pruebas.

Después de 9/9 se verificó la pantalla “Pendiente de confirmación clínica”. El owner habilitó **`Program__Assignment__Enabled=true` en `cooppadresd-api:92`**, rollout verde. Antes no había propuesta; después apareció el enrollment `04757409-bc69-4be1-be95-aca383a2563f` en `PendingAssignment`, semana 0, y la recomendación `4fcba68a-ebf1-43e3-8771-688fb6456f51`.

**La UI actual no permite repetir un test completado**: la tarjeta tiene `aria-disabled=true` y `TestsPage.openTest` retorna si `item.done`. Se comprobó por Playwright y fuente. No se forzó el control ni se fabricó un re-submit. La creación ocurrió mediante recuperación del backend al habilitar el flag con la batería ya 9/9; no se atribuye a un nuevo submit por UI. La pantalla de batería sigue mostrando el copy “plan pendiente hasta completar 9” aun estando 9/9: queda como hallazgo de copy/contexto, no como estado real del programa activo.

El cambio del flag lo ejecutó el owner; el agente no modificó el servicio API. Su reversión queda bajo control del owner (retirar el override o volver a su configuración previa), sin alterar datos clínicos ya persistidos.

### Reparación del 503 y narrativa real

La recomendación quedó `pending-narrative`; Regenerar narrativa por UI respondió **202**. Se observaron ocho respuestas 503 del endpoint interno. Los logs del ai-service identificaron la causa: **Anthropic 400 `temperature: Extra inputs are not permitted`**, traducido a 503 por la ruta.

El fix del repo `ai-service` copia exclusivamente el modelo `ChatAnthropic` de narrativa con `temperature=None`, para omitirlo del payload. OpenAI, los agentes de chat, prompts, propuesta y validación de fuentes conservan su comportamiento. Pruebas: **47/47**, lint completo sin errores y regresión del payload dentro del contenedor.

El owner autorizó expresamente la excepción al guardrail de ECS para desplegar **solo ai-service**:

- Base: `cooppadresd-ai:30`, digest `sha256:eb8949741eb2a097e61f340ce5e8ca2088f42b5dea12c3477f55393e1c48ef44`.
- Imagen candidata: `cooppadresd-ai:coppadresd-app-test-narrative-fix-20261104`.
- Digest publicado: `sha256:bcf51b44d1a06ac05bff10af48c37937c3ae7fcc413e54bc57e76d1dd4a58ce6`.
- Revisión desplegada: `arn:aws:ecs:us-east-2:933629770820:task-definition/cooppadresd-ai:31`, **COMPLETED, 1/1**.
- Único campo cambiado en la task definition: `containerDefinitions[name=ai].image`. Se preservaron dependencias de la imagen base, roles, CPU/memoria, red, secrets y configuración.
- El owner también informó la configuración `LLM_PROVIDER=anthropic` en `cooppadresd/ai`; el agente no escribió ese secreto.
- Rollback disponible: actualizar únicamente `cooppadresd-ai` a `cooppadresd-ai:30`; **no se ejecutó rollback**.

El worker produjo texto real ES (**784 caracteres**) y EN (**748**); el estado pasó a `proposed`. Se inspeccionaron ambos idiomas en la UI, sin texto fabricado. Fix local del ai-service: **`9b480425f1e458b72386549a445a258d06939216`**, sin push; [documentación del fix](../../ai-service/docs/program-narrative.md).

### Aplicar y cerrar en el app

En ERP se buscó el documento exacto, abrió la ficha con perfil/fuentes/narrativa y pulsó **Aplicar tal cual**. POST originado por la UI: **200**, estado `applied`, semana 1, `startLocalDate=2026-11-04` (miércoles, arranque inmediato).

En el app se abrió Protocolo diario: GET snapshot **200**, `currentWeekNumber=1`, `currentWeekStatus=Active`, **6 tareas**. Se abrió **Evaluación emocional**, eligió ánimo/sueño/barrera y pulsó **Guardar evaluación**. POST de la UI **200**; snapshot posterior: una tarea Completed, **XP 0→120**, **racha 0→1**. La cabecera muestra **1/6 y 120/750 XP** y la pestaña Racha confirma el día.

| Captura | Evidencia |
| --- | --- |
| [06](test-web-evidence/06-first-entry-contacts.png) | Identificación resuelta y contacto SMS enmascarado |
| [07](test-web-evidence/07-real-sms-otp-waiting.png) | SMS enviado, pantalla esperando al owner, campos vacíos |
| [08](test-web-evidence/08-first-entry-onboarding.png) | Onboarding tras OTP real |
| [09](test-web-evidence/09-onboarding-complete-battery.png) | Batería asignada tras guardar perfil |
| [10](test-web-evidence/10-battery-complete-pending-clinical.png) | 9/9 y espera de confirmación clínica |
| [11](test-web-evidence/11-erp-queue-patient-search.png) | Búsqueda exacta del paciente en la cola |
| [12](test-web-evidence/12-ui-completed-test-cannot-repeat.png) | Tests completados deshabilitados; sin nuevo submit |
| [13](test-web-evidence/13-erp-assignment-profile-narrative.png), [13 EN](test-web-evidence/13b-erp-narrative-english.png) | Perfil, fuentes y narrativa real ES/EN |
| [14](test-web-evidence/14-erp-assignment-applied.png) | Asignación aplicada |
| [15](test-web-evidence/15-app-active-week-one.png) | Semana 1 y tareas del día |
| [16](test-web-evidence/16-app-task-complete-xp.png), [16 racha](test-web-evidence/16b-app-streak-one.png) | 1/6, 120 XP y racha 1 |

### Validación final y límites de la evidencia

- App: **lint 0 errores, 27 advertencias preexistentes; build production correcto; 1055/1055 tests en 141 archivos**. El HTML corregido publicado tiene SHA-256 `d7b17fd6e36cd2c1e75ffd85208565908c0110f82dde8a7c1d8d5e3efd4c1b3e`.
- ai-service: **47/47 tests de narrativa, ruff completo aprobado, prueba de payload dentro de la imagen y narrativa LIVE ES/EN confirmada**.
- No quedan bloqueos operativos para este recorrido. Se mantienen hallazgos QA: no existe repetición de completados en el app; el copy de la batería no cambia al llegar a 9/9; la alerta ORP conserva placeholders `[valor]`/`[indicador]` en su título.
- `/me/results` devolvió 46 scores/subescalas y **ningún resultType=indicator**. No se certifica que `iadherencia`/`iapnea` se hayan persistido como indicadores separados; se verificaron el score IAC, el perfil normalizado y la alerta real, sin inventar indicadores ausentes.
- La animación transitoria de celebración mostró `+420 pts`; el ledger, la respuesta de completación y la cabecera estabilizada confirmaron **+120 XP**. Queda como discrepancia visual a revisar; no se alteraron puntos ni se ocultó el resultado real.
- No se probó entrega push en dispositivo nativo. La prueba se realizó en Chromium con emulación iPhone 13, no Safari/iOS físico.
