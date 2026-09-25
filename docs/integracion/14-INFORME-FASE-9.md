# FASE 9 — Chat IA / Asistente y Agentes Clínicos: Informe de Integración

> **Change OpenSpec**: `app-fase-9-chat-ia-agentes`
> **Fecha**: 2026-09-24
> **Estado**: Completada e integrada (Backend + APP móvil + suite completa en verde)

---

## 1. Resumen Ejecutivo

La Fase 9 entrega el acompañamiento longitudinal del paciente con el asistente clínico unificado **"Antares AI"**, garantizando que:

1. **Asistente clínico unificado**: El paciente conversa con una sola identidad ("Antares AI"), que enruta internamente entre especialidades (médico, nutricionista, psicólogo). El móvil consume `POST /api/v1/chat` (+ streaming SSE con fallback bloqueante) vía el Gateway `:5080`; el frontend nunca llama al AI Service directo.
2. **Anti-IDOR estricto por JWT**: `ThreadsController` y `ChatController` exigen `[Authorize]` y resuelven la identidad exclusivamente desde `ClaimTypes.NameIdentifier`; el query param `userId` heredado se ignora deliberadamente (documentado en código + tests anti-IDOR).
3. **Feedback de 1–5 estrellas para memoria adaptativa**: Nuevo `POST /api/v1/chat/feedback` (backend → AI Service `:8000/api/v1/chat/feedback`) con comando MediatR `SendChatFeedbackCommand` validado (rating 1–5, comentario ≤2000). En el móvil, `ChatFeedbackAction` (pulgares ↑=5 / ↓=1) califica solo respuestas reales con `executionId`.
4. **Disclaimer preventivo**: Banner clínico no invasivo al inicio del listado + sugerencia visible de activar el protocolo de emergencia (`openPanic`) ante mensajes de alerta crítica.
5. **Hilo longitudinal continuo**: Un único thread estable por paciente con paginación progresiva server-driven (`limit`/`before`, `hasMore`/`nextCursor`) y degradación honesta (vacío/error + reintento, nunca mocks).

---

## 2. Cambios en Backend (`coppAddresdBack`)

### 2.1 Blindaje anti-IDOR (`ThreadsController.cs`)

- `src/CoppAddresd.Api/Controllers/ThreadsController.cs:16` — `[Authorize]` + resolución de identidad exclusiva por JWT (`ClaimTypes.NameIdentifier`, `:51`).
- El query param `userId` se conserva **solo por compatibilidad y se ignora** (`_ = userId`, `:48-50`, con comentario anti-IDOR en `:31-32`).
- Tests: `tests/CoppAddresd.UnitTests/Chat/ThreadsControllerAntiIdorTests.cs` — **4 tests** (identidad por JWT, `userId` ajeno ignorado, degradación con `messageCount 0`).

### 2.2 Endpoint de feedback (`ChatController.cs` + MediatR)

- `src/CoppAddresd.Api/Controllers/ChatController.cs:13,125-177` — `[Authorize]` + `POST /api/v1/chat/feedback` (`ChatFeedbackRequestDto` → `SendChatFeedbackCommand`), con `ProblemDetails` estructurado ante rechazo (log `:157`) o inalcanzabilidad del AI Service (log `:177`) — resiliencia 502/503 elegante.
- `IAiServiceClient.SendFeedbackAsync` (`src/CoppAddresd.Application/Interfaces/IAiServiceClient.cs:80`) → `AiServiceClient.SendFeedbackAsync` (`src/CoppAddresd.Infrastructure/Services/AiServiceClient.cs:300`) → `AiServiceSettings.FeedbackEndpoint` (`{ApiPrefix}/chat/feedback`, AI Service `:8000`).
- Tests: `SendChatFeedbackCommandHandlerTests.cs` (5 métodos, 2 Theories → **8 casos**: rating 0/6/-1 rechazados, 1–5 aceptados, comentario >2000 rechazado), `ChatFeedbackEndpointTests.cs` (**4 tests**), `ChatFeedbackClientTests.cs` (**3 tests**).

### 2.3 Pruebas Backend

- Área Chat: **36 casos** — `Chat/` (20: 4 anti-IDOR + 8 handler + 4 endpoint + 3 cliente + 1 caso extra por Theories) + `ChatCommandHandlerTests.cs` (11) + `AiServiceClientTests.cs` `GetThreadStateAsync` (5: orden/roles, degradación sin `messages`, `limit`/`before`, sin paginación, `hasMore`/`nextCursor`).
- Script E2E disponible: `coppAddresdBack/scripts/test_chat_e2e.ps1` (login → chat → thread → feedback `200`, o 502/503 elegante si el modelo está caído).

---

## 3. Cambios en Frontend (`antares-paciente`)

### 3.1 Servicio modular (`src/services/chat/`)

- `types.ts` — DTOs wire camelCase tolerantes: `ChatMessage`, `ChatResult` (`reply/threadId/executionId/agent/suggestions`), `ChatSuggestion` (reexport de `types.ts`), `FeedbackRequest` (`executionId/rating/comment?`), `FeedbackResult`, `ThreadState` (paginación server-driven).
- `chat-service.ts` — sobre `apiFetch` (Bearer + refresh single-flight + timeout + `ProblemDetails` → `ApiError`):
  - `sendChatMessage(message, threadId)` → `POST /api/v1/chat` (valida vacío).
  - `sendChatFeedback(feedback)` → `POST /api/v1/chat/feedback` (rating entero 1–5).
  - `fetchThreadHistory(threadId, limit?, before?)` → `GET /api/v1/threads/{id}/messages` (sin `userId`: identidad por JWT).
  - 502/503 → `CHAT_UNAVAILABLE_MESSAGE` amigable; 401 se propaga intacto (puente de sesión → login).
