import bpy, os, json
from mathutils import Vector
root=os.path.abspath('public/models/avatar');out=os.path.abspath('docs/avatar-phases-11-13-validation')
bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.render.fps=30
bpy.ops.import_scene.gltf(filepath=root+'/bodies/female-body-base-v1.glb')
body=next(o for o in s.objects if o.type=='MESH' and o.data.shape_keys)
rig=next(o for o in s.objects if o.type=='ARMATURE');rig.name='Female_Rig'
assert len(rig.data.bones)==51
names=['BodyVolume','BodyLean','Abdomen','Waist','Chest','Arms','Thighs','FaceVolume','MuscleDefinition']
assert list(body.data.shape_keys.key_blocks.keys())[1:]==names
assert max(len(v.groups) for v in body.data.vertices)<=4
assert max(abs(sum(g.weight for g in v.groups)-1) for v in body.data.vertices)<1e-5
for action in bpy.data.actions:
    action.use_fake_user=True
    for layer in action.layers:
        for strip in layer.strips:
            for slot in action.slots:
                bag=strip.channelbag(slot)
                if bag:
                    for c in bag.fcurves:
                        for p in c.keyframe_points:p.co.x+=1;p.handle_left.x+=1;p.handle_right.x+=1
idle=next(a for a in bpy.data.actions if 'Idle' in a.name);idle.name='Idle'
check=next(a for a in bpy.data.actions if 'RigCheck' in a.name);check.name='RigCheck'
for t in rig.animation_data.nla_tracks:t.mute=True
rig.animation_data.action=idle;rig.animation_data.action_slot=idle.slots[0]
def points(frame):
    s.frame_set(frame);dg=bpy.context.evaluated_depsgraph_get();return [v.co.copy() for v in body.evaluated_get(dg).data.vertices]
first=points(1);last=points(361);loop=max((a-b).length for a,b in zip(first,last));assert loop<1e-5
movement=max((a-b).length for a,b in zip(first,points(91)));assert movement>.001
samples=[]
for name in names:
    for k in body.data.shape_keys.key_blocks:k.value=0
    body.data.shape_keys.key_blocks[name].value=1
    for frame in [1,91,181,271,361]:
        pts=points(frame);assert all(all(abs(c)<5 for c in p) for p in pts)
    delta=max((a.co-b.co).length for a,b in zip(body.data.shape_keys.key_blocks[name].data,body.data.shape_keys.key_blocks[0].data));assert delta>.0001
    samples.append({'morph':name,'maxDelta':delta,'frames':[1,91,181,271,361]})
for k in body.data.shape_keys.key_blocks:k.value=0
rig.animation_data.action=check;rig.animation_data.action_slot=check.slots[0];assert len(points(31))==len(first)
rig.animation_data.action=idle;rig.animation_data.action_slot=idle.slots[0];s.frame_set(1)
with bpy.data.libraries.load(root+'/sources/polish-v9/avatar-polished-v9.blend',link=False) as (src,dst):dst.objects=['Front','Profile','ThreeQuarter','Key','Fill','Rim'];dst.worlds=src.worlds[:1]
for o in dst.objects:
    if o:s.collection.objects.link(o)
s.world=dst.worlds[0];s.camera=bpy.data.objects['ThreeQuarter'];s.render.engine='CYCLES';s.cycles.samples=16;s.render.resolution_x=640;s.render.resolution_y=800;s.render.resolution_percentage=100;s.frame_start=1;s.frame_end=361
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=root+'/sources/female-v1/female-body-base-v1.blend',compress=True)
with open(out+'/female-checkpoint.json','w') as f:json.dump({'triangles':sum(len(p.vertices)-2 for p in body.data.polygons),'bytes':os.path.getsize(root+'/bodies/female-body-base-v1.glb'),'bones':51,'maxInfluences':4,'loopDifference':loop,'idleMovement':movement,'fps':30,'idleSeconds':12,'morphTests':samples,'actions':['Idle','RigCheck']},f,indent=2)
for name,value,camera in [('BodyVolume',0,'Front'),('BodyVolume',.5,'ThreeQuarter'),('BodyVolume',1,'ThreeQuarter'),('BodyLean',1,'Profile')]:
    for k in body.data.shape_keys.key_blocks:k.value=0
    body.data.shape_keys.key_blocks[name].value=value;s.frame_set(91);s.camera=bpy.data.objects[camera];s.render.filepath=out+'/export-'+name+'-'+str(value)+'.png';bpy.ops.render.render(write_still=True)
