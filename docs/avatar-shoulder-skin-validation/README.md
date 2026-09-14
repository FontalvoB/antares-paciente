# Revisión de hombro femenino y persistencia de skin — 14/09/2026

Estado: **trabajo incompleto**. El hombro no tiene una corrección visual aceptada. El contrato actualizado de persistencia pasa las pruebas, pero el proceso Auth activo conserva el contrato anterior. No se sustituyó ningún GLB ni se reinició ningún servicio.

## 1. Hombro / axila

El usuario confirmó durante esta revisión que el defecto es el hundimiento de la axila mostrado en `shoulder-detail.png`.

- Asset que continúa utilizando la app: `public/models/avatar/bodies/female-body-base-v2.glb`.
- 4.342.200 bytes, 15.000 triángulos, 51 huesos, nueve morph targets; clips `Idle` y `RigCheck`.
- Fuente femenina original: `public/models/avatar/sources/female-v2/female-polished-v2.blend`.
- Fuente editable abierta al empezar: `public/models/avatar/sources/customization-v1/customization-final.blend`, objetos `Female_Body` / `Female_Rig`, Action activa `Idle`, frame 1, morphs en cero.
- Checkpoint íntegro conservado y reabierto al terminar: `public/models/avatar/sources/customization-v1/shoulder-diagnosis/before-shoulder.blend`.
- **Asset nuevo: ninguno.** No se cambió la referencia del catálogo.

### Diagnóstico observado

La concavidad ya aparece con el rig en REST y con los morphs en cero. También aparece sin el mapa de normales. Por tanto, no puede atribuirse exclusivamente a Idle, BodyVolume o al material. La geometría de referencia participa en el defecto; estas observaciones no demuestran que pesos y pose no contribuyan a su apariencia final.

Se inspeccionaron los pesos Shoulder/Arm/Chest y las transformaciones de ambos brazos. Se hicieron pruebas temporales con BodyVolume 0/.5/1, BodyLean 1 y una rotación pequeña de RightArm, restaurando después sus valores. Las cámaras frontal y 3/4 muestran la concavidad; no se completó una validación final frontal/perfil/3/4 porque ninguna variante pasó la primera revisión visual.

Los ensayos locales de suavizado de pesos, ajuste de pesos hacia una superficie suavizada, normales y corrección geométrica de la concavidad no proporcionaron un resultado suficientemente convincente. Algunas variantes redujeron volumen o introdujeron pliegues. **Se descartaron**, en lugar de exportarlas como una versión corregida. Los ensayos geométricos trasladaron todas las claves por el mismo desplazamiento para mantener sus deltas relativos, pero tampoco se conservaron.

La restauración comprobó igualdad exacta de las coordenadas de todas las claves y de todos los pesos respecto al checkpoint (`restoration-audit.json`). Malla, skeleton, rig, morphs, materiales, ropa e Idle publicados permanecen intactos. `asset-audit.json` documenta el GLB y su hash. La comparación de posiciones tiene en cuenta la escala .941176474 y el cambio de ejes Blender/glTF; la coincidencia por redondeo no constituye por sí sola una comparación binaria completa de los archivos.

Evidencia y ensayos descartados: `public/models/avatar/sources/customization-v1/shoulder-diagnosis/`. Ningún script de esa carpeta representa una corrección aprobada ni debe aplicarse automáticamente al asset funcional.

Pendiente: conseguir una corrección localizada que pase la revisión visual, comprobar camiseta + Idle + morphs en las tres vistas y, solo después, guardar/exportar la nueva versión. No se declara cumplido el criterio «hombro sin deformación visible».

## 2. Persistencia

### Payload real y contrato esperado

La configuración observada en la app tras seleccionar Claro fue:

```json
{"version":1,"gender":"female","skin":"skin-01","clothing":{"shirt":"shirt-basic-01","pants":null,"shoes":null},"hair":"hair-02","accessories":{"glasses":"glasses-01","watch":"watch-01","bracelet":"bracelet-01"}}
```

`putAvatarConfiguration` serializa directamente `parseAvatarConfiguration(value)`. La estructura es un `AvatarConfiguration` directo, **sin wrapper**. La evidencia del estado visible y del fallo de guardado está en `live-save-failure.json`; no es una captura independiente del cuerpo HTTP de Network.

El Swagger del Auth activo en `http://localhost:5123/swagger/v1/swagger.json` confirma que PUT `/api/auth/me/avatar` recibe directamente `#/components/schemas/AvatarConfiguration`. Su esquema contiene `version`, `gender`, `hair`, `clothing`, `accessories`, con `additionalProperties: false`; **no contiene `skin`**. Copia: `active-auth-contract.json`.

El controlador fuente recibe `[FromBody] AvatarConfiguration configuration`. `configuration` es el nombre del parámetro, no una propiedad contenedora. El rechazo de la propiedad desconocida `skin` impide construir el argumento no anulable; eso explica el error adicional «The configuration field is required». Añadir un wrapper no soluciona el problema.

