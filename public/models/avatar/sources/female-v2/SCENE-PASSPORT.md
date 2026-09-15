# Corrección femenina v2

SCENE
- intent: corregir estiramiento BodyVolume, caída/clipping de camiseta, tres cabellos largos distintos.
- deliverable: GLB v2 cuerpo/camiseta, Hair Long 01/02/03, Blender editable y evidencia.
- units: metres; axes: right-handed Z-up; cálculos en espacio global, respetar matrices importadas.
- render: estudio existente Cycles, 640×800, 30 FPS, 1–361.
- dynamic: Idle existente intacto; no animaciones nuevas.

HIERARCHY
- objetos existentes Female_Body/Female_Shirt/Female_Hair y Female_Rig.
- protegidos: skeleton, rig, Actions, accesorios, todas las fuentes/GLB v1 y masculinos.
- permitidos: morphs femeninos necesarios, nueva camiseta/skinning, tres mallas Hair_Long_01/02/03 enlazadas a Head.

ASSETS
- Female_Body | EXISTING | detailed mobile | altura 1,60 m, ubicación/orientación intactas | Female_Rig.
- Female_Shirt | EXISTING, ajustar o reconstruir solo prenda | detailed mobile | torso, cuello, mangas y hem | Female_Rig.
- Female_Hair_Long_01 | BLOCK → detailed mobile | aprox. 0,23×0,25×0,34 m | cráneo a base cuello | Head | liso.
- Female_Hair_Long_02 | BLOCK → detailed mobile | aprox. 0,25×0,26×0,38 m | cráneo a espalda alta | Head | ondulado.
- Female_Hair_Long_03 | BLOCK → detailed mobile | aprox. 0,22×0,29×0,36 m | cráneo a espalda alta | Head | semirrecogido.
- generación externa no necesaria; cero créditos previstos.

SHOT
- cámaras Front, Profile, ThreeQuarter existentes; encuadre de cuerpo completo y detalle de cabello para QA.
- fondo neutro de estudio; no rediseñar luces.

LOOK
- materiales existentes del cuerpo y prenda; cabello castaño oscuro con mechas de geometría ligera y variación tonal sutil.
- roughness de tela suave, cabello semimate; sin texturas grandes ni shaders no exportables.
- UV/material del cuerpo conservados; sin sustituir piel texturada por color plano.

LIGHTING
- Key/Fill/Rim y World existentes; foco silueta corporal, cuello/mangas y largo posterior.
- conservar AgX/exposición; sin luces/gobos/atmósfera nuevos.

MOTION
- Idle y RigCheck se preservan byte a byte en canales GLB; rig/bones sin cambios.
- pelo anclado a Head sin simulación; auditar contactos durante el ciclo.

ACCEPTANCE
- structural: contrato de nueve morphs, skeleton/rig intactos; conteo móvil comparable.
- motion: frames 1/91/181/271/361, loop, cabello no separado del Head.
- visual: BodyVolume 0/.25/.5/.75/1 y BodyLean 0/.5/1 frontal/perfil/3/4; camiseta suave sin penetración importante, pelo largo diferenciado.
- iluminación existente utilizada para inspección; materiales exportados comprobados en visor.
- integración: solo catálogo/rutas/idiomas/tests necesarios, no AvatarViewer/BodyState/backend/persistencia.

refs_read: blender-scene, blender-scene-spec, blender-modeling, blender-lookdev, blender-animation, blender-audit-finalize.

CHECKPOINTS
- [x] A: alcance y referencias inspeccionados.
- [x] B: checkpoint antes de editar.
- [x] C: diagnóstico medido y siluetas de cabello revisadas; primer bloqueo de mechones descartado, superficies continuas refinadas.
- [x] D: correcciones y detalle de assets.
- [x] E: auditoría, exportación, integración y reporte. Residual aproximado de axila 2,125 mm y persistencia de nuevos IDs fuera de alcance, documentados en docs/avatar-female-v2-validation/README.md.
