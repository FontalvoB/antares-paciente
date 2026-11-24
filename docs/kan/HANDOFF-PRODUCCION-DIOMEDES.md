# Agentic Wellness IA — handoff de producción para Diomedes

**Corte inicial:** 24/11/2026, hora de Bogotá (UTC−05:00). **Base revisada:** `origin/dev` en `d045955`, rama de documentación `docs/handoff-produccion-diomedes`. Los PR #28–#33 están integrados. La generación en segundo plano de KAN-136/142 sigue **EN VUELO** en `feat/KAN-136-142-generacion` al corte del código. Este handoff propone el contrato que Diomedes debe publicar en KAN-130. Los criterios de Jira provienen del encargo y del handoff, sin consulta directa a Jira.

## Producto y recorrido oficial

Agentic Wellness IA guía a la persona durante 365 días según su objetivo (bajar de peso, ganar masa o definición). El protocolo diario tiene ejercicio, dieta, vitales, emocional y cofre. Las siete baterías son progresivas y opcionales para el recorrido. PAR-Q (7) y NQS (6) sí condicionan la generación. El motor es .NET, con el motor JS v5.2 como referencia y `golden.json` para verificar paridad. La definición ya cuenta con aprobación profesional según el ADR.

| Paso del PDF «Flujo de experiencia del cliente», 24/11/2026 | App / persona | Backend / automatización | Situación comprobada |
| --- | --- | --- | --- |
| 1. Pago de membresía | La persona paga en web, fuera de la app. | El pago confirmado activa la membresía y dispara la bienvenida de forma idempotente. | Web mock según el ADR, pasarela real pendiente. |
| 2. Correo de bienvenida | La persona recibe el acceso. | Envío automático con enlace de activación, trazabilidad de entrega y reenvío. | Dependencia de la integración de membresía/correo. |
| 3. Ingreso | Abre el enlace y retoma el paso de incorporación que corresponda. | Canjea la invitación y vincula identidad, persona y membresía. | Entrada manual por login/onboarding. El acceso por correo dentro de Wellness es mock. |
| 4. Términos y contactos | Acepta términos y registra contacto principal, familiar y de emergencia. | Registra aceptación versionada y fecha de auditoría, y guarda contactos según roles acordados. | La app captura emergencia principal y respaldo en el paso anterior a términos. Acordar el mapeo de los tres contactos del PDF y su persistencia. |
| 5. Contraseña | Crea la contraseña tras completar el paso anterior. | Auth crea o activa la cuenta y emite sesión de la app. | Alta mock para correo nuevo. La cuenta mock existente usa su contraseña al ingresar y omite crear una nueva. |
| 6. Objetivo y cuestionario | Elige objetivo, contesta y confirma. El siguiente paso visible es Home. | Al confirmar respuestas válidas se asegura un único envío y se generan ejercicio, nutrición y bandeja en segundo plano. | Hoy se espera una vista previa local y se muestra «Tu plan está listo» con CTA «Entrar». Reapertura KAN-136/142 en vuelo. |
| 7. Home | Consulta sus planes y la bandeja. | Sirve artefactos por versión y publica estados hasta completar. | El PDF marca «todo listo» como experiencia esperada. Si el motor tarda o falla, KAN-142 cubre la llegada inmediata con progreso, recuperación y bandeja visible. |

**Enlace de bienvenida, propuesta de integración.** Usar un enlace HTTPS del dominio de bienvenida aprobado, por ejemplo `https://<dominio>/bienvenida?token=<opaco>`. Backend emite token de un uso, expirable, ligado a invitación/persona/membresía, y lo canjea por una sesión limitada al onboarding. Persistir solo el hash del token en servidor, excluirlo de telemetría y retirar el token de la URL tras el canje. Móvil configura Associated Domains/AASA y App Links/assetlinks, procesa arranque en frío y app abierta, y retoma el paso pendiente. Web ofrece continuidad o instalación si no está la app. Validar expiración, reenvío, enlace ya utilizado, cuenta activa y apertura desde clientes de correo. Acordar dominio, vigencia, rutas y responsables con Auth/Producto.

## Inventario móvil en dev

Las rutas de esta tabla son valores de `flow` y `screen` registrados en `src/App.tsx` / `src/types.ts`. Los caminos abreviados de módulo parten de `src/features/wellness/`. Las claves actuales son locales al navegador/WebView y globales al origen. Antes de ofrecer datos de producción, aislar cuentas, rehidratar datos desde backend y definir tratamiento de datos demo en dispositivos actualizados. El mock guarda contraseñas de prueba en claro dentro de su clave de cuentas. Usar exclusivamente credenciales sintéticas.

