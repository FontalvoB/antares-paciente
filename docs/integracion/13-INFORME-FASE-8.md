# FASE 8 — Nutrición, Plan Alimentario y Food AI: Informe de Integración

> **Change OpenSpec**: `app-fase-8-nutricion-foodai`
> **Fecha**: 2026-09-24
> **Estado**: Completada e integrada (Backend + APP móvil + verificación E2E real contra Gateway)

---

## 1. Resumen Ejecutivo

La Fase 8 conecta el plan alimentario del paciente con la base de datos real PostgreSQL sin intermediación de mocks, garantizando que:

1. **Plan alimentario propio**: El paciente consulta su plan activo vía `GET /api/v1/me/nutrition-plan`, que expone `MyNutritionPlanDto` (días + comidas `MyNutritionPlanMealDto`) resuelto únicamente desde el JWT (anti-IDOR).
2. **Independencia del programa**: Sin asignación activa no hay error: el endpoint responde `404` con mensaje propio («No tienes un plan de alimentación activo asignado») y la APP muestra vacío honesto en Indicaciones.
3. **Registro de ingesta con Food AI**: `FoodAiController` (`POST /api/v1/foodai/analyze`) recibe la foto de la comida, devuelve `{ analysisId, status }` y el flujo móvil `MealFoodFlow` captura por comida con `MealLoggedPanel` de estado registrado.
4. **Nutrición diaria visible**: `NutritionPage.tsx` con cuatro pestañas nativas (`IonSegment`): _Hoy / Semana / Plan / Historial_, anillo de kcal + macros + hidratación con metas del plan.
5. **Cero mock fallbacks**: Todos los datos se obtienen de la verdad persistida (plan asignado desde el ERP + serie real de mediciones).

---

## 2. Cambios en Backend (`coppAddresdBack`)

### 2.1 Nuevos Endpoints y Contratos

- `GET /api/v1/me/nutrition-plan` (`MyPatientProfileController.cs:133`):
  - Sin parámetros (paciente derivado del JWT, nunca del body → anti-IDOR).
  - Respuestas: `200 OK` (`MyNutritionPlanDto`), `401 Unauthorized`, `404 Not Found` (sin perfil o sin plan activo).
  - `CancellationToken` propagado de extremo a extremo (`ct` → MediatR → repositorios).
- `MyNutritionPlanDtos.cs` (nota de nomenclatura: el DTO de comida se llama `MyNutritionPlanMealDto`, no `NutritionPlanMealDto`):
  - `MyNutritionPlanDto`: `id, name, targetCondition, durationDays, dailyCalorieTarget, dailyProteinTarget, dailyCarbsTarget, dailyFatTarget, dailyFiberTarget, dailyWaterMl, allergens, mealTiming, status, days`.
  - `MyNutritionPlanDayDto`: `dayNumber, dailyWaterMl, meals` (ordenadas por `SortOrder`).
  - `MyNutritionPlanMealDto`: `mealType (Desayuno/Almuerzo/Cena/Snack, mismo contrato que el ERP), description, foods, calories, proteinG, carbsG, fatG, fiberG, waterMl, notes, sortOrder`.
- `GetMyNutritionPlanQueryHandler`:
  - 1. Identidad: `patient_profiles.user_id` desde el JWT; sin perfil → `NotFoundException` (nunca datos ajenos).
  - 2. Asignación activa como fuente de verdad (misma regla que `ProgramContentResolver`: `Status Active`, ventana vigente hoy UTC, en overlap gana `StartDate` más reciente).
  - 3. Plan huérfano o sin asignación → `null` → `404` con mensaje propio (no es un error).
  - Lecturas de solo consulta con `AsNoTracking` en los repositorios EF (cero tracking en hot path de lectura).

### 2.2 Food AI — Log de Ingesta

- `FoodAiController` (`POST /api/v1/foodai/analyze`, multipart `image`):
  - `ImageFileValidator` (extensión/MIME/10 MB/firma mágica) → `IImageStorage` (`foodai/<analysisId>.<ext>`) → `IFoodAiClient.SendImageAsync` hacia food-ai-service `:8010`.
  - Respuesta síncrona `{ analysisId, status: "received" }`; el `foodAnalysisId` permite al móvil vincular el análisis con la comida registrada del plan.
  - `GET /api/v1/foodai/health`: probe backend → food-ai-service (público, sin PHI).

### 2.3 Pruebas Backend

- Barrido `Nutrition` + `Measurement`: **47 pasados, 0 fallidos, 0 regresiones**.

---

## 3. Cambios en Frontend (`antares-paciente`)

### 3.1 Cliente y Servicio Tipado

- `src/services/nutrition/my-nutrition-plan-service.ts`:
  - `getMyNutritionPlan()` → `GET /api/v1/me/nutrition-plan` sin params (paciente por JWT).
- Utilidades puras extraídas de la página para testear sin render: `mealTypeToCode.ts`, `nutritionForm.ts`, `nutritionIntake.ts`.

### 3.2 Página de Nutrición (`NutritionPage.tsx`)

