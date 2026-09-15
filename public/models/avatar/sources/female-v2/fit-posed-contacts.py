import bpy
from mathutils import Matrix
from mathutils.bvhtree import BVHTree
rig=bpy.data.objects['Female_Rig']; body=bpy.data.objects['Female_Body']; scene=bpy.context.scene
objects=[bpy.data.objects['Female_Shirt']]+[bpy.data.objects[f'Female_Hair_Long_{n:02d}'] for n in [1,2,3]]
count=0
for keyname in body.data.shape_keys.key_blocks.keys():
    for k in body.data.shape_keys.key_blocks:k.value=1 if k.name==keyname and keyname!='Basis' else 0
    for frame in [1,91,181,271]:
        scene.frame_set(frame);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
        eb=body.evaluated_get(deps); mesh=eb.to_mesh()
        tree=BVHTree.FromPolygons([eb.matrix_world@v.co for v in mesh.vertices],[list(p.vertices) for p in mesh.polygons],all_triangles=False)
        for obj in objects:
            bones={g.index:rig.matrix_world@rig.pose.bones[g.name].matrix@rig.data.bones[g.name].matrix_local.inverted()@rig.matrix_world.inverted()@obj.matrix_world for g in obj.vertex_groups}
            key=obj.data.shape_keys.key_blocks[keyname]
            for i,p in enumerate(key.data):
                mat=Matrix(((0,0,0,0),)*4)
                for g in obj.data.vertices[i].groups:mat+=bones[g.group]*g.weight
                q=mat@p.co
                for _ in range(3):
                    h,n,_,d=tree.find_nearest(q);gap=(q-h).dot(n)
                    if gap<.004:
                        q+=n*(.004-gap);count+=1
                p.co=mat.inverted()@q
        eb.to_mesh_clear()
for obj in [body]+objects:
    for k in obj.data.shape_keys.key_blocks:k.value=0
result={'contactCorrections':count}
