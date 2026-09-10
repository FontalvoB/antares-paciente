# male-body-base-v2

Primera base corporal editable: malla neutra + 51 huesos canónicos reutilizados + nueve morph targets + Idle. Los tres archivos originales male-base permanecen intactos.

## Archivos

- ../../bodies/male-body-base-v2.glb: cuerpo, morphs, skeleton, materiales y acción Idle.
- male-body-base-v2.blend: fuente editable autocontenida; incluye Idle, RigCheck y MORPH_TARGETS_V2.md.
- ../../animations/idle.glb: Idle separada, mismo skeleton.
- morph-targets.json: zonas, rangos, combinaciones y preparación para ropa.
- validation.json: métricas y comprobaciones.
- qa/glb-neutral.png, qa/glb-larger.png, qa/glb-intermediate.png, qa/glb-lean.png: evidencia final obtenida del GLB reimportado. qa/iterations contiene revisiones intermedias, no el resultado final.

## Controles corporales

Basis es neutro. Nueve targets aditivos, todos con rango 0–1: BodyVolume, BodyLean, Abdomen, Waist, Chest, Arms, Thighs, FaceVolume y MuscleDefinition. No dependen del orden de aplicación.

Estados: neutro = todos a cero; mayor volumen = BodyVolume 1; intermedio = BodyVolume 0.5; menor volumen = BodyLean 1. BodyVolume y BodyLean son alternativas: uno debe permanecer en cero. Para combinar ajustes regionales con BodyVolume=g, limitar cada ajuste regional a 1−0.75g. MuscleDefinition se recomienda con BodyVolume=0. Las combinaciones fuera de esta envolvente no están validadas.

En Blender, seleccionar la malla y usar Object Data Properties > Shape Keys. Para comprobar la A-pose, poner el armature en Rest Position; volver a Pose Position para Idle. Idle no contiene pistas de pesos de morph: estos siguen siendo controlables durante la reproducción.

## Animaciones

Idle es funcional: 5 segundos, 30 FPS, frames 1–151. Respiración leve, pequeños ajustes de cabeza/torso, brazos relajados y palmas orientadas hacia dentro. Pies y Hips estables, sin desplazamiento ni escalado corporal mediante huesos. Primer y último estado idénticos y tangentes del ciclo igualadas.

RigCheck se conserva como acción técnica en la fuente y en el archivo original. Al cambiar a RigCheck en Blender, restablecer los canales no animados a la pose de referencia antes de reproducirla. No se generaron Walk, Run ni otras acciones funcionales.

## Calidad y validación

23.924 triángulos; 1 material PBR; 3 texturas embebidas 1024×1024; 1 draw call; GLB 3.921.396 bytes. 51 huesos, mismo bind pose y pesos que male-base, máximo 4 influencias por vértice.

Malla cerrada sin aristas no manifold. Pasaron 42 comprobaciones de morphs, 20 poses de RigCheck y los 604 fotogramas de Idle en cuatro estados corporales, sin intersecciones detectadas. El ciclo cierra exactamente. Comparación GLB/Blender en cinco estados y tres momentos: error máximo inferior a 0,002 mm. Fuente reabierta como biblioteca para verificar morphs, huesos, acciones y texturas empaquetadas.

Se suavizó la musculatura de la base y se corrigieron axilas, pequeñas caras y huecos posteriores de rodilla. No se modificaron los huesos ni los pesos.

## Alcance y siguiente tarea

La representación es visual, no una medición clínica ni una conversión de kilos a geometría. La ropa interior neutra sigue integrada en la base. No se creó ropa: las prendas futuras necesitan su propia topología y targets equivalentes, además del mismo skeleton; estrategia detallada dentro del .blend y en morph-targets.json.

El rendimiento real de Three.js/móvil (FPS, GPU, memoria y carga) queda pendiente. La importación en Blender no sustituye esas métricas. Siguiente tarea: integración aislada para controlar los morphs y reproducir Idle, medir en dispositivos y validar el rango visual con el producto. No se tocó código de aplicación ni se instalaron dependencias.
