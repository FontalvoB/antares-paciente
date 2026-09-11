# Fase 4 — progreso registrado → estado visual del avatar

## Inspección previa y fuente de verdad

Inspección del código existente realizada antes de editar la integración:

- Tabla: `app.clinical_measurements`; entidad Domain `ClinicalMeasurement`.
- Peso: `Value` cuando el catálogo `app.measurement_metrics.Code` es `weight`, unidad `kg` de `app.unit_of_measures`.
- Fecha de medición: `ObservedAt`; fecha de registro: `RecordedAt`. El historial usa la primera, convertida a fecha local del paciente.
- Propietario: `PatientId` → `app.patient_profiles.Id` → `UserId` de la identidad autenticada. `CreatedBy` es el autor de la toma, NO el propietario.
- `ProgramRepository.PersistVitalsAsync` ya convierte `VitalsPayload.WeightKg` en filas `ClinicalMeasurement`, dentro de la transacción de completar la tarea. No es necesario copiar ni sincronizar otra tabla para el avatar.
- Caso de uso: `GetMetricsHistoryQueryHandler`; interfaz Application `IMetricsHistoryRepository`; implementación Infrastructure `MetricsHistoryRepository`; API `ProgramController.GetMetricsHistory`.
- `ProgramActorContext.ResolvePatientProfileIdAsync` resuelve el paciente desde el JWT y su perfil. La ruta `me` no recibe identificadores de pacientes del cliente. El repositorio filtra las mediciones y la inscripción por ese paciente; el caché existente también incluye su identificador.
- Hay catálogo para `height`, `bmi`, `body_fat`, `waist`, `hip` y `wrist`. Además, `VitalSign` contiene `HeightCm` y `WeightKg` nullable; el endpoint toma `heightCm` de la última talla no nula en signos vitales. Estos datos NO se utilizan para inferir la silueta.
- El endpoint puede calcular IMC si se solicita y dispone de peso/talla. El avatar pide únicamente `weight`: no consume ese cálculo ni rangos clínicos.

Lo anterior verifica el modelo, persistencia, consulta y autorización en código. No acredita que una cuenta concreta tenga mediciones: no se obtuvo una consulta autenticada contra la BD/API real durante esta ejecución. No se insertó ninguna medición para suplirlo.

## Contrato reutilizado, sin cambios de backend

`GET /api/v1/program/me/metrics-history?codes=weight&days=365`

Se utiliza el servicio existente `getMetricsHistory` y `apiFetch` (Bearer, gateway, cookies y manejo de errores existentes). No hay endpoint nuevo, tablas, campos, migraciones, persistencia de personalización ni dependencias nuevas.

Comportamiento heredado del endpoint:

- Perfil de paciente e inscripción activa requeridos; 404 si no están disponibles.
- Ventana máxima móvil de 365 días, según zona horaria de la inscripción.
- Última medición de cada día; orden ASC. `ObservedAt` y después `Id` determinan el desempate.
- Solo unidades iguales a la unidad predeterminada del catálogo; no convierte libras.
- Caché por paciente de cinco minutos. El botón Actualizar vuelve a consultar, pero no fuerza la invalidación de ese caché.

La referencia es el **primer registro válido del período recibido**, no el primer registro de toda la historia clínica. Al salir esa referencia de la ventana de 365 días, la referencia cambia. La UI declara este alcance; conservar una referencia de por vida requeriría ampliar el contrato de historial, fuera de esta implementación mínima.

## Transformación determinista v1

Para referencia `w0 > 0` y peso seleccionado `w > 0`, ambos en kg:

```
r = (w - w0) / w0
s = clamp(r / 0.20, -1, 1)
bodyVolume = max(s, 0)
bodyLean   = max(-s, 0)
abdomen = waist = chest = arms = thighs = faceVolume = muscleDefinition = 0
```

`0.20` es sensibilidad artística explícita: ±20 % recorre el morph completo. No representa una relación médica entre kilos, grasa, músculo o volumen geométrico. No es una escala de kilos absolutos ni un objetivo saludable. Por ejemplo, 50→55 kg y 100→110 kg producen el mismo estado visual. El peso de referencia siempre muestra el cuerpo neutral, cualquiera que sea su valor absoluto.

No se deduce distribución regional ni musculatura a partir del peso, IMC o porcentaje de grasa. Las nueve propiedades existen en `AvatarBodyState`; solo `BodyVolume` y `BodyLean` cambian. Los morphs originales del GLB permanecen intactos.

