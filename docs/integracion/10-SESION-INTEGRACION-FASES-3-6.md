# SESIÓN — Integración APP móvil ↔ Backend (fases de conexión): traspaso (2026-09-23)

> Documento de traspaso de la rama `feat/integracion-app`. Resume TODO lo hecho en las
> sesiones de integración (fases 3–6 completadas + correcciones transversales) para que
> una nueva sesión continúe desde aquí. Los informes detallados por fase están en
> `06`, `07`, `08` y `09` de este directorio; la auditoría base en `01`; el contrato en
> `../PROMPT_INICIAL_APP.md` y el plan en `00-PLAN-MAESTRO.md`.

## 1. Estado del plan de integración

| Fase | Alcance                                          | Estado                         | Informe | Change OpenSpec                  |
| ---- | ------------------------------------------------ | ------------------------------ | ------- | -------------------------------- |
| 1    | Login/Auth/OTP/sesión                            | ✅ Completa (sesiones previas) | `03`    | `app-fase-1-login-sesion` ✓      |
| 2    | Onboarding/perfil real                           | ✅ Completa (sesiones previas) | `05`    | `app-fase-2-onboarding-perfil` ✓ |
| 3    | Catálogos y seeds base                           | ✅ Completa (esta sesión)      | `06`    | `app-fase-3-catalogos-seeds` ✓   |
| 4    | Tests de salud (baterías reales)                 | ✅ Completa (esta sesión)      | `07`    | `app-fase-4-tests-salud` ✓       |
| 5    | Home + Programa/Infinito                         | ✅ Completa (esta sesión)      | `08`    | `app-fase-5-home-programa` ✓     |
| 6    | Citas: sala virtual, pre-consulta, contexto real | ✅ Completa (esta sesión)      | `09`    | `app-fase-6-citas-sala` ✓        |

- OpenSpec: los 6 changes **completos (9/9, 7/7, 9/9, 12/12 tareas)**.
- **Pendiente por petición explícita**: `openspec-sync-specs` + `archive` (fases 1–6;
  NO hacerlo sin que el usuario lo pida).
- Siguiente fase: **FASE 7 — Historia/Métricas** (mediciones del paciente; ver orden
  completo en `00-PLAN-MAESTRO.md`: 7 Historia → 8 Nutrición/Food AI → 9 Chat IA →
  10 Comunidad → 11 Push → 12 endurecimiento).

## 2. Commits de la sesión

**antares-paciente — rama `feat/integracion-app`** (fusionada a `dev`, push sin force):

| Commit    | Contenido                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `245cacf` | FASE 3: identidad real tras login por password (getMe) + informe FASE 3                                                                    |
| `a4d51d3` | FASE 3: sesión estable (single-flight restore) + perfil sin mocks + informe con programa 83 días                                           |
| `181d9c2` | FASE 4: 6 keys i18n faltantes en en.json + informe tests de salud                                                                          |
| `b8a002b` | FASE 5: notas honestas requires-data + XP real en Perfil (sin 4820) + cofre del día solo en transición a día completo + informe            |
| `5d452ad` | FASE 6: organización real del paciente desde /telemedicine/me (sin org tree ni hardcode) + perfil con próxima cita y plan reales + informe |

**coppAddresdBack — rama `dev`** (identidades reescritas vía mailmap por el equipo):
rebase de los 2 commits únicos sobre la historia reescrita (`fe9273d..3dcec4c`, sin
force): `dae05ee` (GET /scores self-service sin permiso ERP + test del fallback),
`3dcec4c` (OrganizationId en la cadena de referencia Api→PatientRefDto→/me + seed de
clínica demo), `6c2ffa1` (pin ubuntu-24.04 en runners), `59b474d` (des-trackear
.artifacts). Respaldo del estado local pre-rebase: rama `dev-backup-identidades`.

## 3. Correcciones transversales (más allá de cada fase)

1. **Programa 83 DÍAS (no 83 semanas)** — pedido explícito de Luis. La plantilla
   correcta `program-coppaddresd-83-days` (12 semanas) ya existía; los fallbacks de
   código apuntaban a la auto-sembrada `default-83w` (83 semanas) y los 160
   enrollments demo estaban mal apuntados. Fix: fallbacks corregidos en
   ProgramProgressSeeder/ProgramController/EnrollPatientCommandHandler/DevProgramSeeder
   - `Program:DefaultTemplate:Code` en appsettings local + migración idempotente
     `scripts/fix_program_template_83_days.py` (160 enrollments re-apuntados, 11,317
     semanas sobrantes borradas sin dependientes, progreso gamificado intacto). La APP
     muestra "Semana 1 de 12" ✓.
2. **Identidad**: el login por password solo mapeaba `me.id` → el Home saludaba con
   el mock "María González"; ahora mapea `me.firstName/me.lastName` (y las iniciales
   del Perfil se derivan de `user.nombre`, sin "MG" hardcodeado).
