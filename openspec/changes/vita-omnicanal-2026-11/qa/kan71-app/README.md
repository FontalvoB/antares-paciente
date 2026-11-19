# KAN-71 6.6 · Adjuntos de Vita en la app

Validación del 19 de noviembre de 2026 (UTC). Implementación `ba7f4c6` sobre `c1abf0d`, rama `org/vita-app-attach`. El frontend se publicó en el [CloudFront de pruebas](https://d1rmzt4ao2pn78.cloudfront.net) con el perfil AWS `default` de la cuenta `933629770820`. El proxy de pruebas sirvió la API de producción.

Build final servido por CloudFront con `index-DdUfSOFA.js` e `index-BL_bQkp9.css`. Invalidación `IC58P8VSJB3IYPLXDEKRE9C9H3` completada.

## Contrato y decisiones

Se usaron `docs/modules/agents/vita.md` y `VitaAttachmentsController.cs` del backend `aa024aee`, con JWT de la aplicación `app`.

| Operación | Contrato usado |
| --- | --- |
| Subir | `POST /api/v1/vita/attachments` con multipart `file`, `threadId` y `language`. Respuesta `201` con ID, MIME, tamaño, páginas y vencimiento. |
| Conversar | `POST /api/v1/chat` con `attachmentIds` y `supportsVita: true`. El adaptador conserva el texto y avisa cuando `attachments[].readable` es `false`. El selector admite tres adjuntos para respetar el límite documentado del lector de Vita. |
| Guardar | `POST /api/v1/vita/attachments/{id}/archive` con `confirmed: true`, título y tipo clínico. Se aceptan `201` y el reintento idempotente `200`. |
| Quitar | `DELETE /api/v1/vita/attachments/{id}` antes de enviar; acepta `204`. El vencimiento en el servidor cubre las cargas interrumpidas cuyo ID no llega al cliente. |
| Consultar | `GET /api/v1/me/documents` en Historia clínica → Mis documentos. |

El clip era el único acceso al OCR. El menú conserva ese flujo como **Examen de laboratorio**, con su ruta `/api/v1/lab-exams` y su estado de revisión. Cámara, Fotos y Archivo usan los adjuntos de Vita. El OCR se activa al seleccionar la acción de laboratorio.

El catálogo clínico `/api/v1/documents/catalog` devolvió `403` para el paciente. El catálogo administrativo de tipos de identificación es independiente. Producción usa el tipo clínico verificado **Otro documento** (`OTHER`) para PDF, JPEG y PNG. Los entornos con JWT paciente deben configurar el UUID correspondiente en `VITE_VITA_GENERAL_DOCUMENT_TYPE_ID`.

## Validación

| Comando | Resultado |
| --- | --- |
| `npm run lint` | Código 0, con 27 advertencias del repositorio |
| `npm test` | 1.946 pruebas en 227 archivos, todas en verde |
| `npm run build` | Código 0 |
| `npm run i18n:check` | Código 0, sin claves faltantes y con paridad ES/EN |
| `npm run build:web:test` | Código 0 |

Las pruebas cubren multipart, errores de carga, cancelación con respuesta tardía, quitar del borrador, turno con IDs, legibilidad, consentimiento, selección de tipo y doble confirmación.

Playwright MCP inició sesión en la cuenta demo con `application=app`. Usó `vita-rag-52.pdf` (771 bytes, SHA-256 `038bc93b1cb4e7d8884825cf4dc27e534a2fb74d766e74d402998284e4c976ff`). Se verificó el recorrido contra la API sin interceptar respuestas.

1. La carga devolvió `201`. Quitar un adjunto pendiente devolvió `204`.
2. El mensaje salió con `supportsVita: true` y el ID del PDF. Vita devolvió `200`, `readable: true` y **13.7 g/dL**, citando «Hemograma Completo - Laboratorio Sintético QA» en español e inglés.
3. El adjunto del recorrido en español (`fd6e4d71-67b7-4453-820e-c042521690ee`) estaba ausente de `/api/v1/me/documents` antes de la confirmación. Cancelar el diálogo generó cero peticiones de archivo.
4. Confirmar una vez devolvió `201` con el mismo `documentId`. Una lectura posterior de Mis documentos devolvió `200` e incluyó ese ID. El registro quedó visible en ambas variantes de idioma.
5. En el build final se repitieron la carga, el turno y el diálogo en ES/EN. En 320, 390 y 430 px se comprobó que el borrador y el diálogo caben sin desplazamiento horizontal y que el título se muestra completo.

## Capturas de Playwright · 390 × 844

| Estado | Español | Inglés |
| --- | --- | --- |
| Adjunto en el borrador | [ES](es-390-adjunto.png) | [EN](en-390-adjunto.png) |
| Respuesta con cita | [ES](es-390-respuesta.png) | [EN](en-390-respuesta.png) |
| Confirmación | [ES](es-390-confirmacion.png) | [EN](en-390-confirmacion.png) |
| Documento en la historia clínica | [ES](es-390-expediente.png) | [EN](en-390-expediente.png) |

## Alcance

El historial remoto conserva el texto del turno. Los controles del adjunto pertenecen a la respuesta activa y se pierden al recargar. El documento confirmado sigue disponible en Mis documentos. La cámara se cubrió con una prueba de componente y el selector de archivos con Playwright. Falta validación en dispositivo nativo.

Se cerró el Chromium de Playwright y se comprobó la salida de su PID y sus procesos hijos. El PDF original quedó en su ruta.
