import bpy,math
from mathutils import Vector,Matrix
rig=bpy.data.objects['Female_Rig']; source=bpy.data.objects['Female_Hair']
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
for style in [1,2,3]:
    obj=bpy.data.objects[f'Female_Hair_Long_{style:02d}']; oldmesh=obj.data
    verts=[]; faces=[]; N=64; R=23
    for j in range(R):
        t=j/(R-1)
        for n in range(N):
            a=n*math.tau/N; angle=min(a,math.tau-a)
            curtain=smooth(.58,1.15,angle)
            phi=min(t/.48,1)*1.40
            frontphi=t*1.12
            p=frontphi*(1-curtain)+phi*curtain
            x=.102*math.sin(p)*math.sin(a)
            y=-.015+.123*math.sin(p)*math.cos(a)
            z=1.505+.135*math.cos(p)
            down=max(0,(t-.48)/.52)*curtain
            length=.255 if style==2 else .235
            if style==3:length=.07
            z-=length*down
            wave=(.012*math.sin(down*math.pi*3+2*a)*down) if style==2 else .002*math.sin(a*3)*down
            radial=.002*math.cos(a*28+down*.4)*math.sin(p)+wave
            x+=(radial+.009*down)*math.sin(a)
            y+=(radial+.014*down)*math.cos(a)-.012*down
            z+=.006*math.cos(5*a)*down**5
            verts.append(Vector((x,y,z)))
    for j in range(R-1):
        for n in range(N):faces.append((j*N+n,j*N+(n+1)%N,(j+1)*N+(n+1)%N,(j+1)*N+n))
    if style==3:
        start=len(verts); K=20; L=19
        for j in range(L):
            t=j/(L-1);width=.018+.030*math.sin(t*math.pi)**.6
            for n in range(K):
                a=n*math.tau/K;r=1+.07*math.cos(10*a+t)
                verts.append(Vector((.028+.015*math.sin(t*4)+width*math.cos(a)*r,-.125-.067*math.sin(t*math.pi/2)+width*.55*math.sin(a)*r,1.52-.30*t)))
        for j in range(L-1):
            for n in range(K):faces.append((start+j*K+n,start+j*K+(n+1)%K,start+(j+1)*K+(n+1)%K,start+(j+1)*K+n))
    mesh=bpy.data.meshes.new(obj.name+'_Refined');mesh.from_pydata(verts,[],faces);mesh.update();obj.data=mesh
    for g in list(obj.vertex_groups):obj.vertex_groups.remove(g)
    obj.vertex_groups.new(name='Head').add(list(range(len(verts))),1,'REPLACE')
    for key in source.data.shape_keys.key_blocks:
        new=obj.shape_key_add(name=key.name)
        for i,v in enumerate(verts):new.data[i].co=v
    mat=bpy.data.materials.get('Female_Long_Hair_Chestnut')
    if not mat:
        mat=bpy.data.materials.new('Female_Long_Hair_Chestnut');mat.use_nodes=True
        bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.055,.022,.012,1);bs.inputs['Roughness'].default_value=.52
    mesh.materials.append(mat)
    for p in mesh.polygons:p.use_smooth=True
    obj.hide_render=style!=1
result={'objects':[{'name':bpy.data.objects[f'Female_Hair_Long_{s:02d}'].name,'triangles':sum(len(p.vertices)-2 for p in bpy.data.objects[f'Female_Hair_Long_{s:02d}'].data.polygons)} for s in [1,2,3]]}
