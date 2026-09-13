import bpy,ast
from mathutils import Vector
old=bpy.data.objects['male-body-base-v7_Mesh'];body=bpy.data.objects['male-body-base-v8_Mesh']
source=bpy.data.objects['Shirt_Basic_01'];assert not bpy.data.objects.get('Shirt_Basic_02')
shirt=source.copy();shirt.data=source.data.copy();shirt.name='Shirt_Basic_02';source.users_collection[0].objects.link(shirt)
shirt.hide_render=False;shirt.hide_set(False);source.hide_render=True;source.hide_set(True)
bpy.data.objects['Shirt_Basic_01_Seams'].hide_render=True;bpy.data.objects['Shirt_Basic_01_Seams'].hide_set(True)
delta=[a.co-b.co for a,b in zip(body.data.shape_keys.key_blocks['BodyVolume'].data,old.data.shape_keys.key_blocks['BodyVolume'].data)]
target=shirt.data.shape_keys.key_blocks['BodyVolume']
for i,mapping in enumerate(source['source_vertex_mapping']):
    target.data[i].co+=sum((delta[index]*weight for index,weight in ast.literal_eval(mapping)),Vector())
shirt['source_body']='male-body-base-v8';shirt['revision']='BodyVolume adapted; all other shapes unchanged'
src=open('C:/Users/Carlos Cortina/Documents/CoppAddresd/antares-paciente/public/models/avatar/sources/modular-v1/fit-shirt-pose.py').read()
FIT_KEY='BodyVolume'
exec(compile(src.replace('male-body-base-v7_Mesh','male-body-base-v8_Mesh').replace('Shirt_Basic_01','Shirt_Basic_02'),'fit-shirt-v8','exec'))
src=open('C:/Users/Carlos Cortina/Documents/CoppAddresd/antares-paciente/public/models/avatar/sources/modular-v1/finish-shirt.py').read()
exec(compile(src.replace('Shirt_Basic_01','Shirt_Basic_02'),'seams-v8','exec'))
