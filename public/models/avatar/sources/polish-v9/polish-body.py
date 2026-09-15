import bpy,math
from mathutils import Vector
body=bpy.data.objects['male-body-base-v9_Mesh'];keys=body.data.shape_keys.key_blocks
base=[p.co.copy() for p in keys[0].data];vol=[p.co.copy() for p in keys['BodyVolume'].data]
adj=[set() for _ in base]
for e in body.data.edges:a,b=e.vertices;adj[a].add(b);adj[b].add(a)
smooth=vol[:]
for _ in range(10):smooth=[p.lerp(sum((smooth[j] for j in adj[i]),Vector())/len(adj[i]),.45) if adj[i] else p for i,p in enumerate(smooth)]
gn={g.index:g.name for g in body.vertex_groups}
for i,p in enumerate(base):
    w={gn[g.group]:g.weight for g in body.data.vertices[i].groups}
    torso=sum(w.get(n,0) for n in ['Hips','Spine','Chest']);limbs=sum(v for n,v in w.items() if n.endswith('Arm') or n.endswith('UpLeg'))
    co=vol[i].lerp(smooth[i],min(1,torso+limbs)*.5)
    r=Vector((p.x,p.y,0)).normalized()
    co+=Vector((r.x*.008,r.y*.008,0))*torso
    keys['BodyVolume'].data[i].co=co
for k in keys:k.value=0
result={'body':body.name,'edited':'BodyVolume','keys':[k.name for k in keys]}
