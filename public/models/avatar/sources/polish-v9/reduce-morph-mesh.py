"""Reducir copia y transferir cada deformación usando la misma correspondencia baricéntrica."""
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
source=bpy.data.objects[SOURCE];assert not bpy.data.objects.get(DEST)
for k in source.data.shape_keys.key_blocks:k.value=0
base=[p.co.copy() for p in source.data.shape_keys.key_blocks[0].data]
source.data.calc_loop_triangles();triangles=[tuple(p.vertices) for p in source.data.loop_triangles]
tree=BVHTree.FromPolygons(base,triangles,all_triangles=True)
obj=source.copy();obj.data=source.data.copy();obj.name=DEST;source.users_collection[0].objects.link(obj)
obj.hide_set(False);obj.hide_render=False
obj.shape_key_clear()
for p,co in zip(obj.data.vertices,base):p.co=co
for m in list(obj.modifiers):obj.modifiers.remove(m)
if bpy.context.object and bpy.context.object.mode!='OBJECT':bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
modifier=obj.modifiers.new('Reduction','DECIMATE');modifier.ratio=RATIO;modifier.use_collapse_triangulate=True
bpy.ops.object.modifier_apply(modifier=modifier.name)
mapping=[];errors=[]
for p in obj.data.vertices:
    hit,n,face,d=tree.find_nearest(p.co);ids=triangles[face]
    w=barycentric_transform(hit,*[base[i] for i in ids],Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1)))
    mapping.append((ids,w,p.co.copy()-hit));errors.append(d)
coords=[p.co.copy() for p in obj.data.vertices]
for original in source.data.shape_keys.key_blocks:
    key=obj.shape_key_add(name=original.name)
    for i,(ids,w,offset) in enumerate(mapping):
        key.data[i].co=coords[i]+sum(((original.data[j].co-base[j])*f for j,f in zip(ids,w)),Vector())
    key.value=0
modifier=obj.modifiers.new('CanonicalSkin','ARMATURE');modifier.object=source.parent
obj['morph_range']='0..1';obj['source_revision']=SOURCE
source.hide_render=True;source.hide_set(True)
obj.data.calc_loop_triangles()
result={'source':SOURCE,'object':obj.name,'before':len(triangles),'after':len(obj.data.loop_triangles),'vertices':len(obj.data.vertices),'maxRestErrorMm':max(errors)*1000,'meanRestErrorMm':sum(errors)/len(errors)*1000}
