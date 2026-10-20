# Night Courier — FINAL REPORT

A compact open-district cyberpunk hover-bike courier game for desktop browsers. Personal portfolio piece. Built autonomously through milestones M0–M5. **Nobody has played it yet**: every "pass" below is a bot-measured proxy or a headless capture, not a judgement of fun.

## Play it (installs nothing)
- **Offline, one file:** `builds/play/NightCourier.html` — download and double-click. Works from `file://` (worker as blob URL, Rapier WASM inlined). ~6.7 MB.
- **Hosted:** https://claude.ai/artifact/57iTMnatcL6jW9GvczB5VV (private to you; share it from the page's Share menu). "Save reference shots" uses the viewer's download prompt there.
- Checkpoints: `builds/M1-checkpoint` … `builds/M5-checkpoint`, plus graphics-upgrade checkpoints `builds/G3-checkpoint` and `builds/G5-checkpoint`. The last known-good build is in `builds/known-good/`. `docs/index.html` is the same file.
- Browser: Chrome/Edge recommended. It runs on **WebGL2 by default** (the only backend tested). WebGPU is opt-in: Esc → Settings → Renderer → webgpu (reload), or `?backend=webgpu`; if WebGPU fails to start it falls back to WebGL2.

## Controls (keyboard + mouse)
| Key | Action |
|---|---|
| W / S | throttle / brake-reverse (on foot: walk) |
| A / D | steer (on foot: strafe) |
| Shift | boost (on foot: sprint) |
| Space | handbrake / drift — drifting builds boost; releasing gives a kick |
| Q / E | hop left / right (both = straight hop; on foot: jump) |
| F | talk to fixers (coloured rings) · get off / on the bike · enter / leave Hoshi Noodle Bar |
| L | bike lights on/off (lights off = harder to spot) |
| Tab | full map |
| P | photo mode |
| Esc | pause menu (settings, garage upgrades, tuning, controls, save reference shots, credits) |
| F2 or ` | live vehicle tuning panel (presets Grippy / Balanced / Drifty, "Copy my settings") |
| Mouse | free-look (click to capture the pointer) |
Controller support is a short follow-up: see `INPUT.md`.

## Quality tiers (Esc → Settings → Quality; applies on reload)
| | Low | Medium | High (default) |
|---|---|---|---|
| Render scale | 0.6 | 0.8 | 1.0 |
| SSR (wet reflections) | probe only | on | on |
| GTAO | off | off | on |
| TRAA | off | on | on |
| Depth of field | off | off | on (speed-scaled hint; photo mode full) |
| Motion blur | off | on | on (toggle in settings) |
| Anamorphic streaks, chromatic aberration | off | on | on |
| Lens rain droplets | on | on | on |
| Shadows | off | 1024 | 2048 + headlight shadow |
| Rain streaks | 2.5 k | 5 k | 9 k |
| Real point lights (pooled) | 4 | 8 | 12 |
| Crowd density | low | mid | high |
Comfort: FOV slider, motion blur toggle, camera shake toggle, "reduce flicker + flashing" (neon flicker, TV windows, patrol strobes, chromatic aberration).
URL params for testing: `?quality=low|medium|high`, `?shot=1..10`, `?world=stacks|slice|test`, `?bot=cross|ring|market|loop`, `?job=kiso_tram`, `?post=ssr,ao,...`.

## What is complete
- **Vehicle (M1):** raycast hover bike at 120 Hz in a Rapier physics worker; drift with slip-angle cap that builds boost and kicks on release; boost surge; hops; skim over water; slide-along-walls collisions (never dead-stops); chase camera with spring arm, look-ahead, speed FOV/pull-back, sphere-cast so it never clips. All tuning in `src/vehicle/tuning.ts`, live panel with three presets and "copy my settings".
- **Look:** HDR + ACES, world-space procedural wet materials (puddles, rain ripples, oily iridescent sheen, wet streaks), SSR with a custom reflectivity channel so wet dielectrics reflect, plus vertical streak blur (long neon streaks) and a PMREM probe fallback; GTAO; TRAA; bloom + anamorphic streak; speed-scaled DoF/motion blur/CA; lens droplets; grain; vignette; fake volumetric light cones; steam; layered rain + splashes; neon signs (atlas), holograms, light trails.
- **District (M2–M3):** The Stacks (700 × 700 m) with Hoshi Street hand-authored slice (bend, alley courtyard, canal, Skyway + underpass), procedural blocks, the Ring elevated lane, tram line with a shuttling tram, east canal, Wan Tower. **Old Market** (zone 2, west): narrow lanes, lantern strings, stalls, steam. Streaming in 100 m chunks with near/far LOD, fog hides the edge.
- **Life:** instanced vertex-animated crowds with glowing umbrellas, hover traffic with light trails, tram, drones/patrols, animated signs/holograms, ambient searchlight sweepers.
- **Core loop (M4):** 4 fixers with authored dialogue + synth blips; jobs: 2 timed deliveries, 1 chase (shake the Hound), 1 dark run, + Lantern Run time trial. Ratings (time/style/heat → stars), credits, 3 upgrades (Garage in pause menu), save in localStorage. Heat 0–5 with drones → patrols → roadblocks, analytic visibility (light exposure, cones, line of sight, cover) and a 2 s warning meter. HUD: speed, boost, drift charge, heat, detection bar, compass + objective, waypoint beam, minimap, full map.
- **Showpiece (M5):** photo mode (free camera, FOV/focus/bokeh/exposure/time/rain/vignette/grain, PNG capture), Old Market, ghost replays of your best run per job, time-trial stretch job, light on-foot mode (walk, sprint, jump, enter Hoshi Noodle Bar), audio (engine pitch with speed, boost, drift hiss, wind, rain by cover, water, city rumble + far sirens, neon buzz and tram positional, original synthwave bed).

## What is rough
- Facades are still boxes underneath. Depth now comes from interior-mapped windows, mullions, relief normals and geometry (cornices, fire escapes, drainpipes, AC units, balconies); there is no modular facade kit.
- Rooftop driving layer was cut (rooftop shanties are visual only).
- Pursuers fly (no ground pathfinding), roadblocks are simple barriers. Patrol "cars" are low flyers.
- On-foot is deliberately light. The courier is a skinned, animated human (idle, walk, jog, sprint, jump); the noodle bar is a small room reached by a fade and teleport, with Mama Kiso animated behind the counter.
- Job count is small (5). Style scoring counts drifts, air time and high-speed boosting only (no near-misses).
- Motion captures were taken at ~10 fps in software rendering, so TRAA/motion-blur ghosting in `shots/*_6/7` is exaggerated.

## Needs real-hardware testing (cannot be verified here)
- **Real fps:** all frame times were measured on SwiftShader (software). Targets: High = 60 fps on Ryzen 7 7800X3D + RX 7800 XT. Unverified until you report numbers (pause → Save reference shots writes a `stats.json` with draw calls, triangles and frame times from your GPU).
- **WebGPU backend:** only WebGL2 was exercised. A headless WebGPU (SwiftShader) run crashed the browser from memory pressure, so WebGPU is opt-in and UNTESTED — please try Settings → Renderer → webgpu and report.
- **Feel:** I cannot feel the handling. Proxies say: 0 → cruise in 2.0 s, boost 34–36 m/s, ≥ 62 % speed kept on a head-on wall hit, camera never clips. Whether it is *fun* is for you to say.
- Hosted Artifact runtime (claude.ai sandbox: WASM + workers + WebGPU) could not be opened headless.
- Volumetric ray-marched fog (`VolumeNodeMaterial`) exists in three r186 but is not enabled; light shafts are fakes. UNVERIFIED on GPU.

## Assets worth attaching (sites were blocked from the build environment)
Everything is procedural today. These would raise quality most (all free; some need an account):
- Poly Haven wet asphalt / concrete / brick PBR sets — https://polyhaven.com/textures (CC0) — e.g. "asphalt_02", "concrete_wall_008", "red_brick_03".
- ambientCG "Asphalt", "Metal Plates", "Rust" sets — https://ambientcg.com (CC0).
- Quaternius "Ultimate Modular Sci-Fi" / "Cyberpunk Game Kit" — https://quaternius.com (CC0) for props, vehicles, characters.
- Kenney "City Kit (Commercial)" — https://kenney.nl/assets/city-kit-commercial (CC0).
- Freesound rain-on-asphalt and neon-hum recordings (CC0/CC-BY) — https://freesound.org (account needed to download).
Drop files into `assets/` and log them in CREDITS.md; the material and audio modules are the integration points.

## Graphics upgrade (branch `claude/loving-cerf-mml2vq`)
Audit and before shots: `shots/graphics-upgrade/AUDIT.md`, `before_sheet.png`. After shots: `after_sheet.png` (same cameras).

**What changed**
- **Humans (G1).** A real humanoid instead of box people.
  - Source: Quaternius' Universal Animation Library (CC0), baked offline by `tools/bake/humans.ts` into a 0.8 MB binary.
    - A 53-bone rig with 13 clips: idle, talk, walk, jog, sprint, drive, jump ×3, sit, interact, crouch.
    - LOD0 is 21k triangles; LOD1 is a meshoptimizer-simplified 4.3k.
    - Procedural clothing shells: suit, coat skirt, jacket, hood, hair, helmet and visor, trousers, boots, apron, bag.
    - Faces are drawn in the shader.
  - One shared character material, with per-object uniforms for outfit, palette and accent.
  - The cast:
    - The courier rides seated, leaning into turns and tucking on boost, with handlebars built at its hands.
    - On foot it blends idle → walk → jog → sprint → jump.
    - Mama Kiso and the four fixers stand at their posts with talk or idle loops, lit by a soft key light that follows the nearest one.
  - Crowd LOD ladder:
    - pooled skinned heroes under 25 m
    - VAT-instanced LOD1 bodies under 80 m, with walk, idle, talk and jog baked on load
    - silhouettes beyond that
    - glowing umbrellas
  - Wet look: cloth darkens, the roughness film drops, and rain sparkles flick on heads and shoulders.
- **Models (G2).**
  - Hero bike: extruded fairing, side pods, lathed thruster bells and intake, hover emitters, steering vanes and flaps. The vanes follow yaw rate, the flaps follow climb and boost, and the thrusters glow with speed.
  - Traffic: sedan, van and sports silhouettes, one instanced draw each.
  - Tram: rounded extruded cars with a window band, bogies, a pantograph, cab ends and a destination sign.
  - Pursuit craft: patrol cruiser with light bar, quad-rotor drone, hound interceptor, sweeper disc. They bank into turns, and their materials are precompiled.
- **Props and facades (G3).**
  - Street furniture on every street-facing wall in the procedural blocks and on Hoshi Street:
    - at street level: vending machines, bins, benches, food stalls, barriers, crates, tram stops
    - on the facades: drainpipes, fire escapes
    - on the roofs: tanks, antennas, dishes, sign rigs
  - Solid pieces get matching collider boxes. The road, kerb side, block corners, zone-edge strips, job drops and fixers stay clear.
  - Facades: interior-mapped windows (rooms with parallax), mullions and transoms, per-building window proportions, sills, relief normals, and cornices, parapets and fascia bands as geometry.
  - Wan Tower: glass setbacks, a lit crown, a spire and corner light fins.
  - Skyway: girders, a glowing underside strip, pillar caps and sign gantries.
- **Materials, decals, font (G4).**
  - One alpha-tested decal material covers worn lane dashes (faintly retroreflective), zebra crossings, dry patches that break up the wet reflections, cracks, manholes and torn wall posters.
  - Rajdhani HUD font embedded (OFL).
  - The hand-made textures were not replaced by downloaded PBR sets. See "Procedural vs sourced".
- **Lighting and polish (G5).**
  - A soft key light follows the nearest named NPC: cool on the street, warm and dimmer for Kiso. It is permanent, so the light count never changes and nothing recompiles.
  - A faint albedo fill keeps people readable in dark alleys; rim light is toned down.
  - Lanterns and edge glows are toned down, so the Hoshi room is no longer washed out and the Skyway strip no longer reads as a laser.
  - Road paint is faintly retroreflective; drone duct glows are softened.
  - Umbrellas are hidden inside 4 m of the camera.
  - When dismounted, the courier's helmet comes off (face and hair).
- **Loading (constraint 2).** Fixed a real freeze source:
  - three's `compileAsync` compiles at render-context depth 0, but the scene pass draws nested at depth 2.
  - Instanced and skinned shaders embed buffer ids, so they were rebuilt and linked synchronously on their first frame.
  - `Post.probe()` now measures the depth and `Post.compile()` compiles there.
  - Also new: a time-sliced chunk build, a time-sliced neon atlas, and a per-material warm-up.
  - `npm run smoke` now fails on any loading long task over 3 s. Every case passes; the worst was 1.4 s on SwiftShader, against 4.4 s and 2.6 s stalls in the build before the upgrade.

**Performance: NRC_DEBUG.stats() at High, same cameras (SwiftShader, so only counts are meaningful)**
| Shot | Before: calls / triangles | After: calls / triangles |
|---|---|---|
| 1 | 348 / 217,422 | 421 / 244,559 |
| 2 | 348 / 217,422 | 421 / 244,559 |
| 3 | 363 / 222,130 | 485 / 223,868 |
| 4 | 379 / 225,832 | 479 / 307,240 |
| 5 | 372 / 225,350 | 498 / 352,409 |
| 6 | 370 / 218,760 | 463 / 208,779 |
| 7 | 299 / 214,226 | 398 / 246,914 |
| 8 | 408 / 241,668 | 559 / 499,740 |
| 9 | 344 / 338,110 | 407 / 444,412 |
| 10 | 294 / 211,534 | 366 / 218,908 |
| 11 | — | 470 / 241,581 |
| 12 | — | 262 / 261,128 |
| 13 | — | 454 / 214,906 |
| 14 | — | 505 / 346,586 |
| 15 | — | 562 / 362,529 |
Counts include shadow passes. On High, draw calls rose 20–37%. Triangles stayed flat at 6 of the 10 cameras and roughly doubled at the busiest (shot 8: 241k → 500k), still small for an RX 7800 XT. Before the traffic split, one view reached 630k.
Low tier (smoke runs, `?quality=low`): 175–274 calls and 67k–130k triangles.
Tier knobs (all in `TIERS`, `src/renderer/renderer.ts`):
- crowd density, hero pool, VAT fps and LOD radii
- NPC hero LOD
- street-detail draw radius: 90 / 130 / 170 m
- Low uses a lighter character shader, drops the VAT band (heroes, then silhouettes) and uses LOD1 for every hero

**Tests run on the final build (all on SwiftShader)**
- `npm run build` clean.
- `npm run smoke` OK on `dist/` and on the single file over file:// (13/13 each, worst load task 1.35 s).
- Gameplay checks:
  - `tools/fungate.ts` output is byte-identical to the build before the upgrade (vehicle feel, routes, job routes).
  - `tools/fairness.ts` is identical (heat detection).
  - `tools/jobtest.mjs` passes every job, and the save format is unchanged.
  - `tools/foottest.mjs` passes (dismount, walk, sprint, jump, Hoshi in and out).
- New tools:
  - `tools/tris.mjs`: triangle and draw-call budget by category at any shot.
  - `tools/longtasks.mjs`: loading long-task timeline against loading phases.
  - `tools/vehshots.mjs`: tram and pursuit-craft captures with a frozen camera.
- Single file: 6.7 MB, against a 40 MB budget.

**Procedural vs sourced**
- Sourced: the human body, rig and animations (Quaternius, CC0, GREEN) and the HUD font (Rajdhani, OFL, GREEN).
- Everything else is procedural, because the asset hosts were blocked (see `assets/WANTED.md`).
- Drop-in loader: any `assets/**/*.glb` is bundled and loaded behind the progress bar, then replaces the matching procedural model (bike, pursuit craft); the procedural model is the fallback.
- The PBR texture sets in WANTED.md are not wired yet. The integration point is the wet-ground and facade shaders.

**UNVERIFIED on real hardware**
- 60 fps at High on the Ryzen 7 7800X3D + RX 7800 XT.
- Shader compile times on a real driver.
- WebGPU backend with the new skinned and VAT shaders.
- How the crowd VAT band and the 500k-triangle worst case (shot 8) behave on a mid-range GPU.

**Still rough**
- Faces are shader-drawn and simple.
- Hands do not grip the bars exactly, because the bars are built at the clip's hand positions.
- The on-foot courier keeps the helmet on.
- Interior mapping is subtle under depth of field.
- No downloaded PBR textures.

## Route C (backup hosting, needs a free account, installs nothing)
1. Run `npm install` then `npm run build` (or use the prebuilt `dist/` from a build machine) — or simply use the single file `builds/play/NightCourier.html`.
2. **Netlify Drop:** open https://app.netlify.com/drop , drag `builds/play/` (rename `NightCourier.html` to `index.html` first) onto the page, sign in when asked. You get a public URL in ~30 s.
3. **GitHub Pages:** create a repo, upload `index.html` (the single file), Settings → Pages → Deploy from branch → `main` / root → Save. URL appears after ~1 min.
4. **itch.io:** New project → Kind: HTML → upload a zip containing `index.html` → check "This file will be played in the browser" → Save.

## Human questions (from PLAYTEST.md)
See PLAYTEST.md for the full list per milestone. The five that matter most:
1. Does steering feel good at low speed and at top speed? Which preset felt best (send "Copy my settings")?
2. Is the boost surge + drift-for-boost loop satisfying enough to use all the time?
3. Can you read the road, kerbs and obstacles at full speed in rain, fog and bloom?
4. Were jobs clear, fair and worth repeating? Did the 2 s searchlight warning feel fair?
5. Real fps on your machine at High, and any stutters while crossing the district?

## Process notes
- The graphics upgrade is on branch `claude/loving-cerf-mml2vq`. Earlier work is on branch `claude/stoic-clarke-cvo2qy` (https://github.com/Prabbie9/Game1/tree/claude/stoic-clarke-cvo2qy). Early pushes were refused (403) until GitHub access was connected.
- Tooling: `npm run smoke` (headless smoke test of every shot), `npx tsx tools/fungate.ts [preset]` (bot proxies), `node tools/stability.mjs` (frame-time drive), `node tools/jobtest.mjs`, `node tools/foottest.mjs`, `npx tsx tools/fairness.ts`, `node tools/shots.mjs dist <prefix> shot=1 …`.
