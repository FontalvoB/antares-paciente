# FASE 3 — Catálogos y seeds base: informe (2026-09-23)

> Change: `app-fase-3-catalogos-seeds` (delta specs `erp` + `pacientes`) · Sin cambios de UI
> planificados — la APP consume los datos de siempre; aquí se corrigió un bug de identidad
> y dos bugs de datos que la verificación reveló.

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

## 3. Verificación (HTTP real + Playwright, viewport iPhone)

- `GET /api/v1/program/me/metrics-history?codes=bmi,hba1c,body_fat,weight,waist&days=180`
  → 5 métricas × 6 pts, serie hasta 15/09/2026, `target {lo,hi}` presente, sin fechas futuras.
- `GET /api/v1/program/me/snapshot` → programa 83 semanas, 6 tareas hoy, XP/streak/chests ✓.
- `GET /api/v1/me/patient-profile` ✓ · `GET /api/v1/insurers` 19 ✓ ·
  `GET /api/v1/professionals-catalog` total 14 ✓.
- `GET /api/v1/professionals/{id}/schedules` (token erp) → L-V+sáb 07:00-16:00 ✓.
- **APP Home**: tarjetas IMC 28,4 ↓ desde 30,5 · HbA1c 6,3 ↓ desde 7,1 · % grasa 29,2 ↓ desde 33,1.
- **Historia** (modal): banda "META 18,5–24,9 kg_m²" desde el seed + tendencia mejorante
  con la serie mensual (`metric-modal-imc.png`).
- **Agenda**: días con cupo según horarios sembrados, "15 horarios · Lucía Méndez",
  "Próximo disponible · Hoy 11:00" (`agenda-horarios-seed.png`).

## 4. Bugs encontrados y corregidos

1. **Identidad del login por password** (`AppContext.finishLogin`): solo mapeaba `me.id`
   → el Home saludaba con el mock "María González". Ahora mapea
   `me.firstName/me.lastName` igual que la restauración de sesión. Verificado:
   "Hola, Luis" + iniciales LP. (lint ✓, 48/49 archivos de tests ✓)
2. **Fechas futuras del histórico** (2027-10/11/12) — corregido en el seed + reparación
   idempotente de las filas existentes.
3. **Talla en metros con unidad cm** — corregido a 170 cm + reparación de filas previas.

## 5. Deuda técnica / próxima fase

- `src/data/__tests__/homeCards.test.ts`: **3 tests pre-existentes en rojo** (fallan igual
  sin los cambios de esta fase, verificado con `git stash`) — mock/fabricación en
  `resolveHomeCards`; se corrige en FASE 5 (Home) donde se retiran los mocks.
- `favorableDirection` vacío para weight/waist (sin línea base en `app.clinical_baselines`);
  la derivación por rango cubre bmi/hba1c/body_fat. Evaluar seed de baselines en FASE 7.
- Adherencia "Sin datos" (viene de checkins/scores-history — por diseño hasta FASE 5).
- `patient-profile` de 55551234 sin aseguradora (el onboarding de FASE 2 se ejecutó con 77777777).
- Rotación de password SMTP (quedó pendiente en FASE 2, M365).

## Estado

**FASE 3 COMPLETADA** → siguiente: FASE 4 (Tests de salud onboarding con baterías reales)
o FASE 5 (Home + Programa/Infinito) según prioridad del backlog.
