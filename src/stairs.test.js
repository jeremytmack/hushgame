import test from "node:test";
import assert from "node:assert/strict";
import { OFFSET } from "./rules.js";
import { STAIRS, FLOOR_HEIGHT, groundHeight, stairFloor, stairMoveAllowed } from "./stairs.js";

function walkFlight(startZ, direction, startingFloor, stride) {
  let floor = startingFloor;
  let z = startZ;
  let x = STAIRS.x + floor * OFFSET;
  const heights = [];
  for (let step = 0; step < 500; step++) {
    const nextZ = z + direction * stride;
    assert.ok(stairMoveAllowed(x - floor * OFFSET, z, x - floor * OFFSET, nextZ, floor));
    const nextFloor = stairFloor(x, z, nextZ, floor);
    x += (nextFloor - floor) * OFFSET;
    floor = nextFloor;
    z = nextZ;
    heights.push(groundHeight(x, z, floor));
    if (direction < 0 ? z < STAIRS.top - 0.3 : z > STAIRS.bottom + 0.3) break;
  }
  return { floor, heights, x, z };
}

test("walking, sprinting and crouching climb and descend without an interaction", () => {
  for (const stride of [0.03, 0.07, 0.17]) {
    const up = walkFlight(STAIRS.bottom + 0.1, -1, 0, stride);
    assert.equal(up.floor, 1);
    assert.equal(up.heights.at(-1), FLOOR_HEIGHT);
    up.heights.forEach((height, i) => {
      if (i) assert.ok(height >= up.heights[i - 1]);
    });
    const down = walkFlight(STAIRS.top - 0.1, 1, 1, stride);
    assert.equal(down.floor, 0);
    assert.equal(down.heights.at(-1), 0);
    down.heights.forEach((height, i) => {
      if (i) assert.ok(height <= down.heights[i - 1]);
    });
  }
});

test("reversing halfway down the flight returns smoothly to the upstairs landing", () => {
  const middle = (STAIRS.top + STAIRS.bottom) / 2;
  const result = walkFlight(middle, -1, 0, 0.08);
  assert.equal(result.floor, 1);
  assert.equal(result.heights.at(-1), FLOOR_HEIGHT);
});

test("walking beside the staircase stays on the current floor", () => {
  for (const floor of [0, 1]) {
    const x = STAIRS.x + STAIRS.width + floor * OFFSET;
    assert.equal(groundHeight(x, 5, floor), floor * FLOOR_HEIGHT);
    assert.equal(stairFloor(x, STAIRS.top + 0.1, STAIRS.top - 0.1, floor), floor);
  }
});

test("the upper opening cannot be entered from its low end or from below the top landing", () => {
  assert.equal(stairMoveAllowed(STAIRS.x, STAIRS.bottom + 0.1, STAIRS.x, STAIRS.bottom - 0.1, 1), false);
  assert.equal(stairMoveAllowed(STAIRS.x, STAIRS.top - 0.1, STAIRS.x, STAIRS.top + 0.1, 0), false);
});
