import bpy,os,json
root='C:/Users/Carlos Cortina/Documents/CoppAddresd/antares-paciente/public/models/avatar';rows=[]
for gender,scene_name,rig_name in [('female','Scene','Female_Rig'),('male','Avatar_Polished_V9','Avatar_V9_Rig')]:
 scene=bpy.data.scenes[scene_name];bpy.context.window.scene=scene;rig=bpy.data.objects[rig_name];scene.frame_set(1)
 for o in scene.objects:o.select_set(False)
 for kind,styles in [('pants',[1,2,3]),('shoes',[1])]:
  for style in styles:
   o=bpy.data.objects[kind.capitalize()+'_'+gender+'_'+str(style).zfill(2)];o.hide_set(False)
   for k in o.data.shape_keys.key_blocks:k.value=0
   for v,k in zip(o.data.vertices,o.data.shape_keys.key_blocks[0].data):v.co=k.co
   o.data.update();o.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
   path=root+'/clothing/'+kind+'/'+kind+'-'+gender+'-'+str(style).zfill(2)+'.glb';os.makedirs(os.path.dirname(path),exist_ok=True)
   bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,use_active_scene=True,export_animations=False,export_rest_position_armature=True,export_skins=True,export_morph=True,export_apply=False,export_extras=True,export_try_sparse_sk=True)
   rows.append({'path':path,'bytes':os.path.getsize(path),'triangles':sum(len(p.vertices)-2 for p in o.data.polygons),'morphs':[k.name for k in o.data.shape_keys.key_blocks][1:]})
   o.select_set(False);rig.select_set(False)
with open(root+'/sources/customization-v1/export-manifest.json','w') as f:json.dump(rows,f,indent=2)
bpy.ops.wm.save_as_mainfile(filepath=root+'/sources/customization-v1/customization-final.blend',copy=True)
result={'exports':rows}