3. **Sesión estable**: dos refreshes concurrentes en el boot (AppContext +
   GraphQL/community) activaban la detección de reuso del refresh token → caída a
   login en cada recarga. Fix: **single-flight en `restoreSession`** (authApi).
4. **Perfil sin datos fabricados**: `hydratePatientProfile` trae el perfil real
   (contacto/aseguradora/emergencia) tras login y restore; el ContactSection ya no
   prefillaba el celular/email mock (riesgo de persistir datos falsos).
5. **Cofre del día fantasma**: entraba al Protocolo y celebraba "¡0 DÍAS! Cofre del
   día abierto" con el día sin terminar — condición invertida; celebra solo la
   transición no-completo → completo con baseline `null`.
6. **XP real**: `pointsTotal` inicia en 0 (retirado el 4820 fabricado); el hero del
   Perfil manda con `snapshot.xp.balance`.

## 4. Seeds y estado demo (para probar)

- **Credenciales**: `55551234` / `playwright.e2e@coppaddresd.com` con password
  `Demo1234!` (application `app`). Email channel OTP con `devCode` en Development.
- **Datos por paciente**: LP (55551234) 4/9 evaluaciones completadas, XP 80 (1 tarea
  real), enrollment 83 días; PW (77777777) 4/9 evaluaciones; ambos con 12 meses de
  mediciones (168 filas/paciente, fechas 2025-10..2026-09 corregidas), 3 citas
  futuras confirmadas + solicitudes pendientes, horarios L-V (+sábado médico/
  enfermería) sembrados.
- **Seeds aplicados** (todos idempotentes, corren con
  `uv run --with psycopg[binary] python ../coppAddresdBack/scripts/<seed>.py` desde
  `ai-service/`): rangos de referencia 14/14 en `ClinicalMeasurementsSeeder.cs`,
  histórico corregido, horarios (`seed_professional_schedules.py`), telemedicina
  (`seed_telemedicine.py` — demos siempre en muestra + citas futuras garantizadas),
  credenciales (`seed_unified_credentials.py` + reset vía X-Internal-Key para LP/PW).
- **Gotcha de caché**: tras cambiar datos de referencia del ERP (clínica del
  paciente), limpiar `tele:ref:patients/by-user/*` en Valkey (TTL 10 min) o subir
  `KeyVersion`.

## 5. Estado técnico al cierre

- **Stack local arriba** (dev-up): gateway 5080, API 5122, Auth 5123,
  Telemedicine 5130, Community 5200, AI 8000, antares 5173, front 3000, foodai 8010.
- **Verificación móvil Playwright (390×844 táctil) hecha y documentada por fase**:
  login/indicadores (Home), Historia con banda de referencia, agenda con horarios
  sembrados, creación/cancelación de citas, pre-consulta + sala virtual con gate
  ("abre 15 min antes"), resultados AHS 59/100, registro real de tarea con XP.
- **Suites verdes al cierre**: APP 589/589 tests (70 archivos), lint/tsc/i18n en
  verde; backend Program 234 ✓ + Telemedicine 355 ✓; build 0 errores.
- **CI/AWS**: el despliegue ECS está bloqueado por facturación de GitHub
  (cuenta LFDIAZDEV2209; revisar settings/billing). Runners ya fijados a
  ubuntu-24.04 (ubuntu-latest migra a Ubuntu 26 desde 2026-10-19).

## 6. Pendientes para la próxima sesión

1. **FASE 7 — Historia/Métricas**: measurements del paciente (`/me/*`), gap de
   baselines (`favorableDirection` vacío para weight/waist sin `clinical_baselines`).
2. **Deuda etiquetada por fase** (detalle en cada informe): mock "4820" heredado en
   Comunidad (FASE 10), org/tree ya eliminado ✓, "Próximo disponible" en horas
   locales del seed (revisar TZ en FASE 11 si el comité lo nota),
   `homeCards.test.ts` ya en verde (los 3 rojos eran la nota genérica), mock
   "Dr. Ramírez" retirado en FASE 6.
3. **OpenSpec**: sync + archive de `app-fase-3..6` SOLO a petición del usuario.
4. **Despliegue ECS**: pendiente de resolver facturación GitHub; tras sanear,
   `gh run rerun` del último run de `deploy-backend.yml`.

## 7. Nota sobre el merge de `dev` (antares + back)

El equipo reescribió identidades (mailmap) → historias sin ancestro común. Se
resolvió **sin perder nada de nadie**: respaldos (`dev-backup-20260923`,
`feat/integracion-app-backup`, en el back `dev-backup-identidades`), rebase
quirúrgico en el back y merge de `feat/integracion-app` en antares combinando
ambos trabajos (nuestro FASE 3-6 + el wearable BLE de Carlos). Todo empujado a
`dev` sin `--force`; `dev` local = `origin/dev` en ambos repos.
