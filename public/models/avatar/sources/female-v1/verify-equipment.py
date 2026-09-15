"""Reimporta los módulos exportados, comprueba el contrato y guarda una fuente limpia."""
import bpy, os, json
from mathutils import Vector
root=os.path.abspath('public/models/avatar')
bpy.ops.wm.open_mainfile(filepath=root+'/sources/female-v1/female-body-base-v1.blend')
scene=bpy.context.scene
rig=next(o for o in scene.objects if o.type=='ARMATURE')
body=next(o for o in scene.objects if o.type=='MESH' and o.data.shape_keys)
body.name='Female_Body'
names=list(body.data.shape_keys.key_blocks.keys())
rows=[]
for name,file in [('Female_Shirt','clothing/tops/female-shirt-basic-01-v1.glb'),('Female_Hair','hair/female-hair-02-v1.glb'),('Female_Glasses','accessories/glasses/female-glasses-02-v1.glb'),('Female_Watch','accessories/watches/female-watch-02-v1.glb'),('Female_Bracelet','accessories/bracelets/female-bracelet-02-v1.glb')]:
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=root+'/'+file)
    new=set(bpy.data.objects)-before
    source=next(o for o in new if o.type=='ARMATURE')
    assert list(source.data.bones.keys())==list(rig.data.bones.keys())
    meshes=[o for o in new if o.type=='MESH' and o.data.shape_keys]
    for i,obj in enumerate(meshes):
        obj.name=name if i==0 else name+'_'+str(i)
        assert list(obj.data.shape_keys.key_blocks.keys())==names
        assert max(len(v.groups) for v in obj.data.vertices)<=4
        for bone in source.data.bones:
            assert max(abs(a-b) for ra,rb in zip(source.matrix_world@bone.matrix_local,rig.matrix_world@rig.data.bones[bone.name].matrix_local) for a,b in zip(ra,rb))<1e-4
        world=obj.matrix_world.copy();obj.parent=rig;obj.matrix_world=world
        for modifier in obj.modifiers:
            if modifier.type=='ARMATURE':modifier.object=rig
    bpy.data.objects.remove(source,do_unlink=True)
    rows.append({'asset':file,'meshes':len(meshes),'bytes':os.path.getsize(root+'/'+file)})
scene.frame_set(1)
modules=[o for o in scene.objects if o.type=='MESH' and o.data.shape_keys]
for name,value in [('BodyVolume',0),('BodyVolume',.5),('BodyVolume',1),('BodyLean',1)]:
    for obj in modules:
        for key in obj.data.shape_keys.key_blocks:key.value=value if key.name==name else 0
    samples={}
    for frame in [1,91,181,271,361]:
        scene.frame_set(frame);dg=bpy.context.evaluated_depsgraph_get()
        samples[frame]={o.name:[o.matrix_world@v.co for v in o.evaluated_get(dg).data.vertices] for o in modules}
        assert all(all(abs(c)<5 for c in p) for pts in samples[frame].values() for p in pts)
    assert max((a-b).length for obj in modules for a,b in zip(samples[1][obj.name],samples[361][obj.name]))<1e-5
for obj in modules:
    for key in obj.data.shape_keys.key_blocks:key.value=0
scene.frame_set(1)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=root+'/sources/female-v1/female-equipment-v1.blend',compress=True)
with open('docs/avatar-phases-11-13-validation/female-equipment-checkpoint.json','w') as f:json.dump({'assets':rows,'canonicalBindMatrices':True,'maxInfluences':4,'morphs':names[1:],'loopDifferenceBelow':1e-5,'sampleFrames':[1,91,181,271,361]},f,indent=2)
