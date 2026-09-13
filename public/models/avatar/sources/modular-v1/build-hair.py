"""Tres peinados ajustados al cráneo, con deformaciones del cuerpo y Head existente."""
import bpy, math
from mathutils import Vector
body=bpy.data.objects['male-body-base-v7_Mesh'];rig=body.parent;keys=body.data.shape_keys.key_blocks
style=HAIR_STYLE;name=f'Hair_{style:02d}'
assert not bpy.data.objects.get(name)
basis=[v.co.copy() for v in keys[0].data]
def line(p):
    front=max(0,min(1,p.y/.075));side=min(1,abs(p.x)/.10)
    return p.z-(1.552+.10*front+.04*side**4)
def point(mapping,source):return sum((source.data[i].co*w for i,w in mapping.items()),Vector())
verts=[];faces=[];maps=[];lookup={}
def add(m):
    key=tuple(sorted((i,round(w,7)) for i,w in m.items() if w>1e-8))
    if key not in lookup:lookup[key]=len(verts);verts.append(point(m,keys[0]));maps.append(m)
    return lookup[key]
for face in body.data.polygons:
    polygon=[{i:1.0} for i in face.vertices];clipped=[]
    for j,current in enumerate(polygon):
        previous=polygon[j-1];a=line(point(previous,keys[0]));b=line(point(current,keys[0]))
        if (a>=0)!=(b>=0):
            t=a/(a-b);mix={}
            for i,w in previous.items():mix[i]=mix.get(i,0)+w*(1-t)
            for i,w in current.items():mix[i]=mix.get(i,0)+w*t
            clipped.append(mix)
        if b>=0:clipped.append(current)
    if len(clipped)>2:
        indices=[add(m) for m in clipped]
        for j in range(1,len(indices)-1):faces.append((indices[0],indices[j],indices[j+1]))
if style>1:
    refined=[]
    for a,b,c in faces:
        mids=[]
        for x,y in [(a,b),(b,c),(c,a)]:
            mapping={}
            for i,w in maps[x].items():mapping[i]=mapping.get(i,0)+w*.5
            for i,w in maps[y].items():mapping[i]=mapping.get(i,0)+w*.5
            mids.append(add(mapping))
        ab,bc,ca=mids;refined.extend([(a,ab,ca),(ab,b,bc),(ca,bc,c),(ab,bc,ca)])
    faces=refined
mesh=bpy.data.meshes.new(name+'_Surface');mesh.from_pydata(verts,[],faces);mesh.update()
obj=bpy.data.objects.new(name,mesh);bpy.data.collections['AVATAR_Modular'].objects.link(obj);obj.parent=rig
group=obj.vertex_groups.new(name='Head');group.add(list(range(len(verts))),1,'REPLACE')
normal_mesh=bpy.data.meshes.new('Hair_NormalWork');normal_mesh.from_pydata(basis,[],[list(p.vertices) for p in body.data.polygons]);normal_mesh.update()
for source in keys:
    key=obj.shape_key_add(name=source.name)
    for j,mapping in enumerate(maps):
        base=point(mapping,keys[0]);p=point(mapping,source)
        n=sum((normal_mesh.vertices[i].normal*w for i,w in mapping.items()),Vector()).normalized()
        crown=max(0,min(1,(base.z-1.58)/.12));edge=max(0,min(1,line(base)/.025))
        if style==1:
            amount=.0035+.0012*(.5+.5*math.sin(base.x*620)*math.sin(base.y*620))*edge
            p+=n*amount
        elif style==2:
            part=1-.65*math.exp(-((base.x-.025)/.006)**2)
            wave=.002*(.5+.5*math.sin((base.y+base.x*.35)*550))
            p+=n*(.005+edge*(.020*crown*part+wave));p.x-=.012*crown*edge;p.z+=.012*crown*edge
        else:
            curl=(.5+.5*math.sin(base.x*410+math.sin(base.y*190))*math.sin(base.y*390+base.z*180))
            p+=n*(.005+edge*(.020+.010*curl));p.z+=.008*crown*edge
        key.data[j].co=p
    key.value=0
bpy.data.meshes.remove(normal_mesh)
for p in mesh.polygons:p.use_smooth=True
mod=obj.modifiers.new('HeadAttachment','ARMATURE');mod.object=rig
mat=bpy.data.materials.new(name+'_Brown');mat.use_nodes=True
bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(.022,.010,.006,1);bsdf.inputs['Roughness'].default_value=.72
mesh.materials.append(mat);obj['morph_range']='0..1';obj['attachment_bone']='Head'
# Color por vértice exportable: variación fina de mechones sin shader exclusivo de Blender.
colors=mesh.color_attributes.new(name='HairShade',type='FLOAT_COLOR',domain='POINT')
for i,p in enumerate(verts):
    noise=.5+.5*math.sin(p.x*1751+math.sin(p.y*1381))*math.sin(p.z*1543)
    shade=.014+.025*noise
    colors.data[i].color=(shade,shade*.48,shade*.28,1)
node=mat.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='HairShade'
mat.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
result={'name':name,'vertices':len(verts),'triangles':len(faces),'head_group':1,'styles':style}
