import bpy, math, json
from mathutils import Vector, Matrix
root='C:/Users/Carlos Cortina/Documents/CoppAddresd/antares-paciente/'
s=bpy.data.scenes['Female_V1'];bpy.context.window.scene=s
body=bpy.data.objects['Female_Body']
assert not body.get('prepared'), 'Already prepared'
# T-pose intake -> A-pose, rotating around each shoulder with a smooth transition.
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
for v in body.data.vertices:
    p=v.co.copy(); side=1 if p.x>=0 else -1
    influence=smooth(.115,.205,abs(p.x))*smooth(1.08,1.19,p.z)
    pivot=Vector((side*.155,0,1.26))
    rotated=pivot+Matrix.Rotation(side*math.pi/4,3,'Y')@(p-pivot)
    v.co=p.lerp(rotated,influence)
body.data.update()
rig=bpy.data.objects['Avatar_V9_Rig'].copy();rig.data=rig.data.copy();rig.name='Female_Rig';s.collection.objects.link(rig)
rig.animation_data_clear();rig.scale=(1.6/1.7,)*3
for p in rig.pose.bones:
    p.location=(0,0,0);p.rotation_mode='QUATERNION';p.rotation_quaternion=(1,0,0,0);p.scale=(1,1,1)
for p in rig.pose.bones:p.custom_shape=None
rig.data.pose_position='REST'
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
bpy.context.view_layer.objects.active=body
bpy.ops.object.vertex_group_limit_total(limit=4)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
assert all(len(v.groups)>0 for v in body.data.vertices), 'Unweighted vertices'
body['prepared']=True;body['morph_range']='0..1';body['avatar_gender']='female';body['avatar_version']=1
basis=body.shape_key_add(name='Basis');basis.value=0
names=['BodyVolume','BodyLean','Abdomen','Waist','Chest','Arms','Thighs','FaceVolume','MuscleDefinition']
groups={g.index:g.name for g in body.vertex_groups}
def bell(z,center,width):return math.exp(-((z-center)/width)**2)
for name in names:
    key=body.shape_key_add(name=name);key.value=0
    for v,k in zip(body.data.vertices,key.data):
        x,y,z=v.co; w={groups[g.group]:g.weight for g in v.groups}
        arms=sum(a for n,a in w.items() if n.endswith(('Arm','ForeArm')))
        hands=sum(a for n,a in w.items() if 'Hand' in n)
        torso=(1-arms)*(1-hands)*bell(x,0,.22)
        belly=bell(z,.98,.14)*torso;waist=bell(z,1.06,.13)*torso
        hips=bell(z,.84,.12)*(1-arms)*(1-hands)
        chest=bell(z,1.2,.105)*torso
        thigh=bell(z,.65,.18)*(1-arms)*(1-hands)
        face=bell(z,1.47,.10)*smooth(1.29,1.36,z)
        sign=1 if x>=0 else -1
        legcenter=sign*.095
        radial=Vector((x-legcenter,y+.01,0));radial.normalize()
        normal=v.normal
        volume=Vector((x*(.24*waist+.10*chest+.14*hips),(.048 if y>=0 else -.028)*(belly+.35*hips)+y*.18*chest,0))
        volume+=radial*(.026*thigh)+normal*(.020*arms+.007*face)
        if name=='BodyVolume':d=volume
        elif name=='BodyLean':d=-volume*.40
        elif name=='Abdomen':d=Vector((x*.09*belly,(.030 if y>=0 else -.007)*belly,0))
        elif name=='Waist':d=Vector((x*.16*waist,y*.10*waist,0))
        elif name=='Chest':d=Vector((x*.05*chest,.018*chest*smooth(0,.06,y),0))
        elif name=='Arms':d=normal*.017*arms
        elif name=='Thighs':d=radial*.020*thigh
        elif name=='FaceVolume':d=normal*.009*face
        else:d=normal*(.004*arms+.003*thigh)-Vector((x*.015*waist,y*.02*waist,0))
        k.co=v.co+d
rig.data.pose_position='POSE';rig.animation_data_create();rig.animation_data.action=bpy.data.actions['Idle']
rig.animation_data.action_slot=bpy.data.actions['Idle'].slots[0]
s.frame_set(1);s.camera=bpy.data.objects['ThreeQuarter'];s.render.filepath=root+'docs/avatar-phases-11-13-validation/female-rig-idle.png'
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=root+'public/models/avatar/sources/female-v1/female-rig-review.blend',copy=True,compress=True)
result={'body':body.name,'rig':rig.name,'morphs':names,'maxInfluences':max(len(v.groups) for v in body.data.vertices)}
