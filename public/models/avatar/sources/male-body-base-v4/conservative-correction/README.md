# Corrección conservadora desde v3

Base editable y geometría GLB: male-body-base-v3. V3 permanece intacta. Copias anteriores en conservative-correction/before-* y checkpoint.blend.

Solo pose/curvas de brazos y manos. Movimiento corporal, respiración y desfases del Idle anterior conservados. Idle: 8 s, 30 FPS, 241 muestras con extremo duplicado. RigCheck conservado.

Brazo superior apenas retrasado; codo flexionado, antebrazo ligeramente hacia dentro (más sutil a izquierda). Palma hacia el cuerpo, dedos suavemente flexionados y pulgar recogido. Muñeca ajustada 5 grados para despejar el muslo. La separación frontal de los codos sigue siendo perceptible: es el compromiso elegido para evitar penetraciones con BodyVolume=1 usando una única animación sin cambiar geometría ni morphs.

Validación: frontal, perfil y 3/4 en PNG. Base, BodyVolume=1, BodyVolume=.5, BodyLean=1: 241 fotogramas por estado, cero contactos detectados por BVH entre regiones de brazos/manos y cuerpo. No es una certificación exhaustiva de todas las superficies internas. Pies fijos y seam=0. Amplitud lateral de manos pico a pico: 14.13 mm izquierda, 17.41 mm derecha. Reimportación GLB: 20 muestras, error máximo 0.00237 mm respecto a Blender.

GLB: 4,286,264 bytes; 51 huesos; secciones estáticas y bytes de v3 conservados. Informes JSON adjuntos. No se cambió código de aplicación ni su URL de carga; esta corrección debe revisarse abriendo el nuevo v4. RigCheck en Blender usa rotaciones quaternion; Idle usa XYZ.
