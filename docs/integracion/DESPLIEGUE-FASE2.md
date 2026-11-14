# Orden de despliegue — Fase 2

Tarea **2.25** del change `organizar-experiencia-bienestar`. Fecha: **14/11/2026**.
Este documento describe operaciones futuras; su elaboración no despliega servicios,
no cambia configuración ni publica la app.

## Orden obligatorio

**BACK con 2.6 verde → activar el interruptor 2.7 en el entorno → publicar APP 2.23–2.24.**

La app nueva **no es requisito para activar el interruptor**. El backend compatible
y la validación de la app anterior en 2.6 permiten crear descansos antes de publicar
la actualización móvil. No se exige que todos los pacientes hayan actualizado.
La activación es una operación explícita por entorno; desplegar el backend no la activa.

## Condiciones de entrada y versiones

Según el despacho del orquestador, **2.6 está verde para abrir el interruptor**.
Se conserva la evidencia original en [revision-2.6/README.md](revision-2.6/README.md):
TodayView anterior omite ejercicio sin una excepción nueva por el descanso;
el acceso residual de Inicio queda corregido por 2.24. El informe histórico no se
reescribe ni se presenta como una prueba nativa en dispositivo. La decisión vigente
de despliegue no impone una versión mínima nueva de app para activar descansos.

El artefacto backend debe incluir 2.5 (`c0288b3`), 2.7 (`51fe338`) y 2.8
(`e69fab6`), **con el arreglo de 2.8 `5ef2567`** y sus dependencias integradas.
No basta el commit inicial de 2.8: el arreglo protege la edición por calendario real
de la inscripción y la conservación de la personalización al activar la semana.

La app que se publicará debe incluir 2.23
(`2b65494a193f209a2529e84e9a66f8f288555013`) y 2.24
(`d701fee962984dab44396fbb5fcd28447ca208ce`), con QA de publicación aceptado por
el orquestador. Su QA local está registrado; este documento no acredita un despliegue
ni sustituye el QA integral pendiente.

## Procedimiento por entorno

1. **Desplegar BACK primero**, manteniendo el interruptor apagado. Comprobar la
   versión efectiva de todas las instancias, salud del servicio y lectura del
   snapshot de un paciente de prueba autorizado. La app publicada sigue operando.
   Verificar que el contrato anterior se conserva y que `upcoming`/`rest` son aditivos.
2. **Verificar el estado apagado** antes de abrir: una petición válida de descanso
   sobre una semana editable debe responder `422 REST_DAYS_DISABLED`, sin escritura.
   Usar una inscripción de prueba del entorno y permisos/alcance correctos para no
   confundir esa guardia con un rechazo de autorización o de semana iniciada.
3. **Activar el interruptor 2.7 en ese entorno**, después de las comprobaciones del
   backend y antes de publicar la app. Establecer el valor siguiente en la configuración
   efectiva del backend y aplicar el reinicio/reciclado que requiera la plataforma.
   Comprobar que todas las instancias usan el mismo valor.

   | Configuración | Valor habilitado | Valor de rollback |
   | --- | --- | --- |
   | Clave .NET `Program:RestDays:Enabled` | `true` | `false` |
   | Variable de entorno equivalente `Program__RestDays__Enabled` | `true` | `false` |

   La ausencia de la clave, `false` o un valor inválido mantienen el interruptor
   apagado. La lectura de descansos existentes sigue siendo tolerante.
4. **Comprobar la apertura con la app anterior aún publicada**. Crear mediante el
   flujo autorizado un descanso de ejercicio en una semana realmente editable de
   la inscripción de prueba. El ítem debe tener `rest:true`, `origin:individual`
   y ninguna rutina. Confirmar el guardado y la lectura consistente en ERP/snapshot;
   una semana iniciada o pasada debe seguir protegida. TodayView anterior debe
   omitir la misión de ejercicio sin un error nuevo atribuible al descanso.
5. **Publicar APP 2.23–2.24**, conservando el backend y el interruptor habilitado.
   Registrar el identificador real de la build y efectuar las verificaciones de la
   sección siguiente. Los usuarios con la versión anterior pueden seguir operando.

## Verificaciones posteriores al despliegue

Realizar y registrar estas comprobaciones sobre datos de prueba controlados en el
entorno desplegado, sin completar misiones de pacientes reales para obtener evidencia.

