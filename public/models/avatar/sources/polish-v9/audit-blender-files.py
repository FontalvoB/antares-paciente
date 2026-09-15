import bpy, os, json
root=os.path.abspath('public/models/avatar')
rows=[]
for folder, dirs, files in os.walk(root):
    for name in files:
        if not name.endswith(('.blend','.blend1')): continue
        file=os.path.join(folder,name)
        try:
            bpy.ops.wm.open_mainfile(filepath=file,load_ui=False)
            props=[]
            for obj in bpy.data.objects:
                for key in obj.keys():
                    value=obj[key]
                    if isinstance(value,str) and any(ext in value for ext in ['.glb','.blend','.png','.jpg']): props.append(value)
            rows.append({'file':file,'externalPaths':list(bpy.utils.blend_paths(absolute=True,packed=False)),'assetProperties':props,'actions':[a.name for a in bpy.data.actions],'meshes':[o.name for o in bpy.context.scene.objects if o.type=='MESH']})
        except Exception as e: rows.append({'file':file,'error':str(e)})
with open('docs/avatar-polish-validation/blender-reference-audit.json','w') as f: json.dump(rows,f,indent=2)
print('AUDITED',len(rows),flush=True)
