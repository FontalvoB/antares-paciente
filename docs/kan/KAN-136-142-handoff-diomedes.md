# KAN-136 y KAN-142 · Handoff para Diomedes

## Flujo del cliente

Pago web automático confirmado → correo de bienvenida → ingreso desde el enlace del correo → aceptación de términos y registro de contactos principal, familiar y de emergencia → creación de contraseña → objetivo y cuestionario → Inicio.

Al validar el cuestionario, la app guarda las respuestas y el resumen del plan, solicita una sola generación y abre Inicio en la misma interacción. El ejercicio, la nutrición y la bandeja se preparan en segundo plano. Inicio conserva el saludo, el día, el protocolo y los accesos mientras muestra el avance de cada elemento. Si alguno falla, el cliente recupera ese resultado desde Inicio con **Reintentar** y conserva sus respuestas y los resultados listos. La bandeja muestra carga, mensajes con fecha o un mensaje de estado vacío.

El enlace profundo del correo depende de que KAN-116 confirme el pago en servidor y pueda emitir una invitación vinculada a la membresía. El contrato de activación debe acordar URL, App Links/Universal Links, token de un solo uso con caducidad, destino web si la app no está instalada y recuperación al abrir un enlace vencido. Al canjearlo, el servidor vincula la sesión con la cuenta pagada y devuelve el siguiente paso pendiente. El pago y el envío del correo ocurren fuera de la app. El mensaje de bienvenida de la bandeja se genera por separado.

## Contrato HTTP propuesto para KAN-130

La identidad del paciente se obtiene de la sesión autenticada. Todas las lecturas y escrituras se autorizan para ese paciente. La app reutiliza una clave idempotente estable por envío aceptado y la conserva durante cortes de red o recargas.

| Operación | Entrada | Respuesta |
| --- | --- | --- |
| `POST /v1/wellness/generate` | Cabecera `Idempotency-Key` y cuerpo `{"submissionId":"sub_123"}`. El ID referencia una versión inmutable del objetivo, respuestas y términos ya guardados. | `202`, estado actual y `Location: /v1/wellness/generation/gen_123`. Un replay con la misma clave y contenido devuelve la misma generación, con `200` si ya está finalizada. |
| `GET /v1/wellness/generation/{generationId}` | ID devuelto por el POST. Puede consultarse mientras hay artefactos activos. | `200`, estado de la generación. Un artefacto fallido sigue siendo un estado consultable. |
| `POST /v1/wellness/generation/{generationId}/retry` | Cabecera `Idempotency-Key` por reintento lógico y cuerpo `{"expectedAttempts":1}`. El servidor detecta cuáles artefactos fallaron. | `202` con el mismo ID, nuevo intento y resultados listos conservados. Si ya corre el reintento de esa revisión, devuelve el estado de ese intento. Si todo está listo, devuelve `200` sin iniciar otro intento. |
| `GET /v1/wellness/inbox?generationId=gen_123&cursor=...` | ID de generación, cursor opcional y locale de la sesión o de `Accept-Language`. | `200` con estado de la bandeja y mensajes. `items: []` es válido durante la carga y cuando no hay mensajes. |

Ejemplo de estado después de que ejercicio y bandeja se publicaron y nutrición falló.

```json
{
  "generationId": "gen_123",
  "submissionId": "sub_123",
  "startedAt": "2026-11-24T15:00:00Z",
  "attempts": 1,
  "status": "failed",
  "artifacts": {
    "exercise": { "status": "ready", "progress": 100, "resultId": "ex_123" },
    "nutrition": {
      "status": "failed",
      "progress": 0,
      "error": { "code": "WORKER_UNAVAILABLE", "retryable": true }
    },
    "inbox": { "status": "ready", "progress": 100 }
  }
}
```

Cada artefacto usa `pending`, `running`, `ready` o `failed` y progreso entero entre 0 y 100. La generación está `pending` si todo está en cola, `running` si quedan tareas activas, `failed` si se asentó con fallos y `ready` si los tres artefactos están publicados. La app puede mostrar el resultado disponible de cada uno sin esperar al resto.

Ejemplo de respuesta de bandeja.

```json
{
  "status": "ready",
  "items": [
    {
      "id": "msg_123",
      "type": "exercise_ready",
      "title": "Tu plan de ejercicio está listo",
      "body": "Abre Ejercicio para ver tu primera sesión.",
      "createdAt": "2026-11-24T15:00:01Z"
    }
  ],
  "nextCursor": null
}
```

Tipos de mensaje iniciales: `welcome`, `exercise_ready`, `nutrition_ready` y `questionnaires`. Publicar los mensajes de cada plan solo cuando su resultado esté disponible.

| Código | Tratamiento |
| --- | --- |
| `202 Accepted` | La solicitud quedó registrada de forma durable. Abrir Inicio y consultar el estado. |
| `409 Conflict` | Clave reutilizada con contenido distinto o revisión de reintento incompatible. Consultar el estado vigente y reconciliar antes de generar otro envío. |
| `422 Unprocessable Content` | Cuestionario, términos o reglas de elegibilidad inválidos. Devolver `issues` con `code`, `field` y `step`. Conservar el borrador y mostrar la corrección en el formulario. |
| `503 Service Unavailable` | Dependencia temporalmente indisponible. Devolver `Retry-After` cuando esté disponible. Ante una respuesta incierta, repetir con la misma clave para recuperar la operación original. |

