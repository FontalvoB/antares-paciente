import bpy, json, os
from mathutils.bvhtree import BVHTree
body=bpy.data.objects['male-body-base-v7_Mesh'];cloth=bpy.data.objects['Shirt_Basic_01'];seams=bpy.data.objects['Shirt_Basic_01_Seams']
s=bpy.context.scene;out=r'C:\Users\Carlos Cortina\Documents\CoppAddresd\antares-paciente\docs\avatar-modular-validation'
report=[]
for state,vol,lean in [('base',0,0),('intermediate',.5,0),('volume',1,0),('lean',0,1)]:
    for obj in [body,cloth,seams]:
        for k in obj.data.shape_keys.key_blocks:k.value=0
        obj.data.shape_keys.key_blocks['BodyVolume'].value=vol;obj.data.shape_keys.key_blocks['BodyLean'].value=lean
    for frame in [1,91,181,271,361]:
        s.frame_set(frame);dg=bpy.context.evaluated_depsgraph_get();b=body.evaluated_get(dg);c=cloth.evaluated_get(dg)
        bm=b.to_mesh();cm=c.to_mesh()
        bvh=BVHTree.FromPolygons([b.matrix_world@v.co for v in bm.vertices],[list(p.vertices) for p in bm.polygons],all_triangles=True)
        gaps=[]
        for v in cm.vertices:
            co=c.matrix_world@v.co;hit,normal,_,_=bvh.find_nearest(co);gaps.append((co-hit).dot(normal))
        report.append({'state':state,'frame':frame,'minimum_signed_gap_mm':min(gaps)*1000,'vertices_deeper_than_2mm':sum(x<-.002 for x in gaps),'vertices':len(gaps)})
        b.to_mesh_clear();c.to_mesh_clear()
        if globals().get('AUDIT_RENDER',True) and frame in [1,181]:
            s.render.filepath=os.path.join(out,f'shirt-{state}-{frame}.png');bpy.ops.render.render(write_still=True)
for obj in [body,cloth,seams]:
    for k in obj.data.shape_keys.key_blocks:k.value=0
s.frame_set(1)
with open(os.path.join(out,'shirt-audit.json'),'w') as f:json.dump(report,f,indent=2)
result={'samples':report}
