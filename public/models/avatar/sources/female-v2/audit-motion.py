import bpy,json
from pathlib import Path
from mathutils.bvhtree import BVHTree
root=Path(r'C:/Users/Carlos Cortina/Documents/CoppAddresd/antares-paciente')
s=bpy.context.scene;body=bpy.data.objects['Female_Body'];shirt=bpy.data.objects['Female_Shirt']
objects=[body,shirt]+[bpy.data.objects[f'Female_Hair_Long_{n:02d}'] for n in [1,2,3]]
rows=[]
for morph,value in [('BodyVolume',0),('BodyVolume',.25),('BodyVolume',.5),('BodyVolume',.75),('BodyVolume',1),('BodyLean',.5),('BodyLean',1)]:
    for o in objects:
        for k in o.data.shape_keys.key_blocks:k.value=value if k.name==morph else 0
    for frame in [1,91,181,271,361]:
        s.frame_set(frame);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
        eb=body.evaluated_get(deps); bm=eb.to_mesh();bc=[eb.matrix_world@v.co for v in bm.vertices]
        tree=BVHTree.FromPolygons(bc,[list(p.vertices) for p in bm.polygons],all_triangles=False)
        for o in objects[1:]:
            eo=o.evaluated_get(deps);me=eo.to_mesh();neg=[]
            for v in me.vertices:
                q=eo.matrix_world@v.co;h,n,_,d=tree.find_nearest(q)
                gap=(q-h).dot(n)
                if gap<-.0005:neg.append(-gap)
            rows.append({'morph':morph,'value':value,'frame':frame,'object':o.name,'negativeSamples':len(neg),'maxPenetrationMM':1000*max(neg,default=0)})
            eo.to_mesh_clear()
        eb.to_mesh_clear()
(root/'docs/avatar-female-v2-validation/motion-contact-audit.json').write_text(json.dumps({'method':'Evaluated skinned vertex to nearest body triangle signed normal distance; conservative proxy, not exact solid intersection','samples':rows},indent=2))
result={'worst':sorted(rows,key=lambda r:r['maxPenetrationMM'],reverse=True)[:8]}
