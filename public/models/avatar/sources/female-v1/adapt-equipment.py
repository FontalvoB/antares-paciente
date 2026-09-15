import bpy, math, os
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
s=bpy.data.scenes['Female_V1'];bpy.context.window.scene=s
body=bpy.data.objects['Female_Body'];rig=bpy.data.objects['Female_Rig'];rig.data.pose_position='REST'
keys=body.data.shape_keys.key_blocks;polys=[list(p.vertices) for p in body.data.polygons];coords=[p.co.copy() for p in keys[0].data]
bvh=BVHTree.FromPolygons(coords,polys,all_triangles=True)
root='C:/Users/Carlos Cortina/Documents/CoppAddresd/antares-paciente/public/models/avatar/'
spec=[('Shirt_Collar_Review','Female_Shirt','clothing/tops/female-shirt-basic-01-v1.glb'),('Hair_02_V9','Female_Hair','hair/female-hair-02-v1.glb'),('Glasses_02','Female_Glasses','accessories/glasses/female-glasses-02-v1.glb'),('Watch_02','Female_Watch','accessories/watches/female-watch-02-v1.glb'),('Bracelet_02','Female_Bracelet','accessories/bracelets/female-bracelet-02-v1.glb')]
rows=[]
for source,name,file in spec:
    assert not bpy.data.objects.get(name),name
    original=bpy.data.objects[source];obj=original.copy();obj.data=original.data.copy();obj.name=name;s.collection.objects.link(obj);obj.hide_set(False);obj.hide_render=False
    obj.shape_key_clear();obj.modifiers.clear();obj.parent=rig;obj.matrix_world=Matrix.Identity(4)
    for v in obj.data.vertices:v.co*=1.6/1.7
    if name=='Female_Glasses':
        for v in obj.data.vertices:v.co.z+=.023;v.co.y+=.012
    obj.data.update()
    base=[];mapping=[]
    for v in obj.data.vertices:
        co=v.co.copy();hit,n,idx,dist=bvh.find_nearest(co)
        if name=='Female_Shirt': co=hit+n*max(.022,min((co-hit).dot(n),.035))
        elif name=='Female_Hair':
            if co.z>1.35:co=hit+n*max(.004,min((co-hit).dot(n),.035))
        elif name in ['Female_Watch','Female_Bracelet']:
            gap=(co-hit).dot(n)
            if gap<.004:co+=n*(.004-gap)
        hit,n,idx,dist=bvh.find_nearest(co);ids=polys[idx]
        weights=barycentric_transform(hit,*[coords[i] for i in ids],Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1)))
        mapping.append((ids,weights));base.append(co)
    if name=='Female_Shirt':
        adjacency=[set() for _ in base];counts={}
        for p in obj.data.polygons:
            for a,b in zip(p.vertices,list(p.vertices[1:])+[p.vertices[0]]):adjacency[a].add(b);adjacency[b].add(a);e=tuple(sorted((a,b)));counts[e]=counts.get(e,0)+1
        boundary={i for e,n in counts.items() if n==1 for i in e}
        for _ in range(8):base=[p if i in boundary or not adjacency[i] else p.lerp(sum((base[j] for j in adjacency[i]),Vector())/len(adjacency[i]),.35) for i,p in enumerate(base)]
        for i,co in enumerate(base):
            hit,n,_,_=bvh.find_nearest(co);gap=(co-hit).dot(n)
            if gap<.018:base[i]+=n*(.018-gap)
        obj.vertex_groups.clear()
        for g in body.vertex_groups:obj.vertex_groups.new(name=g.name)
        for vi,(ids,ws) in enumerate(mapping):
            weights={}
            for j,factor in zip(ids,ws):
                for g in body.data.vertices[j].groups:weights[g.group]=weights.get(g.group,0)+max(0,factor)*g.weight
            weights=sorted(weights.items(),key=lambda p:-p[1])[:4];total=sum(v for _,v in weights)
            for gi,w in weights:obj.vertex_groups[gi].add([vi],w/total,'REPLACE')
    for sourcekey in keys:
        key=obj.shape_key_add(name=sourcekey.name);key.value=0
        targetBVH=BVHTree.FromPolygons([v.co for v in sourcekey.data],polys,all_triangles=True)
        for i,(p,(ids,ws)) in enumerate(zip(base,mapping)):
            delta=sum(((sourcekey.data[j].co-keys[0].data[j].co)*w for j,w in zip(ids,ws)),Vector())
            co=p+delta
            if name!='Female_Glasses':
                hit,n,_,_=targetBVH.find_nearest(co);gap=(co-hit).dot(n);minimum=.012 if name=='Female_Shirt' else .003
                if gap<minimum:co+=n*(minimum-gap)
            key.data[i].co=co
    for v,p in zip(obj.data.vertices,obj.data.shape_keys.key_blocks[0].data):v.co=p.co
    modifier=obj.modifiers.new('CanonicalSkin','ARMATURE');modifier.object=rig
    obj['morph_range']='0..1';obj['avatar_gender']='female'
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=root+file,export_format='GLB',use_selection=True,use_active_scene=True,export_animations=False,export_rest_position_armature=True,export_skins=True,export_morph=True,export_apply=False,export_extras=True,export_try_sparse_sk=True)
    rows.append({'file':file,'bytes':os.path.getsize(root+file),'triangles':sum(len(p.vertices)-2 for p in obj.data.polygons)})
rig.data.pose_position='POSE';s.frame_set(91);s.camera=bpy.data.objects['ThreeQuarter'];s.render.filepath=root+'../../../docs/avatar-phases-11-13-validation/female-equipped-review.png';bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=root+'sources/female-v1/female-equipment-review.blend',copy=True,compress=True)
result={'exports':rows}
