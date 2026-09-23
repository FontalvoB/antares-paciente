# FASE 3 — Catálogos y seeds base: informe (2026-09-23)

> Change: `app-fase-3-catalogos-seeds` (delta specs `erp` + `pacientes`) · Sin cambios de UI
> planificados — la APP consume los datos de siempre; durante la verificación (desktop +
> **modo celular 390×844 táctil**) surgieron 4 correcciones: identidad tras login, iniciales,
> race de refresh en el boot y el programa 83 días (pedido explícito de Luis).

## 0. Corrección adicional pedida por el usuario: programa 83 DÍAS (no 83 semanas)

El programa inicial y principal de **todos** los pacientes es el de **83 días (12
semanas)** — la plantilla `program-coppaddresd-83-days` ya existía, pero los
fallbacks de código y la config local apuntaban a la auto-sembrada `default-83w`
(83 semanas): los 160 enrollments demo estaban mal apuntados y la APP mostraba
"Semana 1 de 83".

- **Código** (regla de negocio, 4 archivos): fallbacks → `program-coppaddresd-83-days`
  en `ProgramProgressSeeder`, `ProgramController.DefaultTemplateCodeFallback`,
  `EnrollPatientCommandHandler` y `DevProgramSeeder` (lookup determinista);
  `appsettings.Example.json` + `Program.cs` documentados.
- **Config local**: `Program:DefaultTemplate:Code` explícito en el appsettings del Api.
- **Datos** (`scripts/fix_program_template_83_days.py`, idempotente): 160 enrollments
  re-apuntados a la plantilla de 83 días, 11,317 filas `program_weeks` > 12 borradas
  (sin dependientes: 0 task_completions/daily_checkins fuera de 12, `current_week`
  demo 1-9), progreso gamificado intacto (ambas plantillas comparten los mismos 42
  day_templates). Verificado en BD: 160/160 en 83-days, max week 12.
- **Resultado**: snapshot `template=program-coppaddresd-83-days, totalWeeks=12` y la
  APP muestra **"Semana 1 de 12"** (Home, Citas y Perfil).

## 1. Análisis (inventario real BD vs `/me/*`)

| Fuente                           | Estado encontrado                                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Catálogos (`Add*.sql` aplicados) | insurers 19, metrics 14, blood_types 8, document_types 10, cities 305, icd10 87, medications 141, allergens 77 ✓        |
| `measurement_reference_ranges`   | **GAP**: solo 6/14 métricas con rango (weight, waist, body_fat, height, hip, wrist, temperature_c sin banda)            |
| Histórico de mediciones          | **BUG de fechas**: 3 meses del histórico caían en 2027-10/11/12 (futuro) en vez de 2025-10/11/12                        |
| Talla (`height`)                 | **BUG de datos**: 1.70 guardado con unidad cm (debe ser 170 cm)                                                         |
| `erp.professional_schedules`     | 0 filas — agenda sin horarios                                                                                           |
| Pacientes demo                   | 55551234 enrollment Active ✓; 77777777 sin enrollment (la APP self-enrolls por fallback `enrollOnce`, no requiere seed) |

## 2. Seeds aplicados (todos idempotentes)

1. **Rangos de referencia (14/14)** — `ClinicalMeasurementsSeeder.cs` extendido con bandas
   adulto general para las 7 métricas faltantes (weight 45-160 kg, height 140-210 cm,
   waist 45-150 cm, hip 70-150 cm, wrist 12-20 cm, body_fat 5-45 %, temperature 35.5-37.5 °C).
   Insertadas al arranque del API (0 Warning(s)/0 Error(s) en build).
2. **Histórico 12 meses** — `seed_measurements_history.py` corregido:
   - Bug de fechas: cálculo de mes con floors de Python producía meses futuros;
     nuevo `month_shift()` con aritmética de año×12+mes → 2025-10..2026-09, día 15.
   - Talla: 1.70 → 170 (unidad cm del catálogo).
   - Reparación incluida: borra filas `source='seed-hist'` con altura en metros o
     `observed_at` futura y re-inserta con su `source_key` determinista.
   - Resultado: **168 filas/paciente demo** (14 métricas × 12 meses), 0 fechas futuras.
3. **Horarios de profesionales** — nuevo `seed_professional_schedules.py`: L-V para los
   10 profesionales Active (franja determinista por hash del id: 08-17/09-18/07-16),
   sábado solo médico/enfermería. 52 filas vía `ON CONFLICT (professional_id, weekday)`.
4. **Credenciales** — reset de password demo (`Demo1234!`) para los 2 pacientes APP de
   prueba vía `POST /api/auth/internal/seed-demo-password` (X-Internal-Key, Development only).

## 3. Verificación (HTTP real + Playwright, desktop y modo celular 390×844 táctil)

- `GET /api/v1/program/me/metrics-history?codes=bmi,hba1c,body_fat,weight,waist&days=180`
  → 5 métricas × 6 pts, serie hasta 15/09/2026, `target {lo,hi}` presente, sin fechas futuras.
