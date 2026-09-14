import bpy
from mathutils import Vector, Matrix
obj=bpy.data.objects['Female_Shirt'];assert not bpy.data.objects.get('Female_Shirt_Hems')
loops=[[int(i) for i in x.split(',')] for x in obj['boundary_loops']]
adj=[set() for _ in obj.data.vertices]
for e in obj.data.edges:a,b=e.vertices;adj[a].add(b);adj[b].add(a)
bound={i for loop in loops for i in loop};mapping=[];faces=[];allcoords=[];colors=[]
for loop in loops:
    start=len(mapping);center=sum((obj.data.vertices[i].co for i in loop),Vector())/len(loop)
    for i in loop:
        for j in range(4):mapping.append((i,j,center.z>1.38))
    for i in range(len(loop)):
        for j in range(3):faces.append((start+i*4+j,start+((i+1)%len(loop))*4+j,start+((i+1)%len(loop))*4+j+1,start+i*4+j+1))
for key in obj.data.shape_keys.key_blocks:
    temp=bpy.data.meshes.new('HemNormals');temp.from_pydata([v.co for v in key.data],[],[list(p.vertices) for p in obj.data.polygons]);temp.update();coords=[]
    for i,j,neck in mapping:
        co=key.data[i].co;inside=[n for n in adj[i] if n not in bound]
        direction=(sum((key.data[n].co for n in inside),Vector())/len(inside)-co).normalized() if inside else Vector((0,0,1))
        width=.010 if neck else .008
        distances=[0,.0015,width-.001,width];height=[.0006,.002,.002,.0006]
        coords.append(co+direction*distances[j]+temp.vertices[i].normal*height[j])
    allcoords.append(coords);bpy.data.meshes.remove(temp)
mesh=bpy.data.meshes.new('Shirt_Hems');mesh.from_pydata(allcoords[0],[],faces);mesh.update();hems=bpy.data.objects.new('Female_Shirt_Hems',mesh);obj.users_collection[0].objects.link(hems);hems.parent=obj.parent;hems.matrix_world=Matrix.Identity(4)
for g in obj.vertex_groups:hems.vertex_groups.new(name=g.name)
for index,(i,_,_) in enumerate(mapping):
    for g in obj.data.vertices[i].groups:hems.vertex_groups[g.group].add([index],g.weight,'REPLACE')
for key,coords in zip(obj.data.shape_keys.key_blocks,allcoords):
    target=hems.shape_key_add(name=key.name)
    for v,co in zip(target.data,coords):v.co=co
    target.value=0
mod=hems.modifiers.new('CanonicalSkin','ARMATURE');mod.object=obj.parent
mat=obj.data.materials[0].copy();mat.name='Shirt_Cotton_Polished';mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.9
vc=mat.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='ClothTone';mat.node_tree.links.new(vc.outputs['Color'],mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
for o in [obj,hems]:
    o.data.materials.clear();o.data.materials.append(mat)
    attr=o.data.color_attributes.new(name='ClothTone',type='FLOAT_COLOR',domain='POINT')
    for v,c in zip(o.data.vertices,attr.data):
        factor=1 if o==obj else (.72 if mapping[v.index][1] in [0,3] else .87)
        c.color=(.04*factor,.30*factor,.34*factor,1)
    for p in o.data.polygons:p.use_smooth=True
    o['morph_range']='0..1'
# Un material, una malla skinned exportada; los grupos y los nueve keys se unen por nombre.
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);hems.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.join()
obj.data.calc_loop_triangles();result={'object':obj.name,'triangles':len(obj.data.loop_triangles),'materials':len(obj.data.materials),'morphs':len(obj.data.shape_keys.key_blocks)-1}

