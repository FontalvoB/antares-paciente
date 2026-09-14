"""Camiseta independiente; correspondencia baricéntrica con el cuerpo protegido."""
import bpy, math, os
from mathutils import Vector, Matrix

body = bpy.data.objects['Female_Body']
rig = bpy.data.objects['Female_Rig']
assert not bpy.data.objects.get('Female_Shirt'), 'La prenda ya existe; inspeccionar antes de repetir.'
keys = body.data.shape_keys.key_blocks
basis = [v.co.copy() for v in keys[0].data]
allowed = {'Hips', 'Spine', 'Chest', 'Neck', 'RightShoulder', 'LeftShoulder', 'RightArm', 'LeftArm'}
group_names = {g.index:g.name for g in body.vertex_groups}
eligible = [sum(g.weight for g in v.groups if group_names[g.group] in allowed) > .5 for v in body.data.vertices]
directions = {side:(rig.data.bones[side+'Arm'].tail_local-rig.data.bones[side+'Arm'].head_local).normalized() for side in ['Right','Left']}
def distances(p):
    return [p.z-.83, 1.36-p.z] + [max(.221-abs(p.x), .155-(p-rig.matrix_world@rig.data.bones[side+'Arm'].head_local).dot(directions[side])) if ((p.x>0)==(side=='Right')) else 1.0 for side in ['Right','Left']]

verts, faces, mappings, lookup = [], [], [], {}
def point(mapping):
    return sum((basis[i]*w for i,w in mapping.items()), Vector())
def add(mapping):
    key=tuple(sorted((i,round(w,7)) for i,w in mapping.items() if w>1e-8))
    if key not in lookup:
        lookup[key]=len(verts); verts.append(point(mapping)); mappings.append(mapping)
    return lookup[key]
for poly in body.data.polygons:
    # Cortes de patrón sobre una copia; ninguna cara del cuerpo se elimina.
    polygon=[{i:1.0} for i in poly.vertices]
    for plane in range(4):
        clipped=[]
        for j,current in enumerate(polygon):
            previous=polygon[j-1]
            a,b=distances(point(previous))[plane],distances(point(current))[plane]
            if (a>=0)!=(b>=0):
                t=a/(a-b); mix={}
                for i,w in previous.items(): mix[i]=mix.get(i,0)+w*(1-t)
                for i,w in current.items(): mix[i]=mix.get(i,0)+w*t
                clipped.append(mix)
            if b>=0: clipped.append(current)
        polygon=clipped
        if not polygon: break
    if len(polygon)>=3:
        ids=[add(m) for m in polygon]
        for j in range(1,len(ids)-1): faces.append((ids[0],ids[j],ids[j+1]))

mesh=bpy.data.meshes.new('Female_Shirt_Surface')
mesh.from_pydata(verts,[],faces); mesh.update()
obj=bpy.data.objects.new('Female_Shirt',mesh)
collection=bpy.data.collections.get('AVATAR_Modular') or bpy.data.collections.new('AVATAR_Modular')
if collection.name not in bpy.context.scene.collection.children: bpy.context.scene.collection.children.link(collection)
collection.objects.link(obj)
obj.parent=rig; obj.matrix_world=Matrix.Identity(4)
for g in body.vertex_groups: obj.vertex_groups.new(name=g.name)
for j,mapping in enumerate(mappings):
    weights={}
    for i,factor in mapping.items():
        for g in body.data.vertices[i].groups: weights[g.group]=weights.get(g.group,0)+factor*g.weight
    weights=dict(sorted(weights.items(),key=lambda x:-x[1])[:4]); total=sum(weights.values())
    for g,w in weights.items(): obj.vertex_groups[g].add([j],w/total,'REPLACE')

# Holgura en cada Shape Key; nunca cambia el cuerpo ni sus coordenadas.
normals=[v.normal.copy() for v in body.data.vertices]
for source in keys:
    target=obj.shape_key_add(name=source.name)
    for j,mapping in enumerate(mappings):
        co=sum((source.data[i].co*w for i,w in mapping.items()),Vector())
        normal=sum((normals[i]*w for i,w in mapping.items()),Vector()).normalized()
        target.data[j].co=co+normal*.032
    target.slider_min=0; target.slider_max=1
    target.value=0
obj['morph_range']='0..1'
obj['source_body']='female-body-base-v1'
obj['construction']='Barycentric body surface transfer; independent cloth mesh; 14 mm ease.'
obj['source_vertex_mapping']=[str(sorted(m.items())) for m in mappings]
# Suavizar la tela manteniendo los contornos de corte y holgura exterior.
from mathutils.bvhtree import BVHTree
adj=[set() for _ in verts]; edge_counts={}
for face in faces:
    for i,j in zip(face,face[1:]+face[:1]):
        adj[i].add(j); adj[j].add(i); edge=tuple(sorted((i,j))); edge_counts[edge]=edge_counts.get(edge,0)+1
boundary={i for edge,n in edge_counts.items() if n==1 for i in edge}
for source,target in zip(keys,obj.data.shape_keys.key_blocks):
    coords=[p.co.copy() for p in target.data]
    bvh=BVHTree.FromPolygons([v.co for v in source.data],[list(p.vertices) for p in body.data.polygons],all_triangles=True)
    for _ in range(20):
        coords=[co if i in boundary or not adj[i] else co.lerp(sum((coords[j] for j in adj[i]),Vector())/len(adj[i]),.45) for i,co in enumerate(coords)]
    for i,co in enumerate(coords):
        hit,normal,_,_=bvh.find_nearest(co)
        gap=(co-hit).dot(normal)
        if gap<.018:co+=normal*(.018-gap)
        target.data[i].co=co
modifier=obj.modifiers.new('CanonicalSkin','ARMATURE'); modifier.object=rig
for p in mesh.polygons:p.use_smooth=True
mat=bpy.data.materials.new('Shirt_Petrol_Cotton'); mat.diffuse_color=(.035,.17,.20,1); mat.use_nodes=True
bsdf=mat.node_tree.nodes.get('Principled BSDF'); bsdf.inputs['Base Color'].default_value=mat.diffuse_color; bsdf.inputs['Roughness'].default_value=.85
mesh.materials.append(mat)
bpy.context.view_layer.update()
result={'object':obj.name,'vertices':len(mesh.vertices),'triangles':len(mesh.polygons),'morphs':[k.name for k in obj.data.shape_keys.key_blocks],'dimensions':list(obj.dimensions)}


