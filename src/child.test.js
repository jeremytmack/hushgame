import test from "node:test";
import assert from "node:assert/strict";
import { CHILD_SPAWNS, pickChildSpawn } from "./child.js";

test("child spawn list includes multiple rooms and both poses", () => {
  assert.ok(CHILD_SPAWNS.length >= 5);
  assert.ok(new Set(CHILD_SPAWNS.map((spawn) => spawn.location)).size >= 5);
  assert.deepEqual(
    new Set(CHILD_SPAWNS.map((spawn) => spawn.pose)),
    new Set(["seated", "standing"]),
  );
  assert.ok(CHILD_SPAWNS.some((spawn) => spawn.id === "kitchen-table"));
});

test("child spawn selection never immediately repeats", () => {
  for (let previous = 0; previous < CHILD_SPAWNS.length; previous += 1) {
    for (const sample of [0, 0.2, 0.5, 0.999999]) {
      const choice = pickChildSpawn(() => sample, previous);
      assert.notEqual(choice.index, previous);
      assert.equal(choice.spawn, CHILD_SPAWNS[choice.index]);
    }
  }
});

test("child spawn selection reaches the first and last locations", () => {
  assert.equal(pickChildSpawn(() => 0).index, 0);
  assert.equal(
    pickChildSpawn(() => 0.999999).index,
    CHILD_SPAWNS.length - 1,
  );
});
