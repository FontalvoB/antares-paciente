# Ronda única de pulido v9

Alcance: cuerpo v8 → v9, camiseta v2 → v3, dos cabellos conservados con mayor cobertura de nuca, optimización de los mismos accesorios. Sin categorías, personajes, animaciones, dependencias o cambios de lógica nuevos.

Conservar rig canónico (51 huesos), Actions Idle y RigCheck, nueve nombres de morphs, materiales corporales y UV. Probar reducción corporal inicial a ~14.4k triángulos mediante copia + transferencia baricéntrica de Shape Keys; aceptar solo tras auditoría de superficies, rostro/manos y movimiento. Fuentes actuales protegidas hasta validar.

Camiseta: cuello redondo con banda de tejido de ~10 mm y grosor ~2 mm; dobladillos de mangas/inferior de ~8 mm; costuras discretas. Superficie más suave y holgura, especialmente BodyVolume. Objetivo ~3–5k triángulos sin simulación en ejecución. Cabello lateral/rizado mantienen identidad y amplían cobertura posterior ~20 mm, transición limpia con orejas. Accesorios conservan diseño, menos segmentos redundantes.

Cámaras/luces de inspección existentes: frontal, perfil, 3/4. Altura corporal 1.70 m, Z arriba en Blender. Comparaciones con misma cámara y frame. Revisar silueta antes de detalle. Validación: cada morph, volumen 0/.25/.5/.75/1 + lean, múltiples frames Idle; comprobar export/import, loop, referencias y navegador.

Limpieza: inventario completo y referencias textuales/binarias/fuentes antes de eliminar. Mantener fuentes irreemplazables y archivos aún referenciados. Retirar Hair01 del catálogo y documentación activa antes de eliminar sus exports. Registrar todas las decisiones y rutas.