| Jira y ruta | Archivos clave y persistencia actual | Mock / integración necesaria |
| --- | --- | --- |
| **KAN-136** · `flow=onboarding`, correo → emergencia → términos → contraseña → objetivo (8 pasos) → vista previa → `home` | `src/pages/OnboardingPage.tsx`, `src/context/AppContext.tsx` (`finishWellnessOnboarding`), `components/onboarding/`, `components/objective/`, `services/wellness-onboarding-service.ts`, `domain/{types,draft,questions,gate,plan-preview}.ts`. Escribe `wellness.mock.accounts.v1`, `wellness.onboarding.draft.v1` y `wellness.plan.v1`; borra el borrador cuando guarda la vista previa. | Lookup, alta y login Wellness locales. Vista previa local y compuerta antes de generar. Backend requiere Auth real, consentimiento/contactos, envío durable del cuestionario y generación asincrónica. Compuerta de servidor con términos, campos completos, mayoría de edad, IMC para déficit y confirmaciones PAR-Q/NQS según corresponda. |
| **KAN-142** · `screen=home` → protocolo, dieta, ejercicio, vitales, Vita y baterías | `home/WellnessHome.tsx`, `state/wellness-home-store.ts`. Lee `wellness.plan.v1`, `wellness.protocol.v1`, `wellness.batteries.v1`. | Día X/365, adherencia, puntos, racha, nivel y n/7 con estado local. Falta lectura de planes/progreso/bandeja y datos agregados persistentes. |
| **KAN-143** · `screen=protocol` desde Home | `protocol/WellnessProtocol.tsx`, `state/wellness-home-store.ts`. Lee plan; escribe `wellness.protocol.v1`. | Secuencia ejercicio, dieta, vitales, emocional y cofre. Cofre exige pasos 1–4, una apertura por día local. Backend debe registrar completados/recompensa con deduplicación, zona IANA del paciente, cambio de día, y rehidratación en otro dispositivo. Coordinar cierre de día con KAN-141 y vitales con KAN-138. |
| **KAN-139** · `screen=wellness-exercise` desde Home/protocolo | `exercise/WellnessExercise.tsx`, `exercise/{exercise-plan,exercise-catalog}.ts`. Lee plan y escribe `wellness.exercise.checkin.v1`, `wellness.exercise.session.v1`, `wellness.exercise.pending.v1`, `wellness.protocol.v1`. | Rutina determinista local por día/objetivo con patrón semanal, fases, descarga, desbloqueos, adaptación por check-in y sesión guiada reanudable. `pending` registra una finalización local. Integrar rutina del motor, procedencia del check-in y sincronización idempotente de sesiones/completados. |
| **KAN-144** · `prof` → Mi plan → Objetivo → `wellness-goal` → `home` | `goal/WellnessGoalPage.tsx`, `state/goal-change.ts`, `state/wellness-home-store.ts`. Escribe `wellness.plan.v1` y `wellness.plan.versions.v1`. Conserva fecha de inicio, `wellness.protocol.v1` y `wellness.batteries.v1`. | Reutiliza wizard precargado, solicita de nuevo PAR-Q/NQS y términos, calcula diferencias de objetivo/kcal/macros y archiva la versión anterior localmente. Backend debe guardar versiones, conservar historial y publicar el nuevo plan sin interrumpir el vigente si falla la regeneración. |
| **KAN-145** · `screen=wellness-diet` desde Home/protocolo | `nutrition/WellnessDiet.tsx`, `nutrition/{diet-plan,diet-store,meal-catalog}.ts`, `src/utils/foodAiApi.ts`. Lee plan y escribe `wellness.diet.v1` (plato elegido, comidas, agua, modo simplificado y borrador numérico por foto), y `wellness.protocol.v1` al registrar una comida. | Menú de cuatro comidas, objetivos de macros/agua, alternativas y registros locales. La foto ya invoca Food AI real por `POST /api/v1/foodai/analyze` autenticado, con edición y entrada manual si falla la estimación. Backend debe entregar menú generado y persistir registros por día, versión, comida y persona. Verificar sesión real y permisos de cámara. |
| **KAN-136/142 EN VUELO** · confirmación de cuestionario → `home` inmediato | Puntos de unión en `OnboardingPage.tsx`, servicio, Home y estado. La base auditada carece de claves publicadas para job, id de envío, progreso o inbox. Confirmarlas en la revisión del PR de la otra rama. | El cliente debe conservar las respuestas y el identificador de envío ante errores o reinicios. La UI debe refrescar y reintentar. La generación durable y deduplicada requiere endpoint, outbox y motor de Diomedes. |

