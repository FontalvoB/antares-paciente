import bpy
from pathlib import Path
out=Path(r'C:/Users/Carlos Cortina/Documents/CoppAddresd/antares-paciente/docs/avatar-female-v2-validation')
s=bpy.context.scene;body=bpy.data.objects['Female_Body'];shirt=bpy.data.objects['Female_Shirt']
hairs=[bpy.data.objects[f'Female_Hair_Long_{n:02d}'] for n in [1,2,3]]
for o in [shirt]+hairs:o.hide_render=True
for morph,value in [('BodyVolume',0),('BodyVolume',.25),('BodyVolume',.5),('BodyVolume',.75),('BodyVolume',1),('BodyLean',.5),('BodyLean',1)]:
 for k in body.data.shape_keys.key_blocks:k.value=value if k.name==morph else 0
 s.frame_set(91)
 for cam in ['Front','Profile','ThreeQuarter']:
  s.camera=bpy.data.objects[cam];s.render.filepath=str(out/f'body-{morph}-{value}-{cam}.png');bpy.ops.render.render(write_still=True)
shirt.hide_render=False
for n,hair in enumerate(hairs):
 for h in hairs:h.hide_render=h!=hair
 for morph,value,frame in [('BodyVolume',0,1),('BodyVolume',1,181),('BodyLean',1,271)]:
  for o in [body,shirt]+hairs:
   for k in o.data.shape_keys.key_blocks:k.value=value if k.name==morph else 0
  s.frame_set(frame);cam=['Front','Profile','ThreeQuarter'][n];s.camera=bpy.data.objects[cam]
  s.render.filepath=str(out/f'ensemble-hair{n+1}-{morph}-{value}-{cam}.png');bpy.ops.render.render(write_still=True)
result={'renders':30}
