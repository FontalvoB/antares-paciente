"""Patrón continuo de pantalón: cintura única, bifurcación y dos perneras regulares."""
import bpy, math
from mathutils import Vector
from mathutils.kdtree import KDTree
b=bpy.data.objects['Female_Body'];rig=bpy.data.objects['Female_Rig']
names={g.index:g.name for g in b.vertex_groups}
ids={}
for side in ['Left','Right','Hips']:
 allowed={'Hips','Spine','LeftUpLeg','RightUpLeg'} if side=='Hips' else {side+'UpLeg',side+'Leg',side+'Foot'}
 ids[side]=[v.index for v in b.data.vertices if sum(g.weight for g in v.groups if names[g.group] in allowed)>.45]
kd=KDTree(len(b.data.vertices))
for v in b.data.vertices:kd.insert(b.data.shape_keys.key_blocks[0].data[v.index].co,v.index)
kd.balance()

for style in [1,2,3]:
 all_coords={};faces=[]
 for key in b.data.shape_keys.key_blocks:
  coords=[]
  def section(side,z):
   pts=[key.data[i].co for i in ids[side] if abs(key.data[i].co.z-z)<.025]
   if not pts:pts=[key.data[i].co for i in ids[side] if abs(key.data[i].co.z-z)<.06]
   center=Vector(((min(p.x for p in pts)+max(p.x for p in pts))/2,(min(p.y for p in pts)+max(p.y for p in pts))/2,z))
   return pts,center
  def ring_point(pts,center,angle,ease):
   d=Vector((math.cos(angle),math.sin(angle),0));radius=max((p-center).dot(d) for p in pts)
   return center+d*(radius+ease)
  rings=[]
  for z in [.935,.915,.88,.84,.80,.76]:
   pts,center=section('Hips',z);ring=[]
   for i in range(48):ring.append(len(coords));coords.append(ring_point(pts,center,2*math.pi*i/48,.013))
   rings.append(ring)
  if key.name=='Basis':
   for a,c in zip(rings,rings[1:]):
    for i in range(48):j=(i+1)%48;faces.extend([(a[i],c[i],c[j]),(a[i],c[j],a[j])])
  hip=rings[-1];front=coords[hip[12]];back=coords[hip[36]]
  bridge=[]
  for i in range(1,8):bridge.append(len(coords));coords.append(front.lerp(back,i/8))
  # Right geometric side is anatomically Right in the imported mesh coordinates.
  for side,outer,inner,angles in [
   ('Right',[hip[i%48] for i in range(36,61)],bridge,[-math.pi/2+math.pi*i/24 for i in range(25)]+[math.pi/2+math.pi*i/8 for i in range(1,8)]),
   ('Left',[hip[i] for i in range(12,37)],list(reversed(bridge)),[math.pi/2+math.pi*i/24 for i in range(25)]+[3*math.pi/2+math.pi*i/8 for i in range(1,8)])]:
   previous=outer+inner
   for z in [.70,.65,.60,.55,.50,.45,.40,.35,.30,.25,.20,.155,.115]:
    pts,center=section(side,z);ease=.017+[.006,.016,.03][style-1]*max(0,min(1,(.7-z)/.4))
    if style==1 and z<.17:ease=.012
    ring=[]
    for angle in angles:ring.append(len(coords));coords.append(ring_point(pts,center,angle,ease))
    if key.name=='Basis':
     for i in range(32):j=(i+1)%32;faces.extend([(previous[i],ring[i],ring[j]),(previous[i],ring[j],previous[j])])
    previous=ring
  all_coords[key.name]=coords
 obj=bpy.data.objects['Pants_female_'+str(style).zfill(2)]
 materials=list(obj.data.materials)
 mesh=bpy.data.meshes.new('Pants_female_'+str(style).zfill(2)+'_Continuous')
 mesh.from_pydata(all_coords['Basis'],[],faces);mesh.update();obj.data=mesh;obj.vertex_groups.clear()
 for g in b.vertex_groups:obj.vertex_groups.new(name=g.name)
 for v in mesh.vertices:
  _,i,_=kd.find(v.co);groups=sorted(b.data.vertices[i].groups,key=lambda g:-g.weight)[:4];total=sum(g.weight for g in groups)
  for g in groups:obj.vertex_groups[g.group].add([v.index],g.weight/total,'REPLACE')
 for keyname,coords in all_coords.items():
  target=obj.shape_key_add(name=keyname)
  for v,co in zip(target.data,coords):v.co=co
  target.value=0;target.slider_min=0;target.slider_max=1
 for material in materials:mesh.materials.append(material)
 for p in mesh.polygons:
  p.use_smooth=True;p.material_index=int(len(materials)>1 and ((style==1 and p.center.z<.17) or p.center.z>.92))
 obj['construction']='Continuous loft; one waist and shared crotch bridge; nine body-derived morphs; normalized canonical weights'
 mesh.update()
result={'continuousPants':[(bpy.data.objects['Pants_female_'+str(s).zfill(2)].name,len(bpy.data.objects['Pants_female_'+str(s).zfill(2)].data.polygons)) for s in [1,2,3]]}
