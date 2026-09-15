import bpy, math
def material(name,color,roughness=.85):
    mat=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes=True;mat.diffuse_color=(*color,1)
    bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=mat.diffuse_color
    bsdf.inputs['Roughness'].default_value=roughness
    return mat

for obj in bpy.data.collections['AVATAR_Customization'].objects:
    shoes=obj.name.startswith('Shoes');style=int(obj.name[-2:])
    color=(.20,.23,.22) if shoes else {1:(.045,.09,.095),2:(.39,.28,.17),3:(.035,.085,.17)}[style]
    main=material('Avatar_Sneaker_Textile' if shoes else 'Avatar_Pants_Fabric_'+str(style),color)
    trim=material('Avatar_Sole' if shoes else 'Avatar_Pants_Trim_'+str(style),(.65,.68,.64) if shoes else tuple(c*.62 for c in color))
    obj.data.materials.clear();obj.data.materials.append(main);obj.data.materials.append(trim)
    for poly in obj.data.polygons:
        co=sum((obj.data.vertices[i].co for i in poly.vertices), __import__('mathutils').Vector())/len(poly.vertices)
        # Waistband/cuffs and side seam travel with the garment, no extra draw objects.
        is_trim=co.z<.036 if shoes else co.z>.962 or (style==1 and co.z<.157) or (style==3 and abs(poly.normal.x)>.97)
        poly.material_index=int(is_trim)
    obj.hide_render=True;obj.hide_set(True)
result={'styled':[o.name for o in bpy.data.collections['AVATAR_Customization'].objects]}