## Contrato propuesto para KAN-130

Base lógica `/v1` bajo el gateway. Confirmar prefijo público y documentarlo en OpenAPI antes de integrar. Las cuatro operaciones requieren JWT de app y autorización sobre `{id}` (id interno de persona, obtenido de la sesión). El servidor valida membresía, versión del formulario y consentimiento. Usar tiempos UTC y zona IANA para calcular la fecha local del programa. Los ejemplos usan datos sintéticos. Normalizar errores en el cliente por código estable para ES/EN.

### Enviar cuestionario y encolar generación

`POST /v1/people/{id}/plans/generate` con `Idempotency-Key: sub-qa-001` igual a `submissionId`. Crear ese id al confirmar un borrador válido y reutilizarlo para reenvíos de las mismas respuestas. El payload lleva la instantánea de respuestas y la versión del cuestionario. La confirmación de un cambio de objetivo genera un nuevo id, con `reason: "goal_change"` y `expectedPlanVersion` del vigente para proteger contra ediciones concurrentes.

```json
{
  "submissionId": "sub-qa-001",
  "questionnaireVersion": "v1",
  "reason": "onboarding",
  "expectedPlanVersion": null,
  "timezone": "America/Bogota",
  "answers": {
    "goal": "bajar", "sex": "F", "age": 35, "heightCm": 165, "weightKg": 74,
    "waistCm": 88, "targetWeightKg": 68, "activity": 2, "pace": "m",
    "vegetarian": false, "dairyFree": false,
    "parq": [0, 0, 0, 0, 0, 0, 0], "nqs": [0, 0, 0, 0, 0, 0],
    "doctorConfirmed": false, "nutritionistConfirmed": false
  },
  "terms": {"version": "wellness-v1-2026-11", "acceptedAt": "2026-11-24T19:00:00Z"}
}
```

`202 Accepted` tras registrar el envío y el trabajo de forma durable. Devolver `Location: /v1/people/{id}/generation?jobId=job-qa-001`. Un reenvío idéntico devuelve el mismo job y sus estados vigentes, incluso si ya terminó. La sesión local abre Home al confirmar y registrar el envío pendiente, en paralelo a la llamada de red. Home conserva el estado de envío si aún espera la aceptación del servidor. Si el servidor devuelve validación, Home ofrece volver al formulario con respuestas conservadas.

```json
{
  "jobId": "job-qa-001", "submissionId": "sub-qa-001", "candidatePlanVersion": 1,
  "activePlanVersion": null, "attempt": 1, "status": "queued", "retryable": false,
  "artifacts": {
    "exercise": {"status": "queued", "progress": 0},
    "nutrition": {"status": "queued", "progress": 0},
    "inbox": {"status": "queued", "progress": 0}
  },
  "error": null, "pollAfterSeconds": 3
}
```

### Consultar estado

`GET /v1/people/{id}/generation` devuelve `200` para el último trabajo, con `?jobId=` opcional para reconciliar el envío conocido. Antes del primer envío, devolver `200` con `status: "not_started"`, `jobId: null` y `artifacts: {}`. Cada artefacto usa `queued | generating | ready | failed`, progreso entero de 0–100 y error propio cuando corresponda. El job usa los mismos estados, más `not_started` en lectura. `ready` requiere que los tres resultados finales existan y sean consultables. Para cambio de objetivo, el candidato pasa a vigente atómicamente cuando los tres estén listos. En primera generación se puede abrir un artefacto ya persistido como vista del candidato, siempre identificado por su versión.

```json
{
  "jobId": "job-qa-001", "submissionId": "sub-qa-001", "candidatePlanVersion": 1,
  "activePlanVersion": null, "attempt": 1, "status": "failed", "retryable": true,
  "artifacts": {
    "exercise": {"status": "ready", "progress": 100, "artifactId": "ex-qa-001"},
    "nutrition": {
      "status": "failed", "progress": 62,
      "error": {"code": "ENGINE_TEMPORARILY_UNAVAILABLE", "retryable": true}
    },
    "inbox": {"status": "ready", "progress": 100, "artifactId": "in-qa-001"}
  },
  "error": {"code": "ARTIFACT_GENERATION_FAILED", "retryable": true},
  "updatedAt": "2026-11-24T19:00:32Z", "pollAfterSeconds": null
}
```