| Caso | Resultado esperado |
| --- | --- |
| Salud y versión de BACK | Instancias saludables con el artefacto aprobado y configuración coherente. |
| Snapshot de día normal | Lectura correcta, ejercicio con su rutina cuando corresponde y misiones restantes conservadas. |
| `upcoming` del backend | Desde mañana hasta hoy + 6 en la zona del paciente, limitado por el final de su programa; fechas/días/semanas y misiones coherentes. |
| TodayView de APP 2.23 | «Lo que viene» muestra esos próximos días, con fechas y contenido coincidentes; los acordeones son de solo lectura. Si `upcoming` falta, es null o está vacío, no hay error ni calendario inventado. |
| Día de descanso en el snapshot | `rest:true`, sin misión `ejercicio` ni rutina de respaldo; las demás misiones continúan disponibles. |
| Día de descanso en APP 2.24 | Hoy muestra el aviso de descanso y omite la tarjeta de ejercicio; Inicio tampoco ofrece ejercicio. Una apertura directa de Ejercicio muestra descanso, sin misión, rutina, cronómetro ni botón de completación. |
| XP, máximo y bonus | Coinciden con el snapshot del backend; no incluyen ejercicio inexistente. Con la fixture controlada de 2.4: podcast 10 + nutrición 10 + bonus 50 = máximo 70; parcial 10/70, completo 70/70 y bonus una sola vez. Los valores reales dependen del plan del paciente. |
| Compatibilidad y errores | La versión anterior sigue leyendo el snapshot; la nueva tolera los campos opcionales ausentes. No aparecen errores nuevos de deserialización o fallos de lectura atribuibles a `rest`/`upcoming`. |

Guardar versiones, hora, entorno, resultado de cada caso y capturas de TodayView
con «Lo que viene» y del descanso en la app. Diferenciar navegador móvil de una
build nativa instalada; no declarar verificado un dispositivo que no se haya probado.

## Rollback del interruptor

Ante un fallo atribuible a la apertura de descansos:

1. **Apagar `Program__RestDays__Enabled`**, estableciéndolo explícitamente en `false`
   en el entorno afectado. Aplicar el reinicio/reciclado necesario y confirmar el
   valor efectivo en todas las instancias.
2. Comprobar que una nueva solicitud válida de descanso responde
   `422 REST_DAYS_DISABLED` sin guardar cambios. Conservar la edición de rutinas
   ordinarias y las guardias de semana iniciada y autorización.
3. Verificar salud del backend, lectura del snapshot y funcionamiento de la app
   tanto en un día normal como en uno de descanso ya guardado.
4. Registrar el incidente, las versiones, la hora del apagado y las comprobaciones.
   Reabrir solo tras corregir y validar la causa en el entorno correspondiente.

**Apagar el interruptor solo impide crear nuevos descansos.** No elimina descansos
existentes, no repone automáticamente ejercicio y no cambia historial, XP o misiones
completadas. Mantener el backend capaz de leer esos datos; no revertir esquema,
borrar snapshots ni restaurar binarios incompatibles como parte de este rollback.
Si el problema se detecta antes de publicar la app, conservar la versión publicada
mientras se resuelve; su actualización no es necesaria para apagar el interruptor.

## Referencias y archivo versionado

- [ARQUITECTURA.md §7.1](ARQUITECTURA.md): compatibilidad y orden de apertura.
- [tasks.md](tasks.md): 2.5–2.8, 2.23–2.25; se consulta sin editarlo.
- [revision-2.6/README.md](revision-2.6/README.md): evidencia de la app anterior.
- Backend: `coppAddresdBack/docs/modules/program-progress/DAILY-ROUTINES.md`
  (clave real del interruptor, errores y comportamiento del rollback).
- App: `docs/integracion/fase-2-programa.md` en la rama `org/f2-antares-paciente`.

La fuente canónica está en este directorio OpenSpec del workspace, fuera de Git.
Para el commit de 2.25 se conserva una copia idéntica en
`antares-paciente/docs/integracion/DESPLIEGUE-FASE2.md`, rama
`org/f2-antares-paciente`. Los enlaces relativos de este documento se resuelven
desde su ubicación canónica en OpenSpec.
