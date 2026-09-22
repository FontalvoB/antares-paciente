# FASE 2 — Onboarding/Perfil: análisis y diseño (2026-09-22)

> Change: `openspec/changes/app-fase-2-onboarding-perfil/` · Estado: en implementación.

## 1.1 Hallazgo clave (corrige la auditoría FASE 0)

`GET/PUT /api/v1/me/profile` (MyProfileController) es el perfil del **PROFESIONAL**
(`GetMyProfileQuery` → `EmployeeDto` — extensión clínica del empleado ERP). Un
**paciente** con JWT `aud=app` recibe `404 "No hay un perfil vinculado a tu cuenta"`.

➡️ **La auditoría FASE 0 (§1 tabla "Perfil YA CONECTADO") era incorrecta** para la app
paciente: no existe endpoint self-service del perfil de paciente. La APP nunca persiste
el onboarding (coincide con el §1 gap de onboarding).

## 1.2 Gap de campos — mapping APP ↔ `app.patient_profiles`

| UserProfile (APP)                 | Columna real                           | Nota                                                                                        |
| --------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `nombre`                          | `first_name`/`last_name`/`middle_name` | dividir por espacio (editable? v1: no — identidad del ERP)                                  |
| `cedula`                          | `document_number`                      | no editable (identidad)                                                                     |
| `dob`                             | `date_of_birth`                        | validación: fecha pasada                                                                    |
| `seguro`                          | `insurer_id` (FK → catálogo)           | `GET /api/v1/insurers` es `[Authorize]` sin permiso → accesible por paciente ✓              |
| `poliza`                          | `member_id`                            | texto                                                                                       |
| `grupo`                           | ❌ sin columna                         | **v1: no persiste** (deuda documentada)                                                     |
| `email`                           | `email`                                | validación formato                                                                          |
| `celular`                         | `phone_number` + `phone_country_code`  | E.164 parcial                                                                               |
| `fam1Nombre/Parentesco/Cel/Email` | `emergency_contact` (varchar)          | serializar JSON `{name, relationship, phone, email}`; onboarding exige nombre+cel (line 98) |
| `ciudad`                          | `city_id` (FK)                         | v2 — onboarding no lo pide aún                                                              |

## Decisión (task 1.2)

1. **Nuevo endpoint self-service de paciente**: `GET/PUT /api/v1/me/patient-profile`
   (Application: `GetMyPatientProfileQuery`/`UpdateMyPatientProfileCommand` en
   `Features/Patients/`; anti-IDOR por JWT, DTO reducido, FluentValidation).
   NO se toca `/me/profile` (profesionales) — separación de dominios limpia.
2. Campos editables v1: `dob`, `email`, `celular`, contacto de emergencia,
   `seguro` (insurer_id), `poliza` (member_id). `nombre`/`cedula`/`grupo`/`ciudad`
   no editables desde la APP (origen ERP / sin columna / post-MVP).
3. APP crea `utils/patientProfileApi.ts` (apiFetch, sin ids en ruta) y el onboarding
   persiste con `PUT` antes de avanzar a tests (error → retry, no se pierden datos).
4. `ProfilePage` edita con el mismo servicio; feedback + rollback en error.

## Estado por tarea

- [x] 1.1 Auditoría DTO vs campos (este doc)
- [x] 1.2 Decisión: nuevo endpoint `/me/patient-profile` (alternativa rechazada:
      reutilizar `/me/profile` profesional — mezclaría dominios Employee/Patient)
- [ ] 2.1 Backend endpoint + validación + test curl
- [ ] 3.x APP (profileApi, onboarding, defaultUser fuera, ProfilePage)
