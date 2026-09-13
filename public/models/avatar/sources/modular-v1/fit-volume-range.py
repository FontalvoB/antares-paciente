"""Validar también interpolaciones; los extremos por sí solos no garantizan holgura."""
import bpy
from mathutils import Matrix
from mathutils.bvhtree import BVHTree
body=bpy.data.objects['male-body-base-v8_Mesh'];rig=body.parent;s=bpy.context.scene
cloth=bpy.data.objects[globals().get('FIT_OBJECT','Shirt_Basic_02')]
base=[v.co.copy() for v in cloth.data.shape_keys.key_blocks[0].data]
target=cloth.data.shape_keys.key_blocks['BodyVolume'];coords=[v.co.copy() for v in target.data];changed=set()
for k in body.data.shape_keys.key_blocks:k.value=0
for cycle in range(3):
    for amount in [.25,.5,.75,1]:
        body.data.shape_keys.key_blocks['BodyVolume'].value=amount
        for frame in [1,91,181,271,361]:
            s.frame_set(frame);dg=bpy.context.evaluated_depsgraph_get();be=body.evaluated_get(dg);bm=be.to_mesh()
            tree=BVHTree.FromPolygons([v.co for v in bm.vertices],[list(p.vertices) for p in bm.polygons],all_triangles=True)
            transforms={g.index:rig.pose.bones[g.name].matrix@rig.data.bones[g.name].matrix_local.inverted() for g in cloth.vertex_groups}
            for v in cloth.data.vertices:
                matrix=Matrix(((0,0,0,0),)*4)
                for g in v.groups:matrix+=transforms[g.group]*g.weight
                inv=matrix.to_3x3().inverted_safe();p=matrix@base[v.index].lerp(coords[v.index],amount)
                for _ in range(6):
                    hit,normal,_,_=tree.find_nearest(p);gap=(p-hit).dot(normal)
                    if gap>=.0015:break
                    correction=normal*(.0025-gap);coords[v.index]+=inv@correction/amount;p+=correction;changed.add(v.index)
            be.to_mesh_clear()
for v,co in zip(target.data,coords):v.co=co
body.data.shape_keys.key_blocks['BodyVolume'].value=0;s.frame_set(1)
result={'object':cloth.name,'corrected_vertices':len(changed)}