### Causa y corrección mínima

El proceso activo utiliza una versión anterior del DTO. El código fuente ya incorpora `string Skin = "skin-03"`, validación de `skin-01` a `skin-05`, serialización web y catálogo de prendas. No hacía falta cambiar ambos lados ni inventar otro contrato; se conservaron esos cambios existentes.

`AvatarPreferenceStore` guarda el DTO serializado dentro de `auth."UserPreferences"."AvatarConfiguration"` JSONB. `skin` es una clave de ese documento, no una columna nueva. GET deserializa la misma estructura; documentos anteriores sin skin reciben `skin-03`. El upsert conserva Lang/AccentColor y utiliza la identidad extraída del JWT en el controlador. No se creó tabla ni migración ni se escribieron mediciones clínicas.

### Cambios de esta revisión

- `coppAddresdBack/tests/CoppAddresd.UnitTests/Auth/AvatarPostgresTests.cs`: regresión que rechaza `{ "configuration": ... }` con HTTP 400 y comprueba que no modifica preferencias. Los cuerpos directos se prueban a continuación.
- `antares-paciente/scripts/avatar-customization-check.mjs`: parámetro de carpeta de salida `AVATAR_REPORT_DIR`, para preservar evidencias de ejecuciones anteriores.
- Este informe, evidencia JSON/logs/imágenes y checkpoint de diagnóstico.
- **Sin nuevos cambios de producción** en AvatarViewer, frontend de persistencia, DTO, Auth/Program, gateway, ERP o BD. Las modificaciones de producción que ya existían al comenzar esta revisión no son nuevas correcciones de esta ejecución.

### Pruebas

`backend-tests.log`: **12 pruebas correctas, 0 fallidas**, compilación en la salida aislada existente. Incluye HTTP TestServer + JWT + PostgreSQL real en transacción revertida, utilizando controlador, casos de uso y repositorio reales del avatar, sin arrancar Program ni seeders.

La prueba recorre ambos géneros, los cinco skins, los tres pantalones compatibles, zapatos, camiseta, cabello (largo femenino), gafas, reloj y pulsera, haciendo PUT/GET e igualdad completa. También verifica 401, IDs inválidos, combinaciones incompatibles, ausencia de endpoints por usuario y que `?userId=` no sustituye al propietario del JWT. Comprueba conservación de Lang/AccentColor. No se activó la prueba opcional que escribe en una cuenta real.

En la aplicación real se cargó la configuración del usuario autenticado, se eligió skin-01 y se pulsó Guardar: volvió a aparecer el error de guardado. Se recargó la aplicación para descartar el borrador. **No se validó un PUT exitoso ni una recarga persistida a través del Auth activo.**

La prueba de navegador con HTTP controlado terminó correctamente (`passed: true`, seis intentos PUT incluyendo el escenario de error/reintento, veinte muestras). Utiliza AvatarPage/AvatarViewer y los GLB reales, pero simula las respuestas HTTP: comprueba selecciones completas femeninas y masculinas, tonos, prendas, accesorios y restauración tras recargar. Sus resultados y capturas están en `browser/` y `browser-tests.log`. **No sustituye la validación del circuito normal de Auth.**

## Auth: activación pendiente

Proceso observado: `CoppAddresd.Auth`, PID 31612, inicio 14/09/2026 11:46:42; ejecutable en `src/Services/CoppAddresd.Auth/bin/Debug/net10.0/`. La evidencia decisiva de la versión servida es su Swagger, no la mera fecha del archivo en disco.

El cambio mínimo pendiente es desplegar el binario que ya incluye Skin y activar ese proceso mediante el flujo normal de despliegue. No necesita una migración para skin. El arranque actual de Program ejecuta `MigrateAsync` y seeders generales, incluidos AdminSeeder/ApplicationSeeder; AdminSeeder contiene restablecimiento de contraseña. Conforme a la restricción del usuario, **no se forzó el reinicio ni se modificó ese arranque para evitarlo**.

No se aplicó `AddErpApplicationSuspension`; no es requisito del campo skin. Tampoco se modificaron ERP, gateway, login, historial clínico ni progreso.

Tras el despliegue autorizado: verificar Swagger con skin y repetir por el circuito normal skin-01 → guardar → GET; skin-04 + selección femenina completa → salir/volver; equivalente masculino. Hasta entonces, la persistencia queda probada en el código actualizado y **pendiente de activación y validación real**.

Incidencias operativas: el primer intento de compilación encontró espacio insuficiente. Solo se eliminó la carpeta de salida temporal creada en esta ejecución, tras validar su ruta. El segundo intento reutilizó la salida de pruebas existente y pasó. No se limpiaron archivos ajenos ni versiones de assets.
