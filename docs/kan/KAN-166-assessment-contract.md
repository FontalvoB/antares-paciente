# KAN-166 · Contrato de baterías progresivas

Documento de implementación para revisión. **No es el cuestionario aprobado** y no cambia la app. La especificación v5.1 §5.4 y el anexo A identifican 27 preguntas por tema, pero remiten a `bateria-inicial-copp-adresd.html` para los textos y respuestas completos ES/EN. Esa referencia no estaba disponible al preparar este contrato.

[KAN-166 y decisión de producto](https://diomedescerda.atlassian.net/browse/KAN-166?focusedCommentId=10075) · [Contrato actual de preguntas PAR-Q y NQS](../../src/features/wellness/domain/questions.ts) · [Formulario actual](../../src/features/wellness/domain/types.ts)

## Temas que debe cubrir el catálogo

| Batería | Cantidad | Temas del anexo A |
| --- | --- | --- |
| Seguridad y salud | 5 | Condiciones comunicadas, medicación diaria, dolor torácico o mareo con actividad, articulaciones, embarazo o indicación de no ejercitarse |
| Capacidad física | 4 | Caminar diez minutos, subir un piso, levantarse cinco veces de una silla, días de actividad por semana |
| Alimentación | 4 | Consumo de frutas y verduras, comida asociada a emociones, bebidas azucaradas y ultraprocesados, agua |
| Sueño | 3 | Horas, descanso al despertar, ronquidos o somnolencia |
| Constancia | 4 | Tiempo disponible, motivación, confianza, reacción ante un día fallido |
| Estrés y apoyo | 3 | Nivel de estrés, efecto en la comida, red de apoyo |
| Mi objetivo y medidas | 4 | Objetivo, medidas, meta de peso y motivo |

## Evitar preguntas duplicadas

- PAR-Q (7) y NQS (6) siguen siendo la compuerta de generación del plan. Una respuesta opcional no modifica ni reemplaza una respuesta de seguridad.
- Objetivo y meta de peso tienen candidatos de reutilización directa en `goal` y `targetWeightKg`. Confirmar las unidades y qué medidas pide exactamente la pregunta original antes de reutilizar `heightCm`, `weightKg` o `waistCm`. El formulario no captura el motivo y su escala de nivel de actividad no equivale a un número de días.
- Una equivalencia de seguridad requiere mismo significado, mismo alcance, opciones compatibles y revisión explícita de la versión. Por ejemplo, `parq-medication` pregunta solo por ciertos medicamentos, no por toda medicación diaria. Un «no» allí no responde la pregunta más amplia. `nqs-pregnancy` incluye lactancia y tampoco equivale por sí solo al tema combinado del anexo A.
- Una respuesta propia o reutilizada tiene un único identificador por versión. Un registro reutilizado conserva referencia a su fuente sin copiar textos clínicos ni inferir respuestas de combinaciones no aprobadas. La pantalla informa el origen y envía a la fuente para corregir si pertenece a la compuerta.

## Comportamiento verificable

- El mismo servidor autorizado por cuenta calcula el avance que leen Inicio, Perfil y Vita. Cada respuesta queda guardada inmediatamente y en reintentos no crea otro registro para la misma pregunta. Una corrección conserva el historial y actualiza el estado vigente.
- Guardar la versión del catálogo, ID de pregunta, canal `manual` o `ia` cuando corresponda, y referencia al origen para respuestas reutilizadas. No incluir respuestas crudas ni identificadores en telemetría o prompts de terceros. La selección de preguntas pendientes puede hacerse sin que un proveedor reciba las respuestas.
- Vita propone entre una y tres preguntas pendientes. Posponer no modifica el avance, no vuelve a preguntar en la misma sesión y permite continuar otro día. La tarjeta de Inicio abre la siguiente batería y desaparece al completar la séptima. Perfil conserva los resultados y la opción de corregir.
- La carga, un error de red y cualquier batería incompleta no bloquean Inicio o el protocolo. El flujo de seguridad del plan mantiene sus condiciones existentes.

## Pruebas de aceptación previstas

| Recorrido | Resultado |
| --- | --- |
| PAR-Q y NQS completos con una equivalencia aprobada | El plan utiliza la compuerta existente y la pregunta equivalente no se vuelve a presentar |
| Usuario abre Inicio con baterías pendientes y pospone en Vita | Puede abrir el protocolo y después continuar la batería desde Perfil sin perder respuestas |
| Respuesta manual, reintento y corrección en Perfil | El avance y la siguiente pregunta coinciden en Inicio, Perfil y Vita. Una pregunta respondida no reaparece en la sesión |
| Finalizar la última batería | Inicio oculta la tarjeta, Perfil conserva los siete resultados y Vita no propone más preguntas |
| Cambio de cuenta o versión, y recorrido ES/EN | No se comparten respuestas entre cuentas. Ambas traducciones usan los mismos IDs, opciones y reglas |

**Pendiente para implementar el catálogo definitivo:** recuperar el prototipo original o aprobar un catálogo de reemplazo con texto y opciones ES/EN y la tabla de equivalencias de seguridad. No inferir criterio clínico ni tratar los temas enumerados como preguntas listas para producción.
