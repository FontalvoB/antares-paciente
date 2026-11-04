# App web de pruebas — coppadresd-app-test

Verificado el **2026-11-04**. Despliegue web operativo y pruebas públicas/autenticación del proxy aprobadas. **El E2E clínico completo está bloqueado por el aprovisionamiento de acceso del paciente**, detallado abajo; no se presenta como aprobado.

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

Solo se crearon esos recursos. No se modificaron buckets, distribuciones/orígenes, ALB, ECS, DNS, dominios, secretos, skills ni configuraciones del backend de otros proyectos. El origen `erp.coppadresd.com` es una referencia HTTPS en la distribución NUEVA; no se cambió su despliegue. No se habilitaron seeders ni flags de producción.

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

## Bloqueo de acceso y alcance clínico pendiente

El flujo real de `LoginPage.tsx` es **identificación + contraseña** para usuarios vinculados; envía `documentNumber`, no email. La activación inicial es identificación → contacto → OTP → onboarding. El login por contraseña entra directamente a la app: no recorre el onboarding.

El `CreateUserRequest` actual de Auth acepta `email`, `password`, `firstName`, `lastName` y asignaciones opcionales de roles/permisos. **No acepta `application`, `documentNumber`, ni otorga `UserApplication(app)` o vincula `patient_profiles.user_id`.** Se ajustó la llamada al contrato real. No se inventó un endpoint de grant/provisioning ni se usaron endpoints internos para saltar el OTP.

Cuenta auth creada, exclusivamente para esta prueba:

- Email: `coppadresd-app-test-20261104201149@example.invalid`.
- User ID: `01a1a830-79f5-7ef5-82c3-9afeb3a6cd58`.
- Nombre: `Coppadresd App Test 20261104201149`.
- Sin roles/permisos solicitados, sin perfil de paciente creado, sin acceso app ni sesión válida. Su contraseña aleatoria permaneció solo en memoria; no se guardó. El alta no envió OTP.

El secreto autorizado `cooppadresd/auth` se leyó sin imprimir su contenido. Su `AdminPassword` devolvió 401; Luis proporcionó una credencial alternativa que permitió el login del admin canónico `admin@coppaddresd.com`. **El secreto AWS no se actualizó.** Para repetir, se admite un override temporal en memoria.

**No ejecutados / no validados en producción**: onboarding de paciente, 3 tests y escape, 9 tests completos, results/Indicators/alerts, auto-enrollment PendingAssignment, recomendación proposed, narrativa IA con fuentes, Aplicar, semana 1, tarea, XP y racha. La cola desplegada existe; no se verificó el flag de asignación ni su pipeline sin un paciente autenticado.

Para continuar hace falta un paciente de QA ya vinculado con `UserApplication(app)` habilitado y contraseña conocida, o completar su activación con un OTP de email recibido legítimamente. Para probar específicamente el primer onboarding se necesita ese flujo real de activación. **No se probó OTP telefónico real en producción**, no se gastó Twilio y no se falsificaron códigos, tokens, historias o resultados clínicos. Un backend DEV local no validaría este despliegue contra producción y no se utilizó.

## Repetición del helper

```powershell
# Solo pantallas públicas; conserva el reporte previo y no crea usuarios.
node scripts/test-web-e2e.mjs --public-only

# Un primer intento LIVE usa el secreto autorizado; si autentica, crea UNA cuenta.
node scripts/test-web-e2e.mjs

# Continuar comprobaciones admin sin crear otra cuenta (lee el reporte previo).
# Si hace falta override: pedirlo en un prompt, nunca ponerlo en el comando/doc.
$credential = Get-Credential -UserName admin@coppaddresd.com -Message 'Credencial QA admin'
$env:COPPADRESD_APP_TEST_ADMIN_PASSWORD = $credential.GetNetworkCredential().Password
try { node scripts/test-web-e2e.mjs --resume-admin }
finally {
  Remove-Item Env:COPPADRESD_APP_TEST_ADMIN_PASSWORD
  Remove-Variable credential
}
```

El helper actual cubre pantallas públicas, proxy/cookies, alta auth y cola ERP; registra explícitamente el bloqueo clínico. **No es un runner de tests clínicos completos**. La ejecución final retorna **exit code 2** mientras exista el bloqueo, aunque las comprobaciones públicas pasen. Los reportes/capturas no contienen valores de cookies, tokens ni contraseñas; no se guardan storageState/HAR de sesiones. La CLI Postman disponible (1.76.0) no implementa `postman status`; la evidencia LIVE procede de Playwright/fetch/curl, sin publicar colecciones ni instalar/modificar skills.

## Costo estimado y retirada

Sin servidores nuevos ni cuotas mensuales fijas del CDN en este despliegue pay-as-you-go. Para QA de hasta **5 GB/día y 50.000 solicitudes/día** en `PriceClass_100`, el presupuesto conservador es **aprox. USD 0,50–0,70/día**, por debajo de USD 1/día, más el costo ya existente del backend. S3 almacena unos 148 MB (del orden de USD 0,004/mes de almacenamiento). El free tier puede reducirlo; no se asume disponible porque la cuenta aloja otros proyectos. Es una estimación bajo ese volumen, **no un tope técnico de facturación**: tráfico superior y uso de IA/backend se facturan aparte.

Fuentes de precios: [CloudFront](https://aws.amazon.com/cloudfront/pricing/) y [S3](https://aws.amazon.com/s3/pricing/). No se contrataron planes mensuales, dominios ni servicios adicionales para imponer un límite.

Para retirar el entorno, operar únicamente sobre la distribución `E10PNDIZLVIVB` (deshabilitar, esperar Deployed y eliminar con su ETag actual), el OAC `EA3VZPMAF9SGN` después de retirar la distribución, y el bucket exacto `coppadresd-app-test-web-933629770820` después de vaciarlo. No se ejecutó retirada. No reutilizar ni ampliar esos comandos a otros buckets/distribuciones de la cuenta.
