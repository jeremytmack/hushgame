"""Build the Seeker with continuous anatomy, a full skeleton and authored horror poses.

Run with Blender 4.4+: blender -b --factory-startup --python tools/build-seeker.py
HUSH_MPFB_SRC and HUSH_CHARACTER_ASSETS can override the source asset folders.
Only the generated GLB is loaded by the game; MPFB code is not shipped.
"""
import bpy
import addon_utils
import sys
import os
import math
from pathlib import Path
from mathutils import Vector, Matrix, Euler

ROOT = Path(__file__).resolve().parents[1]
ASSETS = Path(os.environ.get('HUSH_CHARACTER_ASSETS', '/tmp/hush-system-assets'))
sys.path.insert(0, os.environ.get('HUSH_MPFB_SRC', '/tmp/hush-mpfb2/src'))
original_extension_path = bpy.utils.extension_path_user
bpy.utils.extension_path_user = lambda package, **kw: '/tmp/hush-mpfb-data' if package == 'mpfb' else original_extension_path(package, **kw)
addon_utils.enable('mpfb', default_set=True)
from mpfb.services.humanservice import HumanService
from mpfb.services.targetservice import TargetService

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
macro = TargetService.get_default_macro_info_dict()
macro.update(gender=0.0, age=1.0, muscle=0.08, weight=0.08,
             race={'caucasian': 0.85, 'african': 0.05, 'asian': 0.1})
body = HumanService.create_human(macro_detail_dict=macro)
body.name = 'SeekerSkin'
for target, weight in [
    ('neck-scale-vert-incr', 1.0),
    ('l-lowerarm-scale-vert-incr', 1.0), ('r-lowerarm-scale-vert-incr', 1.0),
    ('l-hand-fingers-length-incr', 1.0), ('r-hand-fingers-length-incr', 1.0),
    ('l-cheek-volume-decr', .78), ('r-cheek-volume-decr', .86),
    ('l-cheek-bones-incr', .35), ('r-cheek-bones-incr', .45),
    ('l-eye-bag-incr', .75), ('r-eye-bag-incr', .8),
    ('l-eye-height1-incr', .62), ('r-eye-height1-incr', .42),
    ('mouth-scale-horiz-incr', .35), ('asym-mouth-1-l', .3),
    ('chin-jaw-drop-incr', .25), ('neck-scale-horiz-decr', .65),
]:
    path = TargetService.target_full_path(target)
    if not path: raise RuntimeError('Missing target ' + target)
    TargetService.load_target(body, path, weight=weight)

rig = HumanService.add_builtin_rig(body, 'default')
rig.name = 'SeekerRig'

def equip(relative, kind):
    return HumanService.add_mhclo_asset(str(ASSETS / relative), body,
        asset_type=kind, subdiv_levels=0, material_type='MAKESKIN')

clothes = equip('clothes/female_elegantsuit01/female_elegantsuit01.mhclo', 'Clothes')
eyes = equip('eyes/high-poly/high-poly.mhclo', 'Eyes')
hair = equip('hair/long01/long01.mhclo', 'Hair')
brows = equip('eyebrows/eyebrow001/eyebrow001.mhclo', 'Eyebrows')
lashes = equip('eyelashes/eyelashes01/eyelashes01.mhclo', 'Eyelashes')
teeth = equip('teeth/teeth_base/teeth_base.mhclo', 'Teeth')

