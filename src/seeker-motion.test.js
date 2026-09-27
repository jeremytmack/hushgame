import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { seekerPace, seekerGesture, seekerThreat } from "./seeker-motion.js";

test("the Seeker pauses and surges without increasing average pursuit speed", () => {
  const samples = Array.from({length:4800},(_,i)=>seekerPace(i/1000));
  const mean = samples.reduce((a,b)=>a+b,0)/samples.length;
  assert.ok(Math.abs(mean-1)<0.002);
  assert.ok(Math.min(...samples)<0.35);
  assert.ok(Math.max(...samples)>1.3);
  assert.ok(samples.every(n=>Number.isFinite(n)&&n>=0&&n<2));
  assert.ok(Math.abs(seekerPace(4.8-0.0001)-seekerPace(4.8+0.0001))<0.001);
});

test("reduced motion removes bursts and involuntary gestures", () => {
  for(let time=0;time<30;time+=0.07){
    assert.equal(seekerPace(time,true),1);
    assert.deepEqual(seekerGesture(time,true),{tilt:0.08,twitch:0,curl:0.18,blink:0});
  }
});

test("the exported monster has continuous skinned meshes and both movement clips", () => {
  const glb=readFileSync(new URL('../public/models/seeker.glb',import.meta.url));
  assert.equal(glb.toString('ascii',0,4),'glTF');
  const length=glb.readUInt32LE(12);
  const asset=JSON.parse(glb.toString('utf8',20,20+length));
  for(const name of ['SeekerStill','SeekerWalk'])
    assert.ok(asset.animations.some(c=>c.name===name));
  const meshes=asset.nodes.filter(n=>n.mesh!==undefined);
  assert.ok(meshes.length>=5);
  assert.ok(meshes.every(n=>n.skin!==undefined));
  assert.ok(asset.skins.some(s=>s.joints.length>80));
  assert.ok(asset.nodes.some(n=>n.name==='head'));
  assert.ok(asset.images.every(i=>i.bufferView!==undefined), 'textures must be bundled locally');
});

test("the scream grows with proximity and never reacts to an unseen or hidden player", () => {
  assert.equal(seekerThreat(10),0);
  assert.equal(seekerThreat(1.3),1);
  assert.ok(seekerThreat(3)>seekerThreat(6));
  assert.equal(seekerThreat(1.3,false),0);
  assert.equal(seekerThreat(Infinity),0);
});
