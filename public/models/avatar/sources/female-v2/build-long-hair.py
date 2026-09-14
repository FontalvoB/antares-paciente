import bpy,math
from mathutils import Vector,Matrix
rig=bpy.data.objects['Female_Rig']; source=bpy.data.objects['Female_Hair']; body=bpy.data.objects['Female_Body']
for style in [1,2,3]:
    name=f'Female_Hair_Long_{style:02d}'
    assert name not in bpy.data.objects, 'Do not duplicate a reviewed asset'
    verts=[source.matrix_world@v.co for v in source.data.shape_keys.key_blocks[0].data]
    faces=[tuple(p.vertices) for p in source.data.polygons]
    cap_count=len(verts)
    def lock(points,width,depth):
        start=len(verts); sides=6
        for j,p in enumerate(points):
            tangent=(points[min(j+1,len(points)-1)]-points[max(0,j-1)]).normalized()
            u=Vector((p.x,p.y+.015,0)).cross(tangent).normalized(); v=tangent.cross(u).normalized()
            taper=1-.65*(j/(len(points)-1))**4
            for k in range(sides):
                a=k*math.tau/sides;verts.append(p+u*(math.cos(a)*width*taper)+v*(math.sin(a)*depth*taper))
        for j in range(len(points)-1):
            for k in range(sides):faces.append((start+j*sides+k,start+j*sides+(k+1)%sides,start+(j+1)*sides+(k+1)%sides,start+(j+1)*sides+k))
        faces.append(tuple(start+k for k in reversed(range(sides))))
        faces.append(tuple(start+(len(points)-1)*sides+k for k in range(sides)))
    for n in range(17):
        a=.91+n*(math.tau-1.82)/16
        points=[]
        for j in range(11):
            t=j/10
            radius=1+.07*math.sin(t*math.pi)
            wave=(.012*math.sin(t*math.pi*3+n*.55)*math.sin(t*math.pi/2)) if style==2 else .002*math.sin(t*math.pi+n)
            x=(.096*radius+wave)*math.sin(a)
            y=-.012+(.120*radius+wave)*math.cos(a)-.025*t
            z=1.54-t*((.31 if style==2 else .28)+.009*math.cos(n*1.7))
            if style==3:
                # Gather upper locks into an offset ponytail; lower tail fans softly.
                gather=math.sin(min(t/.5,1)*math.pi/2)
                x=x*(1-.8*gather)+.035*gather+.013*math.sin(t*4+n*.4)*t
                y=y*(1-gather)+(-.155-.055*t)*gather
                z=1.54-.30*t
            points.append(Vector((x,y,z)))
        lock(points,.019 if style!=3 else .015,.006 if style!=2 else .008)
    mesh=bpy.data.meshes.new(name+'_Surface');mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(obj)
    obj.parent=rig;obj.matrix_world=Matrix.Identity(4)
    obj.vertex_groups.new(name='Head').add(list(range(len(verts))),1,'REPLACE')
    mod=obj.modifiers.new('CanonicalSkin','ARMATURE');mod.object=rig
    for source_key in source.data.shape_keys.key_blocks:
        key=obj.shape_key_add(name=source_key.name)
        for i,p in enumerate(verts):
            if i<cap_count:key.data[i].co=source.matrix_world@source_key.data[i].co
            else:key.data[i].co=p
    for mat in source.data.materials:mesh.materials.append(mat)
    for p in mesh.polygons:p.use_smooth=True
    obj['style']=['long straight','long wavy','gathered long ponytail'][style-1]
    obj['attachment']='Head, weight 1; no physics; unchanged canonical Idle'
    obj.hide_render=style!=1
result={'hair':[{'name':bpy.data.objects[f'Female_Hair_Long_{n:02d}'].name,'triangles':sum(len(p.vertices)-2 for p in bpy.data.objects[f'Female_Hair_Long_{n:02d}'].data.polygons)} for n in [1,2,3]]}
