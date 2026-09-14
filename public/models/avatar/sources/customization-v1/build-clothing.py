"""Prendas nuevas; nunca altera malla, morphs ni pesos del cuerpo de referencia."""
import bpy, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree

def build_clothing(body, rig, gender, style=1, shoes=False):
    name=('Shoes' if shoes else 'Pants')+'_'+gender+'_'+str(style).zfill(2)
    assert not bpy.data.objects.get(name), name+' already exists'
    keys=body.data.shape_keys.key_blocks
    basis=[v.co.copy() for v in keys[0].data]
    group_names={g.index:g.name for g in body.vertex_groups}
    allowed={'Hips','Spine','LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase','RightUpLeg','RightLeg','RightFoot','RightToeBase'}
    eligible=[sum(g.weight for g in v.groups if group_names[g.group] in allowed)>.8 for v in body.data.vertices]
    low,high=(-.02,.135) if shoes else (.115,.985)
    mappings=[]; faces=[]; lookup={}
    def point(mapping,source=basis):return sum((source[i]*w for i,w in mapping.items()),Vector())
    def add(mapping):
        # Weld UV seam duplicates in the new garment only.
        co=point(mapping); key=tuple(round(v,6) for v in co)
        if key not in lookup:lookup[key]=len(mappings);mappings.append(mapping)
        return lookup[key]
    for poly in body.data.polygons:
        if not all(eligible[i] for i in poly.vertices):continue
        polygon=[{i:1.0} for i in poly.vertices]
        for bound,sign in [(low,1),(high,-1)]:
            clipped=[]
            for j,current in enumerate(polygon):
                previous=polygon[j-1];a=(point(previous).z-bound)*sign;b=(point(current).z-bound)*sign
                if (a>=0)!=(b>=0):
                    t=a/(a-b);mix={}
                    for i,w in previous.items():mix[i]=mix.get(i,0)+w*(1-t)
                    for i,w in current.items():mix[i]=mix.get(i,0)+w*t
                    clipped.append(mix)
                if b>=0:clipped.append(current)
            polygon=clipped
            if not polygon:break
        if len(polygon)>=3:
            ids=[add(m) for m in polygon]
            for j in range(1,len(ids)-1):
                face=(ids[0],ids[j],ids[j+1])
                if len(set(face))==3:faces.append(face)
    mesh=bpy.data.meshes.new(name+'_Surface');mesh.from_pydata([point(m) for m in mappings],[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    col=bpy.data.collections.get('AVATAR_Customization')
    if col is None:col=bpy.data.collections.new('AVATAR_Customization');bpy.context.scene.collection.children.link(col)
    col.objects.link(obj);obj.parent=rig;obj.matrix_world=body.matrix_world.copy()
    for g in body.vertex_groups:obj.vertex_groups.new(name=g.name)
    for j,mapping in enumerate(mappings):
        weights={}
        for i,factor in mapping.items():
            for g in body.data.vertices[i].groups:weights[g.group]=weights.get(g.group,0)+factor*g.weight
        weights=dict(sorted(weights.items(),key=lambda pair:-pair[1])[:4]);total=sum(weights.values())
        for g,w in weights.items():obj.vertex_groups[g].add([j],w/total,'REPLACE')
    adj=[set() for _ in mappings];counts={}
    for f in faces:
        for a,b in zip(f,f[1:]+f[:1]):adj[a].add(b);adj[b].add(a);edge=tuple(sorted((a,b)));counts[edge]=counts.get(edge,0)+1
    boundary={v for e,n in counts.items() if n==1 for v in e}
    polygons=[list(p.vertices) for p in body.data.polygons]
    for source in keys:
        source_coords=[p.co.copy() for p in source.data]
        bvh=BVHTree.FromPolygons(source_coords,polygons)
        coords=[]
        for mapping in mappings:
            co=point(mapping,source_coords);hit,normal,_,_=bvh.find_nearest(co)
            if shoes:
                ease=.013;co+=normal*ease
                if co.z<.04:co.z=max(.004,co.z)
            else:
                # Waist stays under the shirt. Different ease profiles define real silhouettes.
                leg=max(0,min(1,(.80-co.z)/.45))
                ease=.014+([.015,.009,.028][style-1])*leg
                if style==1: ease-=.012*math.exp(-((co.z-.135)/.025)**2)
                co+=normal*ease
            coords.append(co)
        for _ in range(12):
            coords=[co if i in boundary or not adj[i] else co.lerp(sum((coords[j] for j in adj[i]),Vector())/len(adj[i]),.40) for i,co in enumerate(coords)]
        for i,co in enumerate(coords):
            hit,normal,_,_=bvh.find_nearest(co);gap=(co-hit).dot(normal)
            if gap<.010:co+=normal*(.010-gap)
        key=obj.shape_key_add(name=source.name)
        for v,co in zip(key.data,coords):v.co=co
        key.value=0;key.slider_min=0;key.slider_max=1
    for v,k in zip(mesh.vertices,obj.data.shape_keys.key_blocks[0].data):v.co=k.co
    obj['morph_range']='0..1';obj['source_body']=body.name
    obj['construction']='Independent barycentric shell, all source morphs and normalized canonical weights'
    mod=obj.modifiers.new('CanonicalSkin','ARMATURE');mod.object=rig
    for p in mesh.polygons:p.use_smooth=True
    mesh.update()
    return obj

result={'loaded':'build_clothing'}
