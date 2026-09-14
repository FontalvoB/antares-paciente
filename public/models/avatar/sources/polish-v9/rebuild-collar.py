import bpy,math
from mathutils import Vector
obj=bpy.data.objects['Shirt_Basic_03'];mesh=obj.data;keys=mesh.shape_keys.key_blocks;group_names=[g.name for g in obj.vertex_groups]
loops=[[int(i) for i in x.split(',')] for x in obj['boundary_loops']];neck=loops[2];bandstart=1595+4*(len(loops[0])+len(loops[1]))
adj=[set() for _ in mesh.vertices]
for e in mesh.edges:a,b=e.vertices;adj[a].add(b);adj[b].add(a)
region=set(neck);front=set(neck)
for _ in range(3):front={j for i in front for j in adj[i] if j<1595}-region;region|=front
region|=set(range(bandstart,bandstart+len(neck)*4))
faces=[list(p.vertices) for p in mesh.polygons if not any(i in region for i in p.vertices)]
edges={}
for ids in faces:
 for a,b in zip(ids,ids[1:]+ids[:1]):e=tuple(sorted((a,b)));edges[e]=edges.get(e,0)+1
boundary={}
for (a,b),n in edges.items():
 if n==1:boundary.setdefault(a,[]).append(b);boundary.setdefault(b,[]).append(a)
left=set(boundary);rings=[]
while left:
 first=next(iter(left));ring=[first];previous=None;current=first
 while True:
  choices=[j for j in boundary[current] if j!=previous];nxt=choices[0]
  if nxt==first or nxt in ring:break
  ring.append(nxt);previous,current=current,nxt
 left.difference_update(ring);rings.append(ring)
outer=max(rings,key=lambda ring:sum(keys[0].data[i].co.z for i in ring)/len(ring))
allcoords=[[v.co.copy() for v in k.data] for k in keys];weights=[[(g.group,g.weight) for g in v.groups] for v in mesh.vertices]
oldcolors=mesh.color_attributes['ClothTone'];colors=[tuple(c.color) for c in oldcolors.data]
angles=[math.atan2(keys[0].data[i].co.y+.035,keys[0].data[i].co.x) for i in outer]
previous=outer
for step,t in enumerate([.55,1,1.05]):
 ids=[]
 for j,(i,a) in enumerate(zip(outer,angles)):
  index=len(weights);ids.append(index);weights.append([(obj.vertex_groups['Chest'].index,1)])
  shade=1 if step==0 else .79 if step==1 else .68;colors.append((.04*shade,.30*shade,.34*shade,1))
  for k,coords in zip(keys,allcoords):
   co=k.data[i].co;target=Vector((.088*math.cos(a),-.035+.09*math.sin(a),1.439-.041*max(0,math.sin(a))))
   coords.append(co.lerp(target,min(1,t))+Vector((0,0,.002 if step==1 else 0)))
 for j in range(len(outer)):faces.append([previous[j],previous[(j+1)%len(outer)],ids[(j+1)%len(outer)],ids[j]])
 previous=ids
used=sorted({i for f in faces for i in f});lut={old:i for i,old in enumerate(used)}
data=bpy.data.meshes.new('Shirt_Polished_Collar');data.from_pydata([allcoords[0][i] for i in used],[],[[lut[i] for i in f] for f in faces]);data.update()
names=[k.name for k in keys];materials=list(mesh.materials);obj.data=data
for name in group_names:obj.vertex_groups.new(name=name)
for name,coords in zip(names,allcoords):
 k=obj.shape_key_add(name=name)
 for v,i in zip(k.data,used):v.co=coords[i]
 k.value=0
for new,i in enumerate(used):
 for group,w in weights[i]:obj.vertex_groups[group].add([new],w,'REPLACE')
for m in materials:data.materials.append(m)
attr=data.color_attributes.new(name='ClothTone',type='FLOAT_COLOR',domain='POINT')
for c,i in zip(attr.data,used):c.color=colors[i]
import bmesh
bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
for p in data.polygons:p.use_smooth=True
data.update();data.calc_loop_triangles();result={'outer_ring':len(outer),'triangles':len(data.loop_triangles),'vertices':len(used)}
