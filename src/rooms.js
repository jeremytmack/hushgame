import * as T from "three";
import { SIZE, OFFSET } from "./rules.js";

/** Furniture is specific to each room; clear paths to the existing clues remain intact. */
export function furnishRooms({
  scene,
  box,
  solid,
  wood,
  plaster,
  dark,
  fabric,
  brass,
  point,
}) {
  const enamel = new T.MeshLambertMaterial({ color: 0xa4aea3 }),
    rust = new T.MeshLambertMaterial({ color: 0x5b3c2d }),
    red = new T.MeshLambertMaterial({ color: 0x75463e }),
    blue = new T.MeshLambertMaterial({ color: 0x546f7a });
  const X = (x, f = 0) => x * SIZE + f * OFFSET,
    Z = (z) => z * SIZE;
  function chair(x, z, rot = 0, mat = wood) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    scene.add(g);
    box(0, 0.47, 0, 0.6, 0.1, 0.6, mat, g);
    box(0, 0.91, -0.27, 0.6, 0.85, 0.09, mat, g);
    for (const a of [-0.24, 0.24])
      for (const b of [-0.24, 0.24]) box(a, 0.23, b, 0.07, 0.46, 0.07, mat, g);
    solid(x, z, 0.65, 0.65);
  }
  function cylinder(x, y, z, r, h, mat) {
    const m = new T.Mesh(new T.CylinderGeometry(r, r, h, 14), mat);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  }
  function crate(x, z, w = 0.9, h = 0.8) {
    box(x, h / 2, z, w, h, w, wood);
    for (const y of [0.12, h - 0.12])
      box(x, y, z + w / 2 + 0.01, w, 0.07, 0.025, dark);
  }
  // Sitting room: an old television, a piano, and a grandfather clock.
  let x = X(2.1),
    z = Z(4.1);
  box(x, 0.9, z, 1.35, 0.9, 0.8, wood);
  box(x, 0.95, z + 0.42, 1.06, 0.66, 0.03, dark);
  box(
    x,
    0.93,
    z + 0.45,
    0.87,
    0.49,
    0.01,
    new T.MeshLambertMaterial({ color: 0x2d423d, emissive: 0x15241f }),
  );
  for (const a of [-0.5, 0.5]) box(x + a, 0.25, z, 0.09, 0.6, 0.09, wood);
  solid(x, z, 1.35, 0.8);
  x = X(2.2);
  z = Z(6.7);
  box(x, 0.7, z, 2.1, 1.4, 0.65, wood);
  box(x, 0.81, z + 0.42, 2.1, 0.15, 0.4, dark);
  for (let n = 0; n < 22; n++) {
    box(x - 0.96 + n * 0.087, 0.91, z + 0.43, 0.079, 0.025, 0.31, plaster);
    if (n % 7 !== 2 && n % 7 !== 6)
      box(x - 0.92 + n * 0.087, 0.94, z + 0.35, 0.045, 0.03, 0.18, dark);
  }
  solid(x, z, 2.1, 0.8);
  x = X(6);
  z = Z(1.6);
  box(x, 1.24, z, 0.68, 2.48, 0.42, wood);
  const clock = cylinder(x, 2, z + 0.24, 0.26, 0.03, brass);
  clock.rotation.x = Math.PI / 2;
  box(x, 2.07, z + 0.265, 0.015, 0.15, 0.025, dark);
  box(x + 0.06, 2, z + 0.27, 0.13, 0.014, 0.025, dark);
  box(x, 0.95, z + 0.24, 0.02, 0.95, 0.03, brass);
  solid(x, z, 0.68, 0.42);
  // Dining room: a long table with mismatched chairs and a hanging fixture.
  x = X(14.6);
  z = Z(3.5);
  box(x, 0.89, z, 2.5, 0.15, 3.1, wood);
  for (const a of [-1, 1])
    for (const b of [-1.25, 1.25])
      box(x + a, 0.4, z + b, 0.11, 0.8, 0.11, wood);
  solid(x, z, 2.5, 3.1);
  for (const b of [-1, 1]) {
    chair(x - 1.7, z + b, Math.PI / 2);
    chair(x + 1.7, z + b, -Math.PI / 2, b === 1 ? fabric : wood);
  }
  cylinder(x, 2.65, z, 0.6, 0.1, dark);
  box(x, 3, z, 0.035, 0.7, 0.035, brass);
  for (let n = 0; n < 5; n++) {
    const a = (n / 5) * Math.PI * 2;
    cylinder(
      x + Math.sin(a) * 0.6,
      2.75,
      z + Math.cos(a) * 0.6,
      0.05,
      0.22,
      plaster,
    );
  }
  point(x, 2.6, z, 0xb9b292, 5, 10);
  for (const b of [-1, 0, 1]) cylinder(x, 0.99, z + b, 0.23, 0.025, enamel);
  // Kitchen: dirty checkerboard tiles, cabinets, stove, sink, refrigerator.
  for (let i = 12; i < 18; i++)
    for (let j = 9; j < 18; j++)
      box(X(i), 0.005, Z(j), SIZE, 0.015, SIZE, (i + j) % 2 ? enamel : dark);
  for (const j of [10, 11, 12, 13]) {
    x = X(17);
    z = Z(j);
    box(x, 0.47, z, 1.05, 0.94, 1.55, enamel);
    box(x, 0.98, z, 1.16, 0.08, 1.62, plaster);
    box(x - 0.56, 0.6, z, 0.045, 0.05, 0.5, dark);
    solid(x, z, 1.1, 1.55);
  }
  x = X(17);
  z = Z(15.8);
  box(x, 1.1, z, 1.15, 2.2, 1.2, enamel);
  box(x - 0.59, 1.43, z, 0.06, 0.025, 1.18, dark);
  box(x - 0.64, 1.7, z + 0.4, 0.06, 0.33, 0.05, brass);
  solid(x, z, 1.15, 1.2);
  x = X(17);
  z = Z(12);
  box(x, 1.04, z, 0.8, 0.03, 1.12, dark);
  for (const a of [-0.23, 0.23])
    for (const b of [-0.3, 0.3])
      cylinder(x + a, 1.07, z + b, 0.16, 0.025, rust);
  x = X(17);
  z = Z(10);
  box(x, 1.035, z, 0.72, 0.03, 0.97, dark);
  box(x + 0.2, 1.23, z - 0.3, 0.04, 0.4, 0.04, brass);
  box(x + 0.1, 1.43, z - 0.3, 0.25, 0.04, 0.04, brass);
  // Study: green reading chair, reference stacks, writing instruments.
  chair(X(5.9), Z(16.4), -0.25, fabric);
  for (let n = 0; n < 6; n++)
    box(X(3.8), 1 + n * 0.055, Z(15.4), 0.36, 0.05, 0.5, n % 2 ? red : wood);
  // Old bedroom: toy train, blue rug, the child's little chair.
  box(X(3.8, 1), 0.01, Z(4), 3.6, 0.02, 2.4, blue);
  chair(X(5.8, 1), Z(1.8), Math.PI, blue);
  for (let n = 0; n < 5; n++) {
    x = X(5.8, 1);
    z = Z(6.3) + n * 0.24;
    box(x, 0.1, z, 0.18, 0.18, 0.18, n % 2 ? red : blue);
    for (const a of [-0.1, 0.1]) {
      const wheel = cylinder(x + a, 0.045, z, 0.045, 0.03, dark);
      wheel.rotation.z = Math.PI / 2;
    }
  }
  // Mother's room: dressing mirror, vanity and a folded nightdress.
  x = X(16.6, 1);
  z = Z(6.5);
  box(x, 0.9, z, 1.3, 0.15, 0.65, wood);
  box(x, 1.92, z - 0.2, 1.1, 1.55, 0.08, wood);
  box(
    x,
    1.92,
    z - 0.14,
    0.94,
    1.39,
    0.02,
    new T.MeshLambertMaterial({ color: 0x52625e }),
  );
  for (const a of [-0.53, 0.53]) box(x + a, 0.45, z, 0.08, 0.9, 0.08, wood);
  solid(x, z, 1.3, 0.65);
  cylinder(x - 0.3, 1.08, z, 0.065, 0.2, brass);
  box(x + 0.22, 1.015, z, 0.35, 0.05, 0.27, plaster);
  // Attic: low exposed rafters, trunks, covered furniture, no bedroom set.
  for (const zz of [10, 12.5, 15, 17]) {
    box(X(3.7, 1), 2.88, Z(zz), 8.7, 0.24, 0.2, wood);
    for (const a of [-1, 1]) {
      const beam = box(X(3.7, 1) + a * 2.8, 2.95, Z(zz), 3.2, 0.17, 0.15, wood);
      beam.rotation.z = a * 0.19;
    }
  }
  for (const [xx, zz, w, h] of [
    [2, 10, 1.2, 0.8],
    [2, 11.1, 0.8, 1.2],
    [5.7, 10, 1.2, 0.6],
    [5.7, 11.1, 0.8, 0.8],
    [2.3, 16.3, 1.3, 0.7],
  ]) {
    crate(X(xx, 1), Z(zz), w, h);
    solid(X(xx, 1), Z(zz), w, w);
  }
  box(X(2.1, 1), 1.03, Z(13.4), 1.5, 2.05, 1.1, plaster);
  solid(X(2.1, 1), Z(13.4), 1.5, 1.1);
  // Nursery: empty cot, rocking chair, mobile and scattered blocks.
  x = X(14, 1);
  z = Z(11.2);
  box(x, 0.38, z, 1.3, 0.16, 2.1, wood);
  box(x, 0.51, z, 1.17, 0.12, 1.94, plaster);
  for (const a of [-0.64, 0.64]) {
    box(x + a, 1.04, z, 0.065, 0.06, 2.2, wood);
    for (let n = 0; n < 10; n++)
      box(x + a, 0.73, z - 0.99 + n * 0.22, 0.035, 0.62, 0.035, wood);
  }
  for (const a of [-0.97, 0.97]) box(x, 0.78, z + a, 1.3, 0.75, 0.07, wood);
  solid(x, z, 1.3, 2.1);
  chair(X(16.2, 1), Z(16.3), -0.5, wood);
  for (let n = 0; n < 8; n++)
    box(
      X(13.1, 1) + Math.sin(n * 3) * 0.8,
      0.1,
      Z(13.4) + Math.cos(n * 4) * 0.7,
      0.19,
      0.19,
      0.19,
      n % 2 ? blue : red,
    );
  box(x, 2.7, z, 0.02, 1.1, 0.02, brass);
  box(x, 2.15, z, 1.3, 0.025, 0.025, brass);
  for (const a of [-0.6, 0, 0.6]) {
    box(x + a, 1.93, z, 0.012, 0.4, 0.012, brass);
    const star = new T.Mesh(new T.OctahedronGeometry(0.1), a ? blue : brass);
    star.position.set(x + a, 1.67, z);
    scene.add(star);
  }
}
