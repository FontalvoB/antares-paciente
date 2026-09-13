# Diagnóstico de codo — NO APROBADO PARA EXPORTAR

Base abierta: sources/male-body-base-v3/male-body-base-v3.blend. Archivos originales v3, v4 y v5 intactos. Sin cambios en aplicación.

Causa reproducida: la rotación axial de ForeArm cercana a 78 grados produce una protuberancia/compresión visible en la transición del codo, incluso en A-pose sin Idle. La prueba de 15 grados conserva mucho mejor la silueta. Por tanto, no es únicamente la flexión frontal. Jerarquía y continuidad de Arm -> ForeArm -> Hand coherentes en ambos lados; no se detectó un enlace roto. No se ha demostrado un defecto de orientación del skeleton.

Los pesos de v3 presentan variación alrededor de la articulación. Se probaron suavizado de vecindad y una transición longitudinal local (340 vértices izquierda, 329 derecha, exclusivamente pesos Arm/ForeArm, máximo 4 influencias). Ninguna prueba eliminó satisfactoriamente el defecto. Ambas fueron revertidas: pesos originales restaurados y verificados. Esa variación por sí sola no demuestra que los pesos sean la causa única.

Prueba adicional: repartir la torsión entre Arm y ForeArm reduce la concentración del giro en el codo, pero la variante con mayor rotación proximal altera la silueta del hombro. Preserve Volume se ensayó solo como diagnóstico y fue desactivado de nuevo; no resolvió suficientemente la silueta.

Validación estática: frontal, perfil, 3/4 y primeros planos de ambos brazos. Codo/antebrazo: no aprobados; persiste una transición de silueta no satisfactoria. Hombro: no aprobado en la variante de torsión proximal. Manos: palmas hacia el cuerpo y dedos relajados, pero espacio insuficiente al muslo en los morphs de mayor volumen. Perfil: flexión pequeña, sin traslado global arbitrario. La ausencia de cruces en base no significa una deformación anatómica correcta.

Comprobación regional BVH estática de brazos/manos contra cuerpo: base 0 pares, intermedio 53 pares, BodyVolume=1 272 pares, BodyLean=1 0 pares. Son pares de triángulos, no número de penetraciones independientes.

Idle: no modificado ni adaptado. Animación desactivada durante todas las pruebas. No se creó un nuevo GLB ni una nueva v4. Malla, coordenadas, morphs, skeleton, materiales y texturas no editados.

Conclusión: no hay una solución validada dentro de estas pruebas. No se ha demostrado que sea imprescindible remodelar; tampoco corresponde prometer que otro ajuste de rotación lo arreglará. El componente que requiere trabajo especializado es la deformación de la transición Arm/ForeArm ante torsión axial, considerando también la unión Shoulder/Arm. No forzar otro asset hasta resolver y validar esa transición estáticamente.

El editable diagnostic-static-NOT-APPROVED.blend conserva el experimento fallido para inspección. No es un avatar de entrega. La sesión termina en v3 neutral sin sobrescribir su archivo.