- Tests `__tests__/chat-service.test.ts`: **14 tests** (éxito, validación local sin red, 502/503 amigable, 401 propagado, query de paginación).

### 3.2 Hook reactivo (`src/hooks/useChatAssistant.ts`)

- Estado: `messages` (`AssistantMessage`: `id` + `role user|bot` + `executionId?` + `suggestions?`), `isGenerating`, `error`, `hasMore`, `isLoadingOlder`.
- `sendMessage` optimista (pinta al usuario, contador de vuelos concurrentes), `retryLastMessage` sin duplicar al usuario, `loadOlderMessages` con cursor + fallback `lastMessage` + degradada `messageCount 0` sin marcar fin, `sendFeedback` (registra `error` y propaga), reinicio al cambiar `threadId`.
- Tests `__tests__/useChatAssistant.test.ts` (`renderHook` + `act`, servicio mockeado): **10 tests**.

### 3.3 Componente + integración en `ChatPage.tsx`

- `src/components/chat/ChatFeedbackAction.tsx` — dominio Ionic-first (`IonButton` + `IonIcon`, touch ≥44px, `aria-label`): pregunta sutil + pulgares, spinner al enviar, check + agradecimiento sin recargar; sin `executionId` no renderiza; textos vía `t()`.
- `ChatPage.tsx` — banner disclaimer (`role="note"`, icono `informationCircle`, reutiliza `.chat-history-hint` sin tocar `global.css`): `«Asistente clínico inteligente (no sustituye una consulta médica de urgencia)»`; burbujas `alert` con CTA `«Activar protocolo de emergencia»` → `openPanic`; `<ChatFeedbackAction>` al pie de burbujas bot con `executionId`.
- Trazabilidad: `executionId?` en `ChatMessage` (`types.ts`) propagado en `AppContext` (vía bloqueante + streaming + `appendChatMessages`); fallbacks locales nunca lo tienen → no se califican.
- i18n: **7 claves nuevas** en `es.json` (identidad) + `en.json` (traducción).

### 3.4 Calidad y pruebas frontend (verificado 2026-09-24)

- `ChatPage.test.tsx`: **+4 tests Fase 9** (disclaimer, feedback monta/envía/agradece, sin `executionId` no monta, alerta → `openPanic`).
- Suite completa: **85 archivos, 669 tests verdes (100%)**.
- `npm run lint`: **0 errores** (solo warnings preexistentes) · `npm run i18n:check`: **0 faltantes** · `npm run build` (`tsc -b && vite build`): **exitoso**.
- Commits: `880f351` (servicio + feedback + 14 tests) · `e933243` (hook + 10 tests) · `8b8c355` (disclaimer + feedback + i18n + 4 tests).

---

## 4. Reglas de Negocio Confirmadas (Grill Me)

1. **Asistente Clínico Unificado**: una sola identidad ("Antares AI") con enrutamiento interno entre especialidades (médico, nutricionista, psicólogo) — el paciente nunca elige agente.
2. **Alarma crítica con acción de emergencia destacada**: ante síntomas de alarma el asistente responde con prioridad clínica (`role: "alert"`) y sugiere activar el protocolo de emergencia (`openPanic` → `PanicOverlay`/SOS; botón de pánico persistente en el header).
3. **Hilo continuo longitudinal estable por paciente**: un único thread con memoria (LangGraph en backend) y paginación progresiva; el móvil hidrata, antepone tramos y degrada con honestidad.

---

## 5. Seguridad / Performance / Bugs / Deuda

- **Seguridad (vulnerabilidad IDOR corregida)**: `ThreadsController` aceptaba `userId` por query — ahora se ignora y la identidad sale solo del JWT; `[Authorize]` en ambos controladores; sin secretos/PHI en logs; feedback validado (rating + longitud de comentario).
- **Performance**: lecturas de historial paginadas (`limit`/`before`, sin `COUNT(*)` en el hot path móvil); `CancellationToken` de extremo a extremo en backend; DTOs mínimos; hook con guardas anti-doble-fetch (`loadingOlderRef`/`exhaustedRef`) y anclaje de scroll existente intacto.
- **Bugs encontrados y corregidos**: `ChatMessage` sin `executionId` (el backend lo devolvía pero `AppContext` lo descartaba en las 3 vías) — propagado; `ChatFeedbackAction` con retorno condicional antes de hooks — reordenado (hooks primero); textos hardcodeados sin i18n — migrados a `t()` + 7 claves.
- **Deuda técnica**: `ChatPage` aún orquesta `AppContext.sendChat` en lugar del nuevo `useChatAssistant` (migración futura, hook listo y testeado); paridad es/en con huérfanos preexistentes no relacionados (verificados fuera del alcance de esta fase).

---

## 6. Próximo Paso: Fase 10

Con la Fase 9 completada y validada en su totalidad:

- **Fase 10**: Comunidad (GraphQL, feed, moderación, storage de avatares).
