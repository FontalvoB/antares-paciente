# Traspaso para continuar Fase 7

Fecha: 2026-09-23

## Dónde quedó

- Fases 1–6 están completas. La siguiente es **Fase 7: Historia, Métricas y Perfil corporal**.
- OpenSpec: `openspec/changes/app-fase-7-historia-metricas-avatar/` tiene `proposal.md`, `specs/`, `design.md` y `tasks.md`; `openspec validate --strict` pasó. **La propuesta aún necesita aprobación explícita; no implementar antes.**
- No sincronizar ni archivar los changes OpenSpec de Fases 1–6 sin petición expresa.

## Ramas al dejar la sesión

- `antares-paciente`: `feat/integracion-app`, adelantada localmente por fast-forward a `dev` (`0dccd6a`). Está 141 commits delante de `origin/feat/integracion-app`; **no se hizo push**.
- `coppAddresdBack`: rama local `feat/integracion-app` creada desde `dev` (`59b474d`), sin upstream y sin push.
- Revisa `git status --short --branch` dentro de cada repo antes de continuar. Este archivo está sin commit.

## Acuerdos de Fase 7

- Leer propio historial por JWT, independiente de la inscripción activa: `GET /api/v1/me/measurements`, cursor-paginado y sin `patientId` del cliente.
- Añadir serie diaria para el avatar en `GET /api/v1/me/metrics-history`; mantener intacto `/api/v1/program/me/metrics-history`.
- Historia mostrará todas las mediciones clínicas, sin límite de 365 días. Perfil corporal será composición/antropometría; laboratorio y signos vitales permanecen en Historia.
- Consolidar `AvatarPage` en Perfil corporal, conservar personalización y evolución, y hacer que «Mi Avatar» abra el destino unificado.
- El avatar 3D sigue siendo una visualización basada solo en peso, no una representación anatómica. Mostrar datos reales y BMI del backend; grasa solo si está registrada. Sin rangos, riesgos, metas ni fórmulas clínicas no validadas.
- Mantener el registro de peso `Admin`-only; esta fase no habilita escrituras clínicas para pacientes.

## Para empezar mañana

1. Releer `PROMPT_INICIAL_APP.md`, `docs/integracion/10-SESION-INTEGRACION-FASES-3-6.md`, este traspaso y las guías `AGENTS.md` de Antares y backend.
2. Revisar la propuesta OpenSpec y pedir aprobación explícita; luego aplicar sus tareas en orden: backend → APP → QA.
3. Al cerrar Fase 7, documentar resultados y detenerse para validación del usuario. No hacer merge, push, sync ni archive sin autorización.