Publicar también los esquemas y rutas de lectura de los artefactos de ejercicio/nutrición en el mismo OpenAPI. Un estado exitoso incluye referencias autorizadas y versión, para que Home pueda abrir el contenido. Progreso por artefacto y por intento. Se admite reiniciar el indicador de la pieza fallida en el siguiente intento.

### Reintentar el mismo trabajo

`POST /v1/people/{id}/generation/retry` con `Idempotency-Key: retry-job-qa-001-1` (id estable para un reenvío del mismo reintento) y el cuerpo siguiente. `expectedAttempt` protege de duplicados cuando dos clientes reintentan el mismo fallo. Aceptar solo un fallo reintentable y repetir piezas incompletas. Respuesta `202` con el esquema anterior, el mismo job y la misma versión candidata, `attempt: 2`, artefacto fallido en cola y artefactos listos preservados. Una pulsación repetida con la misma clave recupera ese intento.

```json
{"jobId": "job-qa-001", "expectedAttempt": 1}
```

### Leer bandeja

`GET /v1/people/{id}/inbox` devuelve `200`, orden estable por fecha/id, cursor opaco si hay más y mensajes con clave ES/EN y parámetros. La bandeja visible tiene al menos una entrada. Insertar bienvenida desde la activación de la membresía y actualizar o complementar el contenido generado mediante claves de negocio únicas. Si la primera consulta falla o un servidor antiguo entrega una lista vacía, Home muestra una bienvenida local de respaldo y feedback de conexión cuando aplique.

```json
{
  "items": [{
    "id": "msg-qa-001", "type": "welcome", "titleKey": "wellness.inbox.welcome.title",
    "bodyKey": "wellness.inbox.welcome.body", "params": {},
    "createdAt": "2026-11-24T18:55:00Z", "readAt": null
  }],
  "nextCursor": null
}
```

| HTTP | Cuándo y respuesta del cliente |
| --- | --- |
| `202` | Encolado o replay de generación/reintento. Asociar el job al id del envío y refrescar Home en segundo plano. |
| `409` | Misma clave con otro payload, versión vigente cambió, intento obsoleto o trabajo incompatible activo. Recuperar el estado si la respuesta trae un job autorizado. Para una edición bloqueada por versión, recargar y pedir confirmación conservando las respuestas. |
| `422` | Datos incompletos o compuerta rechazada, con `issues[]` que incluya código/campo/paso (0–7). También reintento no permitido por un fallo definitivo. Mantener borrador y ofrecer corrección o soporte según el código. |
| `503` | Servicio temporalmente indisponible. Respetar `Retry-After` cuando exista; reemitir la misma operación con la misma clave, sin pedir volver a responder. |
| `401/403/404` | Renovar sesión para `401`; para acceso denegado o recurso inexistente, respetar el contrato de Auth y evitar filtrar datos de otra persona. |

```json
{
  "code": "QUESTIONNAIRE_GATE_REJECTED", "retryable": false,
  "issues": [{"code": "unanswered", "field": "parq[2]", "step": 4}],
  "traceId": "trace-qa-001"
}
```

### Datos y garantías de entrega

| Entidad propuesta | Campos e invariantes | Cruce de trabajo con Diomedes |
| --- | --- | --- |
| Envíos de cuestionario | Persona/membresía, `submissionId`, versión de esquema y respuestas, aceptación y zona. Único por persona y envío. Guardar una copia protegida para reintentos. | KAN-110 para base de datos e identidad de dominio, KAN-130 para validar/recibir. |
| Jobs e intentos | Job único por envío. Versión candidata, estado, intento, error, reintentabilidad y timestamps. Un trabajo activo por persona/programa; intento y cambio de estado protegidos contra carreras. | KAN-134 para ejecución y reintentos, KAN-130 para HTTP y estados. |
| Artefactos y versiones | `artifacts` con estado, progreso, error y contenido/referencia. Único por persona, versión y tipo `exercise/nutrition/inbox`. `plan_versions` único por persona/programa y versión, con versión activa, snapshot y fecha de inicio del programa. Historial de protocolo, comidas y sesiones vinculado a la fecha y versión correspondiente. | KAN-110 para entidades/migración y KAN-134 para persistencia/publicación del motor; KAN-130 para representación y consulta. |
| Inbox | Entradas por persona, tipo, fecha, contenido traducible, `readAt` y clave de negocio única. Bienvenida por membresía y contenidos generados por versión/tipo. | KAN-116 para coordinar bienvenida/entrada inicial, KAN-134 para bandeja materializada y KAN-130 para lectura. |
| Idempotencia, outbox y deduplicación del consumidor | Entrada única por persona, operación y clave, con hash canónico y referencia al resultado. Outbox con eventId, job, intento y estado de publicación. Registro de eventos procesados y restricción única de artefactos. | KAN-110 para restricciones, KAN-134 para worker/outbox y KAN-130 para la semántica de claves y errores. |

