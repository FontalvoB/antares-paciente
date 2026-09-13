import bpy, os, json, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
obj=bpy.data.objects['Shirt_Basic_01']; rig=obj.parent; mesh=obj.data
assert not bpy.data.objects.get('Shirt_Basic_01_Seams')
adj=[set() for _ in mesh.vertices]; edges={}
for p in mesh.polygons:
    ids=list(p.vertices)
    for a,b in zip(ids,ids[1:]+ids[:1]):
        adj[a].add(b); adj[b].add(a); key=tuple(sorted((a,b)));edges[key]=edges.get(key,0)+1
boundary=[e for e,n in edges.items() if n==1]
ids=sorted({i for e in boundary for i in e}); lut={i:j for j,i in enumerate(ids)}; n=len(ids)
faces=[]; sides=4
for a,b in boundary:
    a,b=lut[a],lut[b]
    for j in range(sides):
        x,y=a*sides+j,b*sides+j;z=b*sides+(j+1)%sides;w=a*sides+(j+1)%sides
        faces.extend([(x,y,z),(x,z,w)])
coords_by_key=[]
for k in obj.data.shape_keys.key_blocks:
    normal_mesh=bpy.data.meshes.new('Shirt_SeamNormalWork')
    normal_mesh.from_pydata([v.co for v in k.data],[],[list(p.vertices) for p in mesh.polygons]);normal_mesh.update()
    coords=[]
    for i in ids:
        co=k.data[i].co.copy();edge_neighbors=[j for j in adj[i] if tuple(sorted((i,j))) in boundary]
        tangent=(k.data[edge_neighbors[-1]].co-k.data[edge_neighbors[0]].co).normalized()
        normal=normal_mesh.vertices[i].normal.copy();cross=tangent.cross(normal).normalized()
        for j in range(sides):
            angle=j*2*math.pi/sides
            coords.append(co+normal*.0015+(normal*math.cos(angle)+cross*math.sin(angle))*.0018)
    coords_by_key.append(coords)
    bpy.data.meshes.remove(normal_mesh)
data=bpy.data.meshes.new('Shirt_Seams_Surface');data.from_pydata(coords_by_key[0],[],faces);data.update()
seams=bpy.data.objects.new('Shirt_Basic_01_Seams',data);obj.users_collection[0].objects.link(seams);seams.parent=rig
for g in obj.vertex_groups:seams.vertex_groups.new(name=g.name)
for j,i in enumerate(ids):
    for g in mesh.vertices[i].groups:seams.vertex_groups[g.group].add(list(range(j*sides,(j+1)*sides)),g.weight,'REPLACE')
for source,coords in zip(obj.data.shape_keys.key_blocks,coords_by_key):
    key=seams.shape_key_add(name=source.name)
    for v,co in zip(key.data,coords):v.co=co
    key.value=0
mod=seams.modifiers.new('CanonicalSkin','ARMATURE');mod.object=rig
mat=bpy.data.materials.new('Shirt_Ribbed_Edges');mat.use_nodes=True
bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(.023,.11,.13,1);bsdf.inputs['Roughness'].default_value=.9
data.materials.append(mat)
for p in data.polygons:p.use_smooth=True
seams['morph_range']='0..1'
result={'trim':seams.name,'triangles':len(faces)}
