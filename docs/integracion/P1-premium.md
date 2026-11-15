# Fase 1 · Bienestar premium APP

Implementa la fase 1 de `DISENO-BIENESTAR-PREMIUM.md`, tomando las propuestas PNG como referencia visual y contrastándolas con el HTML y las páginas 2, 4 y 6 del PDF. Base anterior: `20057df`. 4.11 permanece pausada y sus dos archivos de preparación quedan fuera de este commit.

## Resultado

- Tokens compartidos de superficies, colores, radios, sombras y movimiento. Fondo azul vertical sin puntos en el shell; se conservan Inter, Space Grotesk y Sora.
- Barra Ionic con Inicio, Nutrición, Vita, Chat y Perfil. Vita llama al acceso de voz existente; SOS conserva `openPanic` en un botón separado. Se mantienen el contador de chat, los flags de citas y la navegación por estado.
- Nutrición mantiene Hoy, Semana, Plan e Historial visibles. Hoy presenta hero compacto, balance, macros con metas reales y comidas; conserva agua, cámara, galería, registros, edición y confirmación del protocolo.
- Plan presenta días con fechas del ciclo y acordeones Ionic: receta, porciones, macros, agua e indicaciones. El primer menú configurado abre inicialmente. Registro manual y Foto IA reutilizan los flujos existentes, habilitados solo para hoy. Las metas completas, restricciones, recomendaciones publicadas y ciclos anteriores siguen accesibles.
- Historial presenta indicadores, consumo con chips, peso y mediciones recientes expandibles. La antigüedad de la última medición se calcula con la fecha del snapshot; la tabla ordena una copia de la serie. No se interpreta una subida o bajada como una mejora clínica.
- Aviso completo ES/EN en hoja Ionic, lectura por cuenta y versión, reapertura desde el banner, foco atrapado, Escape, cierre y arrastre. Animación nativa de 280 ms; acordeones de 220 ms y progreso de 600 ms. Reducción de movimiento, foco visible, objetivos táctiles de 44 px, nombres de progreso y `html.lang` sincronizado. Se permite zoom en el viewport.

## Contratos y límites

No se modifican servicios, DTO, rutas, payloads, autorizaciones ni dependencias. Se mantienen los estados de carga, ausencia de datos, fallo, preparación del plan, revisiones y errores de publicación. Las pruebas existentes de registro, hidratación offline, fuentes de ingesta y recomendaciones siguen pasando.

El contrato de ingestas solo entrega hoy y no incluye una referencia de plan por registro: se muestran «Registros disponibles de hoy» y los valores persistidos. No se añade un botón inerte de días anteriores ni un badge `Plan 557` inventado. «Ver todas las mediciones» expande la serie ya recibida. El texto clínico libre mantiene el idioma del contrato; se traduce la interfaz y se utiliza `notesEn` cuando existe.

## Evidencia

Directorio acordado del workspace: [`revision-app-premium`](../../../../openspec/changes/organizar-experiencia-bienestar/revision-app-premium/index.html). El [manifest versionado](P1-premium-evidencia.json) contiene dimensiones físicas y SHA-256 de cada captura, matriz de recorridos y hashes protegidos.

| Pasada | Datos y alcance | Evidencia |
| --- | --- | --- |
| Antes | Código `20057df` extraído con `git archive`, mismo DTO controlado | 18 capturas: Hoy/Plan/Historial × 320/390/1440 × ES/EN |
| Después | Componentes y cliente reales con fixture aislada; sin escrituras al stack | 42 capturas: comparación, aviso, indicadores/ingestas, peso y movimiento reducido |
| Runtime | Login y producto completos, paciente QA propio de 4.10; Auth/Gateway/API reales, sin interceptar rutas | 18 vistas; cero errores JS y cero mutaciones clínicas |

Las capturas adicionales con mediciones contienen datos ilustrativos explícitos. No se presentan como evidencia de registros clínicos reales. El runner verifica el ancho físico del PNG y el viewport, además del desbordamiento horizontal; el harness heredado fijaba 390 px y fue corregido antes de producir la evidencia definitiva.

Playwright comprueba en las seis combinaciones: acordeones, selección de otro día con registro deshabilitado, retorno a hoy, apertura/cancelación del registro manual, aviso con Tab/Escape y arrastre, lectura persistida, callbacks Vita/SOS aislados, reducción de movimiento, idioma del documento y objetivos táctiles. En runtime no se activa SOS ni se envían comandos de voz.

Gates: **1.704/1.704 tests, 209 archivos; lint sin errores; build correcto; i18n con cero claves faltantes**. Persisten los warnings previos de lint y del chunk mayor de 1.300 kB. Los recuentos exactos están en el manifest.

Los dos pacientes protegidos permanecen iguales antes/después: 34 ingestas (incluidos los 33 registros R7), 2 cierres publicados y 4 planes publicados. El auditor abre una transacción de solo lectura. No se consume el noveno test de 4.11, no se aplica ninguna sugerencia y no se publican recursos.

## Reproducción local

Usar previews propios en background con `Start-Process -WindowStyle Hidden`; comprobar PID y ruta antes de cerrarlos. No arrancar ni parar el stack compartido.

1. Preview actual: Vite con `scripts/qa/premium-nutrition/vite.config.mts`, modo development, host `127.0.0.1`, puerto `5182`, `--strictPort`.
2. Extraer `git archive 20057df src public index.html package.json tsconfig.json tsconfig.app.json tsconfig.node.json` en `.artifacts/premium-baseline`; preview de esa raíz con `vite-baseline.config.mts`, puerto propio `5194`.
3. `PREMIUM_ORIGIN=http://127.0.0.1:5194 node scripts/qa/premium-nutrition/run.mjs before`.
4. `node scripts/qa/premium-nutrition/run.mjs after`.
5. `node scripts/qa/premium-nutrition/read-only-real.mjs` usa la cuenta QA ya preparada de 4.10 y lee su contraseña desde Windows Credential Manager, en memoria. Requiere el helper local `.ai/operations/organizar-experiencia-bienestar/3.20-fixture-helper.py`; no crea cuentas ni restablece fixtures.
6. Ejecutar `npm test`, `npm run lint`, `npm run build`, `npm run i18n:check`; los runners de esta entrega guardaron sus logs/resúmenes bajo `.artifacts/premium-*`. `node scripts/qa/premium-nutrition/evidence.mjs` valida y genera índice/manifest.

Solo P1 está implementada. No se rediseñan aún ejercicio, nutracéutico, evaluación emocional, podcasts ni chat. Sin push, sin `tasks.md` y sin intervención sobre servicios compartidos.
