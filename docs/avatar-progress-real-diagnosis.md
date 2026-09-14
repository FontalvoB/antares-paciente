# Fase 4 — diagnóstico real del 11/09/2026

Estado: **PENDIENTE de validación con mediciones reales**. La cuenta autorizada, documento terminado en 0001, tiene perfil de paciente e inscripción activa, pero carece de mediciones. No existe un historial que el botón pueda cargar para esa cuenta.

## Evidencia real

- Autenticación real mediante `/api/auth/login` con la cuenta proporcionada, aplicación `app`; identidad contrastada mediante `/api/auth/me` con el `user_id` de `app.patient_profiles`. No se usaron IDs de otro usuario ni se consultaron sus datos.
- GET real, a través del proxy de la aplicación: `/api/v1/program/me/metrics-history?codes=weight&days=365`.
- HTTP **200**, `Content-Type: application/json; charset=utf-8`. Primera respuesta registrada: `Date: Fri, 11 Sep 2026 17:22:04 GMT`.
- Cuerpo exacto: `{"heightCm":null,"metrics":[]}`. Dos solicitudes autenticadas posteriores devolvieron el mismo resultado. Coincide con el status/JSON que el usuario obtuvo al pulsar «Actualizar historial».
- La misma ruta sin credenciales devuelve **401**, no un 200 vacío.
- SQL de solo lectura, filtrado al paciente resuelto de esa identidad: **0 filas en `app.clinical_measurements` en todo el historial**, **0 filas en `app.vital_signs`**. Por tanto, tampoco hay pesos fuera de la ventana que puedan recuperarse ampliándola.
- Inscripción `Active`, zona `America/Bogota`. Catálogo real: código `weight`, nombre `Peso`, unidad predeterminada `kg`, símbolo `kg`, métrica activa. No procede convertir libras.
- Ventana de 365 días al momento de la prueba: 12/09/2025–11/09/2026, inclusive, en la zona del paciente. El repositorio convierte sus límites a UTC.
- No se insertaron, actualizaron ni eliminaron datos clínicos. No se generaron cuentas ni mediciones para las pruebas.

**Clasificación de la causa: D, no existen registros.** No es una pérdida de registros en el frontend, un fallo de sesión ni un filtro de fechas demostrado en esta cuenta.

## Trazabilidad de código

1. `AvatarPage`: el botón limpia la selección de fecha y métricas de rendimiento y llama a `progress.refresh()`.
2. `useAvatarProgress`: incrementa el intento, publica `loading` y solicita `getMetricsHistory(['weight'], 365)`. El resultado permanece aislado por sesión; una respuesta tardía de otra sesión se descarta.
3. `metrics-history-service`: GET mediante `apiFetch`, token de la sesión, credenciales incluidas y manejo de errores HTTP.
4. Contrato esperado: `{heightCm, metrics:[{code,unit,target,favorableDirection,points:[{date,value}]}]}`. Fecha `yyyy-mm-dd`, peso numérico positivo en kg. No hay conversión para kg. Se ordenan fechas, y un duplicado de fecha conserva el último punto recibido.
5. `ProgramController.GetMetricsHistory`: resuelve el perfil desde la identidad autenticada; no recibe patientId del cliente.
6. `GetMetricsHistoryQueryHandler`: comprueba inscripción activa, valida el catálogo y recorta el contexto cacheado por paciente. Caché de cinco minutos, ventana máxima 365 días. Omite series sin puntos y mediciones cuya unidad no coincide con la predeterminada del catálogo.
7. `MetricsHistoryRepository`: consulta `ClinicalMeasurements` → `app.clinical_measurements`, con joins al catálogo/unidades, filtro por paciente y fechas. Deduplica por fecha local en el handler. `heightCm` procede de `app.vital_signs`.

## Correcciones acotadas realizadas

- Una respuesta sin contrato válido, una unidad no compatible o una serie cuyos puntos son todos inválidos ahora producen **error**, en lugar de confundirse con una consulta correcta sin registros.
- Una respuesta válida con `metrics:[]` sigue siendo **sin datos**.
- Solo el 404 con código `NO_ACTIVE_ENROLLMENT` se clasifica como falta de inscripción. Otros 404 muestran error real.
- La pantalla muestra HTTP, código, mensaje de API e identificador de diagnóstico cuando existen, sin registrar tokens, cookies ni respuestas clínicas en consola.
- Añadida cantidad de registros válidos cuando hay datos. No se cambió la consulta de 365 días ni la fórmula de BodyVolume/BodyLean.
- Cambios: `src/components/avatar/avatar-body-state.ts`, `src/hooks/useAvatarProgress.ts`, `src/pages/AvatarPage.tsx`, `src/i18n/es.json`, `src/i18n/en.json`, expectativas de regresión en `src/hooks/__tests__/avatar-progress.test.tsx` y este informe.
- Backend, Next.js/admin, modelo 3D, Blender y lógica de morphs regionales intactos.

## Resultados y límites

| Dato | Resultado real |
|---|---|
| Cantidad de registros | 0 |
| Registro/fecha/peso inicial | No disponible |
| Registro/fecha/peso actual | No disponible |
| Variación relativa | No calculable sin mediciones |
| BodyVolume / BodyLean | 0 / 0 por guarda neutral; no representan progreso real. El visor no se monta en estado vacío. |

Build correcto; lint sin errores (advertencias preexistentes); i18n sin claves faltantes; 13 pruebas de regresión aisladas correctas. Esas pruebas existentes utilizan dobles para el hook y **no sustituyen validación real ni proporcionan datos a la aplicación**. La evidencia de esta cuenta proviene de HTTP y SQL reales.

Caso C (sin registros): comprobado con la cuenta autorizada. Caso D: HTTP 401 real comprobado; presentación de error cubierta por regresión, pendiente de inspección visual. Casos A/B (varios/un registro): no hay cuentas autorizadas con esos datos disponibles para validar; no se consultaron otras cuentas ni se crearon datos.

La herramienta de navegador falló antes de conectar (`failed to write kernel assets`), por lo que no se afirma una inspección automatizada del botón ni una reacción visual de morphs con datos reales. Se inspeccionó su implementación, el usuario aportó su respuesta de red y se repitió la petición real autenticada desde la misma cuenta.

La fase no se marca aprobada de extremo a extremo. Falta una cuenta autorizada con pesos realmente registrados y comprobar allí carga, referencia inicial/actual, actualización del botón y reacción de morphs. No se debe introducir información clínica ficticia para cerrar esta validación.
