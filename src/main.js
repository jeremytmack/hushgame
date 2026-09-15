import "./style.css";
import * as T from "three";
import { createWorld } from "./world.js";
import { HouseAudio } from "./audio.js";
import {
  SIZE,
  OFFSET,
  walkable,
  pathfind,
  roomAt,
  suspicion,
  MEMORIES,
} from "./rules.js";
const $ = (id) => document.getElementById(id),
  audio = new HouseAudio(),
  keys = new Set(),
  touch = matchMedia("(pointer:coarse)").matches;
let world = null,
  state = null,
  modal = false,
  started = false,
  yaw = 0,
  pitch = 0,
  sensitivity = 0.002,
  brightness = 1.35,
  reduced = false,
  previous = performance.now(),
  subtitleUntil = 0,
  stepTimer = 0,
  enemyStep = 0,
  currentTarget = null,
  moveStick = { x: 0, y: 0 },
  lastFrame = 0;

function say(text, seconds = 6, voice = false) {
  $("subtitle").textContent = text;
  subtitleUntil = state.elapsed + seconds;
  if (voice) audio.whisper(text);
}
function showModal(kicker, title, body, actions) {
  modal = true;
  keys.clear();
  moveStick = { x: 0, y: 0 };
  document.exitPointerLock?.();
  audio.pause();
  $("dialog-kicker").textContent = kicker;
  $("dialog-title").textContent = title;
  $("dialog-body").innerHTML = body;
  $("dialog-actions").replaceChildren();
  for (const [label, fn] of actions) {
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = fn;
    $("dialog-actions").append(b);
  }
  $("modal").hidden = false;
  setTimeout(() => $("dialog-actions").querySelector("button")?.focus(), 30);
}
function closeModal() {
  modal = false;
  $("modal").hidden = true;
  keys.clear();
  if (started) {
    audio.resume();
    lock();
  }
}
function lock() {
  if (!touch && !modal)
    try {
      const p = $("world").requestPointerLock?.();
      p?.catch(() => {});
    } catch {}
}
function settings(back) {
  showModal(
    "MAKE YOURSELF COMFORTABLE",
    "Before the lights go out.",
    `<label class="setting">Brightness<input id="brightness" aria-label="Brightness" type="range" min="0.7" max="2.8" step="0.05" value="${brightness}"></label><label class="setting">Look sensitivity<input id="sensitivity" aria-label="Look sensitivity" type="range" min="0.0007" max="0.005" step="0.0001" value="${sensitivity}"></label><label class="setting">Sound<input id="volume" aria-label="Sound volume" type="range" min="0" max="1" step="0.05" value="${audio.volume}"></label><label class="setting">Spoken whispers (browser voice)<input id="voices" type="checkbox" ${audio.voices ? "checked" : ""}></label><label class="setting">Reduce camera motion & flicker<input id="reduced" type="checkbox" ${reduced ? "checked" : ""}></label><div class="controls"><span><b>W A S D</b> Move</span><span><b>MOUSE / ARROWS</b> Look</span><span><b>E</b> Interact / leave hiding</span><span><b>F</b> Flashlight</span><span><b>SHIFT</b> Run (makes noise)</span><span><b>C</b> Crouch (quiet)</span><span><b>SPACE</b> Hold your breath</span><span><b>Q</b> Throw a distraction</span><span><b>J / M</b> Memories & floor plan</span><span><b>ESC / P</b> Pause</span></div><p>On touchscreens: left thumb to move, drag the right side to look. The game pauses when you read or open a menu.</p>`,
    [["Back", back]],
  );
  $("brightness").oninput = (e) => {
    brightness = +e.target.value;
    if (world) world.renderer.toneMappingExposure = brightness;
  };
  $("sensitivity").oninput = (e) => (sensitivity = +e.target.value);
  $("volume").oninput = (e) => audio.setVolume(+e.target.value);
  $("voices").onchange = (e) => (audio.voices = e.target.checked);
  $("reduced").onchange = (e) => (reduced = e.target.checked);
}
$("menu-settings").onclick = () =>
  settings(() => {
    modal = false;
    $("modal").hidden = true;
  });
