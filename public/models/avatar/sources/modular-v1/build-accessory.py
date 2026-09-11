import bpy, math
from mathutils import Vector
body=bpy.data.objects['male-body-base-v7_Mesh'];rig=body.parent
kind=ACCESSORY;name={'glasses':'Glasses_01','watch':'Watch_01','bracelet':'Bracelet_01'}[kind]
assert not bpy.data.objects.get(name)
verts=[];faces=[];slots=[]
def addface(ids,mat=0):faces.append(ids);slots.append(mat)
def sweep(path,radius,mat=0,closed=False,sides=6):
    start=len(verts)
    for i,p in enumerate(path):
        tangent=(path[(i+1)%len(path)]-path[i-1]).normalized() if closed else (path[min(i+1,len(path)-1)]-path[max(i-1,0)]).normalized()
        n=tangent.cross(Vector((0,0,1)))
        if n.length<.1:n=tangent.cross(Vector((0,1,0)))
        n.normalize();b=tangent.cross(n).normalized()
        for j in range(sides):verts.append(p+radius*(n*math.cos(j*2*math.pi/sides)+b*math.sin(j*2*math.pi/sides)))
    for i in range(len(path) if closed else len(path)-1):
        for j in range(sides):addface((start+i*sides+j,start+((i+1)%len(path))*sides+j,start+((i+1)%len(path))*sides+(j+1)%sides,start+i*sides+(j+1)%sides),mat)
def rounded(center,u,v,w,h,n=32):
    return [center+u*(w*math.copysign(abs(math.cos(i*2*math.pi/n))**.55,math.cos(i*2*math.pi/n)))+v*(h*math.copysign(abs(math.sin(i*2*math.pi/n))**.55,math.sin(i*2*math.pi/n))) for i in range(n)]
def disk(path,mat):
    start=len(verts);verts.extend(path);addface(tuple(range(start,start+len(path))),mat)
if kind=='glasses':
    bone='Head';center=Vector((0,.125,1.606))
    for side in [-1,1]:
        path=rounded(center+Vector((side*.044,0,0)),Vector((1,0,0)),Vector((0,0,1)),.028,.017)
        sweep(path,.0025,closed=True);disk([p+Vector((0,-.0007,0)) for p in path],1)
        sweep([Vector((side*.073,.121,1.610)),Vector((side*.087,.090,1.610)),Vector((side*.090,.015,1.600)),Vector((side*.090,-.040,1.594)),Vector((side*.086,-.052,1.576))],.0022)
    sweep([Vector((-.016,.125,1.608)),Vector((-.009,.142,1.611)),Vector((.009,.142,1.611)),Vector((.016,.125,1.608))],.002)
else:
    bone='LeftForeArm' if kind=='watch' else 'RightForeArm'
    b=rig.data.bones[bone];axis=(b.tail_local-b.head_local).normalized();center=b.tail_local-axis*.026
    u=Vector((0,1,0));u=(u-axis*u.dot(axis)).normalized();v=axis.cross(u).normalized()
    # Radio medido en la sección de muñeca del cuerpo en reposo.
    section=[p.co-center for p in body.data.shape_keys.key_blocks[0].data if abs((p.co-center).dot(axis))<.009 and (p.co-center).length<.10]
    ru=max(abs(p.dot(u)) for p in section)+.003;rv=max(abs(p.dot(v)) for p in section)+.003
    width=.018 if kind=='watch' else .007
    start=len(verts);segments=48
    for along in [-width/2,width/2]:
        for i in range(segments):
            angle=2*math.pi*i/segments;verts.append(center+axis*along+u*(ru*math.cos(angle))+v*(rv*math.sin(angle)))
    for i in range(segments):addface((start+i,start+(i+1)%segments,start+segments+(i+1)%segments,start+segments+i))
    for along in [-width/2,width/2]:sweep([center+axis*along+u*(ru*math.cos(i*2*math.pi/segments))+v*(rv*math.sin(i*2*math.pi/segments)) for i in range(segments)],.0012,closed=True)
    if kind=='watch':
        c=center+u*(ru+.005)
        rings=[]
        for height,scale in [(-.004,.88),(-.002,1),(.003,1),(.004,.88)]:
            rings.append(len(verts));verts.extend(rounded(c+u*height,axis,v,.021*scale,.017*scale))
        for a,b in zip(rings,rings[1:]):
            for i in range(32):addface((a+i,a+(i+1)%32,b+(i+1)%32,b+i),1)
        disk(rounded(c+u*.0041,axis,v,.018,.014),2)
        for i in range(12):
            angle=i*math.pi/6;direction=axis*math.cos(angle)+v*math.sin(angle)
            sweep([c+u*.0045+direction*.010,c+u*.0045+direction*.012],.00045,3,sides=4)
        sweep([c+u*.0047+axis*.008+v*.004,c+u*.0047,c+u*.0047-axis*.004+v*.006],.0007,3,sides=4)
    else:
        c=center+u*(ru+.001)
        disk(rounded(c,axis,v,.005,.009,16),1)
if kind=='glasses':
    for p in verts:p.z-=.026*min(1,max(0,(p.y+.045)/.15))
mesh=bpy.data.meshes.new(name+'_Surface');mesh.from_pydata(verts,[],faces);mesh.update()
obj=bpy.data.objects.new(name,mesh);bpy.data.collections['AVATAR_Modular'].objects.link(obj);obj.parent=rig
group=obj.vertex_groups.new(name=bone);group.add(list(range(len(verts))),1,'REPLACE')
for source in body.data.shape_keys.key_blocks:
    key=obj.shape_key_add(name=source.name)
    for i,p in enumerate(verts):
        co=p.copy()
        if kind=='glasses':
            if source.name in ['BodyVolume','FaceVolume']:co.x*=1.045;co.y+=.002
            if source.name=='BodyLean':co.x*=.99
        else:
            factor=1.09 if source.name=='BodyVolume' else .98 if source.name=='BodyLean' else 1.035 if source.name=='Arms' else 1
            delta=co-center;co=center+axis*delta.dot(axis)+(delta-axis*delta.dot(axis))*factor
        key.data[i].co=co
    key.value=0
specs=[('Polymer',(.012,.022,.027,1),.75,0),('BrushedMetal',(.22,.25,.27,1),.35,.8),('Screen',(.003,.015,.019,1),.18,0),('Dial',(.55,.78,.76,1),.6,0)]
if kind=='glasses':specs=[('Frame',(.008,.012,.018,1),.45,0),('Lens',(.5,.65,.7,.12),.15,0)]
for label,color,rough,metal in specs[:max(slots)+1]:
    mat=bpy.data.materials.new(name+'_'+label);mat.use_nodes=True;bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=color;bsdf.inputs['Roughness'].default_value=rough;bsdf.inputs['Metallic'].default_value=metal;bsdf.inputs['Alpha'].default_value=color[3]
    mesh.materials.append(mat)
for p,slot in zip(mesh.polygons,slots):p.material_index=slot;p.use_smooth=True
mod=obj.modifiers.new('CanonicalAttachment','ARMATURE');mod.object=rig;obj['morph_range']='0..1';obj['attachment_bone']=bone
mesh.calc_loop_triangles()
result={'name':name,'bone':bone,'vertices':len(verts),'triangles':len(mesh.loop_triangles),'materials':len(mesh.materials)}
