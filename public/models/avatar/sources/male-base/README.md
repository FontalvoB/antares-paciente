# male-base — Fase 1

Cuerpo masculino base generado con Higgsfield/Tripo y preparado en Blender.

- Runtime: ../../bodies/male-base.glb
- Fuente editable: male-base.blend
- Clip de prueba: ../../animations/rig-check.glb (RigCheck, 2 s, 30 fps, sin root motion).
- 23.924 triángulos, 1 material PBR, 3 texturas 1024 × 1024 embebidas, 1 draw call.
- Altura 1,70 m; GLB +Y arriba, frente -Z; origen en los pies.
- 51 huesos; raíz Hips y jerarquía canónica del documento 16; A-pose de referencia.
- Hasta 4 pesos normalizados por vértice; ninguna zona sin skinning.
- Cabello y ropa intercambiables se crearán en tareas posteriores. Boxer neutro integrado en la base.

## Validación

Malla cerrada sin aristas no manifold. GLB y clip reimportados en Blender a 30 fps; deformación comparada en cinco momentos, error máximo inferior a 0,01 mm. Ver validation.json y las imágenes glb-reimport.png / glb-rig-check.png.

El servicio Higgsfield de rigging falló sin detalle del proveedor; rig creado y ajustado en Blender. La topología final es triangulada; las deformaciones extremas y el rendimiento en dispositivos reales quedan por medir. El clip es de diagnóstico, no una animación idle para producción.

## Próxima tarea

Validar carga, AnimationMixer y rendimiento en Three.js/dispositivo real. Usar este skeleton como referencia para las futuras prendas y cabello. Ningún archivo de aplicación ni dependencia fue modificado en esta fase.
