"""Corrección local de holgura en pose mediante inversa del skinning; cuerpo intacto."""
import bpy
from mathutils import Matrix
from mathutils.bvhtree import BVHTree
body=bpy.data.objects['male-body-base-v7_Mesh'];rig=body.parent;s=bpy.context.scene
cloth=bpy.data.objects['Shirt_Basic_01']
name=FIT_KEY
for k in body.data.shape_keys.key_blocks:k.value=0
if name!='Basis':body.data.shape_keys.key_blocks[name].value=1
target=cloth.data.shape_keys.key_blocks[name]
coords=[v.co.copy() for v in target.data]
corrected=set()
for cycle in range(3):
    for frame in [1,91,181,271,361]:
        s.frame_set(frame);dg=bpy.context.evaluated_depsgraph_get();be=body.evaluated_get(dg);bm=be.to_mesh()
        tree=BVHTree.FromPolygons([v.co for v in bm.vertices],[list(p.vertices) for p in bm.polygons],all_triangles=True)
        transforms={g.index:rig.pose.bones[g.name].matrix@rig.data.bones[g.name].matrix_local.inverted() for g in cloth.vertex_groups}
        for v in cloth.data.vertices:
            matrix=Matrix(((0,0,0,0),)*4)
            for g in v.groups:matrix+=transforms[g.group]*g.weight
            inv=matrix.to_3x3().inverted_safe();p=matrix@coords[v.index]
            for _ in range(6):
                hit,normal,_,_=tree.find_nearest(p);gap=(p-hit).dot(normal)
                if gap>=.002:break
                correction=normal*(.003-gap);coords[v.index]+=inv@correction;p+=correction;corrected.add(v.index)
        be.to_mesh_clear()
for v,co in zip(target.data,coords):v.co=co
for k in body.data.shape_keys.key_blocks:k.value=0
s.frame_set(1)
result={'key':name,'corrected_vertices':len(corrected)}
