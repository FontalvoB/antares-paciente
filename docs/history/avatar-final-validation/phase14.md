# Fase 14 — circuito real

14/09/2026. Corrección implementada; pendiente activar el binario actualizado de Auth sin intervenciones ajenas al avatar.

El catálogo frontend incluye female-hair-long-01/02/03. Faltaban en el catálogo de dominio `AvatarCatalog` del backend; se agregaron allí, exclusivamente compatibles con femenino. Se reutilizan el DTO, validador de configuración, serializer, store y GET/PUT existentes. No hay nueva tabla, endpoint ni dependencia. IDs desconocidos, slots incorrectos y combinaciones incompatibles siguen rechazados.

Diez pruebas unitarias pasaron. También pasó la prueba HTTP/JWT/PostgreSQL real con rollback: GET/PUT, los tres cabellos nuevos, readback, 401, 400, aislamiento A/B y conservación de idioma/acento. Esa prueba usa TestServer; no sustituye el login/gateway. La compilación se realizó en `.artifacts/avatar-final-tests` porque el ejecutable del servicio activo estaba bloqueado; no se detuvo el servicio.

## Circuito normal observado

- Sesión previa: error de personalización. Se cerró sesión y se inició normalmente con la cuenta de pruebas autorizada.
- Login normal por la app y gateway: funciona.
- GET de preferencias e historial: funciona, cuatro registros y BodyVolume=1.
- PUT de la configuración compatible original: funciona, incluyendo género, camiseta, cabello corto y tres accesorios.
- Cabello largo: la UI conserva la selección y muestra error al guardar con el servicio activo. La corrección compilada y probada no está cargada en ese proceso.
- Se restauró/guardó la selección original. No se escribieron mediciones.
- A/B: validado por HTTP/JWT/PostgreSQL con identidades transitorias y rollback; no se afirma login UI con dos cuentas reales.

## Pendiente externo y límite

La sonda del gateway devolvió 503/Degraded (Api/Auth/Telemedicine Unhealthy, Community Healthy), aunque login y preferencias funcionaron tras autenticar de nuevo. La sonda directa Auth devolvió 200/Degraded. No se atribuye el rechazo de cabello a esa sonda: el catálogo anterior explica el rechazo.

Una consulta SELECT en modo read-only confirmó que `20260913184501_AddErpApplicationSuspension` **ya aparece aplicada** y existen IsSuspended/SessionVersion. Esto difiere del informe anterior. No se aplicó ninguna migración en esta tarea ni se determina quién cambió el entorno.

No se reinició Auth: `Program.cs` ejecuta migraciones y seeders al arrancar; `AdminSeeder` restablece incondicionalmente la contraseña del administrador existente, y `RoleSeeder` gestiona roles/permisos. Esas escrituras no pertenecen al avatar. Tampoco se alteró el arranque para omitirlas, ni se reemplazó el gateway por un host de prueba.

Cambio mínimo pendiente: cargar el binario de Auth que contiene la corrección del catálogo mediante un procedimiento de arranque autorizado y después repetir guardar/recargar los tres cabellos por la UI normal. No requiere cambios de esquema del avatar. Hasta entonces no se declara terminada la persistencia del cabello largo en el servicio activo.

Evidencia del circuito: `phase14-live.json`. Datos clínicos, ERP, gateway y mecanismo de autenticación permanecen sin cambios.
