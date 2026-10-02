# Diagnóstico de validación login/gateway — sin implementar solución

Fecha: 14/09/2026. Estado acordado por el usuario:

**FASES 11–13 IMPLEMENTADAS, PENDIENTES DE VALIDACIÓN DEL CIRCUITO NORMAL DE LOGIN/GATEWAY.**

No está autorizada la migración `AddErpApplicationSuspension`, ni reiniciar servicios si ello implica aplicarla o modificar ERP. No se ha aplicado en esta revisión. Solo se realizaron lecturas de código, SELECT de metadatos PostgreSQL en modo read-only y GET de salud. Los únicos archivos editados son documentación. No se ejecutó login, refresh, guardado, test con escrituras ni arranque de servicios.

## 1. Parte exacta que impide la validación

Falta recorrer la cadena con los servicios normales: aplicación paciente → gateway local → login de Auth → token real → consultas autenticadas de configuración del avatar (Auth) e historial de peso (API) → presentación → guardar → salir/volver → restaurar.

Las pruebas previas usaron la página y GLB reales con HTTP controlado, y por separado el controller del avatar en TestServer con JWT y PostgreSQL. La prueba de durabilidad guardó y leyó desde conexiones diferentes. Ninguna demuestra el circuito completo por los servicios normales.

Hay dos condiciones distintas:

1. **Disponibilidad observada ahora:** gateway degradado, Auth/API no saludables según sus sondas.
2. **Incompatibilidad comprobada del código Auth del checkout con el esquema local:** el arranque aplica migraciones pendientes, y login/refresh usan columnas de la migración ERP ausentes en esa BD.

No se ha probado que la segunda condición haya causado la primera. No se conoce qué versión/binario/configuración utiliza cada proceso que sirve actualmente el entorno.

## 2. Punto donde falla o se detuvo

La validación anterior se detuvo **antes de arrancar/reiniciar el host Auth normal**, no después de recibir un error de login. En `coppAddresdBack/src/Services/CoppAddresd.Auth/Program.cs`, después de `builder.Build()` y antes de `app.Run()`, se ejecutan sin un guard de exclusión:

- `AuthMigrationHistoryRelocator.RelocateAsync(...)`;
- `dbContext.Database.MigrateAsync()` (línea 205 en la revisión consultada);
- varios seeders de permisos/usuarios/aplicaciones.

Por tanto, arrancar ese checkout no es una operación de solo lectura de la BD.

Si se omitiera únicamente `MigrateAsync`, quedaría otro punto incompatible: `AuthService.LoginAsync`, consulta a `UserApplications` (líneas 121–125), materializa una entidad que incluye `IsSuspended` y `SessionVersion`. El flujo no restringe esa lectura a `application=erp`; también corresponde al login de la app paciente. `RefreshAsync` materializa `RefreshTokens` (línea 151) y consulta/compara esas versiones (líneas 182–184). `TokenService` persiste `ApplicationSessionVersion` al generar refresh tokens.

Con esas columnas ausentes, se espera un error de columna inexistente al llegar a las consultas correspondientes. **Es una conclusión de código + esquema, no un HTTP/stack de login observado.** No se reprodujo forzando el arranque ni deshabilitando seguridad.

## 3. Servicio y respuestas observadas

Sondas GET sin autenticación ni cambios de configuración:

| Sonda | Resultado |
|---|---|
| `http://localhost:5080/health` | HTTP 503, `status=Degraded` |
| Clusters reportados por gateway | Auth=Unhealthy, Api=Unhealthy, Community=Healthy, Telemedicine=Unhealthy |
| `http://localhost:5123/health` | Timeout del cliente tras 3 segundos; sin respuesta HTTP recibida |

El puerto 5123 es el destino Auth del archivo **de ejemplo** del gateway. No se verificó que sea el destino efectivo del proceso vivo: el `appsettings.json` del gateway no existe en el checkout consultado y puede haber configuración externa. No se creó ni modificó configuración.

