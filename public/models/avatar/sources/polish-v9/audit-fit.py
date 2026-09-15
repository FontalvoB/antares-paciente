import bpy,json
from mathutils.bvhtree import BVHTree
body=bpy.data.objects['male-body-base-v9_Mesh'];objects=[bpy.data.objects[n] for n in AUDIT_OBJECTS];s=bpy.context.scene;rows=[]
states=[('BodyVolume',v) for v in [0,.25,.5,.75,1]]+[(k.name,1) for k in body.data.shape_keys.key_blocks if k.name not in ['Basis','BodyVolume']]
for name,value in states:
 for obj in [body]+objects:
  for k in obj.data.shape_keys.key_blocks:k.value=value if k.name==name else 0
 for frame in [1,91,181,271,361]:
  s.frame_set(frame);dg=bpy.context.evaluated_depsgraph_get();be=body.evaluated_get(dg);bm=be.to_mesh();bm.calc_loop_triangles()
  tree=BVHTree.FromPolygons([v.co for v in bm.vertices],[list(p.vertices) for p in bm.loop_triangles],all_triangles=True)
  for obj in objects:
   oe=obj.evaluated_get(dg);om=oe.to_mesh();gaps=[]
   for v in om.vertices:
    hit,n,_,_=tree.find_nearest(v.co);gaps.append((v.co-hit).dot(n))
   rows.append({'asset':obj.name,'morph':name,'value':value,'frame':frame,'minGapMm':min(gaps)*1000,'deeperThan2mm':sum(g<-.002 for g in gaps)})
   oe.to_mesh_clear()
  be.to_mesh_clear()
for obj in [body]+objects:
 for k in obj.data.shape_keys.key_blocks:k.value=0
s.frame_set(1)
with open('C:/Users/Carlos Cortina/Documents/CoppAddresd/antares-paciente/docs/avatar-polish-validation/'+AUDIT_FILE,'w') as f:json.dump(rows,f,indent=2)
result={'samples':len(rows),'worst':sorted(rows,key=lambda p:p['minGapMm'])[:5]}
