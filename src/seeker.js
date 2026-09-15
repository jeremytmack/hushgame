import * as T from 'three';

// Hierarchical joints let the head keep its gaze while the body walks away.
export function createSeeker(faceTexture) {
  const root=new T.Group(),torso=new T.Group();root.add(torso);
  const skin=new T.MeshLambertMaterial({color:0xaaa18c});
  const cloth=new T.MeshLambertMaterial({color:0x202523,side:T.DoubleSide});
  const black=new T.MeshLambertMaterial({color:0x080b0a});
  function ellipsoid(parent,material,x,y,z,sx,sy,sz){const m=new T.Mesh(new T.SphereGeometry(1,12,10),material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m}
  torso.position.y=1.38;
  ellipsoid(torso,cloth,0,.36,0,.29,.68,.17);
  ellipsoid(torso,cloth,0,.77,0,.43,.12,.16);
  // A fluted, ragged hem instead of a solid triangular robe.
  const dressGeo=new T.CylinderGeometry(.24,.46,1.12,13,4,true);
  const p=dressGeo.attributes.position;
  for(let i=0;i<p.count;i++){const y=p.getY(i);p.setY(i,y+(y<-.45?Math.sin(i*3.7)*.11:0));p.setZ(i,p.getZ(i)*.6)}dressGeo.computeVertexNormals();
  const dress=new T.Mesh(dressGeo,cloth);dress.position.y=-.1;torso.add(dress);
  const neck=ellipsoid(torso,skin,0,.99,.06,.085,.27,.085);
  const head=new T.Group();head.position.set(0,1.25,.08);torso.add(head);
  ellipsoid(head,skin,0,0,0,.19,.29,.17);
  // Curved textured face: its silhouette is genuinely dimensional from oblique views.
  const faceGeo=new T.SphereGeometry(1,24,20,0,Math.PI,0,Math.PI);
  const faceMat=new T.MeshLambertMaterial({map:faceTexture,color:0xd3ccbb,side:T.DoubleSide});
  const face=new T.Mesh(faceGeo,faceMat);face.scale.set(.194,.285,.178);head.add(face);
  const limbs=[],fingers=[];
  for(const side of [-1,1]){
    const shoulder=new T.Group();shoulder.position.set(side*.39,.76,0);torso.add(shoulder);
    ellipsoid(shoulder,skin,0,-.36,0,.062,.42,.065);
    const elbow=new T.Group();elbow.position.y=-.75;shoulder.add(elbow);
    ellipsoid(elbow,skin,0,-.4,0,.045,.46,.043);
    const hand=ellipsoid(elbow,skin,0,-.88,.025,.072,.13,.035);
    for(let n=0;n<4;n++){const finger=new T.Group();finger.position.set((n-1.5)*.034,-.96,.025);elbow.add(finger);ellipsoid(finger,skin,0,-.12,0,.013,.17,.014);fingers.push(finger)}
    const hip=new T.Group();hip.position.set(side*.15,1.02,0);root.add(hip);
    ellipsoid(hip,black,0,-.23,0,.083,.32,.065);
    const knee=new T.Group();knee.position.y=-.48;hip.add(knee);ellipsoid(knee,skin,0,-.23,0,.047,.29,.044);ellipsoid(knee,black,0,-.48,.07,.07,.045,.16);
    limbs.push({side,shoulder,elbow,hip,knee,hand});
  }
  root.visible=false;
  function animate(time,dt,{walking,playerX,playerZ,reduced=false}){
    const gait=time*3.7,listen=!walking;
    torso.position.y=1.38+(reduced?0:Math.sin(gait*2)*.018);
    torso.rotation.z=reduced?0:Math.sin(gait*.5)*.025;
    torso.rotation.x=.11;
    const relative=T.MathUtils.euclideanModulo(Math.atan2(playerX-root.position.x,playerZ-root.position.z)-root.rotation.y+Math.PI,Math.PI*2)-Math.PI;
    const turn=T.MathUtils.clamp(relative,-1.35,1.35);
    head.rotation.y=T.MathUtils.damp(head.rotation.y,turn,listen?4:2,dt);
    head.rotation.z=T.MathUtils.damp(head.rotation.z,listen?.42:.11,2,dt);
    head.rotation.x=T.MathUtils.damp(head.rotation.x,listen?.13:-.06,2,dt);
    neck.rotation.z=head.rotation.z*.2;
    for(const l of limbs){const swing=walking?Math.sin(gait+l.side*Math.PI*.5):0;l.hip.rotation.x=swing*.35;l.knee.rotation.x=Math.max(0,-swing)*.38;l.shoulder.rotation.x=-swing*.19-.1;l.shoulder.rotation.z=l.side*(.055+(listen?.08:0));l.elbow.rotation.x=-.13+(reduced?0:Math.sin(gait*.7+l.side)*.04)}
    fingers.forEach((f,i)=>f.rotation.x=.18+(reduced?0:(Math.sin(time*.8+i*.4)+1)*.14));
  }
  return {root,animate};
}
