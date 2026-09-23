# FASE 0 — Auditoría APP ↔ ERP ↔ Backend ↔ BD (2026-09-22)

> Estado: COMPLETA (nivel plan). Re-auditar a nivel tabla/endpoints al inicio de cada fase.
> Complementa a `docs/auditoria.md` (auditoría UI/Ionic) — este doc cubre la integración.

## 1. Diagnóstico APP (antares-paciente)

- **Stack**: React 19 + Ionic 8.8 + Capacitor 8 + Vite 8 + TS, `pnpm` (lockfiles múltiples históricos — usar npm scripts). i18n propio (`useT`, es/en). Estado global: `AppContext` (state machine `flow`/`screen`, SIN router).
- **Entrada única**: Gateway YARP `:5080` (`VITE_GATEWAY_BASE_URL`). Proxy Vite enruta `/api`, `/api/v1/community`, `/storage`, WS subscriptions. JWT `aud=app`.
- **Auth YA CONECTADA** (`src/utils/authApi.ts`, `apiClient.ts`): password login + **OTP por identificación** (id-lookup → send-otp → verify-otp), refresh single-flight con retry 401, `restoreSession()` vía cookie, `getMe()`, logout. Queda `DEMO_LOGIN` (doc `12345678`/`demo1234`) como bypass a aislar en dev.
- **Módulos YA CONECTADOS al backend real**:

| Módulo              | Capa APP                                             | Endpoints                                                       |
| ------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| Citas               | `AppContext` + `appointmentsApi` + `VirtualRoomPage` | `/api/v1/telemedicine/me/*`, requests, cancel, rooms            |
| Perfil              | `ProfilePage`, `MyProfile/MyContext`                 | `GET/PUT /api/v1/me/profile`, `GET /api/v1/me/context`          |
| Programa/Infinito   | `services/program/*` + hooks (anti-IDOR documentado) | `/api/v1/program/me/*`, snapshot, tasks, scores, liga, métricas |
| Tests de salud      | `TestsPage` + `healthTestsApi`                       | `/api/v1/health-tests/me/*`                                     |
| Nutrición + Food AI | `NutritionPage`, `foodAiApi`, `CameraCapture`        | `/api/v1/foodai/analyze                                         | nutrition | analyses | feedback` |
| Chat IA             | `ChatPage`, `threadApi`                              | `/api/v1/chat`, threads                                         |
| Comunidad           | `graphql/*` (urql + WS)                              | `/api/v1/community/graphql`, subscriptions                      |
| Notificaciones      | `pushNotifications.ts`                               | `/api/v1/notifications/devices`                                 |
| Avatar              | `useAvatarConfiguration`                             | Auth Service avatar controller                                  |

- **Módulos con MOCKS remanentes** (`src/data/`):

| Pantalla                                                  | Mock                                        | Reemplazo propuesto                                                                                |
| --------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `HomePage`                                                | `PROGRAM_TASKS`, `data/metrics` (parcial)   | `/program/me/snapshot` + `/program/me/metrics-history`                                             |
| `HistoryPage`                                             | `data/metrics` (100%)                       | **GAP backend**: no existe `GET /api/v1/me/measurements` (solo admin `Patients/{id}/measurements`) |
| `BodyProfilePage`                                         | `data/bodyProfile` (100%)                   | Decisión de negocio: ¿parte del perfil o métricas clínicas?                                        |
| `OnboardingPage`                                          | `finishOnboarding` → localStorage (sin API) | **GAP backend**: creación/actualización del perfil paciente en onboarding                          |
| `TestsPage` metadatos                                     | `TESTS_META`, `HEALTH_PROFILE`              | metadatos estáticos OK (labels); baterías reales ya usadas                                         |
| `AcademyPage`, `WearablePage`, `InfinitoPage` (secciones) | estáticos                                   | sin backend aún — priorizar después del núcleo                                                     |

- **Flags**: `VITE_PROGRAM_API_ENABLED` declarado en `.env`/`vite-env.d.ts` pero **sin usos en el código** (vestigial) — limpiar o implementar.
- **Deuda APP**: `AppContext` persiste usuario en `localStorage` (`USER_STORAGE_KEY`) — migrar a datos de sesión del JWT (FASE 1); oxlint warnings preexistentes; chunk principal 2.5 MB (code-split pendiente).

## 2. Diagnóstico Backend (coppAddresdBack)

- .NET 10 Clean Architecture, 5 servicios: API `:5122`, Auth `:5123`, Telemedicine `:5130`, Community `:5200` (GraphQL+WS), Gateway `:5080`. Comparten BD (una sola Postgres) con schema por módulo e historial de migraciones aislado por servicio.
- **Superficie paciente ya implementada**: `api/v1/me/*` (perfil, contexto), `api/v1/health-tests/me/*`, `api/v1/program/me/*`, foodai, chat (sync+stream), threads, community GraphQL, notifications devices, storage presigned.
- **Superficie ERP** (administra lo que la APP consume): Patients CRUD+bulk+measurements, Professionals+schedules, Catalogs (países/documentos/métricas/ICD10/medicamentos/alérgenos), HealthTests admin, Program admin+ERP dashboards, Wellness (planes/rutinas), Inventory/Store, Roles/Permisos/Usuarios (Auth), Community moderación.
- **Gaps detectados para la APP**: ver tabla de mocks (§1). Ningún endpoint duplicado — reutilizar siempre.

