# KAN-175 · Resumen de mercadeo ES/EN

**Borrador para aprobación legal.** Sustituye el resumen anterior cuando los textos se aprueben y el build de lanzamiento confirme las funciones incluidas. Las capturas y el copy de tiendas deben contar la misma historia. [KAN-175 y decisiones de alcance](https://diomedescerda.atlassian.net/browse/KAN-175?focusedCommentId=10076)

## Texto de campaña

**ES · Una rutina de bienestar para tu objetivo**

Elige un objetivo y sigue una rutina con sugerencias de ejercicio y alimentación. Registra tus actividades y consulta tu progreso día a día. Agentic Wellness IA ofrece orientación general de bienestar. Consulta a un profesional si tienes dudas sobre qué rutina es adecuada para ti.

**EN · A wellness routine for your goal**

Choose a goal and follow a routine with movement and meal suggestions. Log your activities and see your progress day by day. Agentic Wellness IA offers general wellness guidance. Consult a professional if you have questions about which routine is right for you.

## Matriz de respaldo

La columna «promesa anterior» recoge las diferencias identificadas en Jira. No se debe interpretar como un inventario exhaustivo de todos los canales históricos.

| Función | Especificación o decisión | Implementación / evidencia | Promesa anterior → texto candidato | Aprobación de publicación |
| --- | --- | --- | --- | --- |
| Objetivo, ejercicio, alimentación y registro diario | v5.1 §5.2–5.5, v5.2 §§1, 5 | [Objetivo](../../src/features/wellness/goal/WellnessGoalPage.tsx), [ejercicio](../../src/features/wellness/exercise/WellnessExercise.tsx), [alimentación](../../src/features/wellness/nutrition/WellnessDiet.tsx), [protocolo](../../src/features/wellness/protocol/WellnessProtocol.tsx). | El texto candidato solo promete elección de objetivo, sugerencias y seguimiento. | Legal y verificación del build. La aprobación de Definición no cubre otros objetivos ni los textos. |
| Alertas automáticas a familiares por frecuencia cardíaca o presión | Fuera de v1 según [KAN-114](https://diomedescerda.atlassian.net/browse/KAN-114?focusedCommentId=10073), que corrige v5.1 §2.3. | El [flujo SOS](../kan/HANDOFF-PRODUCCION-DIOMEDES.md#navegación-v51-cierre-del-día-y-sos) es iniciado por la persona y requiere confirmación. | Alerta automática → omitir. No sustituir por promesas de vigilancia o respuesta. | Exclusión de v1 ya decidida. No publicar umbrales. |
| GPS | v5.1 §5.10, ligado al SOS iniciado por la persona. | [Prueba de aviso de ubicación](../../e2e/sos-location-disclosure.mjs). No acredita entrega de la alerta en producción. | GPS sin contexto → omitir de campaña. No afirmar seguimiento continuo. | No hay autorización para ampliar la función. |
| Agente de WhatsApp | [KAN-179](https://diomedescerda.atlassian.net/browse/KAN-179) separado y pendiente. | Un canal de contacto no acredita agente ni recordatorios. | Agente y recordatorios por WhatsApp → omitir. | Pendiente. |
| Medicamentos y recordatorios | v5.1 §§2.2 y 7.2 conserva el módulo existente. [KAN-114](https://diomedescerda.atlassian.net/browse/KAN-114?focusedCommentId=10069) distingue recordatorio y registro. | El legado no demuestra alcance final, permisos ni entrega en los builds de v1. | Recordatorios de pastillas → omitir de la campaña de v1. | Sin validación de alcance y producción. |
| Registro por foto | v5.1 §§5.5 y 7.1 contempla foto para un registro de comida. No equivale a capturar cualquier registro con una foto. | [Cliente FoodAI](../../src/utils/foodAiApi.ts) y [autorización por alcance](../LEGAL_CONSENTS_CLIENT.md). | Registro general por foto → omitir. | Confirmar proveedor, consentimiento y función real del build antes de recuperar un claim específico. |
| Apple Health | [KAN-114](https://diomedescerda.atlassian.net/browse/KAN-114?focusedCommentId=10073) fija sincronización desde iOS, no nube genérica ni agregador externo. | [Plugin iOS](../../ios/App/App/WellnessHealthPlugin.swift). La presencia del plugin no acredita el flujo nativo del build. | Sincronización «vía nube» → omitir. Si se aprueba después de QA, describir solo iOS con permiso. | Validación de dispositivo, disponibilidad y privacidad pendiente. |
| Pago y membresía | [KAN-116](https://diomedescerda.atlassian.net/browse/KAN-116) y [KAN-114](https://diomedescerda.atlassian.net/browse/KAN-114?focusedCommentId=10073) documentan la simulación web, no cobro en producción. | [KAN-58](https://diomedescerda.atlassian.net/browse/KAN-58) separa la pasarela real. | Checkout activo, trial, precio o renovación → omitir mientras no se validen. | Revisar términos, precios, renovaciones, cancelación y funcionamiento en el canal real antes de anunciarlos. |
| Privacidad, retención y borrado | Decisión registrada en [KAN-114](https://diomedescerda.atlassian.net/browse/KAN-114?focusedCommentId=10073). | [Flujo de solicitud](../../src/features/wellness/privacy/ServerPrivacyRequests.tsx). Una solicitud no acredita el borrado ni sus plazos. | No prometer borrado inmediato o total. | Privacidad revisa los textos que correspondan al flujo aprobado y verificado. |
| Resultados y testimonios | v5.1 §9, v5.2 §7. | La app propone hábitos y registra actividades. No demuestra resultados individuales. | No incluir garantías, plazos de resultado ni testimonios sin respaldo. | Legal aprueba el copy final. |

Para cerrar, cotejar cada frase ES/EN y las capturas contra esta matriz, archivar la versión autorizada por legal y confirmar que la publicada es esa misma versión. Las fichas de tienda son un [borrador separado](stores.md).