$("start").onclick = async () => {
  $("start").disabled = true;
  $("start").textContent = "Opening the door…";
  try {
    audio.init();
    if (!world) world = await createWorld($("world"));
    world.renderer.toneMappingExposure = brightness;
    reset();
    $("menu").hidden = true;
    $("hud").hidden = false;
    $("touch").hidden = !touch;
    started = true;
    showModal(
      "2:17 AM · ONE UNREAD MESSAGE",
      "Don’t answer her.",
      `<p>You wake up in your childhood home. It has been abandoned for twenty years.</p><p>Upstairs, your mother calls your childhood nickname.</p><p><em>She has been dead for eighteen years.</em></p><p>Your phone lights up:</p><p class="note">DON’T ANSWER HER. SHE DOESN’T KNOW WHERE YOU ARE YET.</p><p>Recover five memories, find your sister, and reach the front door. When the house says “Ready or not”, you have thirty seconds to hide. <em>Change hiding places. It learns.</em></p>`,
      [
        [
          "Put the phone away",
          () => {
            closeModal();
            say("The study. That is where you left the tape.", 8);
          },
        ],
      ],
    );
  } catch (e) {
    console.error(e);
    $("start").disabled = false;
    $("start").textContent = "Try again";
    showModal(
      "THE DOOR WOULD NOT OPEN",
      "Unable to enter.",
      `<p>The 3D scene could not load. This game needs a browser with WebGL enabled. Try another browser or reload.</p>`,
      [
        [
          "Back",
          () => {
            modal = false;
            $("modal").hidden = true;
          },
        ],
      ],
    );
  }
};
function reset() {
  state = {
    x: 9 * SIZE,
    z: 15.6 * SIZE,
    floor: 0,
    elapsed: 0,
    phase: "explore",
    phaseTime: 65,
    round: 0,
    collected: new Set(),
    hidden: null,
    breath: 100,
    light: true,
    crouch: false,
    noise: 0,
    uses: {},
    roomVisits: {},
    lastRoom: "",
    throws: 3,
    sister: false,
    done: false,
    enemy: {
      x: 9 * SIZE,
      z: 5 * SIZE,
      floor: 0,
      path: [],
      repath: 0,
      target: null,
      inspect: 0,
      pressure: 0,
      plan: [],
    },
  };
  yaw = 0;
  pitch = 0;
  subtitleUntil = 0;
  $("subtitle").textContent = "";
  $("subtitle").style.opacity = 0;
  for (const i of world.items)
    if (i.type === "memory") {
      i.mesh.visible = true;
      i.glow.visible = true;
    }
  world.sister.active = false;
  world.sister.mesh.visible = false;
  world.fake.active = true;
  world.fake.mesh.visible = true;
  world.seeker.visible = false;
  document.body.classList.remove("hidden-view", "danger");
  world.flashlight.visible = true;
}
function pause() {
  if (!started || state.done) return;
  showModal(
    "THE HOUSE CAN WAIT",
    "Be very quiet.",
    `<p>Find five memories. Survive the searches. Bring your sister to the front door.</p><p>Hiding only helps if you stay quiet. Hold <em>Space</em> when footsteps are close, release it before your breath runs out, and turn off your light with <em>F</em>. It remembers the kinds of places you use.</p>`,
    [
      ["Resume", closeModal],
      ["Settings", () => settings(pause)],
      [
        "Restart",
        () =>
          showModal(
            "START OVER",
            "Forget everything?",
            `<p>Your current memories and progress will be lost.</p>`,
            [
              ["Keep playing", pause],
              [
                "Restart",
                () => {
                  reset();
                  closeModal();
                },
              ],
            ],
          ),
      ],
    ],
  );
}
$("pause-button").onclick = pause;
function journal() {
  const f = state.floor,
    x = (state.x - f * OFFSET) / SIZE,
    z = state.z / SIZE,
    room = roomAt(x, z, f);
  const rooms = f
    ? ["Your old room", "Mother’s room", "The attic", "The nursery"]
    : ["The sitting room", "The dining room", "The study", "The kitchen"];
  showModal(
    `${state.collected.size} / 5 MEMORIES · ${f ? "UPSTAIRS" : "GROUND FLOOR"}`,
    "What you remember.",
    `<p>Stairs are at the north end of the central hall. The front door is at the south end, downstairs.</p><div class="floor-map"><span class="${room === rooms[0] ? "current" : ""}">${rooms[0]}</span><span class="hall">NORTH · STAIRS ↑</span><span class="${room === rooms[1] ? "current" : ""}">${rooms[1]}</span><span class="${room === rooms[2] ? "current" : ""}">${rooms[2]}</span><span class="${room === rooms[3] ? "current" : ""}">${rooms[3]}</span></div><p class="mono">YOU ARE IN ${room.toUpperCase()} · DISTRACTIONS ${state.throws} / 3</p>${MEMORIES.map((n) => `<details class="journal-entry"><summary>${state.collected.has(n.id) ? n.name : "Unrecovered memory — " + n.where}</summary><p>${state.collected.has(n.id) ? n.text : "Look for a pale, glowing page on the furniture."}</p></details>`).join("")}<p><em>Yellow pajamas. She wore yellow.</em></p>`,
    [["Back to the house", closeModal]],
  );
}
$("journal-button").onclick = journal;
function action(code) {
  if (!started || state.done) return;
  if (modal) {
    if (code === "Escape" || code === "KeyP") closeModal();
    return;
  }
  if (code === "Escape" || code === "KeyP") {
    pause();
    return;
  }
  if (code === "KeyJ" || code === "KeyM") {
    journal();
    return;
  }
  if (code === "KeyF") {
    state.light = !state.light;
    if (
      state.hidden &&
      !state.light &&
      state.uses.dark > 0 &&
      state.phase === "search"
    )
      say("“Why did the light go out?”", 5, true);
    if (state.hidden && !state.light)
      state.uses.dark = (state.uses.dark || 0) + 1;
    audio.tone(220, 0.05, 0.06);
  }
  if (code === "KeyC") state.crouch = !state.crouch;
  if (code === "KeyE") interact();
  if (code === "KeyQ") {
    if (state.throws <= 0) {
      say("Nothing left to throw.", 3);
      return;
    }
    if (state.hidden) {
      say("Not from here. You would give yourself away.", 3);
      return;
    }
    state.throws--;
    const e = state.enemy;
    let tx = state.x - Math.sin(yaw) * 7,
      tz = state.z - Math.cos(yaw) * 7;
    if (!walkable((tx - state.floor * OFFSET) / SIZE, tz / SIZE)) {
      tx = state.x - Math.sin(yaw) * 3;
      tz = state.z - Math.cos(yaw) * 3;
    }
    e.target = { x: tx, z: tz };
    e.repath = 0;
    e.distracted = 9;
    audio.tone(570, 0.2, 0.18, 0.7, "triangle");
    say(`A bottle breaks in the dark. ${state.throws} distractions left.`, 3);
  }
}
window.addEventListener("keydown", (e) => {
  if (
    [
      "Space",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Tab",
    ].includes(e.code) &&
    started &&
    !modal
  )
    e.preventDefault();
  if (!e.repeat) action(e.code);
  if (!modal) keys.add(e.code);
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("mousemove", (e) => {
  if (started && !modal && document.pointerLockElement) {
    yaw -= e.movementX * sensitivity;
    pitch = Math.max(-1.25, Math.min(1.25, pitch - e.movementY * sensitivity));
  }
});
$("world").onclick = () => {
  if (started && !modal) lock();
};
document.addEventListener("pointerlockchange", () => {
  if (
    started &&
    !modal &&
    !document.pointerLockElement &&
    !touch &&
    !state.done
  )
    pause();
});
window.addEventListener("blur", () => {
  keys.clear();
  if (started && !modal && !state.done) pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && started && !modal && !state.done) pause();
});
function nearest() {
  let best = null,
    bestD = 2.5;
  for (const i of world.items) {
    if (
      i.floor !== state.floor ||
      i.active === false ||
      (i.type === "memory" && state.collected.has(i.id))
    )
      continue;
    const d = Math.hypot(i.x - state.x, (i.entryZ ?? i.z) - state.z);
    if (d < bestD) {
      const dx = i.x - state.x,
        dz = i.z - state.z,
        dot =
          (-Math.sin(yaw) * dx - Math.cos(yaw) * dz) /
          (Math.hypot(dx, dz) || 1);
      if ((dot > -0.1 || d < 1.1) && lineClear(state.x, state.z, i.x, i.z)) {
        bestD = d;
        best = i;
      }
    }
  }
  return best;
}
function interact() {
  if (state.hidden) {
    state.hidden = null;
    document.body.classList.remove("hidden-view");
    say("You step back into the house.", 2);
    return;
  }
  const i = nearest();
  if (!i) return;
  if (i.type === "hide") {
    state.hidden = i;
    state.uses[i.kind] = (state.uses[i.kind] || 0) + 1;
    document.body.classList.add("hidden-view");
    audio.tone(80, 0.5, 0.13);
    say(
      state.uses[i.kind] > 1
        ? "You have hidden somewhere like this before."
        : "Stay still. Turn off the light. Listen.",
      4,
    );
    return;
  }
  if (i.type === "stairs") {
    state.floor = 1 - state.floor;
    state.x = 9 * SIZE + state.floor * OFFSET;
    state.z = 4.2 * SIZE;
    yaw = Math.PI;
    pitch = 0;
    audio.step();
    say(
      state.floor ? "Upstairs. The air is colder here." : "Back downstairs.",
      3,
    );
    return;
  }
  if (i.type === "memory") {
    const n = MEMORIES.find((n) => n.id === i.id);
    state.collected.add(i.id);
    i.mesh.visible = false;
    i.glow.visible = false;
    audio.chime();
    if (state.collected.size === 5) {
      world.sister.active = true;
      world.sister.mesh.visible = true;
      state.phase = "explore";
      state.phaseTime = 75;
      world.seeker.visible = false;
    }
    showModal(
      `MEMORY ${state.collected.size} OF 5 · ${n.where.toUpperCase()}`,
      n.name,
      `<p class="note">${n.text}</p>`,
      [
        [
          "Remember",
          () => {
            closeModal();
            say(n.after, 8, true);
          },
        ],
      ],
    );
    return;
  }
  if (i.type === "fake") {
    showModal(
      "THE DINING ROOM",
      "“Don’t let him find me.”",
      `<p>A little girl waits by the table. She looks like your sister.</p><p>Her pajamas are <em>blue</em>.</p><p>“Jeremy,” she whispers. “Come and hide with me.”</p>`,
      [
        [
          "Step away",
          () => {
            i.active = false;
            i.mesh.visible = false;
            closeModal();
            say("“You used to believe me.”", 5, true);
          },
        ],
        [
          "Take her hand",
          () => {
            closeModal();
            finish(
              "found",
              "Found you.",
              "Her hand is ice. The thing beside you slowly turns its head. Your sister wore yellow. You remember too late.",
            );
          },
        ],
      ],
    );
    return;
  }
  if (i.type === "sister") {
    state.sister = true;
    i.active = false;
    i.mesh.visible = false;
    showModal(
      "THE NURSERY",
      "“Is it my turn to go home now?”",
      `<p>Yellow pajamas. The same eyes. The sister you left behind.</p><p>“I hid really well,” she says. “But I’m tired.”</p><p>You take her hand. Downstairs, the lock on the front door turns.</p><p><em>Bring her to the front door.</em></p>`,
      [
        [
          "Take her downstairs",
          () => {
            closeModal();
            say("Behind you, smaller footsteps follow yours.", 5);
          },
        ],
      ],
    );
    return;
  }
  if (i.type === "exit") {
    if (!state.sister) {
      say(
        state.collected.size === 5
          ? "Your sister is waiting in the nursery."
          : "The door will not open. Your sister is still inside.",
        5,
      );
      return;
    }
    showModal(
      "5:59 AM · THE FRONT DOOR",
      "Someone has to stay.",
      `<p>The door opens. Morning spills across the floor.</p><p>Your sister squeezes your hand. Then you hear another child on the stairs.</p><p>“Dad? I came to bring you home.”</p><p>Your own child. Twenty years from now.</p><p><em>The house is waiting for your answer.</em></p>`,
      [
        [
          "Stay for your sister",
          () =>
            finish(
              "stay",
              "Her turn to go home.",
              "You let her hand go. She walks into the morning, eight years old and finally free. You close the door. Upstairs, your child begins to count. For the first time, you know why you came back.",
            ),
        ],
        [
          "Leave together",
          () =>
            finish(
              "leave",
              "The game goes on.",
              "You step into the sunlight together. Behind you, your child whispers, “I found somewhere good.” The door shuts. Twenty years from now, a package will arrive.",
            ),
        ],
      ],
    );
  }
}
function finish(kind, title, body) {
  state.done = true;
  document.body.classList.remove("danger", "hidden-view");
  showModal(
    kind === "found"
      ? "THE SEEKER REMEMBERS"
      : "HUSH · " + (kind === "stay" ? "THE PROMISE" : "THE INHERITANCE"),
    title,
    `<p>${body}</p><p class="mono">${state.collected.size} / 5 MEMORIES · ${state.round} SEARCHES · ${Math.floor(state.elapsed / 60)} MINUTES IN THE HOUSE</p>`,
    [
      [
        "Play again",
        () => {
          reset();
          closeModal();
        },
      ],
      [
        "Return to title",
        () => {
          started = false;
          modal = false;
          $("modal").hidden = true;
          $("hud").hidden = true;
          $("touch").hidden = true;
          $("menu").hidden = false;
          $("start").disabled = false;
          $("start").textContent = "Enter the house";
          audio.pause();
        },
      ],
    ],
  );
}
function canMove(x, z) {
  const local = (x - state.floor * OFFSET) / SIZE,
    zz = z / SIZE;
  for (const a of [-0.2, 0.2])
    for (const b of [-0.2, 0.2]) if (!walkable(local + a, zz + b)) return false;
  return !world.colliders.some(
    (c) => Math.abs(x - c.x) < c.w && Math.abs(z - c.z) < c.d,
  );
}
function routeEnemy() {
  const e = state.enemy;
  if (!e.target) return;
  e.path = pathfind(
    [(e.x - e.floor * OFFSET) / SIZE, e.z / SIZE],
    [(e.target.x - e.floor * OFFSET) / SIZE, e.target.z / SIZE],
  ).map(([x, z]) => ({ x: x * SIZE + e.floor * OFFSET, z: z * SIZE }));
}
function beginSearch() {
  state.phase = "search";
  state.phaseTime = 38 + Math.min(state.round * 3, 15);
  state.round++;
  const e = state.enemy;
  e.floor = state.floor;
  e.x = 9 * SIZE + e.floor * OFFSET;
  e.z = 2.9 * SIZE;
  e.pressure = 0;
  e.inspect = 0;
  e.distracted = 0;
  e.repath = 0;
  e.plan = world.items
    .filter((i) => i.type === "hide" && i.floor === e.floor)
    .sort((a, b) => {
      const rank = (i) =>
        (state.uses[i.kind] || 0) +
        (state.roomVisits[
          roomAt((i.x - i.floor * OFFSET) / SIZE, i.z / SIZE, i.floor)
        ] || 0) *
          0.2;
      return rank(b) - rank(a);
    })
    .map((i) => ({ x: i.x, z: i.entryZ ?? i.z, item: i }));
  e.target = e.plan.shift();
  world.seeker.visible = true;
  say("“…here I come.”", 6, true);
  routeEnemy();
}
function lineClear(x, z, tx, tz) {
  const d = Math.hypot(tx - x, tz - z);
  for (let t = 0.3; t < d; t += 0.4) {
    const xx = x + ((tx - x) * t) / d,
      zz = z + ((tz - z) * t) / d;
    if (!walkable((xx - state.floor * OFFSET) / SIZE, zz / SIZE)) return false;
  }
  return true;
}
function updateEnemy(dt) {
  const e = state.enemy;
  e.repath -= dt;
  e.distracted = Math.max(0, (e.distracted || 0) - dt);
  if (e.floor !== state.floor) {
    world.seeker.visible = false;
    e.repath = -1;
    e.floor = state.floor;
    e.x = 9 * SIZE + e.floor * OFFSET;
    e.z = 3.5 * SIZE;
    e.target = null;
    e.plan = [];
    return;
  }
  world.seeker.visible = true;
  const d = Math.hypot(e.x - state.x, e.z - state.z);
  const los = lineClear(e.x, e.z, state.x, state.z);
  const loud = state.noise > 0.5;
  if (
    !e.distracted &&
    !state.hidden &&
    ((los && d < (state.light ? 11 : 5)) || (loud && d < 15))
  ) {
    e.target = { x: state.x, z: state.z };
    e.inspect = 0;
  }
  if (!e.target) {
    e.target = e.plan.shift() || { x: state.x, z: state.z };
    e.repath = 0;
  }
  if (e.repath <= 0) {
    routeEnemy();
    e.repath = 0.8;
  }
  if (e.path.length && e.inspect <= 0) {
    const p = e.path[0],
      dx = p.x - e.x,
      dz = p.z - e.z,
      len = Math.hypot(dx, dz),
      v = (state.hidden ? 1.3 : 1.65) * dt;
    if (len < v) {
      e.x = p.x;
      e.z = p.z;
      e.path.shift();
    } else {
      e.x += (dx / len) * v;
      e.z += (dz / len) * v;
    }
    world.seeker.rotation.y = Math.atan2(dx, dz);
    enemyStep += dt;
    if (enemyStep > 0.65) {
      enemyStep = 0;
      audio.step(
        true,
        Math.sin(Math.atan2(e.x - state.x, e.z - state.z) + yaw) *
          Math.min(1, 5 / Math.max(1, d)),
      );
    }
  } else if (!e.path.length) {
    e.inspect += dt;
    if (e.inspect > 4) {
      e.target = e.plan.shift() || {
        x: 9 * SIZE + e.floor * OFFSET,
        z: (4 + Math.random() * 12) * SIZE,
      };
      e.inspect = 0;
      e.repath = 0;
    }
  }
  world.seeker.position.set(
    e.x,
    reduced ? 0 : Math.sin(state.elapsed * 2) * 0.03,
    e.z,
  );
  if (!state.hidden && d < 1.05 && los) {
    finish(
      "found",
      "Found you.",
      "The footsteps stop. There is no scream. Only a voice, impossibly close, saying your name. The house begins to count again.",
    );
    return;
  }
  if (state.hidden && d < 3.2 && los) {
    const hold = keys.has("Space") && state.breath > 1;
    const s = suspicion(
      state.uses,
      state.hidden.kind,
      state.roomVisits[state.lastRoom],
      state.noise,
    );
    const rate = state.light ? 0.5 : !hold ? 0.2 : s > 0.7 ? 0.095 : 0;
    e.pressure += dt * rate;
    if (e.pressure > 0.7 && e.pressure - dt * rate <= 0.7)
      say("Feet stop outside. Cover your mouth.", 4);
    if (e.pressure > 2.7) {
      finish(
        "found",
        "It remembered.",
        "The door opens slowly. You taught it where to look. Next time, change the way you hide, keep the light off, and hold your breath when it comes close.",
      );
      return;
    }
  } else e.pressure = Math.max(0, e.pressure - dt * 0.6);
  document.body.classList.toggle("danger", d < 4.5 && !state.hidden);
}
function tick(dt) {
  state.elapsed += dt;
  state.phaseTime -= dt;
  if (state.elapsed > 900) {
    finish(
      "found",
      "The morning never came.",
      "The house has counted to fifteen minutes. You have forgotten the way out. Somewhere in the walls, your sister starts another game.",
    );
    return;
  }
  if (state.phaseTime <= 0) {
    if (state.phase === "explore") {
      state.phase = "warning";
      state.phaseTime = 30;
      say("“Ready or not…”", 7, true);
      audio.chime();
    } else if (state.phase === "warning") beginSearch();
    else {
      state.phase = "explore";
      state.phaseTime = 65;
      world.seeker.visible = false;
      document.body.classList.remove("danger");
      say(
        state.round > 1
          ? "“You cannot hide there forever.”"
          : "The footsteps fade. For now.",
        6,
        true,
      );
    }
  }
  let dx = moveStick.x,
    dz = moveStick.y;
  if (keys.has("KeyW")) dz -= 1;
  if (keys.has("KeyS")) dz += 1;
  if (keys.has("KeyA")) dx -= 1;
  if (keys.has("KeyD")) dx += 1;
  const l = Math.hypot(dx, dz);
  const moving = l > 0.1 && !state.hidden;
  const run =
    (keys.has("ShiftLeft") || keys.has("ShiftRight")) && !state.crouch;
  const held = keys.has("Space");
  if (held && state.breath > 0) {
    state.breath = Math.max(0, state.breath - dt * 7.5);
    if (state.breath === 0) {
      state.noise = 1;
      say("You gasp. Release your breath.", 3);
      audio.tone(220, 0.7, 0.15);
      if (state.hidden) state.enemy.pressure += 1.1;
    }
  } else if (!held) state.breath = Math.min(100, state.breath + dt * 13);
  if (moving) {
    dx /= Math.max(1, l);
    dz /= Math.max(1, l);
    const speed = (run ? 4 : state.crouch ? 1.3 : 2.4) * (held ? 0.65 : 1) * dt;
    const nx = state.x + (dx * Math.cos(yaw) + dz * Math.sin(yaw)) * speed,
      nz = state.z + (-dx * Math.sin(yaw) + dz * Math.cos(yaw)) * speed;
    if (canMove(nx, state.z)) state.x = nx;
    if (canMove(state.x, nz)) state.z = nz;
    state.noise +=
      ((run ? 1 : state.crouch ? 0.04 : 0.2) - state.noise) *
      Math.min(1, dt * 5);
    stepTimer += dt;
    if (stepTimer > (run ? 0.29 : state.crouch ? 0.8 : 0.51)) {
      stepTimer = 0;
      audio.step(false);
    }
  } else state.noise = Math.max(0, state.noise - dt * 0.6);
  if (keys.has("ArrowLeft")) yaw += dt * 1.5;
  if (keys.has("ArrowRight")) yaw -= dt * 1.5;
  if (keys.has("ArrowUp")) pitch = Math.min(1.25, pitch + dt);
  if (keys.has("ArrowDown")) pitch = Math.max(-1.25, pitch - dt);
  const room = roomAt(
    (state.x - state.floor * OFFSET) / SIZE,
    state.z / SIZE,
    state.floor,
  );
  if (room !== state.lastRoom) {
    state.roomVisits[room] = (state.roomVisits[room] || 0) + 1;
    state.lastRoom = room;
  }
  const height = state.hidden ? 0.75 : state.crouch ? 1.03 : 1.65;
  world.camera.position.set(
    state.x,
    height +
      (moving && !reduced
        ? Math.sin(state.elapsed * (run ? 13 : 8)) * 0.035
        : 0),
    state.z,
  );
  world.camera.rotation.set(pitch, yaw, 0);
  world.flashlight.visible = state.light;
  if (state.phase === "search") updateEnemy(dt);
  const flicker =
    !reduced &&
    ((state.phase === "warning" && state.phaseTime > 26) ||
      (state.round > 1 &&
        state.phase === "explore" &&
        state.phaseTime < 30 &&
        state.phaseTime > 28));
  for (const lamp of world.lamps)
    lamp.intensity = flicker
      ? Math.sin(state.elapsed * 19) > 0.2
        ? 5.5
        : 0.3
      : 5.5;
  currentTarget = nearest();
  $("prompt").innerHTML = state.hidden
    ? "<kbd>E</kbd> Leave hiding"
    : currentTarget
      ? `<kbd>E</kbd> ${currentTarget.name}`
      : "";
  $("location").textContent = room;
  $("memories").textContent = `MEMORIES  ${state.collected.size} / 5`;
  $("objective").textContent = state.sister
    ? "Bring your sister to the front door."
    : state.collected.size === 5
      ? "Find your sister in the nursery."
      : "Recover the five memories. Find your sister.";
  const minute = 137 + Math.min(221, Math.floor((state.elapsed * 221) / 900));
  $("time").textContent =
    `${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, "0")} AM`;
  $("phase-label").textContent =
    state.phase === "warning"
      ? "“Ready or not…”"
      : state.phase === "search"
        ? "Be very quiet."
        : "";
  $("countdown").textContent =
    state.phase === "warning"
      ? `HIDE · ${Math.ceil(state.phaseTime)}s`
      : state.phase === "search"
        ? "IT IS SEARCHING"
        : "";
  $("breath-fill").style.width = state.breath + "%";
  $("breath-fill").style.background = state.breath < 25 ? "#ad7563" : "#bfc2b5";
  $("breath-label").textContent = held
    ? "HOLDING YOUR BREATH"
    : state.noise > 0.6
      ? "YOUR FOOTSTEPS CARRY"
      : "BREATH";
  $("hide-label").textContent = state.hidden
    ? "HIDDEN · SPACE TO COVER YOUR MOUTH"
    : state.crouch
      ? "CROUCHING"
      : "";
  $("light-label").textContent = `F  LIGHT ${state.light ? "ON" : "OFF"}`;
  $("subtitle").style.opacity = state.elapsed < subtitleUntil ? 1 : 0;
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  if (!world || !started) return;
  if (!modal && !state.done) tick(dt);
  if (now - lastFrame > 16) {
    world.renderer.render(world.scene, world.camera);
    lastFrame = now;
  }
}
requestAnimationFrame(frame);
window.addEventListener("resize", () => {
  if (!world) return;
  world.camera.aspect = innerWidth / innerHeight;
  world.camera.updateProjectionMatrix();
  world.renderer.setSize(innerWidth, innerHeight);
});
// Touch controls use pointer capture, including cancellation so controls cannot stick.
let stickId = null;
const stick = $("stick"),
  knob = stick.querySelector("span");
stick.onpointerdown = (e) => {
  stickId = e.pointerId;
  stick.setPointerCapture(e.pointerId);
};
stick.onpointermove = (e) => {
  if (e.pointerId !== stickId) return;
  const r = stick.getBoundingClientRect(),
    x = Math.max(-40, Math.min(40, e.clientX - r.left - 55)),
    y = Math.max(-40, Math.min(40, e.clientY - r.top - 55));
  moveStick = { x: x / 40, y: y / 40 };
  knob.style.transform = `translate(${x}px,${y}px)`;
};
const stopStick = () => {
  stickId = null;
  moveStick = { x: 0, y: 0 };
  knob.style.transform = "";
};
stick.onpointerup = stopStick;
stick.onpointercancel = stopStick;
let look = null;
const pad = $("look-pad");
pad.onpointerdown = (e) => {
  look = { id: e.pointerId, x: e.clientX, y: e.clientY };
  pad.setPointerCapture(e.pointerId);
};
pad.onpointermove = (e) => {
  if (!look || look.id !== e.pointerId || modal) return;
  yaw -= (e.clientX - look.x) * sensitivity * 1.6;
  pitch = Math.max(
    -1.25,
    Math.min(1.25, pitch - (e.clientY - look.y) * sensitivity * 1.6),
  );
  look.x = e.clientX;
  look.y = e.clientY;
};
pad.onpointerup = pad.onpointercancel = () => (look = null);
for (const b of document.querySelectorAll("[data-action]"))
  b.onclick = () => action(b.dataset.action);
for (const b of document.querySelectorAll("[data-hold]")) {
  b.onpointerdown = (e) => {
    keys.add(b.dataset.hold);
    b.setPointerCapture(e.pointerId);
  };
  b.onpointerup = b.onpointercancel = () => keys.delete(b.dataset.hold);
}
// Read-only snapshot for diagnostics, useful for automated integration verification.
window.hushSnapshot = () =>
  state
    ? {
        position: [state.x, state.z],
        floor: state.floor,
        phase: state.phase,
        remaining: state.phaseTime,
        hidden: state.hidden?.kind || null,
        breath: state.breath,
        light: state.light,
        memories: [...state.collected],
        room: state.lastRoom,
        paused: modal,
        done: state.done,
        drawCalls: world.renderer.info.render.calls,
      }
    : null;
