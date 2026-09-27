"""Build the clothed, skinned HUSH child with MakeHuman's CC0 assets.

Run with Blender 4.4+: blender -b --factory-startup --python tools/build-child.py
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
macro.update(gender=0.0, age=0.16, muscle=0.4, weight=0.48,
             race={'caucasian': 0.85, 'african': 0.05, 'asian': 0.1})
body = HumanService.create_human(macro_detail_dict=macro)
body.name = 'ChildSkin'
rig = HumanService.add_builtin_rig(body, 'default')
rig.name = 'ChildRig'

def equip(relative, kind):
    return HumanService.add_mhclo_asset(str(ASSETS / relative), body,
        asset_type=kind, subdiv_levels=0, material_type='MAKESKIN')

clothes = equip('clothes/male_casualsuit03/male_casualsuit03.mhclo', 'Clothes')
eyes = equip('eyes/high-poly/high-poly.mhclo', 'Eyes')
hair = equip('hair/short02/short02.mhclo', 'Hair')
brows = equip('eyebrows/eyebrow001/eyebrow001.mhclo', 'Eyebrows')
lashes = equip('eyelashes/eyelashes01/eyelashes01.mhclo', 'Eyelashes')

def material(obj, name, texture=None, color=(1,1,1,1), roughness=.7, alpha=False, normal=None, texture_color=True):
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
        if texture_color: links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
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

material(body, 'Skin', 'skins/young_caucasian_female/young_lightskinned_female_diffuse.png', roughness=.75)
material(clothes, 'Pajamas', color=(.18,.27,.4,1), roughness=.96,
         normal='clothes/male_casualsuit03/male_casualsuit03_normal.png')
material(eyes, 'Eyes', 'eyes/materials/brown_eye.png', roughness=.28, alpha=True)
material(hair, 'Hair', 'hair/short02/short02_diffuse.png', roughness=.87, alpha=True)
material(brows, 'Brows', 'eyebrows/eyebrow001/eyebrow001.png', color=(.075,.045,.025,1), alpha=True, texture_color=False)
material(lashes, 'Lashes', 'eyelashes/eyelashes01/eyelashes01.png', alpha=True)

# Bake the age morph, helper masks and clothing occlusion into clean skinned
# geometry. Keep the skeleton modifier; export no unclothed helper surfaces.
for obj in [body, clothes, eyes, hair, brows, lashes]:
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

bones = rig.pose.bones
for bone in bones: bone.rotation_mode = 'QUATERNION'
scene = bpy.context.scene
scene.render.fps = 30

def aim(name, direction):
    """Aim an anatomical bone in world space, retaining its natural roll."""
    pb = bones[name]
    bpy.context.view_layer.update()
    q = pb.vector.normalized().rotation_difference(Vector(direction).normalized()) @ pb.matrix.to_quaternion()
    pb.matrix = Matrix.Translation(pb.head) @ q.to_matrix().to_4x4()
    bpy.context.view_layer.update()

def offset(name, rotation):
    bones[name].rotation_quaternion = Euler(rotation, 'XYZ').to_quaternion()

def pose(time, seated):
    for bone in bones:
        bone.matrix_basis.identity()
    rig.location = (0,0,-.11 if seated else 0)
    # Smooth asymmetric fidget: one leg swings, hands settle and lift, head
    # looks down at the hands, then up and toward the sound in the hall.
    cycle = time * math.tau / 8
    breath = math.sin(time * math.tau / 4)
    glance = math.sin(cycle)
    fidget = (.5 - .5*math.cos(cycle))
    offset('spine02', (.025 + .015*breath, .01*math.sin(cycle), .018*math.sin(cycle)))
    offset('spine01', (.025*breath, 0, .01*math.sin(cycle)))
    offset('neck01', (.03 + .035*glance, .025*math.sin(cycle), 0))
    offset('head', ((.08 if seated else .02) + .07*glance, .19*math.sin(cycle-.3), .035*math.sin(cycle+.3)))
    for side, sign in [('L',1),('R',-1)]:
        if seated:
            aim('upperleg01.'+side, (sign*.12,-1,-.04))
            aim('upperleg02.'+side, (sign*.12,-1,-.04))
            swing = math.sin(cycle*2 + sign*.7)*.22
            aim('lowerleg01.'+side, (sign*.06,swing,-1))
            aim('lowerleg02.'+side, (sign*.06,swing,-1))
            aim('foot.'+side, (0,-1,-.25))
            aim('upperarm01.'+side, (sign*.08,-.17,-1))
            aim('upperarm02.'+side, (sign*.08,-.17,-1))
            aim('lowerarm01.'+side, (-sign*.08,-1,-.15+fidget*.15))
            aim('lowerarm02.'+side, (-sign*.08,-1,-.15+fidget*.15))
        else:
            aim('upperarm01.'+side, (sign*.13,-.08,-1))
            aim('upperarm02.'+side, (sign*.13,-.08,-1))
            aim('lowerarm01.'+side, (-sign*.4,-.3-fidget*.18,-1))
            aim('lowerarm02.'+side, (-sign*.4,-.3-fidget*.18,-1))
        # Close the fingers into relaxed hands rather than holding a T-pose.
        for digit in range(2,6):
            for joint in range(1,4):
                name = f'finger{digit}-{joint}.{side}'
                if name in bones: offset(name, (.04 + fidget*.05,0,0))
    blink_phase = time % 3.7
    blink = math.sin(blink_phase/.18*math.pi) if blink_phase < .18 else 0
    for side in ['L','R']:
        offset('orbicularis03.'+side, (-.23*blink,0,0))
        offset('orbicularis04.'+side, (.12*blink,0,0))

for name, seated in [('StandingIdle',False),('SeatedIdle',True)]:
    rig.animation_data_create()
    action = bpy.data.actions.new(name)
    rig.animation_data.action = action
    for frame in range(0,241,3):
        scene.frame_set(frame)
        pose(frame/30, seated)
        rig.keyframe_insert('location', frame=frame)
        for bone in bones:
            bone.keyframe_insert('rotation_quaternion', frame=frame)
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 0, action)
    track.mute = True
rig.animation_data.action = None
pose(0,False)
rig.location = (0,0,0)
scene.frame_set(0)

output = ROOT/'public/models/child.glb'
output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in [rig,body,clothes,eyes,hair,brows,lashes]: obj.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,
    export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,
    export_apply=False,export_morph=False,export_skins=True,export_image_format='AUTO',
    export_materials='EXPORT',export_extras=False)
bpy.ops.wm.save_as_mainfile(filepath='/tmp/hush-child-rigged.blend')
print('HUSH_CHILD_EXPORTED', output, output.stat().st_size)
