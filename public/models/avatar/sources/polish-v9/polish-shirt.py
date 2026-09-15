import bpy,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
cloth=bpy.data.objects['Shirt_Basic_03'];body=bpy.data.objects['male-body-base-v9_Mesh']
loops=[[int(i) for i in x.split(',')] for x in cloth['boundary_loops']]
adj=[set() for _ in cloth.data.vertices]
for e in cloth.data.edges:a,b=e.vertices;adj[a].add(b);adj[b].add(a)
boundary={i for loop in loops for i in loop}
for key in cloth.data.shape_keys.key_blocks:
    coords=[p.co.copy() for p in key.data]
    # Limpiar contornos de corte, no añadir ondulaciones arbitrarias.
    for loop in loops:
        for _ in range(14):
            updates={i:coords[i].lerp((coords[loop[j-1]]+coords[loop[(j+1)%len(loop)]])*.5,.45) for j,i in enumerate(loop)}
            for i,p in updates.items():coords[i]=p
        center=sum((coords[i] for i in loop),Vector())/len(loop)
        if center.z>1.38:
            for i in loop:
                p=coords[i];a=math.atan2(p.y+.035,p.x)
                coords[i]=Vector((.087*math.cos(a),-.035+.076*math.sin(a),1.435-.026*max(0,math.sin(a))))
    for _ in range(18):
        coords=[p if i in boundary else p.lerp(sum((coords[j] for j in adj[i]),Vector())/len(adj[i]),.48) for i,p in enumerate(coords)]
    source=body.data.shape_keys.key_blocks[key.name]
    tree=BVHTree.FromPolygons([p.co for p in source.data],[list(p.vertices) for p in body.data.polygons],all_triangles=True)
    for i,p in enumerate(coords):
        hit,n,_,_=tree.find_nearest(p)
        # Holgura de 18–26 mm; mayor en torso bajo a volumen alto.
        ease=.018+(.008 if key.name=='BodyVolume' and p.z<1.25 and abs(p.x)<.25 else 0)
        gap=(p-hit).dot(n)
        if gap<ease:p+=n*(ease-gap)
        key.data[i].co=p
    key.value=0
cloth['revision']='Crew neck, smooth fabric and relaxed fit; hems added after pose audit'
result={'object':cloth.name,'boundary_loops':len(loops)}