El 503 de salud **no demuestra una respuesta incorrecta del gateway**: `HealthResponseWriter` está diseñado para devolver 503 si un cluster no está saludable. Tampoco se ha observado un código 500/401/502 de login o de configuración del avatar en el circuito normal. No corresponde atribuirle un fallo de enrutamiento, credenciales o autorización sin esa evidencia.

La API figura como Unhealthy y es necesaria para el historial; su causa no se investigó más allá de la sonda del gateway. Resolver solo Auth no garantiza completar el circuito. Telemedicine no forma parte de las dependencias del avatar, aunque también degrade la salud global.

## 4. Dependencia con AddErpApplicationSuspension

SELECT de metadatos, con `default_transaction_read_only=on`, confirmó:

- `20260914152543_AddAvatarConfigurationPreference` está registrada como aplicada.
- `20260913184501_AddErpApplicationSuspension` no está registrada como aplicada.
- Existe `auth."UserPreferences"."AvatarConfiguration"`.
- No existen `auth."UserApplications"."IsSuspended"`, `"SessionVersion"` ni `auth."RefreshTokens"."ApplicationSessionVersion"`.

La migración ERP agrega esas tres columnas, además de `auth."ErpAccessOperations"` y su índice. El **módulo avatar no usa esas columnas ni esa tabla**: su store opera sobre UserPreferences y lee gender del perfil por la identidad autenticada. La dependencia viene del host y de los flujos de autenticación existentes en este checkout, no del modelo del avatar ni de su propia migración.

Aplicar la migración del avatar no corrige esa incompatibilidad, y registrar artificialmente la migración ERP como aplicada tampoco crearía las columnas. Ninguna de esas maniobras se propone como solución.

## 5. Validación posible sin esa migración

**Sí, validación parcial y aislada:** conservar los resultados ya obtenidos de assets/rig/morphs/Idle, página y personalización, contratos/JWT/aislamiento, PostgreSQL y durabilidad. TestServer evita el arranque y seeders del host completo. Estas pruebas no necesitan las columnas ERP porque ejercitan el módulo avatar y no el login/refresh del checkout. No se repitieron pruebas con escrituras en esta revisión.

**No está demostrada una validación completa del circuito normal bajo el estado actual.** Podría realizarse sin migrar ERP si existiera un host Auth con el módulo avatar compatible con el esquema actual, rutas efectivas correctas y API saludable. No se ha identificado ni validado ese artefacto/configuración; no se seleccionó otra versión ni se preparó un host sustituto.

No se utilizarán tokens de prueba o respuestas simuladas como evidencia de login real. No se deshabilitarán comprobaciones de sesión para aparentar una validación completa.

## 6. Cambio mínimo que sería necesario — solo análisis

Para la validación parcial ya realizada: **ningún cambio adicional**.

Para completar el circuito normal sin la migración prohibida, la condición mínima es disponer de un Auth que soporte login/refresh y el endpoint avatar **con el esquema local existente**, y de una API de historial accesible por las rutas reales del gateway. Saltar solo la migración de arranque es insuficiente porque persisten las referencias EF a columnas ausentes.

No puede afirmarse todavía un parche mínimo de una línea ni un cambio de gateway concreto. Antes de proponerlo, habría que identificar de manera no mutante los procesos/versiones, configuración efectiva de rutas y motivos de salud de Auth/API. Si se necesitase un artefacto Auth compatible o cambios de su modelo/arranque, serían una intervención separada en Auth y requerirían autorización explícita. No se ha implementado, generado ni aplicado esa alternativa.

**Decisión actual:** mantener código, assets, servicios y BD tal como están; conservar el estado IMPLEMENTADA / PENDIENTE DE VALIDACIÓN DEL CIRCUITO NORMAL. No volver a intentar la migración ERP como parte de esta misión.
