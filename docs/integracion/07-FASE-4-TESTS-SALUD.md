# FASE 4 — Tests de salud (baterías reales): informe (2026-09-23)

> Change: `app-fase-4-tests-salud` · Fase de **cierre y verificación**: la auditoría
> de arranque confirmó que el flujo ya estaba conectado de extremo a extremo (work
> de FASE 2); aquí se verificó desktop + móvil (390×844 táctil), se cerró el
> resultado y el i18n, y se preparó el estado demo para el iPhone físico.

## 1. Análisis (lo que ya funcionaba)

- **Backend `/api/v1/health-tests/me/*` completo** (verificado por HTTP con JWT aud=app):
  `assignments` (auto-batería lazy de FASE 2) → `tests/{id}` (13 preguntas con opciones)
  → `start` → `submit` (scoring + indicadores + alertas) → `results` / `history`.
- **APP ya cableada**: listado con títulos amigables (`PATIENT_TITLES` por testCode),
  wizard con preguntas reales, `start+submit` con mapeo por tipo (multi → `answerOptionId`
  múltiple, open/num → `valueText`, single → opción), contador real y resultados.
  Los nombres "¿Qué tan activo/a eres?" NO son mocks: son títulos amigables de los
  tests reales (`movimiento`, `sueno`, `nutricional`, `historia-clinica`, ...).

## 2. Verificación end-to-end (móvil 390×844 táctil)

- **Wizard completo**: "¿Qué tan activo/a eres?" → intro → 4 preguntas (cards/likert)
  → **Guardar evaluación** → submit real → listado refrescado: **"4 de 9 evaluaciones, 44%"**
  (antes 3 de 9). Toast "Evaluación guardada".
- **Regla "Después"** (tarea 2.2): con ≥3 completadas el flujo continúa a la app sin
  bloqueo ✓ (verificado con "Después" en la batería).
- **Falsa alarma descartada**: el CTA "Guardar evaluación" parecía bloqueado en un
  probe — era un `.ht-cta` oculto de otra vista; el real (en `.ht-foot`) estaba
  habilitado tras seleccionar la opción. Sin cambios de código.

## 3. Resultados reales (tarea 2.1)

La vista **"Mi perfil Copp Adresd · IA"** muestra 100% datos del backend
(`cel-resultados-ahs.png`):

- **AHS 59/100 · Perfil adecuado** (score del motor de scoring)
- **IMC 27.5 · Sobrepeso** y **Grasa 26%** (Método Deurenberg + ICC, estimado backend)
- **Glucosa est. 82–99 · Normal**, temperamento **Sanguíneo–Melancólico**, **IAC A2 · Moderada**
- Análisis integral IA + disclaimer de estimados (no reemplaza medición clínica)

Sin fallback mock: los `backendResults` (20-22 filas por paciente) alimentan la vista.

## 4. Seeds demo (tareas 3.x)

- Estado demo inicial: LP 4/9 ✓, **PW 1/9 (insuficiente para el iPhone)**.
- `seed_health_tests_mass_fill.py` (idempotente) dejó PW en 2/9 (timeout del script
  masivo — se documentó su lentitud); los 2 faltantes se completaron **vía API real**
  (temperamento + nutricional, opción de mayor riesgo → scoring/alertas genuinas).
- **Estado final**: LP 4 completadas/20 resultados · PW 4 completadas/22 resultados,
  evaluaciones → resultados coherentes por FK (SQL verificado). Sin alertas activas
  (las reglas requieren combinaciones específicas de riesgo — expected).
- `scripts/seed_health_tests_mass_fill.py` corre lento (subprocess psql por SQL):
  deuda menor documentada, no bloqueante.

## 5. Bug corregido

1. **i18n**: 6 keys usadas por la APP sin entrada en `en.json` (deja de FASE 2 —
   ContactSection + onboarding): "Correo", "Datos de contacto", "Datos actualizados",
   "Guardar contacto", "No se pudo actualizar tu contacto", "No se pudo guardar tu
   perfil". `npm run i18n:check` → **exit 0** ✓. tsc/lint limpios.

## 6. Deuda técnica / observaciones

- Home metric card "IMC 28,4" vs perfil de salud "IMC 27.5": dos fuentes de cálculo
  (última medición `bmi` vs IMC derivado de peso/talla del AHS). Cosmético; unificar
  criterio en FASE 7 (Historia/Métricas) si el equipo clínico lo pide.
- Alertas de tests (health_test_alerts) sin filas para los demos: las reglas de alerta
  requieren combinaciones de riesgo específicas; el flujo de alertas se cubre en el
  módulo ERP (ya implementado) — no afecta al móvil.
- Mocks pendientes de su fase: "Dr. Ramírez" (FASE 6), "4820 Puntos"/Adherencia (FASE 5).

## Estado

**FASE 4 COMPLETADA** → siguiente: FASE 5 (Home + Programa/Infinito — retirar mocks de
homeCards/adherencia/puntos, ya tiene 3 tests en rojo que apuntan ahí).