def material(obj, name, texture=None, color=(1,1,1,1), roughness=.7, alpha=False, normal=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Specular IOR Level'].default_value = .22
    if texture:
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(str(ASSETS / texture), check_existing=True)
        # Keep the full skin detail, but avoid oversized body and clothes maps.
        if max(tex.image.size) > 2048:
            tex.image.scale(2048, 2048)
        links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        if alpha:
            links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
            mat.surface_render_method = 'DITHERED'
            mat.use_backface_culling = False
    if normal:
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(str(ASSETS / normal), check_existing=True)
        tex.image.colorspace_settings.name = 'Non-Color'
        if max(tex.image.size) > 1024: tex.image.scale(1024, 1024)
        n = nodes.new('ShaderNodeNormalMap')
        n.inputs['Strength'].default_value = .7
        links.new(tex.outputs['Color'], n.inputs['Color'])
        links.new(n.outputs['Normal'], bsdf.inputs['Normal'])
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.material_index = 0
        poly.use_smooth = True
    return mat

material(body, 'SeekerSkin', 'skins/old_caucasian_female/old_lightskinned_female_diffuse.png', color=(.78,.81,.76,1), roughness=.84)
material(clothes, 'SeekerDress', 'clothes/female_elegantsuit01/female_elegantsuit01_ao.png', color=(.055,.066,.06,1), roughness=.96,
         normal='clothes/female_elegantsuit01/female_elegantsuit01_normal.png')
material(eyes, 'SeekerEyes', 'eyes/materials/grey_eye.png', roughness=.24, alpha=True)
material(hair, 'SeekerHair', 'hair/long01/long01_diffuse.png', color=(.15,.17,.14,1), roughness=.85, alpha=True)
material(brows, 'Brows', 'eyebrows/eyebrow001/eyebrow001.png', alpha=True)
material(lashes, 'Lashes', 'eyelashes/eyelashes01/eyelashes01.png', alpha=True)
material(teeth, 'SeekerTeeth', 'teeth/teeth_base/teeth.png', color=(.58,.54,.39,1), roughness=.83)

# Bake the age morph, helper masks and clothing occlusion into clean skinned
# geometry. Keep the skeleton modifier; export no unclothed helper surfaces.
for obj in [body, clothes, eyes, hair, brows, lashes, teeth]:
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    if obj.data.shape_keys:
        bpy.ops.object.shape_key_add(from_mix=True)
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    for mod in list(obj.modifiers):
        if mod.type != 'ARMATURE': bpy.ops.object.modifier_apply(modifier=mod.name)
    if obj in [body, clothes]:
        sub = obj.modifiers.new('Surface detail', 'SUBSURF')
        sub.levels = 1
        bpy.ops.object.modifier_apply(modifier=sub.name)

# Turn the fitted skirt into a loose, uneven calf-length mourning dress.
for vertex in clothes.data.vertices:
    z = vertex.co.z
    if z < .78:
        fall = max(0, min(1, (.78 - z) / .35))
        vertex.co.x *= 1 + .22 * fall
        vertex.co.y *= 1 + .55 * fall
        vertex.co.z -= .16 * fall
        if fall > .9:
            vertex.co.z += .008 * math.sin(vertex.co.x * 63)

# Bruised-looking eye hollows and mottling are vertex colors on the skin,
# following its deformation without a flat face mask or painted-on geometry.
colors = body.data.color_attributes.new(name='SeekerPatina', type='FLOAT_COLOR', domain='POINT')
eye_points = [rig.data.bones['eye.'+side].tail_local for side in ['L','R']]
mouth = rig.data.bones['oris05'].tail_local
for vertex in body.data.vertices:
    x,y,z = vertex.co
    socket = max(math.exp(-(((x-e.x)/.028)**2 + ((z-e.z+.006)/.024)**2 + ((y-e.y)/.045)**2)) for e in eye_points)
    lip = math.exp(-((x/.034)**4 + ((z-mouth.z)/.009)**2 + ((y-mouth.y)/.035)**2))
    mottling = .045 * (math.sin(x*231+z*63) * math.sin(y*169-z*87))
    shade = max(.065, 1 - socket*.91 - lip*.65 + mottling)
    colors.data[vertex.index].color = (shade*.88, shade*.94, shade, 1)
mat = body.data.materials[0]
vcol = mat.node_tree.nodes.new('ShaderNodeVertexColor')
vcol.layer_name = 'SeekerPatina'
bsdf = mat.node_tree.nodes.get('Principled BSDF')
old_link = bsdf.inputs['Base Color'].links[0]
source_socket = old_link.from_socket
mat.node_tree.links.remove(old_link)
mix = mat.node_tree.nodes.new('ShaderNodeMixRGB')
mix.blend_type = 'MULTIPLY'
mix.inputs[0].default_value = 1
mat.node_tree.links.new(source_socket, mix.inputs[1])
mat.node_tree.links.new(vcol.outputs['Color'], mix.inputs[2])
mat.node_tree.links.new(mix.outputs[0], bsdf.inputs['Base Color'])

# The dark mouth interior is actual depth behind the lips, weighted across
# the cranium and mandible so the expanding jaw never reveals an empty head.
mouth_point = rig.data.bones['oris05'].tail_local.copy()
bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, location=(0,mouth_point.y+.045,mouth_point.z-.009))
throat=bpy.context.object
throat.name='SeekerMouthInterior'
throat.scale=(.025,.009,.021)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
material(throat, 'MouthInterior', color=(.004,.002,.003,1), roughness=1)
head_group=throat.vertex_groups.new(name='head')
jaw_group=throat.vertex_groups.new(name='jaw')
for v in throat.data.vertices:
    blend=max(0,min(1,(mouth_point.z+.008-v.co.z)/.025))
    head_group.add([v.index],1-blend,'REPLACE')
    jaw_group.add([v.index],blend,'REPLACE')
modifier=throat.modifiers.new('Mouth skeleton','ARMATURE')
modifier.object=rig
throat.parent=rig

# Continuous fitted clothing and anatomical skin deform together on the rig.
bones = rig.pose.bones
for bone in bones: bone.rotation_mode = 'QUATERNION'
scene = bpy.context.scene
scene.render.fps = 30

