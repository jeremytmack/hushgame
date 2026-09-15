import * as T from "three";

// Hierarchical joints let the head keep its gaze while the body walks away.
export function createSeeker(faceTexture, clothTexture) {
  const root = new T.Group(),
    torso = new T.Group();
  root.add(torso);
  const skinTexture = faceTexture.clone();
  skinTexture.repeat.set(0.16, 0.13);
  skinTexture.offset.set(0.4, 0.82);
  skinTexture.needsUpdate = true;
  const skin = new T.MeshLambertMaterial({ color: 0x878477, map: skinTexture });
  const cloth = new T.MeshLambertMaterial({
    color: 0x32362d,
    map: clothTexture,
    side: T.DoubleSide,
  });
  const black = new T.MeshLambertMaterial({ color: 0x080b0a });
  function ellipsoid(parent, material, x, y, z, sx, sy, sz) {
    const m = new T.Mesh(new T.SphereGeometry(1, 12, 10), material);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    parent.add(m);
    return m;
  }
  torso.position.y = 1.38;
  ellipsoid(torso, cloth, 0, 0.36, 0, 0.29, 0.68, 0.17);
  ellipsoid(torso, cloth, 0, 0.77, 0, 0.43, 0.12, 0.16);
  // A fluted, ragged hem instead of a solid triangular robe.
  const dressGeo = new T.CylinderGeometry(0.24, 0.46, 1.12, 13, 4, true);
  const p = dressGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setY(i, y + (y < -0.45 ? Math.sin(i * 3.7) * 0.11 : 0));
    p.setZ(i, p.getZ(i) * 0.6);
  }
  dressGeo.computeVertexNormals();
  const dress = new T.Mesh(dressGeo, cloth);
  dress.position.y = -0.1;
  torso.add(dress);
  const neck = ellipsoid(torso, skin, 0, 0.99, 0.06, 0.085, 0.27, 0.085);
  const head = new T.Group();
  head.position.set(0.045, 1.25, 0.14);
  torso.add(head);
  ellipsoid(head, skin, 0, 0, 0, 0.19, 0.29, 0.17);
  // Curved textured face: its silhouette is genuinely dimensional from oblique views.
  const faceGeo = new T.SphereGeometry(1, 24, 20, 0, Math.PI, 0, Math.PI);
  const faceUV = faceGeo.attributes.uv,
    facePos = faceGeo.attributes.position;
  for (let i = 0; i < faceUV.count; i++)
    faceUV.setXY(i, 0.5 + facePos.getX(i) * 0.49, 0.5 + facePos.getY(i) * 0.49);
  const hairMaterial = new T.MeshLambertMaterial({ color: 0x25231b });
  for (let n = 0; n < 13; n++) {
    const a = (n / 13) * Math.PI * 2,
      px = Math.sin(a) * 0.17,
      pz = Math.cos(a) * 0.12;
    const curve = new T.CatmullRomCurve3([
      new T.Vector3(px, 0.21, pz),
      new T.Vector3(px * 1.22, -0.04, pz * 1.2 - 0.03),
      new T.Vector3(px * 1.4, -0.4 - (n % 3) * 0.1, pz * 0.8 - 0.08),
    ]);
    head.add(
      new T.Mesh(new T.TubeGeometry(curve, 6, 0.004, 3, false), hairMaterial),
    );
  }
  const faceMat = new T.MeshLambertMaterial({
    map: faceTexture,
    color: 0xd3ccbb,
    side: T.DoubleSide,
  });
  const face = new T.Mesh(faceGeo, faceMat);
  face.scale.set(0.214, 0.29, 0.183);
  head.add(face);
  const limbs = [],
    fingers = [];
  for (const side of [-1, 1]) {
    const shoulder = new T.Group();
    shoulder.position.set(side * 0.35, 0.76 + side * 0.07, -0.035);
    torso.add(shoulder);
    ellipsoid(shoulder, skin, 0, -0.36, 0, 0.062, 0.42, 0.065);
    const elbow = new T.Group();
    elbow.position.y = -0.75;
    shoulder.add(elbow);
    ellipsoid(elbow, skin, 0, -0.4, 0, 0.045, 0.46, 0.043);
    const hand = ellipsoid(elbow, skin, 0, -0.88, 0.025, 0.072, 0.13, 0.035);
    for (let n = 0; n < 4; n++) {
      const finger = new T.Group();
      finger.position.set((n - 1.5) * 0.034, -0.96, 0.025);
      elbow.add(finger);
      ellipsoid(finger, skin, 0, -0.12, 0, 0.013, 0.17, 0.014);
      fingers.push(finger);
    }
    const hip = new T.Group();
    hip.position.set(side * 0.15, 1.02, 0);
    root.add(hip);
    ellipsoid(hip, black, 0, -0.23, 0, 0.083, 0.32, 0.065);
    const knee = new T.Group();
    knee.position.y = -0.48;
    hip.add(knee);
    ellipsoid(knee, skin, 0, -0.23, 0, 0.047, 0.29, 0.044);
    ellipsoid(knee, black, 0, -0.48, 0.07, 0.07, 0.045, 0.16);
    limbs.push({ side, shoulder, elbow, hip, knee, hand });
  }
  root.visible = false;
  function animate(time, dt, { walking, playerX, playerZ, reduced = false }) {
    const gait = time * 3.7,
      listen = !walking;
    torso.position.y = 1.38 + (reduced ? 0 : Math.sin(gait * 2) * 0.018);
    torso.rotation.z = reduced ? 0 : Math.sin(gait * 0.5) * 0.025;
    torso.rotation.x = 0.19;
    const relative =
      T.MathUtils.euclideanModulo(
        Math.atan2(playerX - root.position.x, playerZ - root.position.z) -
          root.rotation.y +
          Math.PI,
        Math.PI * 2,
      ) - Math.PI;
    const turn = T.MathUtils.clamp(relative, -1.35, 1.35);
    head.rotation.y = T.MathUtils.damp(
      head.rotation.y,
      turn,
      listen ? 4 : 2,
      dt,
    );
    head.rotation.z = T.MathUtils.damp(
      head.rotation.z,
      listen ? 0.42 : 0.11,
      2,
      dt,
    );
    head.rotation.x = T.MathUtils.damp(
      head.rotation.x,
      listen ? 0.13 : -0.06,
      2,
      dt,
    );
    neck.rotation.z = head.rotation.z * 0.2;
    for (const l of limbs) {
      const swing = walking ? Math.sin(gait + l.side * Math.PI * 0.5) : 0;
      l.hip.rotation.x = swing * 0.35;
      l.knee.rotation.x = Math.max(0, -swing) * 0.38;
      l.shoulder.rotation.x = -swing * 0.19 - 0.1;
      l.shoulder.rotation.z = l.side * (0.055 + (listen ? 0.08 : 0));
      l.elbow.rotation.x =
        -0.13 + (reduced ? 0 : Math.sin(gait * 0.7 + l.side) * 0.04);
    }
    fingers.forEach(
      (f, i) =>
        (f.rotation.x =
          0.18 + (reduced ? 0 : (Math.sin(time * 0.8 + i * 0.4) + 1) * 0.14)),
    );
  }
  return { root, animate };
}
