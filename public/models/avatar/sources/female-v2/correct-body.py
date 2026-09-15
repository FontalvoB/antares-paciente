import bpy, math, json, hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree

root=Path(r'C:/Users/Carlos Cortina/Documents/CoppAddresd/antares-paciente')
body=bpy.data.objects['Female_Body']; keys=body.data.shape_keys.key_blocks
world=body.matrix_world.copy(); inv=world.inverted()
base=[world@p.co for p in keys[0].data]
old={k.name:[world@p.co-base[i] for i,p in enumerate(k.data)] for k in keys}
def digest(key): return hashlib.sha256(b''.join(__import__('struct').pack('3f',*p.co) for p in key.data)).hexdigest()
protected={n:digest(keys[n]) for n in ['Basis','Waist','Chest']}
kd=KDTree(len(base))
for i,p in enumerate(base):kd.insert(p,i)
kd.balance()
neighbors=[[(j,math.exp(-4*(d/.025)**2)) for _,j,d in kd.find_range(p,.025)] for p in base]
def filtered(values):
    return [sum((values[j]*w for j,w in ns),Vector())/sum(w for _,w in ns) for ns in neighbors]
def bell(v,c,w):return math.exp(-((v-c)/w)**2)
# Repair discontinuous/normal-noise deltas only; preserve two already smooth keys.
smooth={n:filtered(old[n]) for n in ['Arms','Thighs','FaceVolume','MuscleDefinition']}
volume=[]; abdomen=[]
for i,p in enumerate(base):
    x,y,z=p
    torso=math.exp(-(abs(x)/.22)**6)
    waist=bell(z,1.02,.16)*torso
    hips=bell(z,.84,.12)*torso
    chest=bell(z,1.19,.10)*torso
    belly=bell(z,.96,.15)*torso
    # Continuous ellipse expansion: no sign(y) jump at the flank.
    v=Vector((x*(.24*waist+.12*hips+.055*chest),
              math.tanh(y/.075)*(.036*belly+.022*hips+.007*chest),0))
    v+=smooth['Thighs'][i]*1.15+smooth['Arms'][i]*.65+smooth['FaceVolume'][i]*.45
    volume.append(v)
    abdomen.append(Vector((x*.09*belly,math.tanh(y/.075)*.022*belly,0)))
updates={**smooth,'BodyVolume':volume,'BodyLean':[v*-.4 for v in volume],'Abdomen':abdomen}
for name,values in updates.items():
    for i,v in enumerate(values):keys[name].data[i].co=inv@(base[i]+v)
for k in keys:k.value=0
assert all(digest(keys[n])==h for n,h in protected.items())
body.data.update()
rows=[]
for key in keys[1:]:
    coords=[world@p.co for p in key.data];ratios=[]
    for e in body.data.edges:
        a,b=e.vertices;d=(base[a]-base[b]).length
        if d>1e-6:ratios.append((coords[a]-coords[b]).length/d)
    ratios.sort(); rows.append({'morph':key.name,'p99edgeStretch':ratios[int(len(ratios)*.99)],'maxEdgeStretch':max(ratios)})
(root/'docs/avatar-female-v2-validation/after-morph-audit.json').write_text(json.dumps({'metrics':rows,'unchanged':protected,'corrected':list(updates)},indent=2))
bpy.context.view_layer.update()
result={'metrics':rows,'unchanged':list(protected),'corrected':list(updates)}
