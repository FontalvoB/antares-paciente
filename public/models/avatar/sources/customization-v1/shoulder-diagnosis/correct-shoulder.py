"""Corrección local de superficie; conserva topología, pesos y deltas de morphs."""
import bpy, math, json, hashlib, struct
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree

b = bpy.data.objects['Female_Body']
out = Path(__file__).parent
keys = b.data.shape_keys.key_blocks
base = [p.co.copy() for p in keys[0].data]
if not (out / 'coordinates-before.json').exists():
    (out / 'coordinates-before.json').write_text(json.dumps({k.name:[list(p.co) for p in k.data] for k in keys}))
original = json.loads((out / 'coordinates-before.json').read_text())
base = [Vector(p) for p in original['Basis']]
# Vecindad espacial para no abrir las costuras UV duplicadas del GLB.
kd = KDTree(len(base))
for i,p in enumerate(base): kd.insert(p,i)
kd.balance()
neighbors = [[(j,math.exp(-3*(d/.04)**2)) for _,j,d in kd.find_range(p,.04)] for p in base]
mask = [math.exp(-((abs(p.x)-.194)/.071)**4-((p.z-1.323)/.075)**4) for p in base]
coords = [p.copy() for p in base]
normal_mesh=bpy.data.meshes.new('Shoulder_Normal_Reference')
normal_mesh.from_pydata(base,[],[list(p.vertices) for p in b.data.polygons])
normal_mesh.update()
normals=[Vector() for p in base]
for face in normal_mesh.polygons:
    for i in face.vertices:normals[i]+=face.normal*face.area
normals=[sum((normals[j] for _,j,d in kd.find_range(p,.00002)),Vector()).normalized() for p in base]
bpy.data.meshes.remove(normal_mesh)
for iteration in range(24):
    updated = [p.copy() for p in coords]
    for i,p in enumerate(coords):
        if mask[i]<.015: continue
        ns=neighbors[i]
        avg=sum((coords[j]*w for j,w in ns),Vector())/sum(w for _,w in ns)
        movement=(avg-p)*(.55*mask[i])
        # Rellenar concavidades sin adelgazar el volumen exterior del deltoides.
        along=movement.dot(normals[i])
        movement=normals[i]*max(0,along)
        delta=(p+movement)-base[i]
        if delta.length>.026: delta*=.026/delta.length
        updated[i]=base[i]+delta
    coords=updated
offsets=[p-base[i] for i,p in enumerate(coords)]
for k in keys:
    for i,p in enumerate(k.data): p.co=Vector(original[k.name][i])+offsets[i]
for i,v in enumerate(b.data.vertices): v.co=keys[0].data[i].co
b.data.update(); bpy.context.view_layer.update()
result={'vertices':sum(d.length>1e-7 for d in offsets),'maxOffsetMetres':max(d.length for d in offsets),'weights':'unchanged','topology':'unchanged','morphDeltas':'same common offset for every key'}
(out/'surface-correction.json').write_text(json.dumps(result,indent=2))
