import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Vector3 } from "three";
import { createChild } from "./child.js";

// Load the shipped skeleton, geometry and clips unchanged. Only omit materials
// so these animation tests need neither a browser image decoder nor a GPU.
const bytes = await readFile(new URL("../public/models/child.glb", import.meta.url));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
const binaryStart = 20 + jsonLength;
const binary = bytes.subarray(binaryStart + 8);
const materials = gltf.materials;
delete gltf.images;
delete gltf.textures;
delete gltf.materials;
for (const mesh of gltf.meshes) {
  for (const primitive of mesh.primitives) delete primitive.material;
}
const json = Buffer.from(JSON.stringify(gltf));
const paddedLength = Math.ceil(json.length / 4) * 4;
const head = Buffer.alloc(20 + paddedLength + 8, 32);
head.writeUInt32LE(0x46546c67, 0);
head.writeUInt32LE(2, 4);
head.writeUInt32LE(head.length + binary.length, 8);
head.writeUInt32LE(paddedLength, 12);
head.writeUInt32LE(0x4e4f534a, 16);
json.copy(head, 20);
head.writeUInt32LE(binary.length, 20 + paddedLength);
head.writeUInt32LE(0x004e4942, 24 + paddedLength);
const data = Buffer.concat([head, binary]);
const asset = await new GLTFLoader().parseAsync(
  data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), "",
);

function position(child, bone) {
  child.root.updateMatrixWorld(true);
  return child.root.getObjectByName(bone.replaceAll(".", "")).getWorldPosition(new Vector3());
}

test("shipped child has skinned anatomy, skin texture and both eight-second clips", () => {
  let skinned = 0;
  asset.scene.traverse((object) => { if (object.isSkinnedMesh) skinned++; });
  assert.ok(skinned >= 5);
  assert.ok(materials.find((m) => m.name === "Skin").pbrMetallicRoughness.baseColorTexture);
  for (const name of ["SeatedIdle", "StandingIdle"]) {
    const clip = asset.animations.find((c) => c.name === name);
    assert.equal(clip.duration, 8);
    assert.ok(clip.tracks.length > 20);
  }
});

test("seated animation moves feet and hands, including with reduced camera motion", () => {
  const child = createChild(asset);
  child.setPose("seated");
  const foot = position(child, "foot.L");
  const hand = position(child, "wrist.L");
  child.animate(2, 2, { reduced: true });
  assert.ok(position(child, "foot.L").distanceTo(foot) > .02, "feet must visibly swing");
  assert.ok(position(child, "wrist.L").distanceTo(hand) > .01, "hands must visibly fidget");
});

test("clones have independent skeletons and standing motion", () => {
  const moving = createChild(asset);
  const still = createChild(asset);
  const initial = position(still, "wrist.L");
  moving.animate(4, 4);
  assert.ok(position(moving, "wrist.L").distanceTo(initial) > .015);
  assert.ok(position(still, "wrist.L").distanceTo(initial) < 1e-7);
  assert.notEqual(moving.root.getObjectByName("head"), still.root.getObjectByName("head"));
});

test("seated clip loops without a body-position jump", () => {
  const child = createChild(asset);
  child.setPose("seated");
  child.animate(7.999, 7.999);
  const before = position(child, "wrist.L");
  child.animate(8.001, .002);
  assert.ok(position(child, "wrist.L").distanceTo(before) < .001);
});