El cruce KAN-110/134/116 asigna puntos de coordinación propuestos. Confirmar el alcance de esos tres issues en Jira antes de asignar cambios. KAN-130 figura en el ADR como contrato publicado por Diomedes.

1. Para el primer envío válido, confirmar en una transacción respuestas, clave de idempotencia, job, versión candidata y evento `PlanGenerationRequested` único para el job. Responder `202` solo tras la confirmación. Si se pierde la respuesta HTTP, el cliente vuelve con el mismo id y recupera ese job.
2. El publicador de outbox puede entregar más de una vez. El consumidor deduplica por eventId y adquiere el trabajo con exclusión o lease recuperable. Persistir el resultado y su marcador de deduplicación de forma transaccional, con restricciones por artefacto. Una caída entre el cálculo y la confirmación puede repetir el cálculo. La garantía es un solo evento lógico inicial y una sola publicación efectiva de cada artefacto/versión.
3. Reintentar dentro del mismo job y versión. Confirmar en una transacción la aceptación del reintento, el incremento del intento y un evento único para ese intento. Reanudar desde los artefactos ya confirmados. Publicar la nueva versión una vez y conservar la anterior y la fecha de inicio. Registrar `traceId`, `jobId`, tiempos por artefacto y conteos agregados de error/reintento sin respuestas del cuestionario ni credenciales en logs.

## Home y recuperación

| Caso | Qué ve la persona | Comportamiento |
| --- | --- | --- |
| Sin envío previo | Bienvenida y acceso al cuestionario pendiente, sin planes habilitados. | Recuperar el paso de onboarding de la cuenta. Evitar presentar datos de ejemplo como propios. |
| Envío aún sin confirmación o job en cola | Home inmediato, «Estamos preparando tu plan», tarjetas pendientes y bienvenida visible. | Conservar respuestas y clave. Enviar/reconciliar en segundo plano. |
| Generando | Progreso independiente de ejercicio y nutrición; bandeja visible con bienvenida y estado de preparación si corresponde. | Refrescar siguiendo `pollAfterSeconds` en primer plano, con backoff ante red/503 y consulta al volver a primer plano. |
| Listo parcial | Tarjeta lista habilitada para consultar el contenido de su versión. La otra indica progreso o fallo. En un cambio de objetivo sigue visible el plan vigente hasta activar el nuevo. | Consultar los artefactos listos una sola vez por versión/cambio relevante y seguir refrescando los pendientes. |
| Todo listo | Plan diario de ejercicio, plan de nutrición y bandeja con contenido. Día, protocolo y baterías visibles. | Parar el polling frecuente y refrescar datos afectados al retomar sesión. |
| Fallo reintentable | Mensaje claro en cada pieza afectada y CTA «Reintentar». Se mantienen las piezas listas y la bandeja. | La acción llama a retry con el mismo job; si nunca hubo `202`, reenvía generate con la misma clave inicial. |
| Fallo definitivo / validación | Explicación y acción para corregir respuestas o contactar soporte según el código. Bandeja visible. | Conservar datos. Una confirmación con respuestas corregidas usa un id nuevo. |
| Offline / refresco fallido | Estado de conexión y último contenido válido. Si falta caché, bienvenida local y tarjetas pendientes. | Reconciliar al reconectar; distinguir un fallo de red de un fallo del motor. |

El trabajo continúa en backend cuando se cierra la app. Probar también doble toque, dos dispositivos, timeout tras COMMIT, cierre entre envío y respuesta, retorno desde segundo plano, cambio de meta fallido y reentrega del outbox. Acordar con Diomedes el objetivo de latencia del primer Home listo y medirlo con percentiles por artefacto.

## Verificación reproducible

Ejecutar desde `antares-paciente`. En este corte se usó Node 24.14.0 y el `node_modules` compartido mediante junction. Para replicar CI en un checkout independiente, instalar con el `yarn.lock` según `.github/workflows/ios-testflight.yml`.

