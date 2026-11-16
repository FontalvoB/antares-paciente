# P4 · Pulido del rediseño

Base P3 `715fd40`. Nutrición distingue carga inicial, fallo recuperable y ausencia de programa; espera también la consulta del plan antes de mostrar vacío. El reintento renueva programa, plan y estado. Historial distingue fallo de mediciones/adherencia de ausencia de datos; conserva los datos confirmados cuando los hay. Skeletons Ionic, sin valores clínicos fabricados.

Vita muestra carga, conversación vacía o fallo de historial con reintento. El historial disponible y el compositor siguen utilizables. La paginación conserva cursor/anclaje y permite reintentar sin exigir otro gesto. Respuestas de hilos anteriores se descartan. No cambia contratos ni envía mensajes automáticamente.

Movimiento reducido: Router sin desplazamiento/escala/fade, configuración compartida de Motion, paneles de programa sin blur/desplazamiento, skeletons nuevos estáticos y reglas para animaciones/transiciones/pseudoelementos y partes Ionic. Se conservan temporizadores funcionales y audio. Foco visible en botones Ionic, incluidos sus hosts Shadow DOM. Textos ES/EN y seis pares de contraste de los tokens utilizados ≥4,5:1.

El dock reserva 64 px para SOS/Vita en el flujo del layout, más su altura y safe area. El área de lectura queda 14 px por encima de SOS; la última tarjeta conserva su padding. Ancho y límites laterales seguros también en desktop. La regla de teclado tiene prioridad sobre el estilo premium: oculta el dock y deja el compositor disponible, con safe area inferior. Chat puede reducir su área de lectura en ventanas bajas.

## Evidencia reproducible

[Galería final](../../../../openspec/changes/organizar-experiencia-bienestar/revision-app-premium/P4/index.html) · [Manifest versionado](P4-premium-evidencia.json).

- `node scripts/qa/premium-polish/nav.mjs before|after`: Hoy, última tarjeta y safe areas.
- `node scripts/qa/premium-polish/run.mjs`: estados, reintentos, foco, 44 px, movimiento reducido, teclado y geometría de Chat; ES/EN × 320/390/1440.
- `node scripts/qa/premium-polish/regression.mjs p2|p3`: recorridos aceptados, con HTTP/audio aislados y evidencia separada.
- `node scripts/qa/premium-polish/read-only-real.mjs`: login y producto reales, sin interceptar API ni escrituras clínicas; hashes protegidos antes/después.
- `node scripts/qa/premium-polish/gates.mjs`: tests, lint, build e i18n; `evidence.mjs` verifica resultados y genera manifest/galería.

Preview propio 5182; stack compartido sin iniciar/reiniciar/detener. La emulación de safe areas/teclado en Chromium no acredita comportamiento nativo en iOS físico. Los 422/503 controlados y el aviso de desarrollo de Motion se registran aparte; no se presentan como consola global vacía. Lint/build mantienen avisos preexistentes. No hay push ni `tasks.md`.
