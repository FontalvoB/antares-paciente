import bpy,json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
body=bpy.data.objects['Female_Body']; shirt=bpy.data.objects['Female_Shirt']
bkeys=body.data.shape_keys.key_blocks; skeys=shirt.data.shape_keys.key_blocks
bw=body.matrix_world; sw=shirt.matrix_world; si=sw.inverted()
base=[bw@v.co for v in bkeys[0].data]; faces=[list(p.vertices) for p in body.data.polygons]
bvh=BVHTree.FromPolygons(base,faces,all_triangles=True)
coords=[sw@v.co for v in skeys[0].data]
adj=[set() for _ in coords]; counts={}
for p in shirt.data.polygons:
    vs=list(p.vertices)
    for a,b in zip(vs,vs[1:]+vs[:1]):
        adj[a].add(b);adj[b].add(a);e=tuple(sorted((a,b)));counts[e]=counts.get(e,0)+1
boundary={i for e,n in counts.items() if n==1 for i in e}
for _ in range(12):
    coords=[p if i in boundary or not adj[i] else p.lerp(sum((coords[j] for j in adj[i]),Vector())/len(adj[i]),.35) for i,p in enumerate(coords)]
mapping=[]
for p in coords:
    hit,normal,face,d=bvh.find_nearest(p);mapping.append((hit,faces[face]))
for source,target in zip(bkeys,skeys):
    bc=[bw@v.co for v in source.data]
    tree=BVHTree.FromPolygons(bc,faces,all_triangles=True)
    for i,p in enumerate(coords):
        hit,ids=mapping[i];a,b,c=ids
        q=p+barycentric_transform(hit,base[a],base[b],base[c],bc[a],bc[b],bc[c])-hit
        # Keep moderate 18 mm minimum ease; do not inflate the entire garment.
        for _ in range(3):
            h,n,_,_=tree.find_nearest(q); gap=(q-h).dot(n)
            if gap<.018:q+=n*(.018-gap)
        target.data[i].co=si@q
    target.value=0
shirt.hide_render=False
shirt['source_body']='female-body-base-v2'
shirt['construction']='Smooth existing cloth; continuous barycentric morph transfer; 18 mm minimum rest-space ease'
shirt.data.update();bpy.context.view_layer.update()
result={'vertices':len(coords),'triangles':sum(len(p.vertices)-2 for p in shirt.data.polygons)}
