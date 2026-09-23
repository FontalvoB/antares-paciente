# FASE 6 — Citas (sala virtual, pre-consulta y contexto real): informe (2026-09-23)

> Change: `app-fase-6-citas-sala` · La creación, cancelación, pre-consulta y sala
> ya estaban conectadas; la fase quitó la última pieza fabricada (org hardcodeada)
> y verificó el ciclo completo en móvil (390×844 táctil).

## 1. Análisis / hallazgos

- Las solicitudes del móvil enviaban un **org id hardcodeado** con fallback al
  endpoint ERP `organizations/tree`, que **403 para `aud=app`** (error en consola
  en cada arranque). `/api/v1/me/context` no sirve: es el contexto del EMPLEADO
  (ERP); el paciente no tiene employee.
- La organización del paciente vive en su **clínica asignada** en el ERP
  (`patient_profiles.clinic_id` → `erp.clinics.organization_id`).
- Los pacientes demo se creaban **sin clínica** → el backend no podía resolver
  su organización.

## 2. Backend (tareas 1.x)

- **Api**: `AppointmentPatientRefDto` ahora incluye `OrganizationId`
  (= `patient.Clinic.OrganizationId`) en ambas queries (por id y por userId).
- **Telemedicine**: `PatientRefDto.OrganizationId` + bump `KeyVersion` v1→v2 del
  cache de referencias (DTOs deserializados con `JsonSerializerOptions.Web` —
  binding automático). `GET /api/v1/telemedicine/me` expone
  `patient.organizationId` sin tocar su shape público.
- **Seed**: `seed_telemedicine.py` asigna la clínica/sede demo a los pacientes
  demo (idempotente, misma clínica que sus citas).
- **Gotcha de verificación**: la caché distribuida de referencias (TTL 10 min)
  sirvió una entrada v2 con org nula capturada antes del seed — el patrón de
  invalidación por `KeyVersion` es el correcto, pero durante la validación local
  hay que limpiar `tele:ref:patients/by-user/*` tras cambiar datos de referencia.
- Tests: Telemedicine **355 ✓**, Program **217 ✓** (builds 0 errores).
- `PatientRepository.GetByUserIdAsync` ganó `Include(Clinic)` (lo necesitaba el
  resolver; `GetByIdAsync` ya lo traía).

## 3. APP (tareas 2.x)

- `PatientContextDto.organizationId` (opcional); `refreshAppointments` resuelve
  la org desde `/telemedicine/me` — **eliminadas la llamada a
  `organizations/tree` y el id hardcodeado** (y `fetchOrganizationsTree` ya no
  existe en appointmentsApi).
- **Perfil**: fila "Calendario de citas" con la próxima cita REAL
  (`time · day · profesional` desde `upcomingAppointments`) o "Sin próximas
  citas · Agenda desde Citas" — adios "Dr. Ramírez". Fila "Plan nutricional"
  derivada del snapshot (`todayTasks[nut].short`), no hardcodeada. i18n es/en.

## 4. Verificación móvil (tareas 3.x)

- **3.1** Arranque con **0 errores de consola** (el 403 de organizations/tree
  desapareció).
- **3.2** Solicitud real creada: Nueva → Médica → 30/09 10:00 (Lucía Méndez,
  21 horarios del seed) → motivo → Videollamada → **Solicitar cita** → aparece
  como **PENDIENTE** en Siguientes (`cel-citas-solicitud-creada.png`).
  Nota UX: "Solicitar cita" permanece deshabilitado sin modalidad elegida —
  correcto.
- **3.3** Cancelación: alert de confirmación ("Se notificará al equipo médico")
  → la cita pasa a Anteriores con estado **CANCELADA** y la lista re-promueve
  la siguiente confirmada.
- **3.4** Sala virtual: "Unirse" → verificación de dispositivos (cámara/micrófono
  listos), código de cita 29F55470, CONFIRMADA y **gate real**: "La sala todavía
  no está abierta. Abre el 25/9, 02:45" (15 min antes de la cita). Pre-consulta
  disponible desde la sala (`cel-sala-virtual.png`).
- Suite: **412/412 APP**, i18n exit 0, tsc/lint limpios.

## 5. Deuda técnica / próxima fase

- "Próximo disponible · Hoy 15:30" mostró 15:30 local: los slots del seed son
  UTC y el device tz los convierte — revisar la localización de horas en FASE 11
  si el comité lo nota (el 03:00/06:00 del listado es conversión local correcta).
- La solicitud creada espera confirmación del equipo (flujo ERP, fuera de la APP).
- Mocks restantes: Historia clínica (FASE 7), Nutrición/Food AI ya conectada
  (FASE 8), push (FASE 11).

## Estado

**FASE 6 COMPLETADA** → siguiente: FASE 7 (Historia/Métricas del paciente).
