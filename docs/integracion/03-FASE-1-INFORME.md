# Informe FASE 1 — Login/OTP/Sesión + dispositivo físico (2026-09-22)

> Change: `openspec/changes/app-fase-1-login-sesion` · Rama `feat/integracion-app` ·
> Estado: **validación en curso** (refresh token verificado en dispositivo físico nativo por el usuario).

## Entregables por bloque (template PROMPT_INICIAL_APP.md)

### 1. Análisis

- Flujo de auth de la app ya mapeado: password login + OTP por identificación
  (`id-lookup → send-otp → verify-otp`), `POST /api/auth/refresh` con cookie
  HttpOnly `copp_refresh_token`, `SameSite=Lax`/dev vs `None`/prod
  (`AuthController.cs:223`). Gap real: en nativo el WebView origina
  `http://localhost` → XHR cross-site → cookie Lax no viaja.

### 2. Datos

- Sin cambios de esquema. Seed reutilizado: `scripts/seed_patients_demo.py`
  (idempotente) → 6 pacientes con cuenta Auth + acceso `app` + email en
  `app.patient_profiles`. Documento de prueba `1000000001` (password `Demo1234!`).

### 3. Backend

- Sin código nuevo requerido: la infraestructura existente cubre el flujo
  (devCode EMAIL en Development, provisionamiento automático en verify-otp).
- `dotnet build src/Services/CoppAddresd.Auth` → 0 errores.

### 4. API móvil

- Verificado end-to-end contra Gateway `:5080` (curl/PS): lookup (1 contacto
  EMAIL enmascarado) → send-otp (`devCode` visible solo en Development) →
  verify-otp 200 (JWT `aud=app`) → refresh 200 con cookie.

### 5. Frontend (APP)

- `DEMO_LOGIN` eliminado (bypass que saltaba el backend) — todo login real.
- Identidad derivada del backend: eliminado `USER_STORAGE_KEY`/localStorage;
  `getMe()` + JWT alimentan el perfil (evita desincronización APP ↔ ERP).
- Tests actualizados a sesión real (`409/412` ✓; 3 fallos preexistentes en
  `dev` — deuda HomePage, FASE 5).

### 6. Conectividad nativa (dispositivo físico)

- `capacitor.config.ts`: `plugins.CapacitorHttp.enabled = true` → fetch por
  HTTP nativo con cookie jar del SO: **la cookie de refresh viaja sin importar
  SameSite** (decisión C1 del design; SameSite=None condicional quedó como
  plan B no necesario).
- SSE de chat en nativo → fallback síncrono (`threadApi.ts`), documentado.
- **Resultado del usuario**: refresh token funcionando en APK nativa ✓.

### 7. UX

- `SlideCtaButton` (nuevo componente): gesto de deslizar real en los 3 CTAs del
  login (Comencemos / Confirmar identidad / Verificar y entrar). Pulgar con
  Framer Motion, barra de progreso, chevrons que se encienden, haptics al
  confirmar. Accesibilidad: clic en el track y Enter/Space siguen activos
  (el gesto es mejora, no requisito — WCAG). `touch-action: pan-y` preserva scroll.
- Lint 0 · build 1.0s · i18n ✓.

### 8. Performance

- Sin regresiones: bundle sin cambios de tamaño relevantes; `ResizeObserver`
  desmontado en unmount; `useMotionValue` (sin re-render por frame del gesto).

### 9. Seguridad

- Cero secretos en cliente; refresh token permanece en cookie HttpOnly (el jar
  nativo no lo expone a JS). Bypass demo eliminado de authApi/apiClient/hooks.
- Documentado en `docs/integracion/02-FASE-1-LOGIN.md` (guía + checklist).

### 10. Seeds y pruebas

- Seed ejecutado contra BD local (6 cuentas reutilizadas ✓).
- Tests unitarios APP en verde; flujo HTTP real verificado con requests reales.

## Pendiente / riesgos para FASE 2

- Chat nativo sin streaming (C1) — reevaluar tras uso real (podría no importar).
- Historia/BodyProfile/Home siguen con mocks → FASE 2-5 según plan maestro.
- Cambios sin commit (una fase = un commit tras tu validación).