```powershell
npm run build
npx vitest run
npm run i18n:check
npx oxlint src
npx vitest run src/features/wellness
```

Para QA, apuntar Playwright a una instancia de prueba ya disponible del SHA validado. Desde el checkout principal, la evidencia del workspace vive en `../.ai/operations/`. Desde este worktree, en `../../../.ai/operations/`. Ejemplo para este worktree con una URL de prueba aprovisionada aparte:

```powershell
$env:COP_E2E_APP_URL = 'https://<entorno-de-qa>'
$env:COP_E2E_OUTPUT = Join-Path (Resolve-Path '../../../.ai/operations') 'wellness-qa'
New-Item -ItemType Directory -Force -Path $env:COP_E2E_OUTPUT | Out-Null
node e2e/wellness-onboarding.mjs
node e2e/wellness-diet.mjs | Tee-Object -FilePath (Join-Path $env:COP_E2E_OUTPUT 'dieta-results.txt')
```

- **Caso válido sintético.** Alta `ana.qa@example.invalid` con contraseña de prueba, contactos sintéticos, 35 años, 165 cm, 74 kg, objetivo bajar, PAR-Q/NQS completos con «No» y aceptación vigente. Cuenta mock existente `demo@wellness.test` / `Demo1234!`, solo para probar la rama de correo existente. El script de onboarding usa su propia cuenta sintética por ancho, API simulada y comprueba 320/390 px.
- **Onboarding, Home, ejercicio y protocolo actual.** El E2E conserva la expectativa histórica «plan listo» → «Entrar» y verifica Home 1/365, 0/5, 0/7, cuatro ejercicios, temporizador, finalización, cofre y regreso a Home 5/5. Actualizar esa expectativa al integrar KAN-136/142 y cubrir todas las filas de la matriz de Home con respuestas controladas. Registrar solicitudes, correlación de job y recuento de artefactos para comprobar la idempotencia.
- **Cambio de objetivo.** En Perfil, partir de un plan con varios días y actividad registrada, elegir otra meta, volver a contestar compuerta/términos, verificar diferencia y versión incrementada, día N y registros previos. Repetir con fallo en el candidato y verificar que el vigente sigue consultable. Hoy hay pruebas de componente/store; falta E2E dedicado.
- **Dieta.** El script usa auth y Food AI simulados, cubre 320/390 px, alternativa, borrador editable de foto, registro de comida, agua y cofre. En integración repetir con sesión real, cámara, permiso denegado, error de Food AI, entrada manual y persistencia tras reinstalar o entrar desde otro dispositivo.
- **Evidencia histórica consultada.** `.ai/operations/2026-11-24-kan136/` contiene capturas del wizard y de la llegada al Home anterior. `2026-11-24-kan142/` contiene las capturas del nuevo Home y baterías. `2026-11-24-kan143/` y `2026-11-24-kan139/` contienen capturas hasta protocolo/cofre/Home 5/5. Cada carpeta tiene `kan136-results.json` con ambos anchos en `passed` y registros de consola `401 (Unauthorized)` de la corrida sintética. PR #32 documenta las pruebas de cambio de objetivo. PR #33 registra los dos PASS del E2E de dieta. No se encontró carpeta individual de evidencia para KAN-144 ni KAN-145 en las operaciones de ese día.
- **Evidencia de producción por adjuntar.** Guardar en `.ai/operations/<fecha>-wellness-produccion/` el SHA de app y revisión ECS, timestamps, logs de gates, resultados HTTP depurados, capturas de cada estado, clips de dispositivo y enlaces a GitHub/TestFlight. Registrar modelo, OS, idioma, zona y caso. Adjuntar la evidencia al issue correspondiente. Esta auditoría usó evidencia E2E histórica y ejecutó los gates locales sin iniciar servidores.

## Producción y gates observados

Fecha de todas las comprobaciones: **24/11/2026**. Horas en Bogotá. `npm run build` produjo un bundle local de producción, sin publicarlo.

