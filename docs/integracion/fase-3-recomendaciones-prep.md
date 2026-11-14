# Recomendaciones del nutricionista — preparación 3.18

Rama `org/f3-antares-paciente`, conservando como padre de esta entrega `2f85790`.
No se integra ni cambia de base con F2 o con el fix 2.24b.

## Contrato y límites

Se usa únicamente el DTO por ciclo congelado de `ARQUITECTURA.md` §7.2 del change
`organizar-experiencia-bienestar`:

```text
cycleNumber, startDate, endDate, publishedAt, professionalName, patientMessage,
attachments: [{ url, caption }]
```

El tipo público vive en `services/nutrition/nutrition-cycle-recommendation-types.ts`.
No incluye notas internas, borrador de IA, resumen interno, IDs de revisión ni
campos de edición. El componente solo selecciona explícitamente los campos públicos;
campos internos inesperados no se renderizan. El mensaje es texto, sin interpretar HTML.
Los nombres, mensajes y pies clínicos no pasan por el diccionario de la interfaz.

`NutritionPage` recibe opcionalmente `recommendation` y `recommendationsUnavailable`.
El bloque aparece en Plan después del contenido existente; también en la vista de
plan sin inscripción activa. Sin DTO o ante indisponibilidad no aparece el bloque,
y la pantalla conserva su plan, navegación y demás funciones. No hay un estado de
error global por recomendaciones ni texto clínico inventado.

No se crea consulta, servicio HTTP, bandera de activación ni consumo real de 3.10.
La app normal no proporciona estas props y no muestra datos de prueba. La fixture
está bajo `__tests__/fixtures/`; ningún módulo de producto la importa. La selección
del ciclo y el historial 3.19 quedan fuera de esta preparación. Al integrar 3.10 se
contrastarán ruta, envoltorio, nullabilidad y nombres reales del DTO con este contrato.

## Presentación

`NutritionRecommendations` compone IonCard e IonImg. Adapta la jerarquía de la vista
app del mockup oficial `mockups/referencia-claude-f3-nutricion/nutricion-notas-y-recomendaciones.html`
a los tokens del tema existente: título, profesional, ciclo/fechas, mensaje y adjuntos.
No se añade el historial ni los PDF del mockup: esta tarea prepara imágenes del DTO.

Las fechas visibles usan `dd/mm/aaaa`. La publicación usa la parte de fecha del
timestamp recibido, sin una conversión implícita de zona horaria. La URL firmada se
usa intacta; no se reconstruye ni se registra. Una imagen fallida conserva el mensaje
y el pie con «Imagen no disponible»; no se pide otra URL mientras no exista la integración.

## Verificación

- `NutritionRecommendations.test.tsx`: siete casos con fixture pública: contenido,
  ausencia, indisponibilidad, campos internos inesperados/HTML literal, imagen fallida,
  inglés y ausencia de adjuntos.
- `NutritionPage.test.tsx`: tres casos nuevos en Plan — publicadas, sin recomendaciones
  e IA/datos caídos; el resto del plan permanece disponible, sin mutaciones.
- Suite completa: **1645/1645 pruebas en 203 archivos**.
- Lint, build e i18n correctos; advertencias existentes de lint/tamaño de chunks y
  cero claves faltantes. `git diff --check` correcto.
- Vista aislada del componente real con fixture en Playwright MCP, sin desbordamiento
  a 320/390/768 px. Imagen de fixture servida localmente; sin tráfico al API de negocio,
  sin consumo real ni e2e. Captura en OpenSpec `revision-3.18-prep/recomendaciones.png`.
  El navegador bloquea el WebSocket HMR de Vite; no se presenta como fallo de la API.

La integración y el e2e esperan backend 3.10 y un despacho posterior. No se modifica
`tasks.md`, no se publica la app y no se hace push.
