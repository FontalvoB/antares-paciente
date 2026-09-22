# Plan Maestro — Integración APP Antares ↔ Backend ↔ ERP

> **Fuente de verdad del plan**: `PROMPT_INICIAL_APP.md` (raíz del workspace) + este documento.
> Auditoría base: `01-FASE-0-AUDITORIA.md` (mismo directorio).
> Regla SDD del workspace: cada fase pasa por `openspec-propose` → aprobación → `openspec-apply-change`.

## Principios no negociables

1. **El ERP es el administrador de la fuente de verdad.** La APP consume y propone; no duplica entidades, tablas, reglas ni estados.
2. **Backend = autoridad final.** La APP valida para UX; el backend valida de verdad (disponibilidad, permisos, estados).
3. **Una sola entrada**: Gateway YARP `:5080`. La APP nunca llama a servicios directo (Auth `:5123` solo vía `/api/auth/*` del gateway; en dev el proxy de Vite lo resuelve).
4. **JWT**: `aud = app` (`VITE_APPLICATION_CODE`), access token en memoria + refresh cookie HttpOnly `copp_refresh_token` (Path=/api/auth). Sin localStorage para tokens (el perfil de usuario simulado en localStorage es deuda a corregir en FASE 1).
5. **Cada fase entrega**: análisis → datos → backend → API móvil (DTOs reducidos) → frontend → conectividad → UX → performance → seguridad → seeds → tests → informe → **STOP para validación del usuario**.
6. **Seeds**: viven en el backend (`coppAddresdBack/scripts/generate_*_seed.py` → `Migrations/Seed/*.sql`), idempotentes, coherentes con las FK del ERP, con escenarios normales/límite/estados/volumen (decenas de registros relacionados).
7. **Documentar siempre**: toda fase actualiza `docs/integracion/` + el doc del módulo en backend si aplica. Comentarios en español.

## Mapa de dependencias (orden de integración)

```
FASE 1  Login/Auth/Sesión          (Auth Service, ya parcialmente conectado)
FASE 2  Perfil y contexto          (/me/profile, /me/context, onboarding→paciente real)
FASE 3  Catálogos y seeds base     (document types, métricas, catálogos clínicos)
FASE 4  Tests de salud onboarding  (/health-tests/me/*, baterías reales)
FASE 5  Home + Programa/Infinito   (/program/me/*, XP, ligas, cofres)
FASE 6  Citas                      (ya conectada; endurecer estados, sala virtual)
FASE 7  Historia/Métricas          (measurements del paciente; gap: endpoint me/)
FASE 8  Nutrición + Food AI        (ya conectada; ampliar planes del ERP)
FASE 9  Chat IA / agentes          (/api/v1/chat, threads — ya conectado)
FASE 10 Comunidad                  (GraphQL — ya conectada; moderación/avatar storage)
FASE 11 Notificaciones push         (FCM, /notifications/devices — ya existe backend)
FASE 12 Endurecimiento prod         (offline queue, E2E en dispositivo, obs.)
```

El orden es por **dependencia real** (login → identidad → catálogos → contenido clínico → transaccional), no por orden visual de tabs. Cada fase re-audita sus supuestos antes de codificar.

## Definition of Done por fase (checklist)

- [ ] Análisis del módulo documentado (entidades, tablas, endpoints, reglas ERP)
- [ ] Cambios de BD justificados + migración reversible + índices documentados
- [ ] Backend: DTOs reducidos, paginación/filtros server-side, sin N+1, CancellationToken
- [ ] APP: loading/empty/error/retry, sin requests duplicados, estados táctiles ≥44px
- [ ] Seeds idempotentes con escenarios (normal/límite/estados/volumen)
- [ ] Tests: unit + integration (backend), vitest (APP), E2E cuando aplique
- [ ] `dotnet build/test` + `npm run lint && npm run build` + `npm run i18n:check` en verde
- [ ] Informe de fase con el template de `PROMPT_INICIAL_APP.md` y STOP para validación
