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
