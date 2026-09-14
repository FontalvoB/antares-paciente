import bpy,os,json
root='C:/Users/Carlos Cortina/Documents/CoppAddresd/antares-paciente/public/models/avatar';s=bpy.context.scene;rig=bpy.data.objects['male-body-base-v7_Armature']
exports=[('male-body-base-v9_Mesh','bodies/male-body-base-v9.glb'),('Shirt_Collar_Review','clothing/tops/male-shirt-basic-01-v3.glb'),('Hair_02_V9','hair/male-hair-02-v3.glb'),('Hair_03_V9','hair/male-hair-03-v3.glb'),('Glasses_02','accessories/glasses/unisex-glasses-02.glb'),('Watch_02','accessories/watches/unisex-watch-02.glb'),('Bracelet_02','accessories/bracelets/unisex-bracelet-02.glb')]
for obj in s.objects:
 if obj.type=='MESH' and obj.data.shape_keys:
  for k in obj.data.shape_keys.key_blocks:k.value=0
s.frame_set(1);rows=[]
for name,path in exports:
 obj=bpy.data.objects[name]
 for a,b in zip(obj.data.vertices,obj.data.shape_keys.key_blocks[0].data):a.co=b.co
 obj.data.update();bpy.ops.object.select_all(action='DESELECT');obj.hide_set(False);obj.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
 output=root+'/'+path;assert not os.path.exists(output)
 bpy.ops.export_scene.gltf(filepath=output,export_format='GLB',use_selection=True,export_animations=False,export_rest_position_armature=True,export_skins=True,export_morph=True,export_apply=False,export_extras=name.startswith('male-body'),export_try_sparse_sk=True)
 rows.append({'name':name,'file':path,'bytes':os.path.getsize(output)})
# Fuente autónoma y limpia: solo objetos finales, rig y cámaras/luces de revisión.
scene=bpy.data.scenes.new('Avatar_Polished_V9');scene.render.fps=30;scene.frame_start=1;scene.frame_end=361
for name,_ in exports:scene.collection.objects.link(bpy.data.objects[name])
scene.collection.objects.link(rig)
for o in s.objects:
 if o.type in ['CAMERA','LIGHT']:scene.collection.objects.link(o)
scene.camera=bpy.data.objects['V2_Avatar_InspectionCamera.001'];scene.render.resolution_x=555;scene.render.resolution_y=800
bpy.data.libraries.write(root+'/sources/polish-v9/avatar-polished-v9.blend',{scene},fake_user=True,compress=True)
with open(root+'/sources/polish-v9/export-manifest.json','w') as f:json.dump(rows,f,indent=2)
result={'exports':rows,'source':'sources/polish-v9/avatar-polished-v9.blend'}
