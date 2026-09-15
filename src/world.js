import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GRID, SIZE, OFFSET, MEMORIES } from "./rules.js";
export async function createWorld(canvas) {
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  const scene = new T.Scene();
  scene.background = new T.Color("#090e0d");
  scene.fog = new T.FogExp2("#0b1110", 0.039);
  const camera = new T.PerspectiveCamera(
    72,
    innerWidth / innerHeight,
    0.06,
    65,
  );
  camera.rotation.order = "YXZ";
  scene.add(camera);
  scene.add(new T.HemisphereLight(0x829b96, 0x2e2517, 1.05));
  const atlas = await new T.TextureLoader().loadAsync("/art/materials.png");
  atlas.colorSpace = T.SRGBColorSpace;
  function tex(x, y, rx = 1, ry = 1) {
    const t = atlas.clone();
    t.repeat.set(0.5, 0.5);
    t.offset.set(x * 0.5, y * 0.5);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }
  const wallpaper = new T.MeshStandardMaterial({
    map: tex(0, 1),
    color: 0x9e9e89,
    roughness: 1,
  });
  const wood = new T.MeshStandardMaterial({
    map: tex(1, 0),
    color: 0x716653,
    roughness: 0.85,
  });
  const floorMat = new T.MeshStandardMaterial({
    map: tex(1, 1),
    color: 0xada68d,
    roughness: 0.88,
  });
  const plaster = new T.MeshStandardMaterial({
    map: tex(0, 0),
    color: 0x85877b,
    roughness: 1,
  });
  const dark = new T.MeshStandardMaterial({ color: 0x171a16, roughness: 0.8 });
  const fabric = new T.MeshStandardMaterial({ color: 0x575d49, roughness: 1 });
  const brass = new T.MeshStandardMaterial({
    color: 0x887b4d,
    metalness: 0.65,
    roughness: 0.5,
  });
  const items = [],
    colliders = [],
    lamps = [];
  function box(x, y, z, w, h, d, mat, parent = scene) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function solid(x, z, w, d) {
    colliders.push({ x, z, w: w / 2 + 0.23, d: d / 2 + 0.23 });
  }
  function point(x, y, z, color, intensity, range) {
    const l = new T.PointLight(color, intensity, range, 2);
    l.position.set(x, y, z);
    scene.add(l);
    return l;
  }
  function lamp(x, z) {
    box(x, 0.5, z, 0.7, 1, 0.7, wood);
    box(x, 1.1, z, 0.08, 0.5, 0.08, brass);
    const shade = new T.Mesh(
      new T.CylinderGeometry(0.23, 0.38, 0.4, 16),
      new T.MeshStandardMaterial({
        color: 0xc5b17d,
        emissive: 0xa57838,
        emissiveIntensity: 0.45,
      }),
    );
    shade.position.set(x, 1.48, z);
    scene.add(shade);
    const l = point(x, 1.45, z, 0xffc779, 5.5, 9);
    lamps.push(l);
    solid(x, z, 0.7, 0.7);
  }
  function picture(x, z, rot) {
    const g = new T.Group();
    g.position.set(x, 1.95, z);
    g.rotation.y = rot;
    scene.add(g);
    box(0, 0, 0, 0.9, 1.1, 0.06, wood, g);
    box(0, 0, 0.035, 0.73, 0.92, 0.02, dark, g);
    const head = new T.Mesh(
      new T.SphereGeometry(0.13, 10, 8),
      new T.MeshStandardMaterial({ color: 0x454838 }),
    );
    head.position.set(0, 0.16, 0.07);
    g.add(head);
    box(0, -0.15, 0.045, 0.35, 0.35, 0.02, fabric, g);
  }
  function add(type, name, f, x, z, extra = {}) {
    const item = {
      type,
      name,
      floor: f,
      x: x * SIZE + f * OFFSET,
      z: z * SIZE,
      ...extra,
    };
    items.push(item);
    return item;
  }
  function bed(f, gx, gz) {
    const x = gx * SIZE + f * OFFSET,
      z = gz * SIZE;
    box(x, 0.33, z, 2.2, 0.6, 3.4, wood);
    box(x, 0.73, z, 2.15, 0.32, 3.3, plaster);
    box(x, 0.94, z + 0.35, 2.2, 0.14, 2.4, fabric);
    box(x, 0.99, z - 1.05, 1.6, 0.18, 0.55, plaster);
    box(x, 0.8, z - 1.72, 2.35, 1.6, 0.14, wood);
    solid(x, z, 2.2, 3.4);
    add("hide", "Hide under the bed", f, gx, gz, {
      kind: "bed",
      entryZ: z + 2.05,
    });
  }
  function wardrobe(f, gx, gz) {
    const x = gx * SIZE + f * OFFSET,
      z = gz * SIZE;
    box(x, 1.35, z, 1.9, 2.7, 0.85, wood);
    for (const off of [-0.48, 0.48]) {
      box(x + off, 1.38, z + 0.45, 0.86, 2.47, 0.07, wood);
      box(x + off * 0.25, 1.3, z + 0.52, 0.045, 0.14, 0.04, brass);
    }
    solid(x, z, 1.9, 0.85);
    add("hide", "Hide in the wardrobe", f, gx, gz, {
      kind: "wardrobe",
      entryZ: z + 1,
    });
  }
  function table(f, gx, gz) {
    const x = gx * SIZE + f * OFFSET,
      z = gz * SIZE;
    box(x, 0.85, z, 2.5, 0.15, 1.3, wood);
    for (const a of [-1, 1])
      for (const b of [-0.45, 0.45])
        box(x + a, 0.4, z + b, 0.1, 0.8, 0.1, wood);
    solid(x, z, 2.5, 1.3);
    return [x, z];
  }
  for (let f = 0; f < 2; f++) {
    const ox = f * OFFSET;
    for (let z = 0; z < 19; z++)
      for (let x = 0; x < 19; x++) {
        const xx = x * SIZE + ox,
          zz = z * SIZE;
        if (GRID[z][x]) {
          box(xx, 1.65, zz, SIZE, 3.3, SIZE, wallpaper);
          box(xx, 0.18, zz, SIZE + 0.02, 0.36, SIZE + 0.02, wood);
          box(xx, 3.13, zz, SIZE + 0.04, 0.17, SIZE + 0.04, wood);
        } else {
          box(xx, -0.08, zz, SIZE, 0.16, SIZE, floorMat);
          box(xx, 3.38, zz, SIZE, 0.15, SIZE, plaster);
        }
      }
    // Hall runner, ceiling beams, framed portraits, and pools of amber light.
    box(
      9 * SIZE + ox,
      0.012,
      9 * SIZE,
      2.15,
      0.02,
      25,
      new T.MeshStandardMaterial({ color: 0x403b30, roughness: 1 }),
    );
    for (const z of [3, 8, 14]) {
      box(9 * SIZE + ox, 3.15, z * SIZE, 5, 0.2, 0.2, wood);
      lamp(10.5 * SIZE + ox, z * SIZE);
      picture(7.54 * SIZE + ox, z * SIZE, Math.PI / 2);
    }
    for (const x of [3.3, 15.1])
      for (const z of [1, 17]) {
        const xx = x * SIZE + ox,
          zz = z * SIZE;
        const windowMat = new T.MeshStandardMaterial({
          color: 0x677e81,
          emissive: 0x648d9c,
          emissiveIntensity: 0.7,
        });
        box(xx, 1.95, zz, 2.2, 1.8, 0.08, wood);
        box(
          xx,
          1.95,
          zz + (z === 1 ? 0.06 : -0.06),
          1.98,
          1.6,
          0.025,
          windowMat,
        );
        box(xx, 1.95, zz, 2.15, 0.06, 0.2, wood);
        box(xx, 1.95, zz, 0.07, 1.8, 0.2, wood);
        point(xx, 2, z === 1 ? zz + 1.5 : zz - 1.5, 0x9abbcf, 7, 10);
      }
    // A physical staircase marks the connection between the floors.
    for (let s = 0; s < 9; s++)
      box(
        9 * SIZE + ox,
        (s + 1) * 0.12,
        (2.75 - s * 0.16) * SIZE,
        2.65,
        (s + 1) * 0.24,
        0.3,
        wood,
      );
    add("stairs", f ? "Go downstairs" : "Go upstairs", f, 9, 3.3);
    wardrobe(f, 2, 2.2);
    wardrobe(f, 16, 10);
    bed(f, 3, 11.5);
    bed(f, 15, 3.2);
    const couchX = 4 * SIZE + ox,
      couchZ = 5.8 * SIZE;
    box(couchX, 0.4, couchZ, 3.6, 0.65, 1.35, fabric);
    box(couchX, 0.9, couchZ - 0.62, 3.6, 1.25, 0.23, fabric);
    for (const a of [-1.75, 1.75])
      box(couchX + a, 0.65, couchZ, 0.23, 1, 1.4, wood);
    solid(couchX, couchZ, 3.6, 1.35);
    add("hide", "Hide behind the sofa", f, 4, 5.8, {
      kind: "sofa",
      entryZ: couchZ + 1.1,
    });
    table(f, 4.5, 15.4);
    table(f, 14.5, 6.6);
    table(f, 14, 15.2);
    // Shelves and books.
    for (const z of [10, 13, 16]) {
      box(1.1 * SIZE + ox, 1.2, z * SIZE, 0.65, 2.4, 1.6, wood);
      for (let n = 0; n < 6; n++)
        box(
          1.45 * SIZE + ox,
          0.65 + (n % 2) * 0.8,
          z * SIZE - 0.6 + Math.floor(n / 2) * 0.45,
          0.13,
          0.55,
          0.27,
          n % 2 ? fabric : plaster,
        );
    }
    // Small debris and scuffed boards stay below collision height.
    for (let i = 0; i < 27; i++) {
      const x = 8.1 + (Math.sin(i * 7) + 1) * 0.8,
        z = 4 + i * 0.45;
      const scrap = box(
        x * SIZE + ox,
        0.022,
        z * SIZE,
        0.16,
        0.015,
        0.28,
        plaster,
      );
      scrap.rotation.y = i * 2.1;
    }
  }
  const placements = [
    [0, 4.5, 15.4],
    [0, 14.5, 6.6],
    [1, 14.5, 6.6],
    [1, 5.8, 3],
    [1, 4.5, 15.4],
  ];
  // The drawing belongs in the sitting room, on the sofa side table.
  placements[1] = [0, 5.8, 3];
  table(0, 5.8, 3);
  table(1, 5.8, 3);
  MEMORIES.forEach((n, i) => {
    const [f, x, z] = placements[i],
      item = add("memory", `Read ${n.name.toLowerCase()}`, f, x, z, {
        id: n.id,
      });
    const mat = new T.MeshStandardMaterial({
      color: 0xdfd6ac,
      emissive: 0xc5b982,
      emissiveIntensity: 0.45,
    });
    item.mesh = box(item.x, 0.96, item.z, 0.43, 0.025, 0.58, mat);
    item.mesh.rotation.y = 0.2;
    const glow = point(item.x, 1.22, item.z, 0xf4e5ac, 0.55, 2);
    item.glow = glow;
    for (let l = 0; l < 5; l++)
      box(item.x, 0.978, item.z - 0.16 + l * 0.065, 0.27, 0.003, 0.009, dark);
  });
  const exit = add("exit", "Open the front door", 0, 9, 17.2);
  box(exit.x, 1.5, 18 * SIZE - 0.85, 2.1, 3, 0.18, wood);
  box(exit.x + 0.7, 1.45, 18 * SIZE - 0.95, 0.1, 0.1, 0.15, brass);
  const sister = add("sister", "Talk to your sister", 1, 14, 15.2, {
    active: false,
  });
  const fake = add("fake", "Look at the child", 0, 14, 15.2, { active: true });
  function child(item, color) {
    const g = new T.Group();
    g.position.set(item.x, 0, item.z + 1.15);
    scene.add(g);
    const cloth = new T.MeshStandardMaterial({ color, roughness: 1 });
    box(0, 0.58, 0, 0.35, 0.55, 0.22, cloth, g);
    const head = new T.Mesh(
      new T.SphereGeometry(0.16, 12, 12),
      new T.MeshStandardMaterial({ color: 0x918872 }),
    );
    head.position.y = 1;
    g.add(head);
    box(0, 1.08, 0.03, 0.34, 0.2, 0.27, dark, g);
    for (const a of [-0.12, 0.12]) box(a, 0.2, 0, 0.12, 0.4, 0.14, cloth, g);
    item.mesh = g;
    g.visible = item.active;
    return g;
  }
  child(sister, 0xb6a76a);
  child(fake, 0x576c8c);
  const seeker = new T.Group();
  scene.add(seeker);
  const shade = new T.MeshStandardMaterial({ color: 0x050706, roughness: 1 });
  const body = new T.Mesh(new T.ConeGeometry(0.38, 2.2, 9), shade);
  body.position.y = 1.24;
  seeker.add(body);
  const head = new T.Mesh(new T.SphereGeometry(0.2, 12, 10), shade);
  head.scale.y = 1.4;
  head.position.y = 2.5;
  seeker.add(head);
  for (const a of [-1, 1]) {
    const arm = box(a * 0.4, 1.3, 0, 0.08, 1.5, 0.08, shade, seeker);
    arm.rotation.z = a * 0.12;
    box(a * 0.14, 0.2, 0, 0.11, 0.6, 0.15, shade, seeker);
  }
  seeker.visible = false;
  const flashlight = new T.SpotLight(0xe5e4c2, 24, 24, Math.PI / 6, 0.65, 1.25);
  camera.add(flashlight);
  flashlight.position.set(0.16, -0.15, 0);
  camera.add(flashlight.target);
  flashlight.target.position.set(0, 0, -10);
  const fill = new T.PointLight(0x9dab9d, 0.75, 4);
  camera.add(fill);
  // Batch static architecture by material to avoid hundreds of draw calls per frame.
  const dynamic = new Set(items.map((i) => i.mesh).filter(Boolean)),
    batches = new Map();
  for (const m of [...scene.children])
    if (m.isMesh && !dynamic.has(m)) {
      m.updateMatrix();
      const g = m.geometry.clone().applyMatrix4(m.matrix);
      if (!batches.has(m.material)) batches.set(m.material, []);
      batches.get(m.material).push(g);
      scene.remove(m);
      m.geometry.dispose();
    }
  for (const [material, geometries] of batches) {
    const merged = mergeGeometries(geometries);
    scene.add(new T.Mesh(merged, material));
    geometries.forEach((g) => g.dispose());
  }
  return {
    renderer,
    scene,
    camera,
    items,
    colliders,
    lamps,
    seeker,
    flashlight,
    sister,
    fake,
  };
}