- Cuatro segmentos nativos (`IonSegment` en `NutritionPage.tsx:525`): `hoy / semana / indicaciones (Plan) / historial`.
  - **Hoy**: anillo de kcal + pills de macros (proteína/carbos/grasa/fibra) + meta de hidratación, todo con metas del plan servido; serie `activity_kcal` real si existe (sin dato no se muestra la línea).
  - **Semana**: KPIs reales de adherencia nutricional con tendencia (verdad del servidor).
  - **Plan (Indicaciones)**: días y comidas del profesional; `404` sin plan → `null` (vacío honesto, sin inventar dieta).
  - **Historial**: serie de peso real + subtítulos bmi/hba1c por fecha.
- `MealLoggedPanel` (`src/components/nutrition/`): panel de estado registrado por comida (agua excluida: hidratación nunca cuenta como comida del plan).
- `MealFoodFlow` (`src/components/MealFoodFlow.tsx`): máquina local por comida (`pending → capturing → analyzing → …`) para captura con Food AI (foto/manual/hidratación) sin encolar writes reales sobre caché.
- `NutritionPlanTab` + `FoodResultCard`: tarjeta por alimento detectado.

### 3.3 UX/UI

- Tarjetas navy con macro pills (proteína/carbos/grasa/fibra) y anillo de kcal como jerarquía principal en «Hoy».
- Panel de comidas registradas con emoji + título + kcal por comida del plan.
- Estados de UI claros: skeleton durante carga, vacío honesto sin plan, error con reintento.

### 3.4 Calidad y Pruebas Frontend

- `NutritionPage.test.tsx`: **6 tests** (pestaña Hoy con metas del plan + estados).
- Suite completa: **641 tests verdes (100%)**.
- `npm run lint`: **0 errores** · `npm run i18n:check`: **0 claves faltantes** · `npm run build`: **exitoso**.

---

## 4. Seeds y Base de Datos

- Script: `coppAddresdBack/scripts/seed_nutrition_mass.py` (idempotente, respeta FK y reglas del ERP: inscribe en programa antes de asignar plan).
- Pacientes con planes asignados:
  - `55551234` (Luis Prueba Móvil) → Obesidad / déficit calórico **1400 kcal** (verificado E2E §5).
  - `77777777` (Play Wright) → Hipertensión / DASH **1800 kcal**.
  - `88888888` (Test E2E) → Diabetes Tipo 2 **1600 kcal**.
  - `1012345678` (Andrea Salazar) → Diabetes Tipo 2 **1600 kcal**.
- Tablas involucradas (`app.`): `nutrition_plans`, `nutrition_plan_days`, `nutrition_plan_assignments` (+ `patient_profiles` para identidad por JWT).

---

## 5. Verificación E2E Real (Gateway `:5080`)

Verificación ejecutada el 2026-09-24 contra el Gateway local corriendo (NO quedó como pendiente):

```text
✓ POST /api/auth/login → 200 (accessToken Bearer, aud=app)
✓ GET  /api/v1/me/nutrition-plan → 200 (Plan Obesidad - Déficit calórico, 1400 kcal, 42 días)
```

- Respuesta real (recorte): `{"id":"83c645be-…","name":"Plan Obesidad - Déficit calórico","targetCondition":"Obesidad","durationDays":42,"dailyCalorieTarget":1400,"dailyProteinTarget":110.00,…,"dailyWaterMl":2000,…,"days":[{"dayNumber":1,…"meals":[{"mealType":"Desayuno","description":"Batido de proteína con avena",…},…]}]}`.
- **Hallazgo de contrato (documentado, no bloqueante)**: el login móvil exige el campo **`application`** (`"application": "app"`, ver `CoppAddresd.Auth.http`), NO `applicationCode`. El body `{documentNumber, password, applicationCode}` devuelve `400`. El informe lo deja corregido para futuras verificaciones manuales:
  `POST http://localhost:5080/api/auth/login` con `{"documentNumber":"55551234","password":"Demo1234!","application":"app"}`.

---

## 6. Seguridad / Performance / Bugs / Deuda

- **Seguridad**: anti-IDOR por JWT en `nutrition-plan` (sin `patientId` aceptado del cliente); autorización real en backend; Food AI `health` público sin PHI; sin secretos ni tokens en logs.
- **Performance**: lecturas `AsNoTracking`, `CancellationToken` propagado, DTO reducido de solo lectura (sin datos del profesional ni auditoría), sin `COUNT(*)` ni N+1 en el hot path.
- **Bugs encontrados**: 2 corregidos en utilidades (`mealTypeToCode.ts`: fallthrough por prefijo; de-mock de `NutritionPage` hacia resolvers puros testeables) + 1 hallazgo de contrato (`application` vs `applicationCode`, §5).
- **Deuda técnica**: ninguna nueva; `FoodAiController.analyze` sigue `AllowAnonymous` hasta que existan endpoints de negocio con auth (igual que en Fase 7).

---

## 7. Próximo Paso: Fase 9

Con la Fase 8 completada y validada en su totalidad:

- **Fase 9**: Chat IA (conversación del paciente con el AI Service `:8000` vía `POST /api/v1/chat` + streaming SSE, aislamiento de memoria por usuario, `executionId` para feedback).
