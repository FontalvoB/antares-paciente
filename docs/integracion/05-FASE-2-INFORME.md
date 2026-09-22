# FASE 2 — Onboarding/Perfil: informe (2026-09-22)

> Change: `app-fase-2-onboarding-perfil` (13 tareas + decisiones Grill) · E2E Playwright verificado · Validada por el usuario en iPhone físico.

## 1. Análisis (corrige auditoría FASE 0)

- `/api/v1/me/profile` = perfil del **profesional** (EmployeeDto). Para pacientes: **404** → no existía self-service. Documentado en `04-FASE-2-PERFIL.md` con mapping completo APP ↔ `app.patient_profiles`.

## 2. Datos

- Migración `WidenEmergencyContact`: `app.patient_profiles.emergency_contact` varchar 30 → **500** (aplicada y commiteada al historial del Api).

## 3. Backend (verificado con requests reales)

- **`GET/PUT /api/v1/me/patient-profile`** (Application `Features/Patients`, anti-IDOR por JWT, FluentValidation de frontera, contacto de emergencia como JSON). GET/PUT + persistencia verificados.
- **`POST /api/auth/set-first-password`**: define la primera contraseña SOLO si la cuenta no tiene (decisión Grill). Requirió alinear el provisioning OTP: `CreateAsync` **sin password aleatoria** (decisión Grill) → cuentas OTP nacen sin password y el login por password falla hasta definirla (deseado).
- **Auto-asignación batería inicial** (decisión Grill: ERP + lazy):
  - `PatientsController` create/bulk → `AutoAssignInitialBatteryCommand` por paciente creado.
  - `HealthTestsMeController.GetMyAssignments` → lazy fallback idempotente cuando no hay asignaciones visibles.
  - Verificado: paciente nuevo pasó de "0 de 0" a **9 tests pendientes**.
  - Causa raíz: el command existía pero NADIE lo invocaba (solo script manual).

## 4. APP (antares-paciente)

- `utils/patientProfileApi.ts`: fetch/update perfil + `fetchInsurers` (catálogo ERP accesible por paciente).
- `authApi.setFirstPassword` (Bearer + mensajes reales del backend).
- `OnboardingPage`: prefill real del perfil, placeholders de "María González" eliminados, select de aseguradoras con catálogo (fallback estático), persistencia final con **retry sin perder datos**, spinner "Guardando…", contraseña inicial paso 4.
- `ProfilePage`: nueva `ContactSection` (email/celular) con PUT + **rollback** en error.
- Identidad 100% backend (localStorage de identidad ya eliminado en FASE 1).
- Diseño: botones del pie del onboarding alineados al login (navy pill + ghost), barra flotante.

## 5. E2E (Playwright, viewport iPhone 390×844)

Paciente 77777777: logout → Activa tu cuenta → contactos enmascarados → OTP (devCode) → onboarding con prefill → persistencia → **re-login + GET**: nombre/cel/póliza/emergencia persistidos en BD ✓. Validado por el usuario en iPhone físico ✓.

## 6. Seguridad / deuda

- Password SMTP actualizada en local + Secrets (Development). Pendiente: rotarla en M365 (quedó en chat).
- i18n: 1 key dinámica (`chests.ts` fallback, preexistente) — deuda documentada, no de esta fase.
- `grupo`/`ciudad` del onboarding sin persistencia (sin columna / FK pendiente) — post-MVP.
- Nota: `SetFirstPasswordAsync` usa `ChangePasswordRequest` internamente (CurrentPassword ignorado) — evaluar record propio si el contrato cambia.

## Estado

**FASE 2 COMPLETADA** → siguiente: FASE 3 (Catálogos y seeds base).