| Comando local | Ventana | Resultado |
| --- | --- | --- |
| `npm run build` | 14:36:56–14:38:31 | Exit 0; TypeScript + Vite 8.2.1, 1.872 módulos. `dist/assets/index-DDh9XiTo.js` contiene `erp.coppadresd.com`. Advertencia literal `Some chunks are larger than 1300 kB after minification.` El JS principal pesa 2.929,87 kB, 889,43 kB gzip. |
| `npx vitest run` | 14:36:56–14:38:43 | Exit 1; 248/249 archivos y 2127/2128 pruebas. Falló `src/pages/__tests__/ChatPage.nutritionFlag.test.tsx:11:29`, caso `VITE_CHAT_NUTRITION_ENABLED=true controla chip y acción tipada`. Error literal debajo. |
| `npx vitest run` (repetición tras terminar el build) | 14:39:28–14:40:20 | Exit 0; **249/249 archivos, 2128/2128 pruebas**. Ambas corridas emitieron `connect ECONNREFUSED ::1:3000` y `connect ECONNREFUSED 127.0.0.1:3000`. Los mensajes también aparecieron en la corrida exitosa; causa del timeout inicial sin confirmar. |
| `npm run i18n:check` | 14:36:55–14:37:14 (ventana junto a oxlint) | Exit 0; 2.311 llamadas `t()`, 4.864 claves EN, **0 faltantes** y 2.553 huérfanas según el escáner. |
| `npx oxlint src` | 14:36:55–14:37:14 (ventana junto a i18n) | Exit 0; advertencias `react(only-export-components)` y `react-hooks(exhaustive-deps)`. |

```text
Error: Test timed out in 20000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
```

### TestFlight

`gh run list --branch dev` y consulta con `--json` a las 14:38, exit 0. `gh run view <id> --json status,conclusion,jobs,updatedAt,url` confirma estados por job. El workflow activo publica desde `dev` y admite `workflow_dispatch`.

