export const SIZE = 1.65,
  OFFSET = 40,
  WIDTH = 19,
  HEIGHT = 19;
export const GRID = Array.from({ length: HEIGHT }, (_, z) =>
  Array.from({ length: WIDTH }, (_, x) => {
    if (x === 0 || z === 0 || x === 18 || z === 18) return 1;
    if ((x === 7 || x === 11) && ![4, 5, 12, 13].includes(z)) return 1;
    if (z === 8 && (x < 7 || x > 11)) return 1;
    return 0;
  }),
);
export function walkable(x, z) {
  return GRID[Math.round(z)]?.[Math.round(x)] === 0;
}
export function pathfind(start, end) {
  const s = start.map(Math.round),
    e = end.map(Math.round);
  if (!walkable(...e) || !walkable(...s)) return [];
  const key = (p) => p.join(",");
  const queue = [s],
    prev = new Map([[key(s), null]]);
  let found = false;
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (key(p) === key(e)) {
      found = true;
      break;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = [p[0] + dx, p[1] + dz];
      if (walkable(...n) && !prev.has(key(n))) {
        prev.set(key(n), p);
        queue.push(n);
      }
    }
  }
  if (!found) return [];
  const path = [];
  let p = e;
  while (p && key(p) !== key(s)) {
    path.unshift(p);
    p = prev.get(key(p));
  }
  return path;
}
export function roomAt(x, z, floor) {
  if (x > 7 && x < 11) return floor ? "Upstairs landing" : "The foyer";
  return (
    floor
      ? x < 7
        ? ["Your old room", "The attic"]
        : ["Mother’s room", "The nursery"]
      : x < 7
        ? ["The sitting room", "The study"]
        : ["The dining room", "The kitchen"]
  )[z < 8 ? 0 : 1];
}
export function suspicion(uses, type, roomVisits, noise) {
  return Math.min(
    0.9,
    (uses[type] || 0) * 0.19 +
      Math.min(0.25, (roomVisits || 0) * 0.035) +
      noise * 0.2,
  );
}
export const MEMORIES = [
  {
    id: "tape",
    name: "The VHS tape",
    where: "The study",
    text: "The date on the tape is twenty years ago. Your sister stands in this house, in her yellow pajamas. Behind her: a shape too tall for the doorway. The tape stutters. In the background, you see yourself. An adult.",
    after: "She wore yellow. Remember that.",
  },
  {
    id: "drawing",
    name: "The rules of our game",
    where: "The sitting room",
    text: "A drawing in your sister’s handwriting. “One counts. One hides. Never answer the voice upstairs. If you use the same place, it learns. If you leave, someone has to stay.” Underneath, in another hand: “We never stopped playing.”",
    after:
      "The hallway light flickers three times. Somewhere, a floorboard answers.",
  },
  {
    id: "letter",
    name: "Mother’s unsent letter",
    where: "Mother’s room",
    text: "“He says she went outside. But the windows were locked. At night I hear her laughing in the walls. Yesterday the voice called his nickname. It sounded exactly like me. I am afraid to sleep.”",
    after: "“Come upstairs, sweetheart.” That is not your mother.",
  },
  {
    id: "promise",
    name: "The promise",
    where: "Your old room",
    text: "You remember now. You were the one it found. Your sister crawled out of her hiding place and held its hand. “Take me instead,” she said. You promised you would come back. It has been twenty years.",
    after: "She has been hiding for you all this time.",
  },
  {
    id: "future",
    name: "A photograph from tomorrow",
    where: "The attic",
    text: "A child stands outside this house holding a photograph of you. On the back, a date twenty years from now. “I came to bring you home.” You recognize your own child’s handwriting. The house is a promise. And a promise always needs someone to keep it.",
    after: "A small voice from the nursery: “Is it my turn to go home now?”",
  },
];
