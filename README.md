# HUSH

A complete short first-person browser horror game adapted from the supplied concept. Explore an abandoned childhood home, recover five memories, recognize the false sister, survive the Seeker, and choose who leaves the house.

## Play locally

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5187. Click **Enter the house**, then **Put the phone away**. Click the scene to capture the mouse; Escape pauses and releases it. Headphones recommended. Requires WebGL and a modern browser.

```sh
npm run build   # deployable static files in dist/
npm run preview
npm test
```

## Controls

| Control | Action |
| --- | --- |
| WASD | Move |
| Mouse / arrow keys | Look |
| E | Interact / enter or leave hiding |
| F | Flashlight |
| Shift | Run; the Seeker hears it |
| C | Toggle crouching |
| Space (hold) | Cover your mouth; release before breath runs out |
| Q | Throw one of three distractions |
| J / M | Story journal and floor plan |
| Escape / P | Pause |

Touch devices have a left movement stick, right look region, and action buttons. Settings include brightness, sensitivity, volume, optional synthesized spoken whispers, and reduced motion/flicker. All narrative whispers are subtitled. No microphone, account, external service, or API key is required.

## The game

Two floors, eight rooms, five memories. Stairs at the north end of the hall connect the floors using E. The front door is south, downstairs. Pale pages mark memories. The journal gives room locations.

After an exploration interval, the house gives 30 seconds to hide, then searches for approximately 40–50 seconds. The Seeker prioritizes familiar hiding types and frequently visited rooms, hears running, sees exposed players and their lights, and investigates distractions. It can catch you directly or discover you in hiding. Breath control becomes important when it is close. The game has a 15-minute limit; reading and menus pause the clock.

Find all memories to reveal the real sister in the upstairs nursery. Bring her to the front door for two ending choices. The blue-pajama imitation is a separate failure encounter. Restart resets all progress and learned behavior.

## Scope

This is a compact playable adaptation, not the hours-long production described in the pitch. The house and characters are stylized real-time 3D geometry with generated material textures; the menu uses cinematic generated artwork. Stair travel and the finale use interactions rather than animated cutscenes. Audio is synthesized locally. Progress lasts for the current session; there is no save system.

## Structure

- `src/main.js`: input, HUD, progression, interaction, Seeker and state transitions.
- `src/world.js`: 3D environment, materials, objects, lighting, static mesh batching.
- `src/rules.js`: floor layout, pathfinding, suspicion model and story memories.
- `src/audio.js`: synthesized ambience, footsteps and optional speech.
- `src/rules.test.js`: connectivity, valid paths, adaptive suspicion, room labels.
- `public/art/`: generated title background and texture atlas.
- `design/title-concept.png`: title-screen visual reference.

## Validation

Production build and four unit tests pass. In-app browser verified title, entry, initial 3D scene and pause. Playwright CLI supplemented it for held keyboard input and screenshots: walked through a doorway into the study and collected the VHS memory. Controlled browser fixtures additionally checked hiding, flashlight, breathing, phase transitions, stairs, all five memories, sister rescue, final choice and restart. These fixtures were injected only into test responses, never shipped in source.

Title checked at 1536×1024, in-app view at 1280×720, and narrow layout at 390×844. Game architecture batching reduced the tested view from 525 draw calls to 20. No browser console errors in the verification pass. Sustained mobile performance and every physical device remain untested.

## Art direction and fidelity

Built-in Image Gen produced the title concept, standalone hallway background, and material atlas. The production prompts specified: (1) a complete HUSH title screen with an ivory serif wordmark, the supplied tagline, outlined entry button, corner clock and footer controls over a shadowed abandoned hallway; (2) the same hallway without text, with muted olive wallpaper, amber lamplight and cold blue doorway light; (3) a four-quadrant orthographic atlas of floral wallpaper, floorboards, cracked plaster and walnut wood.

The concept and native 1536×1024 browser screenshot were inspected with `view_image`. Comparison covered the left menu/right corridor composition, serif title and italic tagline, ivory/olive/blue palette, outlined primary action, corner clock/footer spacing, and narrow-screen readability. All concept copy is retained; Settings & controls is an intentional functional addition. The standalone hallway is a separate generated composition, not the exact concept background. Native fonts differ from the raster typography. Gameplay intentionally uses navigable stylized 3D with the generated textures instead of the photorealistic menu. These are documented adaptations, not pixel-identical fidelity claims.
