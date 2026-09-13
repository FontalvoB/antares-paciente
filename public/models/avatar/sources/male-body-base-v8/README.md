# male-body-base-v8

Revisión de BodyVolume sobre v7. Cuerpo neutro, otros ocho morphs, materiales, skeleton, skinning y Actions originales conservados. Fuente editable: `male-body-base-v8.blend`; export usado por la app: `../../bodies/male-body-base-v8.glb`.

Idle 12 segundos / 30 FPS; RigCheck técnico 2 segundos. Los módulos compatibles están en `../modular-v1/`; las revisiones actuales de camiseta y cabello llevan sufijo v2.

La escena contiene revisiones anteriores ocultas. El objeto corporal actual es `male-body-base-v8_Mesh`, con el armature canónico original `male-body-base-v7_Armature`. Las versiones anteriores no se eliminaron.

Exportación reproducible y auditada: `../modular-v1/export-body-v8.py` lee el Shape Key de Blender y modifica únicamente los accessors de BodyVolume en una copia del GLB v7. Conserva las Actions exportadas y todos los datos protegidos. El script evita sobrescribir una exportación existente.

Informe completo: `docs/avatar-modular-phases-6-10.md` desde la raíz de antares-paciente.
