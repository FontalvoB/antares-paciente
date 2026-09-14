# Misión secuencial 6–10

SCENE
- intent: primera base modular masculina, primero camiseta y validación antes de integración.
- deliverable: GLB independientes, fuentes Blender editables, demo Ionic existente.
- units: metres; axes: right-handed Z-up; export Y-up, frente -Z.
- render: conservar Cycles e iluminación de inspección; cámaras de auditoría adicionales 600×800, 30 fps, frames 1–361.
- dynamic: sí, Idle existente de 12 s sin cambios.

HIERARCHY
- collection/object naming: AVATAR_Modular; Shirt_Basic_01, Hair_01..03, Glasses_01, Watch_01, Bracelet_01.
- parent/child relationships: camiseta al armature existente; cabello/gafas a Head, reloj/pulsera a huesos de muñeca.
- protected existing objects: cuerpo v7, skeleton, Actions Idle/RigCheck, materiales y proporciones base. Fase 10 solo modifica copias versionadas tras auditoría de morphs.

ASSETS
- A01 male-body-base-v7 | [EXISTING] | detailed | altura 1.7 m | origen pies | armature actual | referencia protegida.
- A02 Shirt_Basic_01 | [BLOCK] construcción ajustada desde superficie del cuerpo, no proxy final | detailed | torso ~0.40×0.25×0.48 m más mangas, medidas refinadas por superficie | origen cuerpo | mismo skeleton | camiseta manga corta, cuello y dobladillos.
- generación: no necesaria para la camiseta; transferencia directa permite preservar exactamente la correspondencia de morphs y skinning. Resolver rutas de cabello/accesorios después de aprobar fases precedentes.

SHOT
- active camera: V2_Avatar_InspectionCamera.001 conservada; cámaras adicionales de auditoría frontal, perfil, 3/4.
- framing/lens/target: cuerpo entero y acercamiento al torso, sin recorte de mangas.
- foreground/subject/background: avatar sobre fondo neutro existente.

LOOK
- material roles and palette: camiseta azul petróleo mate con ribete del mismo tejido; piel existente.
- material route: EXISTING cuerpo, nodos Principled nativos para tejido exportable.
- texture scale: sin textura nueva inicialmente; UV transferida. Relieve geométrico de cuello y dobladillos.
- relief: sin displacement; dielectric, roughness 0.85.
- world/background: conservar existente.

LIGHTING
- focal subject: ajuste y silueta; sombras moderadas para leer penetración.
- mood: inspección técnica neutra, no iluminación cinematográfica nueva.
- environment route: EXISTING; no HDRI nuevo.
- key/fill: conservar luces actuales y exposición; cámaras auxiliares solo para auditoría.
- practical/flags/atmosphere: no aplica.

MOTION
- 30 fps, 1–361; Idle existente sin editar.
- muestras: 1, 91, 181, 271, 361; comparar base, volumen 0.5, volumen 1, lean 1.
- verificar endpoints idénticos y desplazamiento de prenda con el skeleton.

ACCEPTANCE
- structural: GLB válido, ropa comparte huesos/inverse binds, nueve morphs con nombres actuales, fuentes independientes y versiones anteriores conservadas.
- motion: Idle sin editar, ropa acompaña cuerpo, sin penetración grave en muestras.
- visual: cuello/mangas/dobladillo legibles, superficie textil natural; revisar imágenes antes de avanzar.
- lighting: preservar lectura y materiales bajo luz de inspección existente.

refs_read: blender-scene, blender-scene-spec, blender-modeling, blender-lookdev, blender-animation, blender-audit-finalize, blender-volatile, blender-lighting-camera.

Orden de gates: [x] 6 camiseta construir/auditar/exportar → [x] 7 integrar/auditar → [x] 8 cabello/auditar → [x] 9 accesorios/auditar → [x] 10 copia corporal/refinar/revalidar conjunto.

## Gates 6–7 y alcance 8

6 validada: camiseta independiente, matrices inverse bind idénticas al cuerpo (51 huesos), nueve morphs; 20 muestras de pose/volumen, cero vértices con penetración >2 mm después del ajuste; contacto residual máximo 1.7 mm en axila a volumen 1. Capturas frontal/perfil/3/4 revisadas. Fuente y GLB guardados.
7 validada en navegador: equipar/quitar/cambiar color mantiene canvas, BodyState e Idle; 34.694 triángulos, tres draws. Una geometría, dos opciones de color.

FASE 8 ASSETS: Hair_01 corto, Hair_02 peinado lateral, Hair_03 rizado. Ruta BLOCK de construcción superficial editada y detalles de mechones; fidelidad detailed para demo móvil, no primitivas de sustitución. Tamaño ~0.20×0.22×0.16 m sobre cabeza z≈1.62 m. Anclaje Head del rig canónico, sin huesos nuevos. Morphs heredados para conservar ajuste. Material dieléctrico marrón oscuro, roughness 0.65–0.8. Silueta y lectura frontal/perfil antes de exportar. Conserva cámara/luces/Idle. Aceptación: tres estilos distinguibles, sin cráneo atravesando cabello, estabilidad en Idle y cambio modular.

8 validada: tres GLB/fuentes; cambio en navegador con camiseta e Idle, cuatro draws y 51 huesos. Auditoría de 48 muestras, contacto residual puntual Hair03/BodyLean ~2.1 mm, sin penetración importante visible. No se oculta como cero geométrico.

FASE 9 ASSETS: Glasses_01 montura oscura y lentes claras (~0.16×0.13×0.04 m) sobre ojos, Head; Watch_01 reloj deportivo de caja redondeada (~0.06×0.06×0.025 m) en LeftForeArm; Bracelet_01 pulsera discreta (~0.06×0.06×0.012 m) en RightForeArm. Ruta BLOCK de superficies barridas continuas y detalle funcional, fidelidad detailed. Skeleton compartido, sin nuevos huesos; adaptación de escala mediante morphs en muñeca y rostro. Materiales: polímero oscuro mate, metal cepillado, cristal sin refracción costosa. Cámaras/luces existentes; Idle como movimiento único. Gate: ajustar contactos frontal/perfil/3/4, exportar fuentes y GLB, probar los tres juntos con ropa/cabello y cambios corporales.

9 validada: montura bajada 26 mm en frente, conservando ganchos; correas ajustadas mediante inversa de skinning. 75 muestras sin penetración >2 mm. Tres módulos simultáneos en navegador, cada uno con estado propio; Idle completa dos loops.

FASE 10: copia v8, solo BodyVolume. Suavizado regional y volumen distribuido en tórax/espalda/pelvis/extremidades; mejillas inferiores y cuello con cambio pequeño. Materiales, Basis, topología, UV, skinning y otros ocho morphs protegidos. Camiseta v2 y cabellos v2 readaptados; accesorios reutilizados. Cámaras y luz existentes preservadas.

10 validada: comparación visual frontal de 0/.33/.66/1 y perfil/3/4 vestido. Camiseta: 30 muestras, residual máximo 0.60 mm; cabello: 75 muestras, residual máximo 1.77 mm; accesorios: 75 muestras, separación mínima 1.22 mm. Cero vértices >2 mm de penetración en esas muestras finales. Son muestras de vértices/poses, no garantía de colisión continua. GLB v8 conserva literalmente binarios de Idle/RigCheck, skeleton, skinning, materiales/texturas y ocho morphs. Script de comprobación de assets pasa. Navegador: 42.294 triángulos, 13 draws, ~60 FPS en Edge de escritorio; no extrapolar a móvil físico. Fuentes y exports versionados guardados por autorización del usuario.
