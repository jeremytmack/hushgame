# Child character source and license

`child.glb` was built specifically for HUSH using MakeHuman/MPFB's CC0 basemesh,
age morphs, default skeleton/weights, and the MakeHuman system assets pack.

- MPFB project: https://github.com/makehumancommunity/mpfb2
- System assets: https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html
- Asset license: https://static.makehumancommunity.org/about/license.html
- CC0 legal text: https://creativecommons.org/publicdomain/zero/1.0/legalcode

Included assets: basemesh and child targets, default rig, young Caucasian female
skin, short02 hair, high-poly eyes with brown eye material, eyebrow001,
eyelashes01, and male_casualsuit03 fitted to the child's proportions and given
blue/yellow fabric materials. HUSH supplies the standing and seated animation
clips and the runtime gaze behavior.

The skin is a UV-mapped body texture on anatomical geometry. It does not use the
earlier generated portrait, `art/child-face.png`.

The assets are CC0; MPFB's program code has a separate GPL license and is not
bundled with the game. `tools/build-child.py` documents the authoring process.

## Seeker

`seeker.glb` uses the same CC0 MakeHuman basemesh, default rig and system
assets: old Caucasian female skin, long01 hair, high-poly eyes, eyebrow001,
eyelashes01, teeth_base, and female_elegantsuit01. HUSH adds a skinned mouth
interior, gaunt asymmetric face/limb
morphs, a lengthened dress, skin vertex coloration, two authored movement
clips, and runtime gaze, hand and cadence animation. The model and embedded
textures are local; no model download service is needed during gameplay.
`tools/build-seeker.py` records the authoring process. MPFB code is not shipped.
