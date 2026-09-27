import * as T from "three";
import { loadSeekerAsset, createSeeker } from "../src/seeker.js";
import { SeekerVoice } from "../src/seeker-voice.js";
import { seekerPace } from "../src/seeker-motion.js";
const renderer = new T.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.5;
const scene=new T.Scene();scene.background=new T.Color('#101513');scene.fog=new T.Fog('#101513',7,15);
const camera=new T.PerspectiveCamera(37,innerWidth/innerHeight,.05,30);
scene.add(new T.HemisphereLight(0xadc1b8,0x30251e,1.65));
const key=new T.DirectionalLight(0xf4e3c8,3.4);key.position.set(-2,4,4);scene.add(key);
const rim=new T.DirectionalLight(0x8bb9ca,2.3);rim.position.set(3,3,-2);scene.add(rim);
const floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:0x141b17,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;scene.add(floor);
const creature=createSeeker(await loadSeekerAsset());scene.add(creature.root);creature.root.visible=true;
let mode=new URLSearchParams(location.search).get('mode')==='approach'?'approach':'still';
let view='full', reduced=false, time=0, last=performance.now(), distance=8, approachStart=0;
let voice=null, audioContext=null, sound=false;
const distanceControl=document.querySelector('#distance');
const soundButton=document.querySelector('#sound');
function chooseMode(value){mode=value;approachStart=time;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));}
chooseMode(mode);
distanceControl.oninput=()=>{distance=Number(distanceControl.value);if(mode==='approach')chooseMode('walk');};
soundButton.onclick=()=>{
 if(!audioContext){audioContext=new AudioContext();const master=audioContext.createGain();master.gain.value=.4;master.connect(audioContext.destination);voice=new SeekerVoice(audioContext,master);}
 sound=!sound;soundButton.setAttribute('aria-pressed',String(sound));soundButton.textContent=sound?'Mute scream audio':'Enable scream audio';
 if(sound)audioContext.resume();else{voice.silence();audioContext.suspend();}
};
document.addEventListener('visibilitychange',()=>{if(document.hidden){voice?.silence();audioContext?.suspend();}else if(sound)audioContext?.resume();});
function aim(){
 if(view==='face'){camera.position.set(.08,2.50,1.28);camera.lookAt(0,2.37,0);}
 else if(view==='side'){camera.position.set(4.3,1.6,3.1);camera.lookAt(0,1.4,0);}
 else {camera.position.set(.3,1.6,5.65);camera.lookAt(0,1.38,0);}
}
aim();
for(const button of document.querySelectorAll('[data-mode]'))button.onclick=()=>chooseMode(button.dataset.mode);
for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>{view=button.dataset.view;aim();document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));};
document.querySelector('#reduced').onclick=e=>{reduced=!reduced;e.target.setAttribute('aria-pressed',String(reduced));};
function frame(now){
 const dt=Math.min((now-last)/1000,.05);last=now;time+=dt;
 if(mode==='approach'){
  const phase=(time-approachStart)%12;
  distance=phase<8?8-6.6*(phase/8):1.4+6.6*((phase-8)/4);
  distanceControl.value=String(distance);
 }
 document.querySelector('#distance-value').textContent=distance.toFixed(1)+' m';
 const walking=mode!=='still';
 const speed=walking?2.8*seekerPace(time,reduced):0;
 creature.animate(time,dt,{walking,speed,distance,playerX:camera.position.x,playerY:camera.position.y,playerZ:camera.position.z,reduced});
 if(sound)voice.update(creature.root.userData.animation.scream);
 renderer.render(scene,camera);
 document.querySelector('#status').textContent=creature.root.userData.animation.scream>.6?'TOO CLOSE':walking?'SHE IS COMING CLOSER':'SHE IS LISTENING';
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
window.seekerPreview={creature,scene,camera,renderer,setTime(value){time=value;},snapshot(){return {previewTime:time,mode,view,reduced,sound,audioLevel:voice?.level||0,...creature.root.userData.animation};}};