La transición interpola un único eje firmado con amortiguación exponencial `1-exp(-8*dt)`, con `dt` limitado a 0.1 s para evitar saltos al volver de segundo plano. Esto conserva la exclusión entre BodyVolume/BodyLean incluso al cruzar cero. Son frames visuales, nunca nuevas mediciones ni fechas inventadas. Con preferencia de movimiento reducido el cambio de morph es inmediato. Idle conserva su control de pausa.

## Frontend y estados

- Vista existente: Perfil → **Probar avatar 3D** → `AvatarPage`.
- Obtiene el historial real en cada entrada y al pulsar Actualizar; no usa datos del perfil demo, sliders ni caché compartida de mediciones.
- Selección inicial/última y selector Ionic de registros intermedios, mostrando peso, fecha `dd/mm/aaaa` y diferencia respecto a la referencia.
- Sin sesión real: no consulta ni monta el avatar de progreso.
- Sin registros válidos: estado vacío. Sin perfil/inscripción: estado no disponible. Error de red/servidor: error con reintento. No hay fallback de peso.
- Con un registro: cuerpo neutral y explicación de que falta una segunda medición para comparar.
- Se rechazan peso no finito, cero/negativo, fechas inválidas y unidades distintas de kg. Se ordena sin mutar la respuesta.
- El estado del hook está asociado a la sesión actual; una respuesta de una sesión anterior se descarta. Al cambiar de sesión, las mediciones previas no se presentan durante la nueva carga. Sin persistencia local de progreso.
- Se mantiene el GLB que ya cargaba la app (`male-body-base-v3.glb`), su rig, Idle y morphs. No se modificaron assets ni animaciones en esta fase. Los cambios v4 anteriores se conservaron.

## Archivos de esta fase

- `src/components/avatar/avatar-body-state.ts`: normalización, tipos y transición.
- `src/hooks/useAvatarProgress.ts`: lectura por sesión, ausencia/error/reintento.
- `src/pages/AvatarPage.tsx`: historial y estado visual; elimina controles manuales.
- `src/components/avatar/AvatarViewer.tsx`: transición del eje corporal en el bucle de render.
- `src/i18n/es.json`, `src/i18n/en.json`: textos de la vista.
- `src/hooks/__tests__/avatar-progress.test.tsx`: pruebas focalizadas.
- `scripts/avatar-progress-smoke.mjs`: prueba WebGL de la página real, aislando el shell de navegación y usando respuestas HTTP de prueba.
- Este documento y `docs/avatar-progress-validation/`: evidencias de ejecución.

## Validación y límites

- 18 pruebas Vitest aprobadas: 12 de esta fase y 6 del contrato de servicio existente. Cubren estados, sesión demo, cambio de usuario, respuesta tardía, reintento, unidades, fechas, normalización y transición.
- `npm run i18n:check -- --no-orphan`: cero claves faltantes.
- `npm run lint`: sin errores; advertencias existentes en módulos ajenos.
- `npm run build`: bloqueado por `TS2307` en `src/components/CameraCapture.tsx`: falta el paquete existente `@capacitor/camera` en la instalación local. No se instaló ni se modificó esa dependencia ni el módulo de cámara.
- La prueba de navegador usa la página, Ionic, servicio HTTP, GLB y render WebGL reales, pero **las respuestas de mediciones son fixtures de prueba**, no datos de pacientes. Comprueba inicial/intermedio/último, morphs visibles, Idle, raíz fija, vacío/error/reintento, ausencia de sliders y rechazo de sesión demo. Evidencias con sufijo `fixture` y métricas en `browser-report.json`.
- No se ha certificado un recorrido BD real → API autenticada → avatar con una cuenta de paciente. Hace falta una sesión válida con perfil, inscripción activa e historial para cerrar esa comprobación; no se crearon datos ficticios para hacerlo.
- La limitación de 365 días, resolución diaria y caché de cinco minutos es la del endpoint existente. No se afirma exactitud anatómica ni cambio corporal localizado.

Siguiente comprobación recomendada: ejecutar la vista con una cuenta real que ya tenga dos o más registros, contrastar fechas/pesos devueltos por la API y verificar visualmente su evolución. Si se requiere una referencia histórica permanente, ampliar primero el contrato existente de historial de manera compatible.
