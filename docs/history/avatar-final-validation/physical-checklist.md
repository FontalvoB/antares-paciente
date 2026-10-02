# Validación física pendiente — Fase 15

Por indicación del usuario, esta misión usa navegador de escritorio; Android/iPhone se probarán manualmente. Un viewport móvil no equivale a un dispositivo físico.

Registrar modelo, SO, versión de app/WebView o navegador, red, fecha y duración. Usar la misma cuenta de pruebas; no introducir mediciones clínicas ficticias para medir rendimiento. Registrar las preferencias originales y restaurarlas al finalizar.

| Escenario | FPS estable/mínimo | Visible ms | GLB ms | JS heap MB* | Draw calls | Observaciones |
|---|---|---|---|---|---|---|
| A Masculino base | | | | | | |
| B Femenino base | | | | | | |
| C Mayor volumen disponible en historial | | | | | | |
| D Camiseta | | | | | | |
| E Cabellos largos 01/02/03 | | | | | | |
| F Gafas/reloj/pulsera | | | | | | |
| G Idle, al menos 10 minutos | | | | | | |
| H Cambiar registro del historial | | | | | | |
| I Cambiar/quitar camiseta | | | | | | |
| J Cambiar/quitar cabello | | | | | | |
| K Cambiar género, conservar progreso | | | | | | |
| L Entrar/salir 10 veces | | | | | | |
| M Recargar/reabrir app | | | | | | |

* `heapMB` representa el heap JavaScript cuando el navegador lo expone; no es memoria total del proceso ni VRAM. En iOS puede no estar disponible. No rellenar valores faltantes con estimaciones.

El visor conserva telemetría no visible en `[data-avatar-metrics]`; la herramienta de inspección remota puede leer ese atributo y `[data-avatar-history-ms]`. No leer ni compartir tokens, cookies o contraseñas. `visibleMs` mide desde entrada a la página; tras cambiar género, ese valor sigue siendo relativo a la entrada, no duración del cambio. Para comparar cambios usar cronómetro/performance desde la acción y `firstFrameMs` del nuevo cuerpo. FPS=0 del primer fotograma significa que aún no hay muestra estable.

Verificar además tacto, scroll en portrait/landscape, labels, navegación de teclado/lector cuando corresponda, guardado y error/reintento. Comprobar que primero se resuelven datos, luego aparece el avatar con los morphs correctos. Registrar pérdidas de contexto WebGL, calentamiento, batería o cierres.

No aprobar rendimiento móvil a partir del informe de Edge. Optimizar solo si estas mediciones detectan un problema reproducible; conservar rig, morphs, Idle y fuentes editables.
