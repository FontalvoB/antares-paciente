# Prueba del brazo derecho — no aprobada

Base: v3 editable, sin modificar archivos anteriores. Idle desactivado. Solo se ajustaron rotaciones de RightArm, RightForeArm, RightHand y se reutilizó la postura relajada de los dedos derechos. Brazo izquierdo intacto en A-pose. No se editaron pesos, geometría, skeleton, morphs, materiales ni texturas.

UpperArm: codo 45.3 mm detrás del hombro mediante rotación, sin traslación global ni cambios de longitud. Forearm: 2.19 grados respecto a la vertical, muñeca aproximadamente debajo del codo. No se aplicó el giro axial de 78 grados que produjo el defecto anterior; se repartió moderadamente entre brazo, antebrazo y mano.

Frontal, perfil y 3/4 inspeccionados. El perfil se aproxima al objetivo de codo atrás, pero el primer plano todavía muestra un quiebre anguloso en el codo y un pequeño pinzamiento triangular en la transición superior. La pose no se considera anatómicamente validada. El skinning original de v3 no se corrigió en esta tarea, que autoriza únicamente postura.

Hand: palma orientada hacia el cuerpo y dedos relajados, pero la verificación regional detecta intersecciones incluso en base. Resultados: base 18 pares de triángulos, mayor volumen 141, intermedio 84, menor volumen 0. Ver diagnosis.json para regiones. No equivalen a penetraciones independientes.

Se detuvo el proceso según la regla explícita del usuario ante otra deformación. No se replicó al izquierdo, no se adaptó Idle, no se exportó GLB y no se creó otra versión de entrega. El archivo right-arm-NOT-APPROVED.blend es exclusivamente diagnóstico. No se afirma que sea imposible corregirlo; esta prueba no satisface la validación exigida y no justifica acumular más rotaciones.
