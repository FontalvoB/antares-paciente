import bpy, json, os
from mathutils.bvhtree import BVHTree
root='C:/Users/Carlos Cortina/Documents/CoppAddresd/antares-paciente/public/models/avatar'
out=root+'/sources/customization-v1'
rows=[]
for gender,scene_name,body_name,rig_name in [('female','Scene','Female_Body','Female_Rig'),('male','Avatar_Polished_V9','male-body-base-v9_Mesh','Avatar_V9_Rig')]:
    scene=bpy.data.scenes[scene_name];bpy.context.window.scene=scene
    body=bpy.data.objects[body_name];rig=bpy.data.objects[rig_name]
    objects=[bpy.data.objects['Pants_'+gender+'_'+str(n).zfill(2)] for n in [1,2,3]]+[bpy.data.objects['Shoes_'+gender+'_01']]
    saved={o.name:[k.value for k in o.data.shape_keys.key_blocks] for o in [body]+objects}
    for o in objects:o.hide_set(False)
    for value in [0,.25,.5,.75,1,-.5,-1]:
        for o in [body]+objects:
            for k in o.data.shape_keys.key_blocks:k.value=0
            o.data.shape_keys.key_blocks['BodyVolume' if value>=0 else 'BodyLean'].value=abs(value)
        for frame in [1,91,181,271,361]:
            scene.frame_set(frame);deps=bpy.context.evaluated_depsgraph_get();evaluated=body.evaluated_get(deps);mesh=evaluated.to_mesh()
            tree=BVHTree.FromPolygons([body.matrix_world@v.co for v in mesh.vertices],[list(p.vertices) for p in mesh.polygons]);evaluated.to_mesh_clear()
            for o in objects:
                e=o.evaluated_get(deps);m=e.to_mesh();gaps=[]
                for v in m.vertices:
                    co=o.matrix_world@v.co;hit,n,_,_=tree.find_nearest(co);gaps.append((co-hit).dot(n))
                e.to_mesh_clear();rows.append({'gender':gender,'object':o.name,'body':value,'frame':frame,'minGapMm':round(min(gaps)*1000,3),'insideOver2mm':sum(g<-.002 for g in gaps)})
    for o in [body]+objects:
        for k in o.data.shape_keys.key_blocks:k.value=0
    scene.frame_set(1)
    for o in bpy.data.collections['AVATAR_Customization'].objects:o.hide_render=True
    for n,o in enumerate(objects):
        o.hide_render=False
        scene.render.filepath=out+'/'+o.name+'.png';bpy.ops.render.render(write_still=True)
        o.hide_render=True
    for o in [body]+objects:
        for key,value in zip(o.data.shape_keys.key_blocks,saved[o.name]):key.value=value
with open(out+'/fit-audit.json','w') as f:json.dump(rows,f,indent=2)
result={'samples':len(rows),'worst':sorted(rows,key=lambda r:r['minGapMm'])[:10]}
