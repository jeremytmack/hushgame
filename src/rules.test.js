import test from "node:test";
import assert from "node:assert/strict";
import { GRID, pathfind, walkable, suspicion, roomAt } from "./rules.js";
test("every open tile is reachable from the foyer", () => {
  for (let z = 0; z < 19; z++)
    for (let x = 0; x < 19; x++)
      if (!GRID[z][x] && (x !== 9 || z !== 15))
        assert.ok(pathfind([9, 15], [x, z]).length, `unreachable ${x},${z}`);
});
test("routes do not cross walls and take adjacent steps", () => {
  let p = [3, 3];
  for (const n of pathfind(p, [15, 15])) {
    assert.ok(walkable(...n));
    assert.equal(Math.abs(n[0] - p[0]) + Math.abs(n[1] - p[1]), 1);
    p = n;
  }
  assert.deepEqual(p, [15, 15]);
  assert.deepEqual(pathfind([9, 15], [0, 0]), []);
});
test("Seeker learns repeated hiding types and frequented rooms", () => {
  assert.ok(
    suspicion({ bed: 3 }, "bed", 1, 0) > suspicion({ bed: 1 }, "bed", 1, 0),
  );
  assert.ok(suspicion({}, "sofa", 9, 0) > suspicion({}, "sofa", 1, 0));
  assert.ok(suspicion({}, "sofa", 0, 1) > suspicion({}, "sofa", 0, 0));
  assert.equal(suspicion({ bed: 100 }, "bed", 100, 1), 0.9);
});
test("floor plan labels distinguish rooms and levels", () => {
  assert.equal(roomAt(3, 15, 0), "The study");
  assert.equal(roomAt(15, 15, 1), "The nursery");
  assert.equal(roomAt(9, 5, 1), "Upstairs landing");
});