Formato de error propuesto: `{"code":"IDEMPOTENCY_CONFLICT","retryable":false,"issues":[],"traceId":"trace_123"}`.

## Datos y evento de generación

- **Envío**. Guardar paciente, membresía, objetivo versionado, respuestas PAR-Q/NQS, confirmación profesional cuando aplique, versión y fecha de términos y fecha de envío. Mantener separados los contactos asociados al perfil del paciente.
- **Generación**. Guardar `generationId`, envío y paciente, clave idempotente y hash del cuerpo, fechas, intentos y estado. Aplicar unicidad a `(patient_id, idempotency_key)` y `(patient_id, submission_id)`. Guardar por artefacto estado, progreso, intento, referencia al resultado y código de error.
- **Resultados y bandeja**. Versionar los planes de ejercicio y nutrición. Guardar por mensaje paciente, generación, tipo, contenido o plantilla, `created_at` y `read_at`. Usar una restricción única por generación y tipo para los mensajes iniciales.
- **Outbox transaccional**. En la transacción que crea la generación, insertar `WellnessGenerationRequested` con un ID único y referencia al envío. Un POST repetido lee la fila existente. El publicador puede reenviar el mismo evento si pierde la confirmación. El consumidor registra el ID procesado y publica cada resultado de forma idempotente por generación, artefacto e intento. Así el efecto inicial ocurre una sola vez aunque el transporte entregue varias veces. En un reintento aceptado, guardar el nuevo intento y su evento de outbox en una sola transacción.
- **Datos sensibles**. Restringir acceso y auditar lecturas de respuestas y contactos. El evento y los logs transportan identificadores y códigos operativos. Las respuestas se recuperan desde el envío autorizado.

## Adaptación de la app

- `src/features/wellness/services/wellness-onboarding-service.ts` simula correo, cuenta y validación con vista previa local. Conserva las respuestas en `wellness.onboarding.draft.v1`. Integrar aquí el guardado autenticado del envío y los errores de compuerta publicados por KAN-130.
- `src/pages/OnboardingPage.tsx` guarda el resumen con `savePlanSnapshot`, pide la generación y llama a `finishWellnessOnboarding`. Si falla el arranque local, deja el trabajo en estado fallido y abre Inicio.
- `src/features/wellness/generation/generation-store.ts` persiste el trabajo activo en `wellness.generation.v1`. Calcula avance por reloj para ejercicio (900 ms), nutrición (1300 ms) y bandeja (700 ms). `setNextFailure` habilita pruebas de fallo y los mensajes son plantillas locales. Sustituir esta implementación por las operaciones HTTP y usar el ID devuelto para retomar estado. Si el navegador bloquea la escritura, el mock conserva las respuestas, el snapshot y el trabajo fallido en memoria para ofrecer reintento durante esa sesión.
- `src/features/wellness/generation/useGeneration.ts` actualiza Inicio cada 400 ms mientras el mock esté activo. Con el backend, usar la cadencia acordada y respetar `Retry-After`. `WellnessHome.tsx` presenta avance, fallo y bandeja. Los módulos de ejercicio y nutrición consumen sus datos actuales del mock; conectar las vistas a los `resultId` publicados en KAN-110.

## Cómo probar

1. Ejecutar `npx vitest run src/features/wellness src/pages/__tests__/OnboardingPage.test.tsx`. Se cubren doble envío, restauración del estado persistido, error de arranque con entrada inmediata a Inicio y reintento parcial.
2. Levantar Vite en `5181`. Configurar `COP_E2E_APP_URL=http://127.0.0.1:5181` y `COP_E2E_OUTPUT` con la ruta a `.ai/operations/2026-11-24-kan136-142-gen`. Ejecutar `node e2e/wellness-onboarding.mjs`. El flujo comprueba Inicio a 390 px y 320 px, transición automática en hasta tres segundos y cuatro mensajes fechados.
3. En integración, enviar dos POST concurrentes con la misma clave y comprobar un ID, una fila de outbox y un efecto del consumidor al repetir la entrega. Simular un fallo de nutrición y dos reintentos concurrentes. Confirmar que solo nutrición se vuelve a ejecutar y que la bandeja conserva los mensajes sin duplicarlos. Verificar conflicto, validación y caída temporal con `409`, `422` y `503`.
4. Con una membresía de prueba pagada, abrir el enlace de bienvenida en un dispositivo con la app instalada y otro con navegador. Comprobar canje, caducidad y reanudación en el siguiente paso pendiente.

## Relación con Jira

| Ítem | Entrega o dependencia |
| --- | --- |
| [KAN-110](https://diomedescerda.atlassian.net/browse/KAN-110) | Épica Motor 365. El motor produce y versiona los resultados de ejercicio y nutrición. |
| [KAN-134](https://diomedescerda.atlassian.net/browse/KAN-134) | Modelo y migraciones. Persistencia del envío, generación, artefactos, bandeja y outbox. |
| [KAN-130](https://diomedescerda.atlassian.net/browse/KAN-130) | Contrato `/v1` y OpenAPI. Operaciones autenticadas, códigos de error e idempotencia. |
| [KAN-116](https://diomedescerda.atlassian.net/browse/KAN-116) | Membresía y pago web. Confirmación del pago, correo de bienvenida y enlace de activación. |
