import bpy,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
obj=bpy.data.objects['Shirt_Basic_03'];body=bpy.data.objects['male-body-base-v9_Mesh']
loops=[[int(i) for i in x.split(',')] for x in obj['boundary_loops']]
neck=loops[2];basis=obj.data.shape_keys.key_blocks[0]
angles=[math.atan2(basis.data[i].co.y+.035,basis.data[i].co.x) for i in neck]
band_start=1595+4*(len(loops[0])+len(loops[1]))
indices=neck+list(range(band_start,band_start+len(neck)*4))
for key in obj.data.shape_keys.key_blocks:
    bk=body.data.shape_keys.key_blocks[key.name];tree=BVHTree.FromPolygons([v.co for v in bk.data],[list(p.vertices) for p in body.data.polygons],all_triangles=True)
    radii=[];heights=[]
    for a in angles:
        z=1.439-.047*max(0,math.sin(a));origin=Vector((0,-.035,z));direction=Vector((math.cos(a),math.sin(a),0));hit,n,_,d=tree.ray_cast(origin,direction,.3)
        radii.append((d if hit else .085)+.012);heights.append(z)
    for _ in range(5):radii=[(radii[j-1]+r*2+radii[(j+1)%len(radii)])/4 for j,r in enumerate(radii)]
    for j,(i,a,r,z) in enumerate(zip(neck,angles,radii,heights)):
        direction=Vector((math.cos(a),math.sin(a),0));co=Vector((0,-.035,z))+direction*r;key.data[i].co=co
        for ring,(width,height) in enumerate([(0,0),(.0015,.0015),(.011,.0015),(.012,0)]):
            key.data[band_start+j*4+ring].co=co+direction*width+Vector((0,0,height-width*.30))
    key.value=0
# El cuello se cose sobre el tórax, sin alternancia de huesos alrededor del borde.
for group in obj.vertex_groups:
    group.remove(indices)
obj.vertex_groups['Chest'].add(indices,1,'REPLACE')
result={'neck_vertices':len(neck),'band_width_mm':12}
