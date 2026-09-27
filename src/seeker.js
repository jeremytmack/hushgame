import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { seekerGesture, seekerThreat } from "./seeker-motion.js";

export async function loadSeekerAsset() {
  const asset = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/seeker.glb`);
  for (const name of ["SeekerStill", "SeekerWalk"])
    if (!asset.animations.some((clip) => clip.name === name))
      throw new Error("Seeker model is missing its " + name + " animation");
  asset.animations.forEach((clip) => clip.optimize());
  return asset;
}

/** A continuously skinned human silhouette, with the gaze independent of gait. */
export function createSeeker(asset) {
  const root = new T.Group();
  root.name = "TheSeeker";
  const model = clone(asset.scene);
  root.add(model);
  const bounds = new T.Box3().setFromObject(model);
  model.scale.setScalar(2.72 / (bounds.max.y - bounds.min.y));
  model.position.y = -bounds.min.y * model.scale.y;
  model.traverse((object) => {
    if (!object.isMesh) return;
    // The animated pose can extend beyond the rest-pose bounds.
    object.frustumCulled = false;
    object.material = object.material.clone();
    const material = object.material;
    if (material.name === "SeekerSkin") material.color.set(0xb4bec0);
    if (material.name === "SeekerEyes") {
      material.map = null;
      material.color.set(0x050708);
      material.roughness = 0.22;
    }
    if (material.name === "SeekerTeeth") material.color.set(0x918872);
    if (material.name === "SeekerHair") material.color.set(0x252b27);
    if (material.name === "SeekerDress") material.color.set(0x333b35);
    if (["SeekerHair", "Brows", "Lashes", "SeekerEyes"].includes(material.name)) {
      material.transparent = false;
      material.alphaTest = material.name === "SeekerEyes" ? 0.05 : 0.38;
      material.side = T.DoubleSide;
      material.depthWrite = true;
    }
    if (material.map) material.map.anisotropy = 4;
    // Preserve skin detail at flashlight distance, matching the child material.
    material.onBeforeCompile = (shader) => {
      if (material.name === "SeekerSkin") {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `#include <map_fragment>
          diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, 0.12);`,
        );
      }
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <lights_pars_begin>",
        T.ShaderChunk.lights_pars_begin.replace(
          "pow( lightDistance, decayExponent )",
          "pow( max( lightDistance, 2.5 ), decayExponent )",
        ),
      );
    };
    material.customProgramCacheKey = () => `seeker-near-light-v2-${material.name}`;
  });
  const mixer = new T.AnimationMixer(model);
  const still = mixer.clipAction(asset.animations.find((c) => c.name === "SeekerStill"));
  const walk = mixer.clipAction(asset.animations.find((c) => c.name === "SeekerWalk"));
  still.play();
  walk.play();
  walk.setEffectiveWeight(0);
  const head = model.getObjectByName("head");
  const neck = model.getObjectByName("neck01");
  const spine = model.getObjectByName("spine02");
  const jaw = model.getObjectByName("jaw");
  const jawRestScale = jaw?.scale.clone();
  const shoulders = [model.getObjectByName("shoulder01L"), model.getObjectByName("shoulder01R")];
  const bones = [];
  model.traverse((object) => { if (object.isBone) bones.push(object); });
  const clipPose = new Map(bones.map((bone) => [bone, bone.quaternion.clone()]));
  const localPlayer = new T.Vector3();
  const rotation = new T.Quaternion();
  const euler = new T.Euler();
  let turn = 0, nod = 0, tilt = 0.08, weight = 0;
  let sampledTurn = 0, nextLook = 0;
  let lastTime = -1, scream = 0, bodyTurn = 0;

  function addRotation(bone, x, y, z) {
    if (!bone) return;
    euler.set(x, y, z, "YXZ");
    rotation.setFromEuler(euler);
    bone.quaternion.multiply(rotation);
  }

  function animate(time, dt, { walking, speed = walking ? 2.8 : 0,
    playerX, playerZ, playerY = 1.65, reduced = false, aware = true, distance: suppliedDistance }) {
    if (time < lastTime) {
      turn = nod = sampledTurn = scream = bodyTurn = 0;
      nextLook = time;
      mixer.setTime(0);
    }
    lastTime = time;
    const step = Math.max(0, Math.min(dt, 0.1));
    weight = T.MathUtils.damp(weight, walking ? 1 : 0, 6, step);
    walk.setEffectiveWeight(weight);
    still.setEffectiveWeight(1 - weight);
    // Distance, rather than a free-running sine wave, drives the planted gait.
    walk.setEffectiveTimeScale(walking ? Math.max(0, speed) / 0.8 : 0);
    still.setEffectiveTimeScale(1);
    // Constant animation tracks may skip writes. Restore the previous clip
    // pose before mixing, so procedural offsets never accumulate each frame.
    for (const [bone, pose] of clipPose) bone.quaternion.copy(pose);
    mixer.update(step);
    for (const [bone, pose] of clipPose) pose.copy(bone.quaternion);
    const gesture = seekerGesture(time, reduced);
    const distance = Number.isFinite(suppliedDistance) ? suppliedDistance :
      Math.hypot(playerX - root.position.x, playerZ - root.position.z);
    scream = T.MathUtils.damp(scream, seekerThreat(distance, aware), aware ? 4.5 : 8, step);
    const mouthOpen = scream * (0.90 + 0.10 * Math.sin(time * 8.5));
    if (Number.isFinite(playerX) && Number.isFinite(playerZ)) {
      root.updateMatrixWorld(true);
      localPlayer.set(playerX, playerY, playerZ);
      root.worldToLocal(localPlayer);
      const distance = Math.hypot(localPlayer.x, localPlayer.z);
      const target = T.MathUtils.clamp(Math.atan2(localPlayer.x, localPlayer.z), -1.05, 1.05);
      // The eyes/head acquire first. The body follows through navigation later.
      if (time >= nextLook || reduced) {
        sampledTurn = target;
        nextLook = time + 0.10 + 0.055 * Math.sin(time * 0.73);
      }
      turn = T.MathUtils.damp(turn, sampledTurn, reduced ? 3 : 9, step);
      nod = T.MathUtils.damp(nod,
        -T.MathUtils.clamp(Math.atan2(localPlayer.y - 2.48, Math.max(0.7, distance)), -0.32, 0.6),
        reduced ? 3 : 6, step);
    }
    tilt = T.MathUtils.damp(tilt, gesture.tilt, reduced ? 2 : 13, step);
    bodyTurn = T.MathUtils.damp(bodyTurn, turn * 0.15, 2.5, step);
    addRotation(head, nod + gesture.twitch - scream * 0.08, turn - bodyTurn, tilt);
    if (jaw) {
      jaw.scale.copy(jawRestScale);
      jaw.scale.y *= 1 + mouthOpen * 0.28;
      addRotation(jaw, mouthOpen * 0.82, 0, mouthOpen * 0.025);
    }
    addRotation(neck, 0, -turn * 0.12, -tilt * 0.24);
    const breath = Math.sin(time * (1.7 + scream * 1.8));
    addRotation(spine, (reduced ? 0.006 : 0.014) * breath - scream * 0.035,
      bodyTurn, reduced ? 0 : gesture.twitch * 0.2);
    shoulders.forEach((shoulder, side) => addRotation(shoulder,
      -scream * 0.12 + breath * 0.012, 0,
      (side ? -1 : 1) * (scream * 0.04 + Math.sin(time * 1.1 + side) * 0.012)));
    for (const bone of bones) {
      if (/^finger[2-5]-[23][_.]?[LR]$/.test(bone.name)) {
        const delayed = bone.name.endsWith("L") ? gesture.curl : seekerGesture(time - 0.35, reduced).curl;
        addRotation(bone, delayed * 0.45, 0, 0);
      }
      if (/^orbicularis03[_.]?[LR]$/.test(bone.name)) addRotation(bone, -gesture.blink * 0.22, 0, 0);
      if (/^orbicularis04[_.]?[LR]$/.test(bone.name)) addRotation(bone, gesture.blink * 0.12, 0, 0);
    }
    root.userData.animation = {
      walking, speed, headTurn: turn, tilt, twitch: gesture.twitch, scream, mouthOpen, distance,
      clip: weight > 0.5 ? "SeekerWalk" : "SeekerStill", time: walk.time,
    };
  }
  root.visible = false;
  return { root, animate, mixer };
}
