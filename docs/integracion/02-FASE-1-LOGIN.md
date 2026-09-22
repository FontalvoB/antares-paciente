# FASE 1 — Login/OTP/Sesión + prueba en dispositivo físico

> Change OpenSpec: `openspec/changes/app-fase-1-login-sesion/` (aprobado 2026-09-22).

## Estado implementado

- Seed pacientes demo reutilizado (`seed_patients_demo.py`): 6 pacientes con cuenta
  Auth + acceso `app` + email en `app.patient_profiles`. Documento de prueba:
  **`1000000001` (Juan Pérez, password `Demo1234!`)**.
- Flujo real verificado contra Gateway `:5080`: id-lookup → send-otp (EMAIL,
  devCode en Development) → verify-otp (JWT aud=app + cookie refresh) → refresh 200.
- `DEMO_LOGIN` eliminado; identidad de la APP ahora vive en el backend (`/api/auth/me`
  - JWT) — se eliminó `USER_STORAGE_KEY` de localStorage.
- Botón deslizable real `SlideCtaButton` en los 3 CTAs del login (gesto + clic + teclado).
- `CapacitorHttp.enabled` en nativo: la cookie HttpOnly de refresh viaja por el cookie
  jar del SO (bypass del SameSite=Lax de dev). SSE de chat → fallback síncrono en
  nativo (`threadApi.ts streamChatMessage`, decisión C1 del design).

## Prueba en dispositivo físico (Android primero)

1. **Red**: PC y teléfono en la misma WiFi. Obtén la IP LAN del PC
   (`ipconfig` → IPv4, ej. `192.168.1.50`).
2. **Env**: en `antares-paciente/.env` →
   `VITE_GATEWAY_BASE_URL=http://192.168.1.50:5080` (IP del PC, no localhost).
3. **Firewall**: permitir inbound `:5080` en el perfil de red Privado
   (`New-NetFirewallRule -DisplayName "Gateway 5080" -Direction Inbound -Port 5080 -Protocol TCP -Action Allow`).
4. **Gateway CORS**: ya incluye `capacitor://localhost` e `ionic://localhost`
   (verificado en `appsettings.json` del Gateway).
5. **Sync + build**:
   ```bash
   npm run build        # genera dist/
   npx cap sync android
   npx cap open android # Run ▶ en el dispositivo físico
   ```
   El esquema ya es `androidScheme: "http"` (sin mixed-content con el gateway http).
6. **Checklist de verificación** (marcar al probar):
   - [ ] Login con contraseña `1000000001` / `Demo1234!` → entra directo a la app.
   - [ ] Primer acceso: documento `1000000001` → contacto EMAIL → código (devCode en
         consola/backend; en EMAIL real revisar el buzón de prueba) → verificar → onboarding.
   - [ ] Cerrar app y reabrir: sesión restaurada (refresh por cookie nativa) sin OTP.
   - [ ] Logout → vuelve al login; reabrir NO restaura sesión.
   - [ ] Chat IA responde (síncrono en nativo, sin streaming en vivo).
   - [ ] Citas cargan (`/api/v1/telemedicine/me`).
7. **iOS**: igual con `npx cap sync ios` + Xcode (Apple Team del usuario).

## Deuda / notas

- El devCode solo aparece con canal EMAIL en Development (decisión de FASE 0).
- El chat en nativo pierde streaming en vivo (C1); se reevalúa tras la prueba.
- Los 3 tests de `homeCards.test.ts` fallan por deuda previa de HomePage (FASE 5),
  no relacionada con esta fase.