- `GET /api/v1/program/me/snapshot` → programa 83 días/12 semanas, 6 tareas hoy, XP/streak/chests ✓.
- `GET /api/v1/me/patient-profile` ✓ · `GET /api/v1/insurers` 19 ✓ ·
  `GET /api/v1/professionals-catalog` total 14 ✓.
- `GET /api/v1/professionals/{id}/schedules` (token erp) → L-V+sáb 07:00-16:00 ✓.
- **APP Home** (desktop y móvil): tarjetas IMC 28,4 ↓ desde 30,5 · HbA1c 6,3 ↓ desde 7,1 ·
  % grasa 29,2 ↓ desde 33,1 · "Hola, Luis" · "Semana 1 de 12".
- **Historia** (modal, también en móvil): banda "META 18,5–24,9 kg_m²" desde el seed +
  tendencia mejorante con la serie mensual (`metric-modal-imc.png`, `cel-historia-imc.png`).
- **Agenda** (móvil): días con cupo según horarios sembrados (23/24/25, 28-30),
  "14 horarios · Lucía Méndez", "Próximo disponible · Hoy 11:30" (`cel-agenda-horarios.png`).
- **Perfil** (móvil, `cel-perfil.png`): LP + "Luis Prueba Movil", equipo real del ERP
  (Lucía Méndez MD, Ana Torres RD, Carlos Ruiz PhD), contacto REAL (correo
  `luis.prueba@coppaddresd.com`, celular vacío — sin mock fabricado).

## 4. Bugs encontrados y corregidos (modo celular incluido)

1. **Identidad del login por password** (`AppContext.finishLogin`): solo mapeaba `me.id`
   → el Home saludaba con el mock "María González". Ahora mapea
   `me.firstName/me.lastName` igual que la restauración de sesión. Verificado:
   "Hola, Luis" + iniciales LP. (lint ✓, 48/49 archivos de tests ✓)
2. **Race de refresh en el boot** (`authApi.restoreSession`): AppContext y el cliente
   GraphQL/community disparaban dos refreshes concurrentes con la misma cookie → el
   backend detectaba reuso del refresh token rotado (401 "invalid") y la sesión caía
   al login en cada recarga. Fix: **single-flight en restoreSession** (una promesa en
   vuelo coalesce a todos los llamadores). Verificado: reload ×2 → 1 llamada refresh →
   200 → sesión restaurada estable.
3. **Perfil con datos fabricados** (`hydratePatientProfile` en AppContext): el
   ContactSection prefillaba celular/email del mock del defaultUser cuando la BD no
   tenía teléfono; "Guardar contacto" habría persistido el valor falso. Ahora el
   perfil real (`GET /me/patient-profile` → `toUserProfile`) hidrata contacto,
   aseguradora y emergencia tras login y restore (best-effort; el id/nombre de
   sesión no se tocan). Verificado: celular vacío real, correo real.
4. **Iniciales hardcodeadas "MG" en ProfilePage**: mostraba a otro usuario junto al
   nombre real. Ahora se derivan de `user.nombre` (misma lógica del Home).
5. **Fechas futuras del histórico** (2027-10/11/12) — corregido en el seed + reparación
   idempotente de las filas existentes.
6. **Talla en metros con unidad cm** — corregido a 170 cm + reparación de filas previas.

## 5. Deuda técnica / próxima fase

- `src/data/__tests__/homeCards.test.ts`: **3 tests pre-existentes en rojo** (fallan igual
  sin los cambios de esta fase, verificado con `git stash`) — mock/fabricación en
  `resolveHomeCards`; se corrige en FASE 5 (Home) donde se retiran los mocks.
- Mocks visibles pendientes de su fase (documentados en FASE 0): "Dr. Ramírez hoy
  15:00" en Calendario de citas (FASE 6) y "4820 Puntos" del Perfil (FASE 5).
- `favorableDirection` vacío para weight/waist (sin línea base en `app.clinical_baselines`);
  la derivación por rango cubre bmi/hba1c/body_fat. Evaluar seed de baselines en FASE 7.
- Adherencia "Sin datos" (viene de checkins/scores-history — por diseño hasta FASE 5).
- `patient-profile` de 55551234 sin aseguradora ni teléfono (reales de demo: el
  onboarding de FASE 2 se ejecutó con 77777777) — la UI ya muestra vacío real, sin mock.
- `AppContext.refreshAppointments` llama `organizations/tree` con fallback a org id
  hardcodeado (403 visible en consola móvil, catch → null) — deuda conocida de la
  mezcla real+mock de Citas; se resuelve con FASE 6.
- Rotación de password SMTP (quedó pendiente en FASE 2, M365).

## Estado

**FASE 3 COMPLETADA + corrección programa 83 días** → siguiente: FASE 4 (Tests de
salud onboarding con baterías reales). Pendiente del usuario: prueba en iPhone físico
de todo lo verificado en modo celular.
