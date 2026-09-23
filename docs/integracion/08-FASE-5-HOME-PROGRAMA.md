# FASE 5 — Home + Programa/Infinito: informe (2026-09-23)

> Change: `app-fase-5-home-programa` · Objetivo: la verdad del backend en las
> tarjetas del Home y el XP del Perfil, sin fabricación, con la verificación
> móvil de Protocolo/Liga/Evolución/cofres.

## 1. Notas honestas (tarea 1.x — los 3 tests en rojo quedaron verdes)

- `REQUIRES_DATA_NOTE` por tarjeta en `src/data/metrics.ts`: IMC "Se completa con
  tu primera medición"; HbA1c/% de grasa "Aparece cuando tu equipo registra tu
  primer análisis/bioimpedancia"; Adherencia "Se completa con tu primera semana
  de adherencia" (antes un genérico "Sin datos registrados").
- **`homeCards.test.ts` 13/13 ✓** (los 3 fallos pre-existentes de FASE 0-4 eran
  esta discrepancia); suite completa **412/412** (49 archivos, cero rojos).
- Las 3 claves ya existían en es/en.json → `i18n:check` exit 0.

## 2. XP real (tarea 2.x)

- `AppContext.pointsTotal` inicia en **0** (eliminado el 4820 fabricado).
- Hero del Perfil: **`snapshot.xp.balance` manda** (mismo patrón que Home); el
  local queda como continuidad demo tras la confirmación del servidor.
- Verificado en móvil: Perfil muestra **"0 Puntos"** para LP (XP real 0) —
  antes "4820 Puntos". Comunidad hereda el valor honesto (FASE 10 ajusta lo suyo).

## 3. Verificación móvil (tareas 3.x)

- **Protocolo diario — tarea real completada**: "Tomar nutracéutico" →
  **POST /api/v1/program/tasks/complete → 200** → refetch del snapshot →
  **"1/6 · 80/750 XP"** reflejando el XP del servidor (xp_ledger en BD).
- **Bug corregido — cofre del día**: al ENTRAR al Protocolo se abría el modal
  "¡0 DÍAS! Cofre del día abierto" con el día sin terminar: la condición del
  efecto estaba invertida (`!allDone && !prevAll.current`) y el ref inicial
  `false` celebraría también al entrar con el día ya hecho. Ahora la
  celebración dispara solo en la TRANSICIÓN no-completo → completo con
  baseline `null` (patrón `program:chest-granted`). Verificado: entrar con
  0/6 ya NO celebra.
- **Bug corregido — Evo 403**: `GET /api/v1/program/scores` (endpoint de la
  pestaña Evolución del móvil, paciente resuelto por JWT) llevaba
  `[RequirePermission("Program.View")]` (permiso ERP) → **403 al aud=app**.
  Retirado el permiso del self-service (anti-IDOR intacto); tests backend
  217 passed (se actualizó `EnrollPatientHandlerTests` que esperaba el
  fallback viejo `default-83w`, corregido en FASE 3).
- **Evo tab real**: Health 24 (Meta 90) con dimensiones reales (Control clínico
  50%, Bienestar mental 60%, Adherencia 9%, Nutrición 0%, Ejercicio 0%),
  Transformation 0 y estados honestos ("Aún no hay suficientes semanas",
  "Sin línea base clínica aún").
- **Liga tab real**: estado vacío honesto ("La liga está arrancando — todavía
  no hay suficientes jugadores con datos").
- **Infinito**: catálogo estático B2C sin datos que integrar (por diseño).

## 4. Estado demo

- XP de LP: 80 (1 tarea real completada) → Perfil "80 Puntos", Home "80XP" con
  snapshot 80/750. Serie de adherencia honesta (requiere semana computada).

## 5. Deuda técnica / próxima fase

- `organizations/tree` 403 sigue en consola (FASE 6 — Citas, org id hardcodeado).
- La liga mostrará datos cuando haya cohortes con datos reales (por diseño).
- `seed_health_tests_mass_fill.py` lento (documentado en FASE 4).

## Estado

**FASE 5 COMPLETADA** → siguiente: FASE 6 (Citas — endurecer estados, sala virtual,
pre-consulta del paciente; retirar el mock "Dr. Ramírez").
