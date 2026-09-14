# V7 — Idle vivo, 12 s / 30 FPS

Base: v6. Únicamente animación. Pose base aprobada preservada exactamente en los extremos del ciclo. Malla, geometría, skinning, rig, 51 huesos, morphs, materiales y texturas sin cambios; huella estática verificada. V6 y versiones anteriores intactas.

Acciones: mirada izquierda entre 1.65–4.65 s (cabeza aproximadamente +14 grados, cuello acompaña), mirada derecha 8.05–11.25 s (aproximadamente -12 grados), respiración de 4 s con una inhalación más profunda a mitad de ciclo, pequeños ajustes de cuello/torso y mayor micro movimiento de brazos/manos. Base de mano/dedos/pulgar conservada; únicamente variaciones animadas secundarias.

Transferencia de peso: pelvis entre -6.8 y +8 mm en X, descenso inferior a 0.7 mm. Solución analítica de dos huesos horneada en rotaciones de piernas para mantener los pies; sin constraints ni cambios de rig. Articulaciones de pies con error máximo 0.000031 mm; superficie de pies varía hasta 0.741 mm por el skinning original de tobillos. No locomoción ni desplazamiento acumulado; nodo raíz del asset fijo.

Brazos: antebrazos a menos de 3.93 grados de vertical; codos al menos 38.36 mm detrás de hombros. Oscilación lateral de muñecas: izquierda 12.63 mm / derecha 18.18 mm pico a pico. Inicio/fin idénticos; 361 muestras a 30 FPS, 12 segundos.

Limitaciones: un único clip repite necesariamente la misma secuencia cada 12 segundos; el timing es desigual dentro del ciclo, no aleatorio entre reproducciones. No se añadió lógica de reproducción a la app. Persiste el contacto mano-muslo y el pequeño artefacto de codo de la pose aprobada: BVH regional detecta contacto en 252/361 frames base, 361/361 mayor volumen e intermedio, 0/361 menor volumen. No se corrigieron manos ni pesos para ocultarlo. Los cuatro morph estados se evaluaron durante el ciclo completo.

Validación: frontal, perfil y 3/4 en renders, secuencia de preview de 120 imágenes a 10 FPS (el asset sigue a 30 FPS), cierre exacto del loop, reimportación GLB en 20 muestras/4 estados con error máximo 0.00233 mm. Métricas JSON adjuntas.

Entrega: bodies/male-body-base-v7.glb (4,960,428 bytes), sources/male-body-base-v7/male-body-base-v7.blend, animations/idle-v7.glb. Idle es la única animación funcional editada; RigCheck técnico conservado. No se modificó el alias idle.glb ni la URL del visor de la app. RigCheck en Blender usa quaternion e Idle Euler XYZ; ambas animaciones funcionan normalmente en GLB.
