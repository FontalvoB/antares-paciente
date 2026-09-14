# Fase 11 â€” Female Body

SCENE
- intent: cuerpo femenino adulto neutro diferenciado anatÃ³micamente, compatible con avatar mÃ³vil.
- deliverable: female-body-base-v1.glb + Blender editable; nueve morphs, rig canÃ³nico, Idle y RigCheck.
- units: metres; axes: right-handed Z-up
- render: Cycles, 640Ã—800, 30 FPS, frames 1â€“361.
- dynamic: sÃ­, retarget del Idle existente; no animaciones nuevas.

HIERARCHY
- collection/object naming: Female_V1 / Female_Body / Female_Rig.
- parent/child relationships: body y futuros mÃ³dulos al rig canÃ³nico adaptado anatÃ³micamente.
- protected existing objects: todos los objetos de Avatar_Polished_V9 y todos sus archivos.

ASSETS
- A01 Female_Body | [GEN] detailed | ~[1.1,.35,1.6] m en A-pose | [0,0,0] | [0,0,0] rad | origen pies | Female_Rig | hero.
- Proxy de volumen/escala independiente; nunca sustituye el cuerpo final.
- GeneraciÃ³n: tripo_3d, texture=true, pbr=true, geometry_quality=standard, texture_quality=standard. El Bridge actual no expone estimaciÃ³n ni parÃ¡metros de rig/remesh; coste previo no disponible. La instrucciÃ³n expresa del usuario autoriza continuar sin estimador. Un solo cuerpo independiente, no modificar la malla masculina.
- Rig y animaciones [EXISTING]: contrato masculino de 51 nombres/jerarquÃ­a, ajustado al cuerpo femenino cuando se requiera; pesos propios, mÃ¡ximo cuatro influencias.

SHOT
- active camera: ThreeQuarter de inspecciÃ³n, compartida sin editar datos; Front/Profile para revisiÃ³n.
- framing/lens/target: cuerpo completo, ortogrÃ¡fica, pies visibles y espacio sobre cabeza.
- foreground, subject, background depth: sujeto centrado, fondo gris limpio sin decorado.

LOOK
- material roles and palette: piel natural, prenda interior deportiva opaca neutra cubriendo pecho y pelvis; rostro neutro, sin maquillaje marcado ni cabello integrado.
- material route: GENERATED para cuerpo, comprobar mapas y UV al importar.
- texture scale: UV corporal, ~1024 px objetivo.
- relief: normal/bump suave, sin musculatura exagerada.
- dielectric, roughness moderada, sin metales corporales.
- world/background: estudio gris existente sin cambios.

LIGHTING
- focal subject: silueta y anatomÃ­a; secundarios rostro/manos; sombras de axila legibles.
- mood: estudio tÃ©cnico neutro, sin ambiente cinematogrÃ¡fico.
- environment: EXISTING; HDR no necesario.
- baseline: esquema existente de Key/Fill/Rim, conservado.
- key: frontal lateral suave, fill subordinado; rim para contorno.
- motivation: iluminaciÃ³n de inspecciÃ³n de estudio.
- reflection: piel sin brillo excesivo; sin flags, atmÃ³sfera ni gobos.
- color management: conservar AgX/exposiciÃ³n del estudio.

MOTION
- 30 FPS / 1â€“361; Idle 12 s; RigCheck tÃ©cnico.
- A-pose de referencia, reposo animado compatible; loop sin desplazamiento acumulado.

ACCEPTANCE
- structural: GLB/editable, 51 huesos, nueve morphs, pesos normalizados â‰¤4, UV/materiales correctos, ~10â€“16k triÃ¡ngulos cuando preserve calidad.
- motion: Idle/RigCheck, articulaciones y manos correctas, loop, sin root motion acumulado.
- visual: mujer adulta anatÃ³micamente diferenciada; base, .25/.5/.75/1 BodyVolume y BodyLean; frontal/perfil/3/4, sin distorsiones graves.
- lighting: inspecciÃ³n neutra, silueta separada, sin clipping de altas luces.

refs_read: blender-scene, blender-scene-spec, blender-modeling, blender-generation, blender-volatile, blender-lookdev, blender-lighting-camera, blender-animation, blender-audit-finalize.

CHECKPOINTS
- [x] MÃ³dulos requeridos leÃ­dos.
- [x] Fase A: inspecciÃ³n y alcance documentados.
- [x] Fase B: checkpoint masculino y escena separada.
- [x] Fase C: dimensiones y encuadre del proxy.
- [x] Fase D: generar, importar, adaptar rig/morphs y retarget.
- [x] Fase E: validar y exportar; solo despuÃ©s pasar a 11.1.
- [x] 11.1 integraciÃ³n comÃºn; despuÃ©s 12 personalizaciÃ³n; despuÃ©s 13 persistencia.

Evidencia final: female-checkpoint.json, female-equipment-checkpoint.json y fases 11.1/12/13 en docs/avatar-phases-11-13-validation. Fuentes limpias female-body-base-v1.blend y female-equipment-v1.blend. El circuito de despliegue/login por gateway no se ejecutó por migración ERP ajena pendiente; véase informe de misión.
