# Revisión legal y profesional · entrega de evidencia

## KAN-168 · Revisión legal de EE. UU.

Entregar al abogado de salud digital los builds de lanzamiento, textos ES/EN de la app, permisos, marketing y tiendas, versiones públicas de Términos y Privacidad, pantallas de alta y compra, política de reembolsos/cancelación y un inventario de datos por proveedor. Incluir la [matriz de mercadeo](marketing.md) y el [inventario de tiendas](stores.md). Identificar para cada evidencia el build, idioma, URL o pantalla y fecha. [KAN-168](https://diomedescerda.atlassian.net/browse/KAN-168)

| Pregunta que debe resolver el memorando | Evidencia para la revisión |
| --- | --- |
| ¿El posicionamiento y las funciones corresponden a bienestar general? | Flujos de meta, ejercicio, alimentación, mediciones, SOS y respuestas de Vita. Resaltar diferencias entre v5.1 y decisiones posteriores y mostrar los avisos finales por idioma. [FDA General Wellness](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices) |
| ¿Los claims de resultados, el precio y las renovaciones se pueden publicar? | Cada claim con su respaldo, testimonios propuestos, y capturas del flujo real con total, cadencia, renovación, cancelación y reembolso, si aplica. Identificar el simulador como tal. [FTC Health Products Compliance Guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance) |
| ¿Qué reglas sobre datos aplican y cómo se implementan? | Mercados y roles, datos reales por finalidad, decisiones sobre retención, accesos, pruebas de autorización/reaceptación, exportación y borrado, y acuerdos con proveedores. Pedir criterio para WA, NV, CT y Colombia (Ley 1581/2012) si aplica, sin presumir jurisdicción. [Washington Attorney General](https://www.atg.wa.gov/protecting-washingtonians-personal-health-data-and-privacy) |
| ¿El alcance de nutrición o acompañamiento requiere límites adicionales en determinados mercados? | Rutas de alto y bajo riesgo, PAR-Q/NQS, mensajes de derivación y roles. Verificar qué acceso real tiene cada usuario y cómo se presenta a quienes revisan contenido. |
| ¿Los documentos, avisos de IA y las declaraciones de tienda describen el mismo producto? | Versiones públicas ES/EN, capturas de permisos, flujos de voz/foto/chat con y sin autorización, destinatarios y registros de las consolas. [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) · [Google Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en) |

Para el cierre, registrar enlace al memorando firmado, jurisdicciones y versión revisadas, cada corrección con su PR o publicación y una comprobación posterior en ambos idiomas. No tratar este inventario ni una aprobación técnica como el memorando o la autorización de lanzamiento.

## KAN-174 · Revisión profesional del contenido

**Definición ya aprobada, fuera de alcance.** La decisión del 24 de noviembre no aprueba bajar de peso, ganar masa ni el contenido restante por extensión. [KAN-174](https://diomedescerda.atlassian.net/browse/KAN-174) · [KAN-114](https://diomedescerda.atlassian.net/browse/KAN-114?focusedCommentId=10073)

| Lote para revisión | Evidencia que debe acompañarlo |
| --- | --- |
| Ejercicios | Catálogo y versión de reglas, dosis/progresiones, excepciones y textos ES/EN de pausas y contraindicaciones. Adjuntar ejemplos reproducibles del motor, no perfiles reales. |
| Alimentación para bajar y masa | Catálogo y versión de planes, pisos, macros, bandas, sustituciones, ejemplos reproducibles y textos de orientación ES/EN. |
| PAR-Q/NQS y derivación | Preguntas y versión, condiciones de bloqueo y mensajes, en los dos idiomas. Adjuntar pruebas de ingreso normal, derivación y ausencia de aprobación vigente. |

El registro del contenido necesita alcance explícito, versión del contenido/reglas, referencia a ejemplos y evidencia, profesional, licencia y jurisdicción, fecha, vigencia, decisión y enlace a la aprobación firmada. No copiar datos de una persona o una aprobación de otro alcance. Si cambian las reglas, un catálogo o los textos que forman parte de un lote aprobado, enviar el nuevo lote a revisión y comprobar el aviso hasta que exista una aprobación vigente para esa versión.

**Brecha de implementación.** En el backend inspeccionado, [`Motor365ProfessionalReview`](https://github.com/LFDIAZDEV2209/agenticwellness-back/blob/5d40dc98/src/CoppAddresd.Domain/Wellness365/Motor365ProfessionalReview.cs) modela decisiones sobre el envío PAR-Q/NQS de una persona. No incluye licencia, vigencia ni versión del contenido. El almacén la consulta para decidir si el envío individual fue aprobado. No crear registros en esa tabla como sustituto de la aprobación de contenido. Coordinar con [KAN-149](https://diomedescerda.atlassian.net/browse/KAN-149) cómo persistir y auditar una aprobación de contenido versionada sin alterar las decisiones de una persona.

Para el cierre, demostrar con versiones de prueba que ERP muestra revisor, vigencia, alcance y estado del contenido, y que la app muestra el aviso de contenido pendiente cuando falta la aprobación, caduca o la versión cambia. Repetir el caso con aprobación vigente. Registrar las firmas reales en el sistema autorizado después de validar el recorrido.
