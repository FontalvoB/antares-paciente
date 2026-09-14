"""Recover an independent editable scene from the exact delivered GLBs."""
import bpy, json, os
from mathutils import Vector
root = os.path.abspath('public/models/avatar')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 30
files = ['bodies/male-body-base-v9.glb', 'clothing/tops/male-shirt-basic-01-v3.glb', 'hair/male-hair-02-v3.glb', 'hair/male-hair-03-v3.glb', 'accessories/glasses/unisex-glasses-02.glb', 'accessories/watches/unisex-watch-02.glb', 'accessories/bracelets/unisex-bracelet-02.glb']
rig = None
rows = []
for file in files:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(root, file))
    imported = set(bpy.data.objects) - before
    armatures = [o for o in imported if o.type == 'ARMATURE']
    if rig is None:
        rig = armatures[0]
        rig.name = 'Avatar_V9_Rig'
    meshes = [o for o in imported if o.type == 'MESH' and o.name in bpy.context.scene.objects and o.data.shape_keys]
    assert len(meshes) == 1, (file, [o.name for o in meshes])
    for mesh in meshes:
        world = mesh.matrix_world.copy()
        mesh.parent = rig
        mesh.matrix_world = world
        for mod in mesh.modifiers:
            if mod.type == 'ARMATURE': mod.object = rig
        mesh['source_glb'] = file
        print('RECOVERY_MESH',mesh.name,mesh.data.name,'KEYS',mesh.data.shape_keys,flush=True)
        assert mesh.data.shape_keys and len(mesh.data.shape_keys.key_blocks) == 10
        rows.append({'file': file, 'object': mesh.name, 'vertices': len(mesh.data.vertices), 'morphs': [k.name for k in mesh.data.shape_keys.key_blocks][1:]})
    for arm in armatures:
        if arm != rig: bpy.data.objects.remove(arm, do_unlink=True)
    if 'hair-02' in file:
        for mesh in meshes: mesh.hide_render = True; mesh.hide_set(True)
assert len(rig.data.bones) == 51
actions = list(bpy.data.actions)
for action in actions:
    for layer in action.layers:
        for strip in layer.strips:
            for slot in action.slots:
                bag=strip.channelbag(slot)
                if bag:
                    for curve in bag.fcurves:
                        for point in curve.keyframe_points:
                            point.co.x += 1
                            point.handle_left.x += 1
                            point.handle_right.x += 1
idle = next(a for a in actions if 'Idle' in a.name)
idle.name = 'Idle'
next(a for a in actions if 'RigCheck' in a.name).name = 'RigCheck'
for a in actions: a.use_fake_user = True
rig.animation_data_create()
for track in rig.animation_data.nla_tracks: track.mute = True
rig.animation_data.action = idle
if idle.slots: rig.animation_data.action_slot = idle.slots[0]
s = bpy.context.scene
s.name = 'Avatar_Polished_V9'; s.render.fps = 30; s.frame_start = 1; s.frame_end = 361; s.frame_set(1)
s.world = bpy.data.worlds.new('Studio'); s.world.use_nodes = True
s.world.node_tree.nodes['Background'].inputs[0].default_value = (.16,.16,.16,1)
s.world.node_tree.nodes['Background'].inputs[1].default_value = .5
for name, loc, energy, size in [('Key',(3,4,4),450,4),('Fill',(-3,2,2),250,3),('Rim',(1,-3,3),400,3)]:
    d=bpy.data.lights.new(name,'AREA'); d.energy=energy; d.shape='DISK'; d.size=size
    o=bpy.data.objects.new(name,d); s.collection.objects.link(o); o.location=loc; o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
for name, loc in [('Front',(0,4,1.1)),('ThreeQuarter',(2.6,4,1.5)),('Profile',(4,0,1.2))]:
    d=bpy.data.cameras.new(name); d.type='ORTHO'; d.ortho_scale=1.95
    o=bpy.data.objects.new(name,d); s.collection.objects.link(o); o.location=loc; o.rotation_euler=(Vector((0,0,.88))-o.location).to_track_quat('-Z','Y').to_euler()
s.camera=bpy.data.objects['ThreeQuarter']; s.render.engine='CYCLES'; s.cycles.samples=16
s.render.resolution_x=640; s.render.resolution_y=800; s.render.resolution_percentage=100
bpy.ops.file.pack_all()
out=os.path.join(root,'sources/polish-v9/avatar-polished-v9.blend')
bpy.ops.wm.save_as_mainfile(filepath=out,compress=True)
with open('docs/avatar-polish-validation/recovered-source.json','w') as f: json.dump({'source':out,'meshes':rows,'bones':len(rig.data.bones),'actions':[a.name for a in actions]},f,indent=2)
for volume in [0,.25,.5,.75,1]:
    for o in bpy.data.objects:
        if o.type=='MESH' and o.data.shape_keys: o.data.shape_keys.key_blocks['BodyVolume'].value=volume
    s.render.filepath=os.path.abspath('docs/avatar-polish-validation/delivered-volume-'+str(volume)+'.png')
    bpy.ops.render.render(write_still=True)
