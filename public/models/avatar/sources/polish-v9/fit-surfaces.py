import bpy
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
body=bpy.data.objects['male-body-base-v9_Mesh'];obj=bpy.data.objects['Shirt_Collar_Review'];rig=body.parent;s=bpy.context.scene
key=obj.data.shape_keys.key_blocks[FIT_KEY];coords=[v.co.copy() for v in key.data];base=[v.co.copy() for v in obj.data.shape_keys.key_blocks[0].data]
for k in body.data.shape_keys.key_blocks:k.value=0
fixed=set()
for cycle in range(3):
 for amount in ([.25,.5,.75,1] if FIT_KEY=='BodyVolume' else [1]):
  if FIT_KEY!='Basis':body.data.shape_keys.key_blocks[FIT_KEY].value=amount
  for frame in [1,91,181,271,361]:
   s.frame_set(frame);dg=bpy.context.evaluated_depsgraph_get();be=body.evaluated_get(dg);bm=be.to_mesh();bm.calc_loop_triangles();tree=BVHTree.FromPolygons([v.co for v in bm.vertices],[list(t.vertices) for t in bm.loop_triangles],all_triangles=True)
   transforms={g.index:rig.pose.bones[g.name].matrix@rig.data.bones[g.name].matrix_local.inverted() for g in obj.vertex_groups}
   matrices=[]
   for v in obj.data.vertices:
    m=Matrix(((0,0,0,0),)*4)
    for g in v.groups:m+=transforms[g.group]*g.weight
    matrices.append(m)
   posed=[m@base[i].lerp(co,amount) for i,(m,co) in enumerate(zip(matrices,coords))]
   corrections={}
   for face in obj.data.polygons:
    ids=list(face.vertices);samples=[sum((posed[i] for i in ids),Vector())/len(ids)]
    samples += [(posed[a]+posed[b])*.5 for a,b in zip(ids,ids[1:]+ids[:1])]
    for p in samples:
     hit,n,_,_=tree.find_nearest(p);gap=(p-hit).dot(n)
     if gap<.001:
      correction=n*(.002-gap)
      for i in ids:
       if i not in corrections or correction.length>corrections[i].length:corrections[i]=correction
   for i,delta in corrections.items():coords[i]+=matrices[i].to_3x3().inverted_safe()@delta/amount;fixed.add(i)
   be.to_mesh_clear()
for v,co in zip(key.data,coords):v.co=co
for k in body.data.shape_keys.key_blocks:k.value=0
s.frame_set(1);result={'key':FIT_KEY,'adjustedVertices':len(fixed)}
