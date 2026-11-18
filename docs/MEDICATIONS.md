# Control de medicamentos

Primera entrega: tomas de hoy, alta manual de un tratamiento existente, registro de toma u omisión, historial y pausa/reactivación/finalización.

## Acceso y compatibilidad

- `GET /api/v1/me/capabilities` habilita el módulo por cuenta. Debe indicar `enabled: true` y `canView: true`.
- Medicamentos reemplaza únicamente la tarjeta Mi perfil en Inicio, independientemente de la habilitación de la cuenta. Perfil conserva su lugar en la barra inferior. Nutracéutico y Comunidad conservan su lugar. El perfil sigue disponible desde el menú de Inicio y la barra inferior.
- Una respuesta 404, un error de capacidades o una cuenta sin habilitación muestra el estado no disponible dentro de Medicamentos; no se consultan tratamientos ni se permiten escrituras. No se modifican los contratos de login/perfil ni los archivos nativos de la versión 67.
- `canManage: false` permite lectura sin controles de escritura. El servidor vuelve a comprobar permisos y ámbito en cada operación.

## Datos

El cliente usa exclusivamente el contrato `coppAddresdBack/docs/modules/medications/contracts.md`, mediante `apiFetch` y su vínculo `expectedUserId`. Las consultas tienen claves por cuenta; el cierre/cambio de sesión limpia el QueryClient existente. El formulario y sus claves de operación se desmontan al cambiar de cuenta.

Las altas y eventos conservan su `clientRequestId` en memoria durante un reintento ambiguo. Los eventos conservan también `occurredAt` y envían `scheduledAt` de la ocurrencia leída. GET no materializa dosis; el servidor verifica y persiste la ocurrencia al registrar. La UI confirma cambios únicamente después de respuesta del servidor y recarga. No hay cola offline ni persistencia local de tratamientos/tomas.

Inventario y Reportes están conectados a persistencia real. Recordatorios externos, foto e interacciones quedan fuera de esta entrega.

## Verificación

La prueba UI se escribió y ejecutó en rojo antes de implementar la pantalla. Usa respuestas HTTP sintéticas explícitas; no representa integración real con PostgreSQL:

```sh
VITE_GATEWAY_BASE_URL=http://127.0.0.1:1 VITE_PROGRAM_API_ENABLED=true npm run dev -- --host 127.0.0.1 --port 5189 --strictPort
COP_E2E_APP_URL=http://127.0.0.1:5189 COP_E2E_OUTPUT=/tmp/copp-medications-ui node e2e/medications-ui.mjs
```

Cubre navegación habilitada/deshabilitada/backend antiguo, errores, lectura sin gestión, ES/EN, alta/toma/omisión/historial/estados, reintentos y límites horizontales de pantalla a 320/390/768 px. La prueba integrada separada comprueba la persistencia y lectura del mismo registro en ERP y app contra el backend real aislado.

## Protocolo diario y adicional

Con acceso a medicamentos habilitado y `optionalTaskCodes: ["nutraceutico"]` en el snapshot, la rueda y el protocolo abren Medicamentos en lugar de la misión antigua de nutracéutico. Medicamentos muestra el número de tomas registradas sin otorgar XP por dosis; una omisión registrada no se presenta como toma realizada.

El plan obligatorio lo registra el personal autorizado en ERP. Medicamentos y vitaminas
con origen `staff_recorded` se muestran como **Plan asignado**. Los registros propios
y los importados permanecen fuera del plan; no sustituyen ni completan dosis asignadas.
El paciente no puede pausar/finalizar/reactivar lo asignado, aunque llame directamente
a la API. Sus registros personales conservan esas acciones.

La línea **Adherencia al plan** usa el cálculo del servidor para las dosis asignadas
cuyo horario ya llegó. Una omisión no cuenta como tomada. Las dosis futuras y
canceladas no reducen el porcentaje; sin dosis evaluables se muestra `—`.
Si se tomaron productos fuera del plan y faltan dosis asignadas evaluables, aparece
**No estás siguiendo el plan asignado**. No se infieren equivalencias por nombres.
Rueda y tarjeta del protocolo usan solo dosis asignadas no canceladas, sin XP por dosis.

Los tratamientos de tipo `supplement` aparecen en Nutracéutico · Adicional dentro de Hoy. La lista principal y el adicional son conjuntos disjuntos de las mismas dosis del servidor. Ambos usan el mismo endpoint de eventos y el mismo historial, sin crear una segunda completación de programa. Los enlaces antiguos a la misión redirigen a Medicamentos en cuentas habilitadas. Las cuentas sin habilitación o con backend anterior mantienen su protocolo legado.

El backend conserva las filas y el contrato anteriores. El nuevo campo es opcional, sin migración adicional. Solo para cuentas opt-in, el nutracéutico deja de bloquear el bonus diario y el umbral de racha. Sus registros/XP históricos no se borran ni se recalculan.

`e2e/medications-daily.mjs` comprueba rueda → Medicamentos, adicional sin duplicados, un único evento de toma, cero completaciones de programa y persistencia al volver desde el protocolo. La cuenta sintética local `Demo Medicamentos LOCAL` se verificó sin interceptar APIs: login real, programa, confirmación desde la app, mismo evento en ERP y agregados del dashboard. Sus credenciales están fuera del repositorio; no es una pauta clínica ni un usuario de producción.


## Inventario y reportes

Inventario registra conteo inicial, reposición y ajuste con motivo, en la unidad
de la pauta. La confirmación de una dosis descuenta stock una sola vez; su
corrección concilia únicamente consumos posteriores al último conteo físico.
Se muestran saldo, días estimados, vencimiento registrado y movimientos. No es
inventario por lotes. Reportes permite síntoma/intensidad/medicamento opcional;
el equipo recibe una alerta en ERP y su seguimiento queda visible al paciente.

No se guarda contenido clínico en localStorage ni se crean colas offline nuevas.
Las operaciones reutilizan UUID/hash en un reintento del mismo contenido y las
consultas/escrituras quedan ligadas al usuario autenticado. Reportes e inventario
usan Ionic y los tokens existentes; el selector muestra cinco opciones completas.
Las pruebas reales están en la suite de monitoreo del ERP, con pacientes
sintéticos, sin mensajes externos ni ejecución del IPA del build67.
