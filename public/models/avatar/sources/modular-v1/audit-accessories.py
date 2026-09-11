import bpy,json,os
from mathutils.bvhtree import BVHTree
root='C:/Users/Carlos Cortina/Documents/CoppAddresd/antares-paciente'
body=bpy.data.objects['male-body-base-v7_Mesh'];s=bpy.context.scene
objects=[bpy.data.objects[n] for n in ['Glasses_01','Watch_01','Bracelet_01']]
rows=[]
for state in ['Basis','BodyVolume','BodyLean','FaceVolume','Arms']:
    for obj in [body]+objects:
        for k in obj.data.shape_keys.key_blocks:k.value=float(k.name==state and state!='Basis')
    for frame in [1,91,181,271,361]:
        s.frame_set(frame);dg=bpy.context.evaluated_depsgraph_get();be=body.evaluated_get(dg);bm=be.to_mesh()
        tree=BVHTree.FromPolygons([v.co for v in bm.vertices],[list(p.vertices) for p in bm.polygons],all_triangles=True)
        for obj in objects:
            oe=obj.evaluated_get(dg);om=oe.to_mesh();gaps=[]
            for v in om.vertices:
                hit,n,_,_=tree.find_nearest(v.co);gaps.append((v.co-hit).dot(n))
            rows.append(dict(asset=obj.name,state=state,frame=frame,minGapMm=min(gaps)*1000,deeperThan2mm=sum(g<-.002 for g in gaps)))
            oe.to_mesh_clear()
        be.to_mesh_clear()
for obj in [body]+objects:
    for k in obj.data.shape_keys.key_blocks:k.value=0
s.frame_set(1);s.camera=bpy.data.objects['V2_Avatar_InspectionCamera.001']
with open(root+'/docs/avatar-modular-validation/accessory-audit.json','w') as f:json.dump(rows,f,indent=2)
result={'samples':len(rows),'worst':sorted(rows,key=lambda r:r['minGapMm'])[:6]}
