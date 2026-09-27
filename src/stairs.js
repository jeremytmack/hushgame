import { SIZE, OFFSET } from "./rules.js";

export const FLOOR_HEIGHT = 3.6;
export const STAIRS = Object.freeze({
  x: 9 * SIZE,
  width: 2.65,
  top: 2 * SIZE,
  bottom: 6 * SIZE,
  steps: 18,
});

export function onStairs(x, z) {
  return Math.abs(x - STAIRS.x) <= STAIRS.width / 2 &&
    z > STAIRS.top && z < STAIRS.bottom;
}

export function stairHeight(z) {
  const progress = Math.max(0, Math.min(1,
    (STAIRS.bottom - z) / (STAIRS.bottom - STAIRS.top)));
  return Math.ceil(progress * STAIRS.steps) * FLOOR_HEIGHT / STAIRS.steps;
}

export function groundHeight(x, z, floor) {
  return onStairs(x - floor * OFFSET, z) ? stairHeight(z) : floor * FLOOR_HEIGHT;
}

// Rails keep players on the flight. The two end gates prevent entering the
// upper opening from its low end, or the high end from underneath the landing.
export function stairMoveAllowed(x, z, nextX, nextZ, floor) {
  const half = STAIRS.width / 2 + 0.23;
  const insideWidth = Math.abs(nextX - STAIRS.x) < half;
  if (insideWidth && floor === 0 && z <= STAIRS.top && nextZ > STAIRS.top)
    return false;
  if (insideWidth && floor === 1 && z >= STAIRS.bottom && nextZ < STAIRS.bottom)
    return false;
  return true;
}

export function stairFloor(x, previousZ, z, floor) {
  if (Math.abs(x - floor * OFFSET - STAIRS.x) > STAIRS.width / 2) return floor;
  if (floor === 0 && previousZ > STAIRS.top && previousZ < STAIRS.bottom && z <= STAIRS.top)
    return 1;
  if (floor === 1 && previousZ <= STAIRS.top && z > STAIRS.top)
    return 0;
  return floor;
}
