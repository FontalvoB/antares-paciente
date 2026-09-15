import bpy
from mathutils import Matrix
from mathutils.bvhtree import BVHTree
rig=bpy.data.objects['Female_Rig'];body=bpy.data.objects['Female_Body'];s=bpy.context.scene
objects=[bpy.data.objects['Female_Shirt']]+[bpy.data.objects[f'Female_Hair_Long_{n:02d}'] for n in [1,2,3]]
count=0
for morph,value in [('BodyVolume',0),('BodyVolume',.25),('BodyVolume',.5),('BodyVolume',.75),('BodyVolume',1),('BodyLean',.5),('BodyLean',1)]:
 for obj in [body]+objects:
  for k in obj.data.shape_keys.key_blocks:k.value=value if k.name==morph else 0
 for frame in [1,91,181,271]:
  s.frame_set(frame);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
  eb=body.evaluated_get(deps);bm=eb.to_mesh();tree=BVHTree.FromPolygons([eb.matrix_world@v.co for v in bm.vertices],[list(p.vertices) for p in bm.polygons],all_triangles=False)
  for obj in objects:
   eo=obj.evaluated_get(deps);me=eo.to_mesh()
   bones={g.index:rig.matrix_world@rig.pose.bones[g.name].matrix@rig.data.bones[g.name].matrix_local.inverted()@rig.matrix_world.inverted()@obj.matrix_world for g in obj.vertex_groups}
   changes=[]
   for i,v in enumerate(me.vertices):
    q=eo.matrix_world@v.co;h,n,_,_=tree.find_nearest(q);gap=(q-h).dot(n)
    if gap<.001:
     mat=Matrix(((0,0,0,0),)*4)
     for g in obj.data.vertices[i].groups:mat+=bones[g.group]*g.weight
     changes.append((i,mat.to_3x3().inverted()@(n*(.005-gap))))
   eo.to_mesh_clear()
   for i,delta in changes:
    for k in obj.data.shape_keys.key_blocks:k.data[i].co+=delta
   count+=len(changes)
  eb.to_mesh_clear()
result={'intermediateContactCorrections':count}