def aim(name, direction):
    pb = bones[name]
    bpy.context.view_layer.update()
    q = pb.vector.normalized().rotation_difference(Vector(direction).normalized()) @ pb.matrix.to_quaternion()
    pb.matrix = Matrix.Translation(pb.head) @ q.to_matrix().to_4x4()
    bpy.context.view_layer.update()

def offset(name, rotation):
    if name in bones: bones[name].rotation_quaternion = Euler(rotation, 'XYZ').to_quaternion()

def pose(time, walking):
    for bone in bones: bone.matrix_basis.identity()
    # Breathing, counter-rotation and overlapping arm motion keep her alive.
    offset('spine03', (.075, 0, -.025))
    offset('spine02', (.055, .015, .04))
    offset('spine01', (.018, -.01, -.025))
    offset('neck01', (-.07, .018, .04))
    offset('head', (.04, 0, .08))
    cycle = time / (2.4 if walking else 6.4) * math.tau
    breath = math.sin(time * math.tau / 6.4)
    sway = math.sin(cycle)
    follow = math.sin(cycle-.38)
    offset('spine04', (.025, (.045 if walking else .012)*sway, -.026*sway))
    offset('spine03', (.075 + .012*breath, -.035*follow, .018*sway))
    offset('spine02', (.055 + .022*breath, .022*follow, .04+.028*follow))
    offset('spine01', (.018+.012*breath, -.015*follow, -.025))
    offset('neck01', (-.07-.012*breath, .018+.016*follow, .04-.018*follow))
    offset('head', (.04+.014*breath, -.01*follow, .08+.015*sway))
    for side, sign in [('L',1),('R',-1)]:
        # Unequal legs: one foot deliberately places, the other drags behind.
        phase = cycle + (0 if sign == 1 else math.pi + .22)
        swing = math.sin(phase) * (1 if walking else 0)
        lift = max(0, math.cos(phase)) * (1 if walking else 0)
        aim('upperleg01.'+side, (sign*.035, -.24*swing, -1))
        aim('upperleg02.'+side, (sign*.035, -.24*swing, -1))
        aim('lowerleg01.'+side, (sign*.015, .30*lift - .06*swing, -1))
        aim('lowerleg02.'+side, (sign*.015, .30*lift - .06*swing, -1))
        offset('foot.'+side, (-.17*lift, 0, 0))
        arm_lag = math.sin(phase - .9) * (.20 if walking else .032)
        aim('upperarm01.'+side, (sign*(.10+.025*math.sin(phase)), .05 + arm_lag, -1))
        aim('upperarm02.'+side, (sign*(.10+.025*math.sin(phase)), .05 + arm_lag, -1))
        aim('lowerarm01.'+side, (sign*.025, -.15 - arm_lag*.7-.045*math.sin(phase-1.4), -1))
        aim('lowerarm02.'+side, (sign*.025, -.15 - arm_lag*.7-.045*math.sin(phase-1.4), -1))
        offset('wrist.'+side, (.12 + sign*.035 + .065*math.sin(phase-1.8), .04*sign, -.09*sign + .035*math.sin(phase-.5)))
        for digit in range(1,6):
            for joint in range(1,4):
                offset(f'finger{digit}-{joint}.{side}', (.12 + digit*.022 + joint*.013, 0, sign*.012))
        # Keep the eyes open much longer than a normal person would.
        offset('orbicularis03.'+side, (.025,0,0))
        offset('orbicularis04.'+side, (-.015,0,0))
    # A barely open mouth, slightly unbalanced rather than a monster snarl.
    offset('jaw', (.006,0,.018))

for name, walking, duration in [('SeekerStill',False,6.4),('SeekerWalk',True,2.4)]:
    rig.animation_data_create()
    action = bpy.data.actions.new(name)
    rig.animation_data.action = action
    final_frame = round(duration*30)
    for frame in range(0,final_frame+1,3):
        scene.frame_set(frame)
        pose(frame/30, walking)
        for bone in bones: bone.keyframe_insert('rotation_quaternion', frame=frame)
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 0, action)
    track.mute = True
rig.animation_data.action = None
pose(0,False)
scene.frame_set(0)

output = ROOT/'public/models/seeker.glb'
bpy.ops.object.select_all(action='DESELECT')
for obj in [rig,body,clothes,eyes,hair,brows,lashes,teeth,throat]: obj.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,
    export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,
    export_apply=False,export_morph=False,export_skins=True,export_image_format='AUTO',
    export_materials='EXPORT',export_extras=False)
bpy.ops.wm.save_as_mainfile(filepath='/tmp/hush-seeker-rigged.blend')
print('HUSH_SEEKER_EXPORTED', output, output.stat().st_size)
