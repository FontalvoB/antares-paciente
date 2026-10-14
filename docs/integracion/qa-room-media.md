# Regresión de medios de sala

Los tiles conservan el diseño existente. Cada track adjunta el elemento
audio/video creado por Twilio y lo agrega al contenedor, sin pasar un div al SDK.
El video lleva `playsinline`; el preview local se silencia y el micrófono local
no se reproduce para evitar feedback. Los tracks ya publicados al conectar
también actualizan el estado de video remoto.

Las etiquetas remotas usan `displayName`/`role` del endpoint de sala y la
identidad Auth del participante conectado, sin asumir que todo remoto es el
profesional asignado. Datos opcionales para compatibilidad con despliegues previos.

Validación: `roomTracks.test.ts`, `roomMedia.test.ts`, build y lint. El iPhone
requiere instalar el nuevo build de TestFlight y repetir la llamada real;
actualizar solamente el backend no cambia el código instalado en el dispositivo.

## Revisión móvil 2026-10-14 (pendiente de despliegue)

- Los refs se vuelven a adjuntar al confirmar `connected`; los eventos consultan el contenedor actual.
- El placeholder remoto sigue `enabled`, `disabled`, `started`, `switchedOn` y `switchedOff`.
- Video silencioso con `playsinline`; audio remoto separado, sin silenciar la consulta.
- El botón de intercambio amplía la cámara local o la remota sin reconectar ni recrear tracks.
- Cámara y micrófono usan `LocalTrack.restart` sobre la publicación existente y conservan mute/cámara apagada.
- Ajustes enumeran dispositivos reales y atienden `devicechange`. Salida seleccionable solo con `setSinkId`; iOS sin soporte indica usar los controles del sistema.
- Los nombres se consultan al conectar, sin esperar el primer intervalo de 20 segundos.

Validación local: pruebas de tracks y pantalla conectada, build, lint e i18n. La vista aislada de diseño usa medios simulados y **no acredita E2E de audio/video**.

Retest con ERP + iPhone: entrar primero con cámara ERP apagada, encenderla después y verificar video en la app; repetir apagado/encendido. Intercambiar video principal dos veces. Cambiar cámara frontal/trasera con cámara activa y apagada. Probar micrófono y auriculares disponibles, desconectar/reconectar auriculares, comprobar audio en ambas direcciones y salir sin finalizar la sesión clínica desde la app.
