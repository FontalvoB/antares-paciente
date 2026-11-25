# Agentic Wellness IA — handoff de producción para Diomedes

**Corte final del carril móvil:** 24/11/2026, hora de Bogotá (UTC−05:00). **Base revisada:** `origin/dev` en `e472af7`, incluida la primera versión de este handoff ([PR #38](https://github.com/FontalvoB/antares-paciente/pull/38)). La generación en segundo plano ya está mergeada en `62889ff` ([PR #37](https://github.com/FontalvoB/antares-paciente/pull/37)). El recorrido móvil usa un generador local y queda listo para cierre móvil en Jira cuando el run TestFlight de ese SHA esté verde. Diomedes debe publicar e integrar el contrato real en KAN-130.

| Merge | Commit en `dev` | PR |
| --- | --- | --- |
| KAN-136 onboarding | `d696242` | #28 |
| KAN-142 Home | `7191040` | #29 |
| KAN-143 protocolo y cofre | `b1f43de` | #30 |
| KAN-139 ejercicio | `b1bcdd8` | #31 |
| KAN-144 cambiar objetivo | `cc441ec` | #32 |
| KAN-145 dieta | `d045955` | #33 |
| KAN-141 cierre del día | `eca5ec4` | #34 |
| KAN-137 SOS global | `f591ce3` | #35 |
| KAN-146 navegación y Perfil | `d055936` | #36 |
| KAN-136/142 generación en segundo plano | `62889ff` | #37 |
| Documentación inicial | `e472af7` | #38 |

## Producto y recorrido oficial

Agentic Wellness IA guía a la persona durante 365 días según su objetivo (bajar de peso, ganar masa o definición). El protocolo diario tiene ejercicio, dieta, vitales, emocional y cofre. Las siete baterías son progresivas y opcionales para el recorrido. PAR-Q (7) y NQS (6) sí condicionan la generación. El motor es .NET, con el motor JS v5.2 como referencia y `golden.json` para verificar paridad. La definición ya cuenta con aprobación profesional según el ADR.

| Paso del PDF «Flujo de experiencia del cliente», 24/11/2026 | App / persona | Backend / automatización | Situación comprobada |
| --- | --- | --- | --- |
| 1. Pago de membresía | La persona paga en web, fuera de la app. | El pago confirmado activa la membresía y dispara la bienvenida de forma idempotente. | Web mock según el ADR, pasarela real pendiente. |
| 2. Correo de bienvenida | La persona recibe el acceso. | Envío automático con enlace de activación, trazabilidad de entrega y reenvío. | Dependencia de la integración de membresía/correo. |
| 3. Ingreso | Abre el enlace y retoma el paso de incorporación que corresponda. | Canjea la invitación y vincula identidad, persona y membresía. | Entrada manual por login/onboarding. El acceso por correo dentro de Wellness es mock. |
| 4. Términos y contactos | Acepta términos y registra contacto principal, familiar y de emergencia. | Registra aceptación versionada y fecha de auditoría, y guarda contactos según roles acordados. | La app captura emergencia principal y respaldo en el paso anterior a términos. Acordar el mapeo de los tres contactos del PDF y su persistencia. |
| 5. Contraseña | Crea la contraseña tras completar el paso anterior. | Auth crea o activa la cuenta y emite sesión de la app. | Alta mock para correo nuevo. La cuenta mock existente usa su contraseña al ingresar y omite crear una nueva. |
| 6. Objetivo y cuestionario | Elige objetivo, contesta y confirma. El siguiente paso visible es Home. | Al confirmar respuestas válidas se asegura un único envío y se generan ejercicio, nutrición y bandeja en segundo plano. | La app guarda respuestas y snapshot, solicita una sola generación local y abre Home en la misma interacción. |
| 7. Home | Consulta sus planes y la bandeja. | Sirve artefactos por versión y publica estados hasta completar. | La app ya muestra progreso, fallo con recuperación y plan listo. La bandeja ocupa su propia sección y presenta carga, mensajes o un texto de estado vacío. |

**Enlace de bienvenida, propuesta de integración.** Usar un enlace HTTPS del dominio de bienvenida aprobado, por ejemplo `https://<dominio>/bienvenida?token=<opaco>`. Backend emite token de un uso, expirable, ligado a invitación/persona/membresía, y lo canjea por una sesión limitada al onboarding. Persistir solo el hash del token en servidor, excluirlo de telemetría y retirar el token de la URL tras el canje. Móvil configura Associated Domains/AASA y App Links/assetlinks, procesa arranque en frío y app abierta, y retoma el paso pendiente. Web ofrece continuidad o instalación si no está la app. Validar expiración, reenvío, enlace ya utilizado, cuenta activa y apertura desde clientes de correo. Acordar dominio, vigencia, rutas y responsables con Auth/Producto.

## Inventario móvil en dev

Las rutas de esta tabla son valores de `flow` y `screen` registrados en `src/App.tsx` / `src/types.ts`. Los caminos abreviados de módulo parten de `src/features/wellness/`. Las claves son locales al navegador/WebView. El cierre del día agrega un sufijo por dueño; las demás claves Wellness del inventario son globales al origen. Para producción, aislar cuentas, rehidratar desde backend y definir el tratamiento de datos demo en actualizaciones. El mock guarda contraseñas de prueba en claro; usar exclusivamente credenciales sintéticas.

| Jira y ruta | Archivos clave y persistencia actual | Mock / integración necesaria |
| --- | --- | --- |
| **KAN-136** · `flow=onboarding`, correo → emergencia → términos → contraseña → objetivo (8 pasos) → `home` | `src/pages/OnboardingPage.tsx`, `src/context/AppContext.tsx` (`finishWellnessOnboarding`), `components/onboarding/`, `components/objective/`, `services/wellness-onboarding-service.ts`, `domain/{types,draft,questions,gate,plan-preview}.ts`. Escribe `wellness.mock.accounts.v1`, `wellness.onboarding.draft.v1` y `wellness.plan.v1`. Retiene las respuestas para recuperación. | Lookup, alta y login Wellness locales. La compuerta y el resumen inicial se calculan localmente. Backend requiere Auth real, consentimiento/contactos, envío durable y validación en servidor. |
| **KAN-142** · `screen=home` → protocolo, dieta, ejercicio, cierre, Vita y baterías | `home/WellnessHome.tsx`, `state/wellness-home-store.ts`. Lee `wellness.plan.v1`, `wellness.protocol.v1`, `wellness.batteries.v1`, `wellness.generation.v1` y el check-in del dueño/día. | Día X/365 y métricas con estado local. Integrar planes, progreso, bandeja y datos agregados persistentes. Vitales permanece en el protocolo y su módulo dedicado queda para KAN-138. |
| **KAN-143** · `screen=protocol` desde Home | `protocol/WellnessProtocol.tsx`, `state/wellness-home-store.ts`. Lee plan; escribe `wellness.protocol.v1`. | Secuencia ejercicio, dieta, vitales, emocional y cofre. Cofre exige pasos 1–4, una apertura por día local. Backend debe registrar completados/recompensa con deduplicación, zona IANA del paciente, cambio de día, y rehidratación en otro dispositivo. Coordinar cierre de día con KAN-141 y vitales con KAN-138. |
| **KAN-139** · `screen=wellness-exercise` desde Home/protocolo | `exercise/WellnessExercise.tsx`, `exercise/{exercise-plan,exercise-catalog}.ts`. Lee plan y escribe `wellness.exercise.checkin.v1`, `wellness.exercise.session.v1`, `wellness.exercise.pending.v1`, `wellness.protocol.v1`. | Rutina determinista local por día/objetivo con patrón semanal, fases, descarga, desbloqueos, adaptación por check-in y sesión guiada reanudable. `pending` registra una finalización local. Integrar rutina del motor, procedencia del check-in y sincronización idempotente de sesiones/completados. |
| **KAN-144** · `prof` → Mi plan → Objetivo → `wellness-goal` → `home` | `goal/WellnessGoalPage.tsx`, `state/goal-change.ts`, `state/wellness-home-store.ts`. Escribe `wellness.plan.v1` y `wellness.plan.versions.v1`. Conserva fecha de inicio, `wellness.protocol.v1` y `wellness.batteries.v1`. | Reutiliza wizard precargado, solicita de nuevo PAR-Q/NQS y términos, calcula diferencias de objetivo/kcal/macros y archiva la versión anterior localmente. Backend debe guardar versiones, conservar historial y publicar el nuevo plan sin interrumpir el vigente si falla la regeneración. |
| **KAN-145** · `screen=wellness-diet` desde Home/protocolo | `nutrition/WellnessDiet.tsx`, `nutrition/{diet-plan,diet-store,meal-catalog}.ts`, `src/utils/foodAiApi.ts`. Lee plan y escribe `wellness.diet.v1` (plato elegido, comidas, agua, modo simplificado y borrador numérico por foto), y `wellness.protocol.v1` al registrar una comida. | Menú de cuatro comidas, objetivos de macros/agua, alternativas y registros locales. La foto ya invoca Food AI real por `POST /api/v1/foodai/analyze` autenticado, con edición y entrada manual si falla la estimación. Backend debe entregar menú generado y persistir registros por día, versión, comida y persona. Verificar sesión real y permisos de cámara. |
| **KAN-141** · `wellness-checkin` desde Home/protocolo | `checkin/WellnessCloseDay.tsx`, `checkin/{close-day,checkin-store}.ts` y `src/App.tsx`. Check-in local de la cuenta por fecha; ejercicio y dieta leen los efectos del día anterior. | Guardado offline, reanudación de pendientes al volver online y confirmación de sync simulada. Backend requiere persistencia idempotente y reglas versionadas para recalcular el día siguiente. |
| **KAN-137** · SOS global, overlay sin ruta propia | `src/App.tsx`, `src/components/{SosLayer,SosQuickAccess,PanicOverlay,BottomNav}.tsx`, `sos/sos-store.ts`, `src/services/sos/sos-service.ts`. Escribe `wellness.sos.audit.v1` y `wellness.sos.notices.v1`. | Aviso a contactos desde la cuenta regresiva es local y auditado. El flujo real existente envía al backend solo después de la doble confirmación. |
| **KAN-146** · barra `home` / `wellness-diet` / SOS / `wellness-exercise` / `prof` | `src/{App.tsx,types.ts}`, `context/AppContext.tsx`, `components/BottomNav.tsx`, `pages/ProfilePage.tsx`. No introduce claves locales de navegación. | Mantener el mapeo de pushes y enlaces a rutas habilitadas. Los destinos retirados se resuelven en Home. |
| **KAN-136/142 generación** · confirmación de cuestionario → `home` inmediato | `OnboardingPage.tsx`, `generation/{generation-store,useGeneration}.ts` y `home/WellnessHome.tsx`. `wellness.generation.v1` persiste trabajo, timestamps, intentos y estados; `wellness.onboarding.draft.v1` conserva las respuestas. | Generador y bandeja locales, refresco de 400 ms y reintento parcial. Sustituir mock por HTTP, outbox y motor, manteniendo el estado al reiniciar. |

## Navegación v5.1, cierre del día y SOS

**KAN-146.** Los flujos siguen siendo `login`, `onboarding`, `tests` y `app`. Pantallas activas: `home`, `protocol`, `wellness-diet`, `wellness-exercise`, `wellness-goal`, `wellness-checkin` y `prof`. SOS y Vita son overlays. Perfil reúne avatar/datos, evaluaciones, planes de nutrición/ejercicio y cambio de objetivo. Los destinos legados `book`, `hc`, `nut`, `edu`, `infinito`, `bt`, `health-accessory`, `chat`, `medical-sources`, `medications`, `avatar`, `prog`, `program-*`, `com`, `room` y `body` se resuelven en Inicio. Se retiran Chat IA, Historia Clínica, Citas, Academia, INFINITO, Podcast, Marketplace, Avatar independiente y Programa anterior. Comunidad y Medicamentos esperan KAN-135, Apple Health KAN-160, reloj BLE KAN-158 y Citas KAN-174. En pushes y enlaces, usar destinos habilitados.

**KAN-141.** `wellness.checkins.v1.<dueño codificado>` guarda un registro por fecha local con `idempotencyKey`, `input` y `pending` o `synced`. El dueño se deriva de id, cédula o correo, con fallback local. Campos: adherencia, horas de sueño, energía, dolor, síntomas, peso/cintura opcionales y ejercicio realizado. Doble cierre recupera el registro existente y las fechas futuras se rechazan. El shell reintenta al entrar y en el evento `online`. Hoy `synced` refleja la confirmación del transporte mock. Dieta y ejercicio ya aplican efectos locales del cierre, incluidos menú simplificado y adaptación de sesión.

Para KAN-130 se propone `POST /v1/wellness/daily-checkins` con clave opaca estable. Acordar zona IANA y restricción única por paciente, membresía y día local. Para un replay idéntico, devolver el cierre original. Usar `409` si difiere el contenido registrado y `422` para valores o fechas inválidos. Un fallo temporal mantiene el cierre pendiente. Devolver id durable y efectos versionados del siguiente día para reconciliar la UI sin duplicar efectos ni recompensas.

```json
{
  "localDate": "2026-11-24",
  "timezone": "America/Bogota",
  "input": {
    "adherence": 75, "sleepHours": 7, "energy": 4, "pain": 0, "symptoms": [],
    "weightKg": null, "waistCm": null, "exercised": true
  }
}
```

**KAN-137.** Cuenta regresiva de cinco segundos con opciones para llamar a emergencias, llamar al contacto o cancelar. `wellness:sos` enlaza voz/Vita con el overlay. En onboarding requiere un teléfono de emergencia. Cancelar registra el resultado y no envía avisos. Elegir emergencias o agotar la cuenta abre el marcador con el número del país (123 en Colombia; 911 en EE. UU. y como fallback). La auditoría local guarda fecha/hora, resultado y pantalla, hasta 50 entradas. `called_911` es una etiqueta histórica: registra la apertura del marcador y no acredita el número marcado ni una llamada completada. El aviso de contactos de ese camino es simulado.

Mantener **REQ-SOS-07**. Solo orbe → confirmación afirmativa activa la alerta real mediante `POST /api/v1/sos/alerts` con `Idempotency-Key`. La cuenta regresiva puede abrir el marcador y registrar un aviso local. Acordar con Diomedes y Legal la entrega automática a contactos y su auditoría antes de habilitarla. Usar dobles de prueba para validar marcador y ausencia de POST al cancelar o al agotar la cuenta. Verificar teclado, sesión guiada y salida de vídeo nativo a pantalla completa en KAN-173.

## Contrato de generación para Diomedes

La referencia para KAN-130 es el [Handoff de generación KAN-136/142](KAN-136-142-handoff-diomedes.md), con ejemplos JSON, polling, errores y requisitos de datos. Adopta la familia `/v1/wellness` del PR #37. Las operaciones requieren sesión de app y autorización sobre la generación del paciente.

| Operación propuesta | Comportamiento |
| --- | --- |
| `POST /v1/wellness/generate` | Clave estable por envío y cuerpo `{"submissionId":"sub_123"}`. El envío referencia cuestionario y términos inmutables. `202` con `Location`; replay finalizado puede devolver `200` con la misma generación. |
| `GET /v1/wellness/generation/{generationId}` | `200` con intentos, estado, errores y progreso por artefacto de 0 a 100. Estados `pending`, `running`, `ready` y `failed`. Usar `resultId` para leer el plan publicado. |
| `POST /v1/wellness/generation/{generationId}/retry` | Clave estable por reintento lógico y `{"expectedAttempts":1}`. `202` con el mismo id, conservando piezas listas; `200` si ya quedó todo listo. |
| `GET /v1/wellness/inbox?generationId=gen_123` | `200` con estado, mensajes localizados y fechados, y cursor opcional. `items: []` es válido para carga y ausencia de mensajes. La sección de Home siempre tiene un estado visible. |

`409` indica conflicto de clave o revisión. Reconciliar con el estado existente. `422` entrega `issues` con código/campo/paso y conserva las respuestas para corregir. Para `503`, respetar `Retry-After` y repetir con la misma clave. Acordar cómo persistir el envío autenticado previo a generate y cómo leer cada plan por `resultId`.

| Entidad / garantía | Tarea |
| --- | --- |
| Envío versionado, paciente, membresía, términos, zona, respuestas. Generación única por paciente y envío, clave y hash; intentos, progreso, artefactos, bandeja y outbox. | KAN-134, modelo y migraciones |
| Motor .NET, planes versionados y conservación del vigente e historial hasta activar el candidato. | KAN-110, Motor 365 |
| OpenAPI, autorización, errores, cadencia de consulta e idempotencia. | KAN-130 |
| Pago web confirmado, bienvenida y activación por enlace. | KAN-116 |

Registrar generación y evento lógico `WellnessGenerationRequested` en una transacción de outbox. Una reentrega puede repetir el evento físico. El consumidor deduplica su efecto con el eventId y restricciones únicas por generación, artefacto y versión. Los mensajes iniciales son únicos por generación y tipo. Un reintento agrega un intento sin cambiar de generación, respuestas ni versión candidata, y recalcula las piezas fallidas. Mantener ids y códigos en trazas y excluir respuestas, contactos y credenciales.

El mock usa una huella del snapshot (`startDate|goal|createdAt`) y restaura el trabajo con `startedAt`. Si falla el almacenamiento, recupera el intento en memoria durante la sesión. Para producción, usar el identificador durable del envío y su `generationId`. Validar concurrencia, timeout tras aceptación, reinicio, reentrega y fallo parcial entre dispositivos.

## Estados de Home

| Caso | UX en el merge móvil | Integración real |
| --- | --- | --- |
| Sin generación local | Bandeja con su estado visible. Sin snapshot, el plan puede aparecer como vista previa. | Resolver el onboarding pendiente desde la cuenta. |
| En cola o generando | Home inmediato, tarjeta de preparación y progreso de ejercicio, nutrición y bandeja. Refresco local cada 400 ms. | Usar progreso y cadencia del servidor, recuperar el trabajo al volver a primer plano. |
| Listo parcial | Las piezas cambian de estado por separado. Las listas se conservan durante el reintento. | Consumir por `resultId` y mantener coherencia de versión. |
| Fallo | Mensaje de respuestas guardadas, CTA «Reintentar» y bandeja visible. Recupera piezas fallidas. | Distinguir red y motor; conservar borrador y clave. Para `422`, volver al formulario conservando campos. |
| Listo | Se retira el panel de progreso; quedan planes y mensajes fechados. Ante bandeja vacía se muestra «No tienes mensajes nuevos». | Actualizar al cambiar de versión y consultar estados/artefactos reales. |

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
$env:COP_E2E_SHOTS = Join-Path $env:COP_E2E_OUTPUT 'sos'
node e2e/wellness-sos.mjs
node e2e/wellness-diet.mjs | Tee-Object -FilePath (Join-Path $env:COP_E2E_OUTPUT 'dieta-results.txt')
```

- **Caso válido sintético.** Alta `ana.qa@example.invalid` con contraseña de prueba, contactos sintéticos, 35 años, 165 cm, 74 kg, objetivo bajar, PAR-Q/NQS completos con «No» y aceptación vigente. Cuenta mock existente `demo@wellness.test` / `Demo1234!`, solo para probar la rama de correo existente. El script de onboarding usa su propia cuenta sintética por ancho, API simulada y comprueba 320/390 px.
- **Onboarding, generación y Home.** `e2e/wellness-onboarding.mjs` comprueba la transición inmediata a Home, tarjeta de generación, retiro automático en hasta 3 s y cuatro mensajes fechados. `.ai/operations/2026-11-24-kan136-142-gen/kan136-results.json` registra `generationMs` de **1683 ms (390 px)** y **1676 ms (320 px)**. El JSON de navegación en la misma carpeta registra 1722/1739 ms. Son tiempos del mock. Para integración, guardar correlación del job y recuento de artefactos tras replay.
- **Protocolo, ejercicio, cierre y navegación.** El E2E verifica sesión guiada, cofre, guardado del cierre offline, sincronización al reconectar y navegación del Perfil. Consultar `.ai/operations/2026-11-24-kan146/kan146-results.json` y las capturas `20-cierre-formulario-*`, `21-cierre-pendiente-*`, `22-cierre-sincronizado-*` y `20-nav-*` a `25-nav-*`. En backend, repetir con cuenta real, fecha local, reconexión, doble cierre y otro dispositivo.
- **SOS global.** `e2e/wellness-sos.mjs` cubre 320 y 390 px según PR #35. Ejecutarlo contra QA con marcador interceptado y sin avisos reales. Pruebas `wellness-sos.test.tsx` y `sos-store.test.ts` cubren overlay y auditoría.
- **Cambio de objetivo.** En Perfil, partir de un plan con varios días y actividad registrada, elegir otra meta, volver a contestar compuerta/términos, verificar diferencia y versión incrementada, día N y registros previos. Repetir con fallo en el candidato y verificar que el vigente sigue consultable. Hoy hay pruebas de componente/store; falta E2E dedicado.
- **Dieta.** El script usa auth y Food AI simulados, cubre 320/390 px, alternativa, borrador editable de foto, registro de comida, agua y cofre. En integración repetir con sesión real, cámara, permiso denegado, error de Food AI, entrada manual y persistencia tras reinstalar o entrar desde otro dispositivo.
- **Evidencia histórica consultada.** `.ai/operations/2026-11-24-kan136/` contiene capturas del wizard y de la llegada al Home anterior. `2026-11-24-kan142/` contiene las capturas del nuevo Home y baterías. `2026-11-24-kan143/` y `2026-11-24-kan139/` contienen capturas hasta protocolo/cofre/Home 5/5. Cada carpeta tiene `kan136-results.json` con ambos anchos en `passed` y registros de consola `401 (Unauthorized)` de la corrida sintética. PR #32 documenta las pruebas de cambio de objetivo. PR #33 registra los dos PASS del E2E de dieta. No se encontró carpeta individual de evidencia para KAN-144 ni KAN-145 en las operaciones de ese día.
- **Evidencia de producción por adjuntar.** Guardar en `.ai/operations/<fecha>-wellness-produccion/` el SHA de app y revisión ECS, timestamps, logs de gates, resultados HTTP depurados, capturas de cada estado, clips de dispositivo y enlaces a GitHub/TestFlight. Registrar modelo, OS, idioma, zona y caso. Adjuntar la evidencia al issue correspondiente. Esta auditoría usó evidencia E2E histórica y ejecutó los gates locales sin iniciar servidores.

## Producción y gates observados

Fecha: **24/11/2026**. Horas en Bogotá. Base de código `e472af7`; el merge al worktree conserva el mismo árbol de aplicación.

| Comando | Ventana | Resultado |
| --- | --- | --- |
| `npx vitest run` | 15:14:18–15:14:55 | Exit 0, **254/254 archivos, 2185/2185 pruebas**. Hubo mensajes no fatales `connect ECONNREFUSED ::1:3000` y `connect ECONNREFUSED 127.0.0.1:3000`. |
| `npm run build` | 15:17:24–15:17:42 | Exit 0, TypeScript + Vite 8.2.1, 1501 módulos. Advertencia `Some chunks are larger than 1300 kB after minification.` JS principal 2262,99 kB, 712,05 kB gzip. El bundle se generó localmente. |
| `npm run i18n:check` | 15:18:13–15:18:14 | Exit 0, **0 faltantes**, 2308 llamadas, 4933 claves EN y 2625 huérfanas según el escáner. |
| `npx oxlint src` | 15:17:24–15:17:25 | Exit 0, advertencias `react(only-export-components)` y `react-hooks(exhaustive-deps)`. |

### TestFlight

El candidato final es el [run 45478408297](https://github.com/FontalvoB/antares-paciente/actions/runs/45478408297), `workflow_dispatch` sobre `e472af7`. La consulta `gh run view 45478408297 --json status,conclusion,headSha,jobs,event,url,updatedAt` confirmó SHA y evento. Pasó de cola a `in_progress`. A las **15:19:58** el job de validaciones seguía en curso y aún no figuraban conclusión ni número de build.

El [run 45475062145](https://github.com/FontalvoB/antares-paciente/actions/runs/45475062145) de KAN-141 (`eca5ec4`) y el [manual 45470320286](https://github.com/FontalvoB/antares-paciente/actions/runs/45470320286) de `d045955` concluyeron en `success`. Verificar build procesado, grupo de testers y smoke nativo del SHA final para la evidencia de producción.

### ECS/AWS

`aws ecs describe-services --cluster cooppadresd-cluster --services cooppadresd-api cooppadresd-auth cooppadresd-ai cooppadresd-frontend --region us-east-2` a las **15:13:48**, exit 0 y `failures: []`.

| Servicio | Revisión ECS | Estado | Deseadas / corriendo / pendientes |
| --- | --- | --- | --- |
| `cooppadresd-api` | `:154` | `ACTIVE / COMPLETED` | 1 / 1 / 0 |
| `cooppadresd-auth` | `:142` | `ACTIVE / COMPLETED` | 1 / 1 / 0 |
| `cooppadresd-ai` | `:89` | `ACTIVE / COMPLETED` | 1 / 1 / 0 |
| `cooppadresd-frontend` | `:118` | `ACTIVE / COMPLETED` | 1 / 1 / 0 |

**0 5xx registrados en seis horas**, ventana **09:14:41–15:14:41**. `aws cloudwatch get-metric-statistics` en `AWS/ApplicationELB`, dimensiones `LoadBalancer` de `cooppadresd-alb` y `cooppadresd-alb-internal`, métricas `HTTPCode_ELB_5XX_Count` y `HTTPCode_Target_5XX_Count`, `Sum` con período 3600. Las cuatro series de errores devolvieron cero puntos. `RequestCount` registró 53 solicitudes en el ALB público y 4796 en el interno. Queda por ejecutar el smoke autenticado del contrato de Wellness cuando se publique.

## Riesgos y dependencias

| Pendiente | Criterio de salida |
| --- | --- |
| KAN-130, motor y persistencia | OpenAPI publicado, paridad .NET con v5.2, migraciones aplicadas, auth por persona, idempotencia y tres artefactos validados con respuestas reales del entorno de QA. |
| Pago, correo, autenticación y deep link | Pago fuera de la app, pasarela real pendiente. Probar activación y reenvío, universal/app link y cuenta con sesión real. Retirar credenciales Wellness de ejemplo del recorrido de producción. Acordar las tres clases de contacto y su auditoría. |
| Módulos fuera de la navegación | Comunidad y Medicamentos vuelven con KAN-135, Apple Health con KAN-160, BLE con KAN-158 y Citas con KAN-174. `b0a90ff` restauró HealthKit anteriormente; su entrada permanece retirada en v5.1. Validar origen y deduplicación de `apple` y `reloj` cuando se habiliten. El ADR deja Health Connect fuera de Wellness v1. |
| Notificaciones | KAN-176 cubre protocolo, cofre, racha y mensajes de IA, preferencias y quiet hours. Probar permiso y entrega con credenciales/APNs y FCM configurados para cada build. Alertas automáticas de FC/presión quedan fuera de v1. |
| Matriz nativa KAN-173 | Adjuntar resultados iOS/Android, ES/EN, zonas horarias (incluye medianoche y cambio de zona), offline/reconexión, reanudación, cámara, sesión guiada con bloqueo, deep links y regresiones de comunidad, medicamentos y reloj. KAN-147 cubre validación de accesibilidad y unidades US. |
| Cierre del día e historial | KAN-141 móvil ya está integrado. Sustituir el transporte simulado y validar transiciones, efectos y recompensas con cambio de fecha o versión. Revisar historial de protocolo, sesiones, comidas y lectura del ERP para KAN-144. |
| SOS | Mantener doble confirmación de la alerta real, diferenciar auditoría local de entrega confirmada y validar 123/911, permisos y vídeo nativo. Acordar aviso automático con backend y Legal. |

## Checklist de Diomedes y Definition of Done en producción

1. [ ] En su checkout limpio, ejecutar `git switch dev`, `git pull --ff-only origin dev`, `git rev-parse --short HEAD`. Verificar que incluye `e472af7` y todos los merges de la tabla, y anotar el SHA exacto del build.
2. [ ] Repetir los cuatro gates y el E2E de la versión, guardar salidas con timestamp. Criterio: todos los gates en exit 0, sin claves faltantes, evidencia 320/390 y revisión ES/EN, accesibilidad y estados de carga, vacío y error.
3. [ ] Publicar OpenAPI y migraciones con Diomedes. Ejecutar el caso válido y casos `409`, `422` y `503` en QA. Repetir el mismo POST en paralelo, simular timeout tras aceptación y reentrega del outbox. Criterio: un envío, un job inicial, una versión candidata y un resultado por tipo; reintento en el mismo job con las respuestas y piezas listas conservadas.
4. [ ] Verificar el flujo desde la confirmación de pago de prueba hasta Home. Criterio: un correo por activación, enlace válido con manejo de expiración, consentimientos/contactos auditados y sesión de app real. Al confirmar el cuestionario aparece Home de inmediato. Verificar todas las filas de la matriz y bandeja visible en cada transición.
5. [ ] Probar protocolo, versión y persistencia en dos dispositivos. Criterio: cofre una vez tras pasos 1–4, sesión recuperable, dieta vinculada al protocolo, cierre offline sincronizado una vez por fecha y cambio de meta conserva día N e historial. Verificar Perfil y fallback de destinos retirados, más los dos caminos de SOS con dobles de prueba.
6. [ ] Verificar KAN-173, Food AI, HealthKit/BLE y notificaciones según lo habilitado en el release. Criterio: evidencia nativa con versión, dispositivo, idioma, zona y resultado, y regresiones de los módulos que se mantienen.
7. [ ] Verificar el run TestFlight del SHA candidato, IPA y build procesado/accesible al grupo. Instalar y ejecutar smoke. Verificar ECS estable y correlacionar smoke autenticado con logs/métricas sin 5xx inesperados. Guardar evidencia de deploy y pruebas sin información personal, credenciales ni tokens.
8. [ ] Con el run TestFlight de `e472af7` en verde, pegar los bloques del [resumen Jira](JIRA-RESUMENES-FINALIZADO.md) y pasar a **Finalizado** el alcance móvil, incluyendo generación KAN-136/142. Adjuntar PR, evidencia y build. Mantener el seguimiento de backend y las pruebas nativas pendientes en sus tareas. Los puntos 3–7 son los criterios de verificación de la integración productiva completa.

### Referencias del workspace

- PDF local `Downloads/flujo_flujo_cliente_1pag.pdf` (24/11/2026) y [contrato del módulo](../../src/features/wellness/CONTRACT.md).
- En la raíz compartida de Repos, `docs/handoffs/AGENTIC-WELLNESS-DIAZF7583-2026-11-24.md`, `.ai/knowledge/decisions/2026-11-24-agentic-wellness-migracion-v1.md`, `.ai/workspace/OVERVIEW.md` y `.ai/operations/2026-11-24-ola2/PLANTILLA-JIRA.md`.
