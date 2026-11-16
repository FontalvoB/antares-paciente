# Fase 3 · Evaluación emocional, Podcast y Vita

Base aceptada: `9c55475`. Se leyó el brief completo y se compararon los PNG Propuesta de los tres módulos con la versión anterior. Rutas por estado, servicios, permisos y contratos de API conservados. Sin push ni cambios en `tasks.md`; 4.11 permanece pausada y su preparación queda fuera del commit.

## Entrega

Evaluación: escala 1–5 con selección navy, detalle en acordeón Ionic, sueño válido del wearable o corrección manual, calidad subjetiva, estrés, motivación, barrera y notas. Solo el ánimo es obligatorio. Sin sueño válido se envía `sleepSource: unknown`, sin inventar cero minutos, estrés ni motivación. Escribir horas inválidas mantiene bloqueado Guardar hasta aplicar o cancelar. Se conserva la procedencia y fecha del dato del wearable y la privacidad del registro. Un rechazo conserva las respuestas; solo el servidor confirma el éxito y los puntos, incluido cero.

Podcast: portada, fondo navy, marcador del 70 %, tiempos reales del archivo, pausa/repetición, ±15 s, capítulos e ideas del episodio conservados. Al alcanzar el umbral del reproductor se solicita una sola confirmación por episodio. El audio y los controles continúan después del éxito. El umbral sigue usando la posición del archivo, incluido el seek, como el reproductor anterior; no se afirma medir escucha única ni atención. Una respuesta pendiente no celebra; un error permite reintentar. Sin archivo se conserva el vacío honesto.

La velocidad actúa sobre `HTMLAudioElement.playbackRate` (1/1,25/1,5/2), incluso si se elige antes del primer play. La luna abre la hoja Ionic de pausa en 15/30 minutos; el temporizador se cancela al salir o desmontar. Una instancia antigua de audio ya descartada no puede pintar errores ni cambiar el estado del episodio nuevo. Compartir prepara un borrador en Comunidad y requiere Publicar allí.

Chat Vita: cabecera compacta con avatar, volver, voz y SOS; temas en scroll horizontal; mensajes blancos/navy; compositor con adjuntos, voz y envío. Se conservan historial paginado y anclaje del scroll, documentos, cámara/fotos, imágenes conversacionales, CTA y protocolo de emergencia. El feedback solo aparece con `executionId` y `threadId`, selecciona optimistamente y revierte ante error para permitir reintentar. Usa el endpoint existente y muestra agradecimiento tras confirmar; no se añade persistencia local ni lectura de feedback que el contrato no ofrece.

## Accesibilidad y navegación

Foco visible, nombres accesibles, estados de selección ARIA actualizables y botones de al menos 44 px. Los valores ARIA booleanos de Ionic se pasan como cadenas para que el botón nativo del shadow DOM los actualice. Transiciones breves, barra de misión de 600 ms, entrada de éxito y cambio play/pausa; se respetan movimiento reducido y scroll sin animación.

El dock mantiene el espacio real del layout introducido en P2. En Chat se reserva separación adicional entre compositor y SOS. Se comprueban Hoy y Chat con safe area top 20/bottom 34 mediante CDP, incluido el margen inferior de 34 px. Es emulación Chromium; no se declara validación en iOS físico ni de permisos nativos de micrófono/cámara.

ES/EN completos para UI. Los títulos, descripciones y capítulos de podcast y los mensajes libres del servidor se muestran en el idioma que entrega su contrato; no se convierten en claves de traducción de la interfaz.

## Evidencia y alcance

[Índice antes/después/runtime](../../../../openspec/changes/organizar-experiencia-bienestar/revision-app-premium/P3/index.html) · [Manifest versionado](P3-premium-evidencia.json).

132 capturas, 102 comprobaciones de interacción y 1.710/1.710 tests aprobados. Matriz Playwright en 320/390/1440, ES/EN, sin overflow horizontal ni pageerrors. La evaluación y el podcast usan `ProgramPage`, `useCompleteTask` y cliente HTTP reales con backend determinista aislado; el audio es un WAV de 17 s reproducido por Chromium nativo, con respuestas Range. Se verifican ánimo sin sueño, corrección manual, rechazo 422, doble toque, confirmación, pausa, velocidad, umbral, continuación, pendientes y vacíos.

Chat usa la pantalla y los servicios HTTP reales de mensaje/feedback, con contexto de sesión/conversación aislado para controlar las respuestas. Los callbacks de voz y SOS se verifican sin iniciar llamadas ni acceder al micrófono. Se ejercitan 503 y reintento del feedback, IA caída sin romper el compositor, hoja de adjuntos, movimiento reducido y safe areas. Esa matriz no sustituye una prueba del stream completo de AppContext ni de voz en dispositivo.

Pasada adicional con producto, login y stack reales, sin interceptar rutas: 18 vistas de Evaluación/Podcast/Chat, solo lectura. No reproduce ni confirma misiones, no envía mensajes ni calificaciones. Cero escrituras clínicas; los hashes protegidos permanecen iguales: 34 ingestas, 2 cierres y 4 planes publicados.

Gates y códigos de salida constan en el manifest. En cada caso, los únicos errores de consola son el 422 y los dos 503 provocados deliberadamente; no hay errores JS ni claves faltantes. Se comprueban también seis pares de contraste de texto ≥4,5:1. Lint conserva avisos previos; build conserva el aviso de chunk grande. Postman CLI instalado no soporta `status`; no se crea ni publica workspace para esta fase de interfaz. Se distinguen la evidencia HTTP aislada y el recorrido real de lectura.

## Reproducción

Preview propio 5182 con `scripts/qa/premium-nutrition/vite.config.mts`, modo development, host 127.0.0.1 y strictPort. No arranca ni reinicia el stack compartido.

- `node scripts/qa/premium-coach/before.mjs`: ejecutado sobre la base aceptada, antes de editar.
- `node scripts/qa/premium-coach/after.mjs`: matriz funcional y capturas.
- `node scripts/qa/premium-coach/capture-detail.mjs`: detalle opcional desde arriba, sin POST.
- `node scripts/qa/premium-coach/polish-nav.mjs after`: regresión de Hoy y safe areas.
- `node scripts/qa/premium-coach/read-only-real.mjs`: cuenta QA propia 4.10, credencial Windows solo en memoria.
- `node scripts/qa/premium-coach/gates.mjs`: tests/lint/build/i18n, logs UTF-8 en `.artifacts/p3-*`.
- `node scripts/qa/premium-coach/evidence.mjs`: índice, dimensiones y SHA-256 de capturas.

Los navegadores privados se cierran en `finally`; al terminar se cierra únicamente el preview propio con PID/ruta verificados. Datos cerrados y fixtures de 4.11 conservados.
