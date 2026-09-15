import bpy, json, os
from mathutils import Vector
root=os.path.abspath('public/models/avatar/sources/polish-v9')
bpy.ops.wm.open_mainfile(filepath=root+'/avatar-polished-v9.blend',load_ui=False)
s=bpy.context.scene; rig=bpy.data.objects['Avatar_V9_Rig']
meshes=[o for o in s.objects if o.type=='MESH' and o.data.shape_keys]
body=next(o for o in meshes if '/bodies/' in '/'+o['source_glb'])
names=['BodyVolume','BodyLean','Abdomen','Waist','Chest','Arms','Thighs','FaceVolume','MuscleDefinition']
rows=[]
for o in meshes:
    assert list(o.data.shape_keys.key_blocks.keys())[1:]==names
    assert all(m.object==rig for m in o.modifiers if m.type=='ARMATURE')
    error=max(abs(sum(g.weight for g in v.groups)-1) for v in o.data.vertices)
    assert error<1e-5,(o.name,error)
    rows.append({'object':o.name,'weightSumMaxError':error,'morphs':names})
endpoints=[]
for frame in [1,361]:
    s.frame_set(frame); dg=bpy.context.evaluated_depsgraph_get()
    endpoints.append([[tuple(v.co) for v in o.evaluated_get(dg).data.vertices] for o in meshes])
loop=max((Vector(a)-Vector(b)).length for ma,mb in zip(*endpoints) for a,b in zip(ma,mb))
assert loop<1e-5,loop
samples=[]
for name in names:
    for o in meshes:
        for k in o.data.shape_keys.key_blocks: k.value=0
        o.data.shape_keys.key_blocks[name].value=1
    for frame in [1,91,181,271,361]:
        s.frame_set(frame); dg=bpy.context.evaluated_depsgraph_get()
        for o in meshes:
            vs=o.evaluated_get(dg).data.vertices
            assert all(all(abs(c)<10 for c in v.co) for v in vs)
        samples.append({'morph':name,'frame':frame,'finiteGeometry':True})
with open('docs/avatar-polish-validation/source-validation.json','w') as f:json.dump({'meshes':rows,'samples':samples,'loopMaxVertexDifference':loop,'actions':[a.name for a in bpy.data.actions],'bones':len(rig.data.bones),'fps':s.render.fps},f,indent=2)
for o in meshes:
    for k in o.data.shape_keys.key_blocks:k.value=0
    if o!=body:o.hide_render=True
s.frame_set(91)
for camera, volume in [('Front',0),('Profile',0),('ThreeQuarter',1)]:
    body.data.shape_keys.key_blocks['BodyVolume'].value=volume
    s.camera=bpy.data.objects[camera]
    s.render.filepath=os.path.abspath('docs/avatar-polish-validation/body-final-'+camera+'.png')
    bpy.ops.render.render(write_still=True)
