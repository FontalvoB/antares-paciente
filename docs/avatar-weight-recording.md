# FASE 4 — registrar peso desde Mi evolución

Validado localmente el 11/09/2026. **Aprobado el flujo de registro de peso del avatar en desarrollo.** No se certifica despliegue de producción ni dispositivos móviles físicos.

## Experiencia

«Actualizar historial» abre `WeightRecordModal` (IonModal). Peso en kg con teclado decimal y calendario IonDatetime con fecha actual editable. Cancelar/cerrar no envía datos. Guardar permanece accesible en el pie, muestra loading y bloquea nuevas acciones durante el envío. Los errores conservan el formulario y la pose derivada de los datos ya guardados. La confirmación exitosa cierra el modal, informa del guardado y solicita nuevamente metrics-history, sin recargar la página.

El botón «Completar historia clínica» se conserva en el estado sin datos, utilizando `hc → HistoryPage`. Su limitación de contenido demo sigue siendo independiente del nuevo registro de peso.

Se conserva el GLB v3, Idle y fórmula de FASE 4. El primer peso crea una **referencia neutral**, no una evolución ficticia; por ello BodyVolume/BodyLean permanecen en cero. Esta aclaración resuelve la contradicción del caso A solicitado con la fórmula vigente. Con mediciones en fechas posteriores cambia el estado relativo.

## Persistencia y resultado real

Endpoint nuevo mínimo `POST /api/v1/program/me/weight`; servicio frontend `recordWeight`; caso de uso `.NET RecordWeightCommandHandler`, reutilizando ClinicalMeasurementRepository. Fuente de verdad `app.clinical_measurements`, sin tablas adicionales. El POST contiene únicamente peso y fecha; paciente y autor proceden del token.

Cuenta principal: Paciente Antares, exclusivamente de pruebas según confirmación del propietario.

| Estado | Referencia | Peso actual | BodyVolume | BodyLean |
|---|---:|---:|---:|---:|
| Antes | 90 kg, 13/07/2026 | 86 kg | 0 | 0,222222 |
| Después del POST | 90 kg, 13/07/2026 | 80 kg, 11/09/2026 | 0 | 0,555556 |

La BD conserva 90 kg (13/07), 94 kg (12/08), 86 kg (11/09 12:00) y añade 80 kg (11/09 14:22). El GET devuelve tres puntos diarios, 90/94/80, siguiendo la política existente de última medición del día. No hubo sobrescritura. Se verificó el morph aplicado a la malla, no solamente el texto de la interfaz.

Una cuenta independiente «Avatar PRUEBA LOCAL primer peso» pasó de cero filas a una de 90 kg desde el modal, con BodyVolume=0 y BodyLean=0. Se usó el mecanismo de cuenta demo Development-only y autoinscripción existente, sin borrar datos para simular ausencia de historial. Las dos mediciones nuevas tienen sus UUID y fechas documentados en el reporte backend `docs/modules/program-progress/weight-recording.md`.

## Validación

- E2E contra servicios y BD reales: carga, apertura, cancelación sin POST, pesos inválidos bloqueados, interrupción de red manteniendo datos/modal/avatar, reintento exitoso HTTP 201 y GET automático actualizado.
- E2E separado de usuario sin pesos: primer POST 201, historial disponible y referencia neutral.
- Verificación SQL de usuario, paciente, value, weight/kg, observed_at y conservación de las filas anteriores.
- Backend: 13 tests correctos, incluidos rechazo de IDs ajenos y ausencia de escritura ante error.
- Frontend: 29 tests correctos (16 validaciones de formulario + 13 regresiones de historial/morphs).
- HTTP real: peso 0/501, precisión excesiva, fecha futura/imposible y anónimo rechazados.
- Revisión móvil 375×812 y tablet 1024×768; calendario con futuro deshabilitado, botón Guardar fijo y cancelación.
- Build frontend y API correctos; i18n sin claves inglesas faltantes; lint sin errores. Persisten advertencias previas del proyecto.

Los scripts E2E reciben credenciales exclusivamente mediante `AVATAR_TEST_DOCUMENT`/`AVATAR_TEST_PASSWORD`. `avatar-weight-save-check.mjs` realiza un guardado real de 80 kg en la cuenta preparada con historial; no ejecutarlo como prueba sin efectos sobre datos. `avatar-first-weight-check.mjs` requiere una cuenta local sin pesos y añade 90 kg. No contienen contraseñas ni tokens. No se crearon datos clínicos en producción.

## Archivos de esta tarea

Frontend:
- `src/pages/AvatarPage.tsx`
- `src/components/avatar/WeightRecordModal.tsx`
- `src/components/avatar/weight-record-validation.ts`
- `src/services/program/metrics-history-service.ts`
- `src/i18n/es.json`, `src/i18n/en.json`
- `src/hooks/__tests__/weight-record.test.ts`
- `scripts/avatar-weight-save-check.mjs`, `scripts/avatar-first-weight-check.mjs`
- `scripts/avatar-local-demo-check.mjs` (adaptado al nuevo significado del botón)
- Este reporte y `docs/avatar-weight-validation/`.

Backend:
- `src/CoppAddresd.Api/Controllers/ProgramController.cs`
- `src/CoppAddresd.Application/Features/ProgramProgress/Commands/RecordWeight/RecordWeightCommand.cs`
- `src/CoppAddresd.Application/Features/ProgramProgress/Commands/CompleteTask/CompleteTaskCommand.cs`
- `src/CoppAddresd.Application/Features/Patients/CreatePatientCommandValidator.cs`
- `tests/CoppAddresd.UnitTests/ProgramProgress/RecordWeightTests.cs`
- `docs/modules/program-progress/weight-recording.md`

Problemas resueltos durante la implementación: doble serialización inicial del body (apiFetch ya serializa), selector E2E que coincidía también con el modal de voz, contraste del botón dentro del toolbar, archivos de restauración de tests desactualizados y falta de espacio por builds temporales. Se eliminaron exclusivamente las compilaciones temporales de esta tarea. La API local quedó reiniciada con el endpoint nuevo.

Se conservaron los cambios anteriores del workspace; no se modificaron assets, Blender, skeleton, rig, morphs, materiales, dependencias declaradas ni Next.js/admin.