| Run | SHA y evento | Resultado observado |
| --- | --- | --- |
| [45470320286](https://github.com/FontalvoB/antares-paciente/actions/runs/45470320286) | `d045955`, manual | Pasó lint, Vitest, i18n, guardas y build web. Estaba en cola a las 14:38. A las 14:41:48 y en la última consulta de las 14:44:47, Fastlane seguía en curso y el paso de IPA estaba pendiente. |
| [45452702062](https://github.com/FontalvoB/antares-paciente/actions/runs/45452702062) / [45452234954](https://github.com/FontalvoB/antares-paciente/actions/runs/45452234954) | `d045955` / `cc441ec`, push | Cancelados. |
| [45451786275](https://github.com/FontalvoB/antares-paciente/actions/runs/45451786275) | `b1bcdd8`, push | Success a las 13:02:04. Jobs de validación y de iOS, paso Fastlane y artefacto IPA/dSYMs exitosos. |
| [45447644274](https://github.com/FontalvoB/antares-paciente/actions/runs/45447644274) / [45445624773](https://github.com/FontalvoB/antares-paciente/actions/runs/45445624773) | `b1f43de` / `7191040`, push | Cancelados; sus commits forman parte del run exitoso de `b1bcdd8`. |
| [45444106260](https://github.com/FontalvoB/antares-paciente/actions/runs/45444106260) | `d696242`, push | Success. |

Validar en App Store Connect el número de compilación procesado y el grupo destinatario. La evidencia de disponibilidad en el grupo y la instalación en un iPhone siguen pendientes de verificación.

### ECS/AWS

`aws ecs describe-services --cluster cooppadresd-cluster --services cooppadresd-api cooppadresd-auth cooppadresd-ai --region us-east-2` terminó a las **14:38:35**, exit 0. Reconsulta filtrada a las **14:38:54**, exit 0 y `failures: []`.

| Servicio | Revisión | Estado | Deseadas / corriendo / pendientes | Última actualización del despliegue |
| --- | --- | --- | --- | --- |
| `cooppadresd-api` | `:154` | `ACTIVE`, `PRIMARY/COMPLETED` | 1 / 1 / 0 | 23/11 10:46:02 |
| `cooppadresd-auth` | `:142` | `ACTIVE`, `PRIMARY/COMPLETED` | 1 / 1 / 0 | 23/11 10:41:03 |
| `cooppadresd-ai` | `:89` | `ACTIVE`, `PRIMARY/COMPLETED` | 1 / 1 / 0 | 20/11 15:57:05 |

La consulta confirma estado de los servicios y réplicas. Pendiente un smoke autorizado del contrato de Wellness y revisar los 5xx en la ventana del smoke para confirmar salud funcional.

## Riesgos y dependencias

| Pendiente | Criterio de salida |
| --- | --- |
| KAN-130, motor y persistencia | OpenAPI publicado, paridad .NET con v5.2, migraciones aplicadas, auth por persona, idempotencia y tres artefactos validados con respuestas reales del entorno de QA. |
| Pago, correo, autenticación y deep link | Pago fuera de la app, pasarela real pendiente. Probar activación y reenvío, universal/app link y cuenta con sesión real. Retirar credenciales Wellness de ejemplo del recorrido de producción. Acordar las tres clases de contacto y su auditoría. |
| Apple Health y reloj BLE | KAN-160 valida permisos, sincronización y deduplicación con origen `apple` en iPhone. `b0a90ff` restauró HealthKit en la app y tiene run verde. KAN-158 valida reloj físico y origen `reloj`; cubrir reconexión y permisos. El ADR deja Health Connect fuera de Wellness v1. |
| Notificaciones | KAN-176 cubre protocolo, cofre, racha y mensajes de IA, preferencias y quiet hours. Probar permiso y entrega con credenciales/APNs y FCM configurados para cada build. Alertas automáticas de FC/presión quedan fuera de v1. |
| Matriz nativa KAN-173 | Adjuntar resultados iOS/Android, ES/EN, zonas horarias (incluye medianoche y cambio de zona), offline/reconexión, reanudación, cámara, sesión guiada con bloqueo, deep links y regresiones de comunidad, medicamentos y reloj. KAN-147 cubre validación de accesibilidad y unidades US. |
| Cierre del día e historial | Validar con KAN-141 las transiciones y recompensas al cierre, especialmente al cambiar de fecha o de versión. Revisar historial de protocolo, sesiones, comidas y lectura del ERP para KAN-144. |

## Checklist de Diomedes y Definition of Done en producción

1. [ ] En su checkout limpio, ejecutar `git switch dev`, `git pull --ff-only origin dev`, `git rev-parse --short HEAD`. Verificar que integra los seis merges de la tabla y anotar el SHA exacto que se desplegará. Para validar KAN-136/142 reabiertas, comprobar que incluye su PR de generación.
2. [ ] Repetir los cuatro gates y el E2E de la versión, guardar salidas con timestamp. Criterio: todos los gates en exit 0, sin claves faltantes, evidencia 320/390 y revisión ES/EN, accesibilidad y estados de carga, vacío y error.
3. [ ] Publicar OpenAPI y migraciones con Diomedes. Ejecutar el caso válido y casos `409`, `422` y `503` en QA. Repetir el mismo POST en paralelo, simular timeout tras aceptación y reentrega del outbox. Criterio: un envío, un job inicial, una versión candidata y un resultado por tipo; reintento en el mismo job con las respuestas y piezas listas conservadas.
4. [ ] Verificar el flujo desde la confirmación de pago de prueba hasta Home. Criterio: un correo por activación, enlace válido con manejo de expiración, consentimientos/contactos auditados y sesión de app real. Al confirmar el cuestionario aparece Home de inmediato. Verificar todas las filas de la matriz y bandeja visible en cada transición.
5. [ ] Probar el recorrido diario, versión y persistencia en dos dispositivos. Criterio: cofre se abre una sola vez tras pasos 1–4, sesión guiada recuperable, dieta vinculada al protocolo, cambio de meta mantiene día N e historial, cuenta distinta aislada.
6. [ ] Verificar KAN-173, Food AI, HealthKit/BLE y notificaciones según lo habilitado en el release. Criterio: evidencia nativa con versión, dispositivo, idioma, zona y resultado, y regresiones de los módulos que se mantienen.
7. [ ] Verificar el run TestFlight del SHA candidato, IPA y build procesado/accesible al grupo. Instalar y ejecutar smoke. Verificar ECS estable y correlacionar smoke autenticado con logs/métricas sin 5xx inesperados. Guardar evidencia de deploy y pruebas sin información personal, credenciales ni tokens.
8. [ ] Pegar el bloque correspondiente del [resumen Jira](JIRA-RESUMENES-FINALIZADO.md), adjuntar evidencias, commit, PR, build y responsables. Pasar cada tarea a **Finalizado** cuando cumpla los criterios aplicables. KAN-136/142 reabiertas requieren el trabajo en vuelo, estados reales y cobertura de generación/reintento.

### Referencias del workspace

- PDF local `Downloads/flujo_flujo_cliente_1pag.pdf` (24/11/2026) y [contrato del módulo](../../src/features/wellness/CONTRACT.md).
- En la raíz compartida de Repos, `docs/handoffs/AGENTIC-WELLNESS-DIAZF7583-2026-11-24.md`, `.ai/knowledge/decisions/2026-11-24-agentic-wellness-migracion-v1.md`, `.ai/workspace/OVERVIEW.md` y `.ai/operations/2026-11-24-ola2/PLANTILLA-JIRA.md`.
