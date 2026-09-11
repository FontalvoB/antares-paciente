# Idle v4 — 2026-09-11

Entrega exclusiva de animación: `bodies/male-body-base-v4.glb` y este directorio `male-body-base-v4.blend`. El editable contiene las Actions Idle y RigCheck. Se conservan GLB y .blend v3 y el clip animations/idle-v3.glb. animations/idle-v4.glb contiene el nuevo clip y animations/idle.glb se actualizó después de verificarlo.

## Movimiento

10 segundos a 30 FPS, frames 1–301 con extremo duplicado para loop. Más variación lenta e independiente en hombros, brazos, antebrazos y codos; muñecas con flexión, inclinación y giro suaves. Dedos con flexión leve de reposo y apertura/cierre parcial desfasado entre segmentos, dedos y lados. Dos respiraciones por ciclo, expansión local animada del pecho, balanceo del torso y pequeños movimientos de cuello/cabeza. No se creó sistema de mirada.

La transferencia de peso se expresa mediante balanceo del torso sobre apoyos fijos. Hips, piernas y pies no se desplazan. No hay root motion ni cambios del rig de reposo. Frente a v3, el recorrido lateral de la mano izquierda pasa de 45 a 63 mm y el de la derecha de 49 a 90 mm a lo largo de un ciclo más lento. No son desplazamientos por frame.

## Validación

- 301 frames por cada estado: base, BodyVolume=1, BodyVolume=0.5, BodyLean=1. Total: 1.204 comprobaciones sin intersecciones detectadas.
- Diferencia entre vértices al principio/final: 0; tangentes de curvas emparejadas para continuidad. Deriva de vértices de pies: 0.
- Comparación binaria v3/v4: atributos de malla (incluidas tangentes, joints y pesos), índices, targets, bind matrices, bones, materiales e imágenes idénticos. El exportador recalculó tangentes; se reutilizaron exactamente los bytes de v3, sin cambiar geometría.
- Reimportación del GLB, 20 muestras de los cuatro estados: error máximo 0,001899 mm frente al editable.
- 23.924 triángulos, 51 huesos, nueve morphs y escala conservados.
- Archivo editable inspeccionado: Actions Idle y RigCheck presentes.
- Renders revisados: pose-1.png, pose-76.png y pose-181.png.

Evidencia: validation.json y roundtrip.json. before-v4.blend es el checkpoint anterior a la edición. Los hashes de v3 se comprobaron antes de actualizar el alias idle.glb; la versión previa del clip permanece en idle-v3.glb.

## Coste y alcance

GLB v3: 4.059.596 bytes. GLB v4: 4.101.364 bytes (+41.768 bytes, +1,03 %). Action editable: 4.789 claves escalares frente a 3.999 en v3. Duración 10 s frente a 8 s; ambos a 30 FPS.

No se instalaron dependencias ni se modificó código, interfaz, arquitectura, backend o admin. La referencia actual de la app sigue apuntando a v3; este encargo entrega los assets v4 y actualiza el clip separado. No se midieron nuevos FPS de runtime ni se afirma validación en teléfono físico. 30 FPS es la frecuencia de autoría/exportación.
