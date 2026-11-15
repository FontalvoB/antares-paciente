# Fase 2 · Ejercicio y nutracéutico premium

Base aceptada: `00c855d`. Referencias: brief completo de Bienestar Premium, PNG Propuesta de ambos módulos y páginas 8/10 del PDF. Se mantienen las rutas por estado y los contratos de API. 4.11 sigue pausada, sin consumir sus fixtures.

## Comportamiento entregado

Ejercicio tiene lista con hero, duración y puntos del snapshot, circuito numerado y detalles desplegables con la prescripción completa. Las demostraciones reutilizan el vídeo/imagen asignados y las referencias existentes; sin medio válido se muestra el estado vacío, sin inventar vídeos.

La sesión activa usa fondo navy, progreso, anillo continuo de un segundo, pausa/reanudar, anterior/siguiente, demostración y siguiente estación. Consultar la técnica pausa el cronómetro. Cambiar ES/EN no reinicia la estación ni el tiempo. La pantalla de completado permanece abierta tras confirmar el servidor y permite volver al protocolo o preparar un borrador de Comunidad.

El tiempo activo del resumen se mide en la sesión de la app. Los puntos y el bonus proceden de `pointsAwarded`/`dailyBonusAwarded`; no se sustituyen ceros por 150/80 ni se presenta la duración prescrita como tiempo realizado. Al reabrir una tarea ya completada sin recibo de esta sesión, los datos no disponibles aparecen como «—», conservando el estado confirmado del protocolo.

Nutracéutico presenta hero con imagen de referencia, día del programa, semana real e indicaciones de seguridad. El contrato no entrega una dosis numérica: se mantiene el texto que indica seguir la prescripción del profesional. La hoja permite foto opcional, cambiar/quitar foto, intención voluntaria de compartir, mensaje de 280 caracteres, confirmar y cancelar.

Confirmar guarda la toma con el servicio existente. Solo la respuesta correcta abre el éxito, con puntos reales y vista previa si se eligió compartir. Cancelar, Escape y abrir/cerrar la hoja no registran nada. Un rechazo conserva foto y mensaje para reintentar; una marca optimista o pendiente no celebra ni permite compartir.

La foto y el texto viajan en memoria, por cuenta y con caducidad, al compositor existente de Comunidad. No se adjuntan al payload clínico ni se suben por abrir la hoja. El compositor conserva su confirmación «Publicar», validación, permisos y cola/subida existentes. Tipos de imagen y tope de 8 MB coinciden con ese flujo. Las pruebas no publican recursos.

## Pulido de Hoy y accesibilidad

El dock deja de superponerse al scroll: ocupa espacio real en el layout, con separación reservada para Vita/SOS y margen inferior por safe area. Se conserva el z-index de interacción; el contenido ya no continúa por debajo de los controles.

La evidencia mide los límites del área de lectura y de la última tarjeta en 320/390/1440, ES/EN. También emula `safe-area-inset-top:20px` y `bottom:34px` mediante CDP: el margen inferior resulta 34 px y ninguna tarjeta queda cubierta. Es emulación de Chromium, no una prueba en dispositivo iOS físico.

Controles Ionic con foco visible y nombres accesibles que incluyen su etiqueta visible. El toggle de compartir mide al menos 48 px; botones y controles, al menos 44 px. La hoja mantiene foco y cierre por Escape; reabrir conserva el borrador. Se reutiliza la animación Ionic de 280 ms, incluidos sus identificadores de gesto. La estación cambia con transición breve; el anillo respeta movimiento reducido, al igual que las celebraciones. ES/EN completos; los datos clínicos libres conservan el idioma del contrato.

## Evidencia y gates

[Índice antes/después y runtime](../../../../openspec/changes/organizar-experiencia-bienestar/revision-app-premium/P2/index.html). [Manifest versionado con dimensiones y SHA-256](P2-premium-evidencia.json).

Se entregan 132 capturas y 90 comprobaciones de interacción. La matriz controlada usa el `ProgramPage`, cronómetro, `useCompleteTask`, cliente HTTP y payloads reales, con respuestas HTTP aisladas. Incluye los tres estados de cada módulo, cancelar sin POST, pausa sin saltos, demostración sin puntos, anterior/siguiente, rechazo 422 sin falso éxito, doble toque sin duplicación, borrador con foto sin subida/publicación, descanso, vacío y sincronización pendiente. El request conserva inscripción/fecha del snapshot e identidad de idempotencia. El rechazo 422 intencional y el aviso de reduced motion son mensajes esperados de consola; no hay pageerrors.

La pasada adicional usa login y producto completos contra el stack real, sin interceptar rutas, con el paciente QA propio de 4.10. Recorre las dos misiones y abre/cierra la hoja sin confirmar. Cero escrituras clínicas, cero errores JS y hashes protegidos iguales: 34 ingestas (incluidos los 33 R7), 2 cierres y 4 planes publicados.

Gates completos: **1.707/1.707 tests**, lint/build/i18n correctos. El manifest registra códigos de salida y warnings. Persisten warnings previos de lint y el chunk mayor de 1.300 kB. Postman CLI instalado no reconoce `status`; no se inicializa ni publica un workspace para este cambio de interfaz.

## Reproducción

Previews propios en background, sin reiniciar servicios compartidos: actual en 5182 con `scripts/qa/premium-nutrition/vite.config.mts`; referencia `git archive 00c855d` bajo `.artifacts/p2-baseline` en 5197 con `vite-baseline.config.mts`. Ambos con modo development, host 127.0.0.1 y `--strictPort`.

- `node scripts/qa/premium-missions/run.mjs before` contra la versión anterior, antes de editar; después, `run.mjs after` contra la actual.
- `PREMIUM_ORIGIN=http://127.0.0.1:5197 node scripts/qa/premium-missions/polish-nav.mjs before`; repetir con 5182 y `after`.
- `node scripts/qa/premium-missions/read-only-real.mjs`: utiliza la credencial de QA 4.10 guardada en Windows, solo en memoria. No restablece cuentas ni toca fixtures cerradas.
- `node scripts/qa/premium-missions/gates.mjs` registra salidas/logs UTF-8 bajo `.artifacts/p2-*`.
- `node scripts/qa/premium-missions/capture-registration.mjs` verifica la etiqueta sin recortes y recaptura la hoja en los seis tamaños/idiomas, sin enviar registros.
- `node scripts/qa/premium-missions/evidence.mjs` valida y genera índice y manifest. El Chromium privado recibe permiso de acceso a la red local para evitar falsos errores de HMR del entorno; esto no cambia la app ni el navegador del usuario.

Sin push, sin `tasks.md`, sin publicaciones ni cambios del stack compartido. Fases 3/4 pendientes.
