# Avatar masculino v4 — corrección de postura e Idle

Entrega 2026-09-11. Trabajo exclusivo sobre el rig/pose animada y exportación del asset existente. No se modificaron aplicación, Three.js, Ionic/React, backend, dependencias, topología, Morph Targets ni skeleton de enlace.

## Entrega actual

- `bodies/male-body-base-v4.glb`: 4.328.172 bytes (4,33 MB), clips Idle y RigCheck.
- `sources/male-body-base-v4/male-body-base-v4.blend`: editable con Actions Idle y RigCheck, abierto en Blender con Idle activo.
- `animations/idle.glb` y `animations/idle-v4.glb`: clip Idle actualizado, 442.668 bytes cada uno.
- v3 intacta. La v4 anterior, su editable y clips se conservaron en `posture-correction/previous-v4/`. El checkpoint de la sesión anterior a la edición es `posture-correction/live-before-correction.blend`.

## Postura y movimiento

8 segundos, 30 FPS, frames 1–241 en Blender (extremo repetido). Tiempos GLB normalizados a 0–8 s. La postura relajada está en la pose animada; no se aplicó como nueva bind/rest pose del skeleton.

Brazos más cercanos al cuerpo. Inclinación lateral del húmero respecto a la vertical: aproximadamente 12,4–13,6 grados; la variación durante el ciclo es solo 0,51 grados a izquierda y 1,14 grados a derecha. Recorrido total de muñecas en espacio mundial (pico a pico):

| Lado | Lateral | Delante/atrás | Vertical |
|---|---:|---:|---:|
| Izquierdo | 11,64 mm | 16,61 mm | 5,64 mm |
| Derecho | 16,46 mm | 24,46 mm | 4,85 mm |

Frente a los aproximadamente 63/90 mm laterales documentados en la v4 anterior, la reducción ronda el 82 %. No son desplazamientos por frame. Se conservan desfases izquierdo/derecho, pequeños ajustes de codo y muñeca, respiración torácica, movimiento de cabeza y balanceo suave del torso sobre apoyos fijos. La transferencia de peso se sugiere con ese balanceo; pelvis, piernas y pies no se trasladan.

Dedos con flexión de reposo aproximada de 15–20 grados en la articulación proximal, 28–30 grados en la intermedia y 15–17 grados en la distal, con ajuste de alineación entre dedos. Pulgar recogido mediante oposición/adducción local, sin cerrar un puño. Microvariación de dedos reducida a unas décimas de grado; muñecas alrededor de un grado, sin ciclos de abrir/cerrar la mano.

## Validación

- Inspección visual de frente, perfil y 3/4 en base, BodyVolume=1, BodyVolume=0.5 y BodyLean=1: doce renders. Tres frames adicionales del mismo ciclo base para comparar movimiento.
- 241 frames por estado, 964 evaluaciones: ninguna intersección brazo–cuerpo detectada por BVH de triángulos de las regiones separadas según los grupos de vértices dominantes.
- Dedos comparados entre sí en 31 muestras por estado: sin intersecciones detectadas. Esta comprobación por regiones no es una certificación exhaustiva de toda posible autointersección de la malla.
- Deriva de vértices de pies: 0. Desplazamiento acumulado/root motion: 0.
- Diferencia de vértices en extremos del loop: 0. Diferencia de canales exportados en extremos: 0. Tangentes de curvas editables emparejadas, error máximo 3,85e-8.
- Huella de topología, coordenadas Basis/morphs, pesos de skinning, nombres/jerarquía y matrices de reposo de los huesos: idéntica antes/después.
- GLB conserva exactamente las secciones de nodos, malla, skins, materiales, imágenes y texturas anteriores, así como sus bytes de datos. Solo se sustituyó Idle y se incluyó RigCheck, que antes estaba en el editable pero no en el GLB corporal.
- Reimportación del GLB final, veinte muestras de cuatro estados: error máximo 0,00246 mm frente al editable. Se mapean duplicados de vértices en costuras UV del GLB; no son cambios de topología del asset.
- 23.924 triángulos, 51 huesos, nueve Morph Targets conservados.

La Action Idle editable utiliza Euler XYZ. La Action técnica RigCheck original utiliza quaternions: para inspeccionarla directamente en Blender, cambiar los huesos a Quaternion antes de seleccionarla y volver a XYZ para Idle. Ambos clips del GLB se exportaron con su modo correcto y no requieren esa operación en un reproductor GLTF.

## Evidencias y límites

Ver `posture-correction/final-motion-audit.json`, `structural-audit.json`, `export-audit.json`, `roundtrip-audit.json`, `delivery-audit.json` y los PNG de vistas/frames. Los archivos `candidate*` documentan la iteración inicial: la pose candidata de 34 grados causaba contacto en BodyVolume=1; se corrigió a 32 grados locales y se repitió la auditoría completa.

No llegaron las dos imágenes de referencia mencionadas: el adjunto disponible contenía solo texto. La dirección visual se siguió a partir de esa descripción. Las cámaras de inspección se movieron temporalmente para la auditoría y se restauró la cámara original. No se cambió iluminación ni materiales. No se midió rendimiento de la app ni se actualizó su URL de modelo, por el alcance exclusivo del asset.
