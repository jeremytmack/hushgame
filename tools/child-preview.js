import { createWorld } from '../src/world.js';
import { Vector3 } from 'three';
const world = await createWorld(document.querySelector('canvas'));
let time = 0, last = performance.now(), running = true, view = 'front';
const status = document.querySelector('#status');
function aim() {
  const p = world.fake.mesh.position;
  world.fake.mesh.updateMatrixWorld(true);
  const face = world.fake.mesh.getObjectByName('head').getWorldPosition(new Vector3());
  const y = face.y - p.y + .085;
  if(view === 'close') world.camera.position.set(p.x + .08,p.y+y+.06,p.z+.72);
  else if(view === 'side') world.camera.position.set(p.x+1.7,p.y+1.25,p.z+.6);
  else world.camera.position.set(p.x+.25,p.y+1.45,p.z+2.25);
  world.camera.lookAt(p.x,p.y+(view==='close'?y:.72),p.z);
}
function spawn(random) {
  world.randomizeFakeChild(random);
  world.fake.mesh.rotation.y = 0;
  aim();
}
spawn(()=>0);
document.querySelector('#seated').onclick=()=>{ if(world.fake.spawnId==='kitchen-table') return; spawn(()=>0); };
document.querySelector('#standing').onclick=()=>{ if(world.fake.spawnId==='sitting-room') return; spawn(()=>.25); };
for(const name of ['front','side','close']) document.querySelector('#'+name).onclick=()=>{view=name;aim();};
document.querySelector('#pause').onclick=(e)=>{running=!running;e.target.textContent=running?'Pause animation':'Play animation';};
function frame(now) {
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(running){time+=dt;world.animateChildren(time,dt,{playerX:world.camera.position.x,playerZ:world.camera.position.z,playerY:world.camera.position.y});}
  world.updateEnvironment(world.fake.floor,dt);
  world.renderer.render(world.scene,world.camera);
  const a=world.fake.mesh.userData.animation;
  status.textContent=world.fake.spawnId+'\n'+(a? a.clip+' · '+a.time.toFixed(2)+'s · '+(running&&a.playing?'PLAYING':'PAUSED'):'waiting')+'\n'+world.renderer.info.render.triangles.toLocaleString()+' triangles · '+world.renderer.info.render.calls+' draw calls';
}
requestAnimationFrame(frame);
window.addEventListener('resize',()=>{world.camera.aspect=innerWidth/innerHeight;world.camera.updateProjectionMatrix();world.renderer.setSize(innerWidth,innerHeight);});
