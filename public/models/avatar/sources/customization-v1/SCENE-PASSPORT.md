SCENE
- intent: seis pantalones distintos y dos pares de zapatillas para personalización existente.
- deliverable: GLB modulares y construcción reproducible; fuentes corporales protegidas.
- units: metres; axes: right-handed Z-up.
- render: Cycles existente, 640×800; 30 FPS, 1–361.
- dynamic: Idle existente, sin crear ni editar Actions.

HIERARCHY
- colección AVATAR_Customization; Pants_{gender}_{01..03}, Shoes_{gender}_01.
- prendas hijas del rig correspondiente, grupos canónicos y nueve morphs propios.
- protegidos: cuerpos, skeletons, Actions, prendas anteriores, cámaras, luces y materiales existentes.

ASSETS
- Female_Body/Female_Rig | EXISTING | detailed | 1,60 m alto, matriz original | referencia protegida.
- Male body/rig v9 | EXISTING | detailed | 1,70 m alto, matriz original | referencia protegida.
- Pants_{gender}_01 | BLOCK | detailed mobile | cintura a tobillo, aprox. .40×.30×.83 m | rig original | deportivo con puño.
- Pants_{gender}_02 | BLOCK | detailed mobile | misma cintura, pierna recta | rig original | casual arena.
- Pants_{gender}_03 | BLOCK | detailed mobile | misma cintura, pierna más amplia | rig original | denim azul.
- Shoes_{gender}_01 | BLOCK | detailed mobile | superficie de pies, aprox. .35×.25×.12 m | rig original | zapatillas neutras.
- sin generación externa ni gasto de créditos.

SHOT
- cámaras existentes Front/Profile/ThreeQuarter; cuerpo completo y detalles de pierna.
- sujeto en estudio neutro existente; visor real para auditoría final.

LOOK
- nuevos materiales de tela mate y suela; colores petróleo, arena y denim; detalles contenidos.
- material route: NONE (PBR local). UV heredadas/interpoladas de superficie; sin mapas grandes nuevos.
- relieve por silueta y puños, sin displacement; metallic 0, roughness .75–.9.
- fondo y materiales corporales existentes.

LIGHTING
- iluminación de estudio existente, sin cambios de energía, cámara, exposición ni World.
- foco: silueta de pantalón; comprobar contactos con camiseta y tobillos.

MOTION
- 30 FPS, 1–361, Idle existente compartido por rig.
- morphs y pesos transferidos baricéntricamente; sin simulación ni nueva animación.

ACCEPTANCE
- structural: nueve morphs, pesos normalizados, rig original, archivos anteriores intactos.
- motion: frames 1/91/181/271/361; BodyVolume 0/.25/.5/.75/1 y BodyLean .5/1.
- visual: sin penetraciones evidentes, siluetas diferenciadas, prendas cubren ropa interior.
- rendimiento: geometría de superficie sin interiores innecesarios, máximo dos materiales por prenda.
- gates: A inspección/pasaporte; B copia de recuperación; C silueta/contacto; D materiales; E GLB, visor y pruebas.

refs_read: blender-scene, blender-scene-spec, blender-modeling, blender-lookdev, blender-animation, blender-audit-finalize.

FINAL
- Fuente final: customization-final.blend; escenas Scene (female) y Avatar_Polished_V9 (male). Colecciones de prendas separadas por género.
- Pantalón femenino final: patrón continuo de 2.144 triángulos, cintura ajustada por rayos solo contra pelvis; nueve morphs y rig original. Construcción de superficie inicial descartada.
- Matrices inverse-bind verificadas contra los GLB corporales y 280 muestras de ajuste conservadas en fit-audit.json. Distancia negativa al triángulo más próximo incluye contactos internos; no se declara una garantía geométrica de cero intersecciones.
- Capturas de patrón final: female-loft-waist.png y female-loft-volume1.png. Capturas de UI final y métricas en docs/avatar-customization-v1-validation/browser.
- No hubo generación externa, gasto de créditos ni cambios en cuerpos/Actions originales.