## 3. Diagnóstico BD

- Schemas: `auth.` (20 tablas), `app.` (~69: patient_profiles, patient_professionals, catálogos clínicos, measurements, health_test__, program__, wellness, encounters), `erp.` (21: organizaciones→clínicas→sedes, employees/professionals, horarios), `tele.` (10: requests, appointments + exclusión GiST anti doble reserva, rooms, encounters con auditoría por trigger), `community.`, `ai.`, `audit.` (activity_logs trigger-based, actor vía GUC).
- Normalización general sana; catálogos centralizados (`app.allergens`, `icd10_codes`, `measurement_metrics` + rangos de referencia). Paciente↔profesional = `patient_professionals` (base del alcance "propios datos").
- **Riesgos a vigilar por fase**: tablas de crecimiento (appointments, measurements, community posts, program events) → índices + paginación keyset; no compartir historial de migraciones entre servicios; seeds vía scripts generadores, nunca SQL manual.

## 4. Diagnóstico ERP (coppaddresd-front)

Módulos que administran los datos de la APP: Patients, Appointments (agenda/citas), Health-Tests (baterías/asignaciones/alertas), Program (plantillas/controles/biometría), Wellness, Community (moderación/miembros/clubes), Users/Roles, Settings. Convención: toda vista ERP con datos nuevos evalúa pre-agregación CQRS (skill `cqrs-preaggregation`).

## 5. Mapa APP ↔ API ↔ BD ↔ ERP (módulos conectados/pendientes)

| APP               | Endpoint                        | Servicio  | Tabla(s)                         | ERP                     |
| ----------------- | ------------------------------- | --------- | -------------------------------- | ----------------------- |
| Login/OTP         | `/api/auth/id-lookup            | send-otp  | verify-otp                       | refresh                 | logout | me` | Auth | auth.users, otp_codes, refresh_tokens | Users/Roles |
| Perfil            | `/api/v1/me/profile`            | API       | app.patient_profiles             | Patients (edit)         |
| Onboarding perfil | ❌ GAP                          | —         | app.patient_profiles             | Patients (create)       |
| Citas             | `/api/v1/telemedicine/me/*`     | Tele      | tele.appointments/requests/rooms | Appointments            |
| Tests             | `/api/v1/health-tests/me/*`     | API       | app.health_test_*                | Health-Tests            |
| Programa          | `/api/v1/program/me/*`          | API       | app.program_*                    | Program                 |
| Historia          | ❌ GAP `me/measurements`        | API       | app.clinical_measurements        | Patients (measurements) |
| Nutrición         | `/api/v1/foodai/*`              | API→8010  | foodai.* + app.wellness_*        | Wellness                |
| Chat IA           | `/api/v1/chat[/stream]`         | API→8000  | ai.*                             | Agents                  |
| Comunidad         | `/api/v1/community/graphql`     | Community | community.*                      | Community admin         |
| Push              | `/api/v1/notifications/devices` | API       | app.device_tokens                | Notifications           |

## 6. Estrategia de seeds y pruebas

- **Seeds**: extender `coppAddresdBack/scripts/generate_*_seed.py` (idempotentes, `uv run --with psycopg[binary]`): 1) paciente demo `12345678` con perfil completo + teléfono/email de prueba (canal EMAIL con devCode en Development); 2) profesionales de prueba con horarios; 3) baterías health-tests asignadas; 4) enrollment de programa con XP/liga; 5) citas en todos los estados; 6) mediciones clínicas históricas (12 meses) para Historia/Home. Volumen: decenas por módulo.
- **Pruebas**: backend xUnit unit + integration (`COP_TEST_DB_CONNECTION`); APP vitest (ya existe) + Playwright MCP para E2E web; dispositivo Android vía `npx cap sync` cuando toque auth/nativos.

## 7. Riesgos y deuda técnica

1. **AGENTS.md desactualizado** (dice "demo sin backend") — corregido con este doc; actualizar AGENTS.md del repo.
2. Refresh cookie en **nativo Capacitor** (`capacitor://localhost`): verificar SameSite/cookie en WebView Android/iOS — probar en FASE 1 con `npx cap run`.
3. `DEMO_LOGIN` bypass y localStorage de usuario: eliminar/aislar en FASE 1.
4. CORS del gateway ya incluye `capacitor://localhost` e `ionic://localhost` (verificado en appsettings del Gateway).
5. OTP real = Twilio SMS (costo/rate limit) — en dev usar canal EMAIL (devCode) o número verificado.
6. Rate limiting OTP server-side ya existe (`OtpProtectionService`, en memoria — no escalar horizontal sin Redis).
7. Chunks 2.5 MB y datos mock dentro de páginas: code-split + limpieza por fase.
