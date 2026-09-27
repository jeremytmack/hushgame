import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Vector3 } from "three";
import { createSeeker } from "./seeker.js";

// Load the shipped skeleton, geometry and clips unchanged. Only omit materials
// so these animation tests need neither a browser image decoder nor a GPU.
const bytes = await readFile(new URL("../public/models/seeker.glb", import.meta.url));
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

function step(creature, frames, options) {
  for (let i=0;i<frames;i++) creature.animate(i/60,1/60,options);
  creature.root.updateMatrixWorld(true);
}

test("the Seeker's procedural gaze stays stable instead of accumulating rotations", () => {
  const creature=createSeeker(asset);
  const options={walking:false,playerX:0,playerY:1.65,playerZ:4,reduced:true};
  step(creature,180,options);
  const head=creature.root.getObjectByName('head');
  const initial=head.quaternion.clone();
  step(creature,600,options);
  assert.ok(head.quaternion.angleTo(initial)<0.03);
  const p=head.getWorldPosition(new Vector3());
  assert.ok(p.y>2 && p.y<2.9);
});

test("the walk deforms the shipped legs and remains finite through idle transitions", () => {
  const creature=createSeeker(asset);
  step(creature,30,{walking:false,playerX:0,playerZ:4});
  const leg=creature.root.getObjectByName('upperleg01L');
  const before=leg.quaternion.clone();
  let movement=0;
  for(let frame=0;frame<90;frame++){
    creature.animate(0.5+frame/60,1/60,{walking:true,speed:2.8,playerX:1,playerZ:3});
    movement=Math.max(movement,leg.quaternion.angleTo(before));
  }
  assert.ok(movement>0.15);
  step(creature,60,{walking:false,playerX:-1,playerZ:3});
  creature.root.traverse(object=>{
    assert.ok(object.quaternion.toArray().every(Number.isFinite));
  });
});

test("proximity opens and stretches the jaw, then relaxes when contact is lost", () => {
  const creature=createSeeker(asset);
  const jaw=creature.root.getObjectByName('jaw');
  step(creature,90,{walking:false,playerX:0,playerZ:9,distance:9});
  const neutral=jaw.quaternion.clone();
  const scale=jaw.scale.y;
  step(creature,120,{walking:false,playerX:0,playerZ:2,distance:1.4});
  assert.ok(creature.root.userData.animation.mouthOpen>.75);
  assert.ok(jaw.quaternion.angleTo(neutral)>.6);
  assert.ok(jaw.scale.y>scale*1.2);
  step(creature,120,{walking:false,playerX:0,playerZ:2,distance:1.4,aware:false});
  assert.ok(creature.root.userData.animation.scream<.001);
  assert.ok(Math.abs(jaw.scale.y-scale)<.001);
});
