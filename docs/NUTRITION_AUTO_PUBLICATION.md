# Publicación automática del plan nutricional (KAN-61)

El plan generado con las evaluaciones requeridas pasa directamente a publicado,
sin aprobación obligatoria de nutricionista. El servidor valida el contenido y
conserva ciclo, vigencia, versiones y bitácora. Los fallos o planes incompletos no
se presentan como disponibles. El flujo anterior se conserva por compatibilidad.

La app consulta el plan publicado y su estado. Muestra el aviso completo solicitado
al principio de Nutrición, además del ciclo y sus comidas, incluso si falta el
snapshot separado del programa. Los textos de preparación y Chat se refieren a
publicación. No hay un nuevo botón de aceptación ni un paso de aprobación.

El cambio requiere backend, ERP y app compatibles. No incluye los cambios de
listado inicial de baterías (KAN-62), bienvenida (KAN-15), color de propósito
(KAN-8) ni captura de signos vitales SOS (KAN-65). El backend sí necesita validar
los requeridos del catálogo para decidir si puede publicar el plan.

`e2e/nutrition-auto-publication.mjs` usa la UI real con HTTP sintético para verificar
plan disponible sin snapshot y preparación sin aprobación. Ejecutar contra el
servidor local mediante `COP_E2E_APP_URL`; `COP_E2E_OUTPUT` opcional guarda evidencia
fuera del repositorio. Las pruebas de UI no sustituyen la aceptación de una cuenta
real, iPhone o WhatsApp.
