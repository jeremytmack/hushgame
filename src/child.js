import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";

export const CHILD_SPAWNS = Object.freeze([
  {
    id: "kitchen-table",
    floor: 0,
    x: 14,
    z: 16.15,
    rotation: 0,
    pose: "seated",
    location: "The kitchen",
  },
  {
    id: "dining-table",
    floor: 0,
    x: 14.6,
    z: 5.2,
    rotation: 0,
    pose: "seated",
    location: "The dining room",
  },
  {
    id: "sitting-room",
    floor: 0,
    x: 5.7,
    z: 4.4,
    rotation: -Math.PI / 2,
    pose: "standing",
    location: "The sitting room",
  },
  {
    id: "study-door",
    floor: 0,
    x: 6,
    z: 13.1,
    rotation: Math.PI / 2,
    pose: "standing",
    location: "The study",
  },
  {
    id: "old-bedroom",
    floor: 1,
    x: 4.4,
    z: 2,
    rotation: 0,
    pose: "seated",
    location: "Your old room",
  },
  {
    id: "attic-rafters",
    floor: 1,
    x: 5.7,
    z: 14.7,
    rotation: -Math.PI / 2,
    pose: "standing",
    location: "The attic",
  },
]);

/** Selects every location evenly while preventing an immediate repeat. */
export function pickChildSpawn(random = Math.random, previousIndex = -1) {
  const count = CHILD_SPAWNS.length;
  let index;
  if (previousIndex < 0 || previousIndex >= count) {
    index = Math.min(count - 1, Math.floor(random() * count));
  } else {
    index = Math.min(count - 2, Math.floor(random() * (count - 1)));
    if (index >= previousIndex) index += 1;
  }
  return { index, spawn: CHILD_SPAWNS[index] };
}


/** One local, licensed character asset shared by independently animated clones. */
export async function loadChildAsset() {
  const asset = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/child.glb`);
  for (const name of ["SeatedIdle", "StandingIdle"]) {
    if (!asset.animations.some((clip) => clip.name === name))
      throw new Error("Child model is missing its " + name + " animation");
  }
  asset.animations.forEach((clip) => clip.optimize());
  return asset;
}

function createChair() {
  const chair = new T.Group();
  const wood = new T.MeshStandardMaterial({ color: 0x403529, roughness: .92 });
  const slat = (x,y,z,w,h,d) => {
    const m = new T.Mesh(new T.BoxGeometry(w,h,d),wood);
    m.position.set(x,y,z);
    chair.add(m);
  };
  slat(0,.49,0,.5,.065,.46);
  for (const x of [-.21,.21]) {
    slat(x,.24,.18,.045,.48,.045);
    slat(x,.54,-.19,.045,1.08,.045);
  }
  for (const y of [.75,.94,1.07]) slat(0,y,-.19,.46,.045,.045);
  return chair;
}

export function createChild(asset, pajamaColor = 0x6b839d) {
  const root = new T.Group();
  root.name = "ChildEncounter";
  const model = clone(asset.scene);
  root.add(model);
  // The exported anatomy is in metres and faces +Z after glTF conversion.
  const bounds = new T.Box3().setFromObject(model);
  const scale = 1.27 / (bounds.max.y - bounds.min.y);
  model.scale.setScalar(scale);
  const chair = createChair();
  root.add(chair);
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.frustumCulled = false;
    object.material = object.material.clone();
    const material = object.material;
    if (material.name === "Pajamas") material.color.set(pajamaColor);
    if (material.name === "Skin") material.color.set(0xc3aa98);
    if (material.name === "Eyes") material.color.set(0xd1c7b9);
    if (material.name === "Lashes") object.visible = false;
    // Keep the near-field flashlight from clipping all skin detail to white.
    // The room's old Lambert surfaces and physical skin respond differently.
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_pars_begin>',
        T.ShaderChunk.lights_pars_begin.replace(
          'pow( lightDistance, decayExponent )',
          'pow( max( lightDistance, 2.5 ), decayExponent )',
        ),
      );
    };
    material.customProgramCacheKey = () => 'child-near-light-v1';
    if (["Hair", "Brows", "Lashes", "Eyes"].includes(material.name)) {
      material.transparent = false;
      material.alphaTest = material.name === "Eyes" ? .05 : .38;
      material.side = T.DoubleSide;
      material.depthWrite = true;
      material.alphaToCoverage = true;
    }
    if (material.map) material.map.anisotropy = 4;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  const mixer = new T.AnimationMixer(model);
  const actions = Object.fromEntries(asset.animations.map((clip) => [
    clip.name, mixer.clipAction(clip),
  ]));
  let currentAction = null;
  let pose = "standing";
  let attention = 0;
  const head = model.getObjectByName("head");
  const gaze = new T.Quaternion();
  const gazeEuler = new T.Euler();
  const localPlayer = new T.Vector3();
  let headTurn = 0;
  let headPitch = 0;

  function setPose(nextPose) {
    pose = nextPose;
    const next = actions[pose === "seated" ? "SeatedIdle" : "StandingIdle"];
    if (currentAction !== next) {
      mixer.stopAllAction();
      next.reset().play();
      currentAction = next;
    }
    chair.visible = pose === "seated";
    attention = 0;
    headTurn = 0;
    headPitch = 0;
    mixer.update(0);
    root.updateMatrixWorld(true);
  }

  function animate(time, dt, { playerX, playerZ, playerY = 1.65, reduced = false } = {}) {
    // AnimationMixer drives the entire skinned body every simulation step.
    // Reduce camera motion does not freeze this essential character motion.
    mixer.update(dt * (reduced ? .8 : 1));
    if (!head || !Number.isFinite(playerX) || !Number.isFinite(playerZ)) return;
    root.updateMatrixWorld(true);
    localPlayer.set(playerX, playerY, playerZ);
    root.worldToLocal(localPlayer);
    const distance = Math.hypot(localPlayer.x, localPlayer.z);
    const target = distance < 5.5 ? 1 : 0;
    attention = T.MathUtils.damp(attention, target, target ? 1.5 : .7, dt);
    const angle = Math.atan2(localPlayer.x, localPlayer.z);
    headTurn = T.MathUtils.damp(headTurn, T.MathUtils.clamp(angle,-.7,.7)*attention, 2.6,dt);
    headPitch = T.MathUtils.damp(headPitch,
      -T.MathUtils.clamp(Math.atan2(localPlayer.y-(pose==="seated"?1.06:1.17),Math.max(1,distance)), -.18,.25)*attention,2,dt);
    // The head's local Y axis runs up the neck; apply after the body clip.
    gazeEuler.set(headPitch,headTurn,0,"YXZ");
    gaze.setFromEuler(gazeEuler);
    head.quaternion.multiply(gaze);
    root.userData.animation = {
      pose, clip: currentAction.getClip().name, time: currentAction.time,
      playing: currentAction.isRunning(), attention,
    };
  }

  setPose("standing");
  return { root, animate, setPose, mixer };
}
