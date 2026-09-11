"""FASE 10: solo BodyVolume en una copia; Basis, UV, pesos, rig y Actions intactos."""
import bpy,math,json
from mathutils import Vector
old=bpy.data.objects['male-body-base-v7_Mesh'];rig=old.parent
assert not bpy.data.objects.get('male-body-base-v8_Mesh')
body=old.copy();body.data=old.data.copy();body.name='male-body-base-v8_Mesh';old.users_collection[0].objects.link(body)
old.hide_render=True;old.hide_set(True)
keys=body.data.shape_keys.key_blocks;basis=[p.co.copy() for p in keys[0].data];coords=[p.co.copy() for p in keys['BodyVolume'].data]
adj=[set() for _ in basis]
for e in body.data.edges:
    a,b=e.vertices;adj[a].add(b);adj[b].add(a)
groups={g.index:g.name for g in body.vertex_groups}
weights=[{groups[g.group]:g.weight for g in v.groups} for v in body.data.vertices]
soft={'Hips','Spine','Chest','LeftArm','RightArm','LeftForeArm','RightForeArm','LeftUpLeg','RightUpLeg'}
smoothed=[p.copy() for p in coords]
for _ in range(18):
    smoothed=[p.lerp(sum((smoothed[j] for j in adj[i]),Vector())/len(adj[i]),.5) if adj[i] else p for i,p in enumerate(smoothed)]
def smooth(a,b,t):
    t=max(0,min(1,(t-a)/(b-a)));return t*t*(3-2*t)
for i,(base,co) in enumerate(zip(basis,coords)):
    w=weights[i];mask=min(1,sum(w.get(n,0) for n in soft))
    co=co.lerp(smoothed[i],mask*.8)
    # Volumen amplio de tórax, cintura, espalda y pelvis; sin concentrarlo en vientre.
    torso=sum(w.get(n,0) for n in ['Hips','Spine','Chest'])
    if torso:
        radial=Vector((base.x,base.y,0)).normalized()
        chest=smooth(1.05,1.22,base.z)*(1-smooth(1.35,1.47,base.z))
        amount=.019+.020*chest
        co+=Vector((radial.x*amount,radial.y*amount*.85,0))*torso
        co.z-=.009*chest*max(0,radial.y)*torso
    for side in ['Left','Right']:
        for part,amount in [('Arm',.014),('ForeArm',.010),('UpLeg',.018)]:
            name=side+part;weight=w.get(name,0)
            if not weight:continue
            bone=rig.data.bones[name];axis=(bone.tail_local-bone.head_local).normalized();length=(bone.tail_local-bone.head_local).length
            along=(base-bone.head_local).dot(axis)/length
            taper=1-smooth(.45,.88,along) if part=='ForeArm' else 1
            offset=base-bone.head_local;radial=(offset-axis*offset.dot(axis)).normalized()
            co+=radial*amount*weight*taper
    neck=w.get('Neck',0)
    if neck:co+=Vector((base.x,base.y,0)).normalized()*.005*neck
    # Mejillas inferiores/mandíbula; el cráneo y la línea de cabello se conservan.
    face=(keys['FaceVolume'].data[i].co-base)*(1-smooth(1.55,1.59,base.z))*.85
    co+=face
    keys['BodyVolume'].data[i].co=co
for k in keys:k.value=0
body['avatar_version']=8;body['source_body']='male-body-base-v7';body['morph_range']='0..1'
body['revision']='BodyVolume: distributed adiposity, softened relief; all other keys preserved'
result={'body':body.name,'vertices':len(basis),'modified_key':'BodyVolume','other_keys_unchanged':all(all((a.co-b.co).length==0 for a,b in zip(k.data,old.data.shape_keys.key_blocks[k.name].data)) for k in keys if k.name!='BodyVolume')}
