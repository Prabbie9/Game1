# Night Courier — FINAL REPORT

A compact open-district cyberpunk hover-bike courier game for desktop browsers. Personal portfolio piece. Built autonomously through milestones M0–M5. **Nobody has played it yet**: every "pass" below is a bot-measured proxy or a headless capture, not a judgement of fun.

## Play it (installs nothing)
- **Offline, one file:** `builds/play/NightCourier.html` — download and double-click. Works from `file://` (worker as blob URL, Rapier WASM inlined). ~5.5 MB.
- **Hosted:** https://claude.ai/artifact/57iTMnatcL6jW9GvczB5VV (private to you; share it from the page's Share menu). "Save reference shots" uses the viewer's download prompt there.
- Checkpoints: `builds/M1-checkpoint` … `builds/M5-checkpoint`; last known-good build in `builds/known-good/`.
- Browser: Chrome/Edge recommended. It uses WebGPU when available, otherwise WebGL2 automatically. Add `?backend=webgl` to force WebGL2.

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
- Facades are procedural shader boxes: convincing at night speed, plain up close; no real geometry depth (ledges are painted). Not at "prestige film still" level — reads as a stylised indie night city.
- Rooftop driving layer was cut (rooftop shanties are visual only).
- Pursuers fly (no ground pathfinding), roadblocks are simple barriers. Patrol "cars" are low flyers.
- On-foot is deliberately light: no animations beyond a box-figure walk cycle; the noodle bar is a small room reached by a fade/teleport; Mama Kiso inside is a static figure.
- Near characters (rigged sourced models) were cut — no asset site was reachable from the build environment.
- Job count is small (5). Style scoring counts drifts, air time and high-speed boosting only (no near-misses).
- Motion captures were taken at ~10 fps in software rendering, so TRAA/motion-blur ghosting in `shots/*_6/7` is exaggerated.

## Needs real-hardware testing (cannot be verified here)
- **Real fps:** all frame times were measured on SwiftShader (software). Targets: High = 60 fps on Ryzen 7 7800X3D + RX 7800 XT. Unverified until you report numbers (pause → Save reference shots writes a `stats.json` with draw calls, triangles and frame times from your GPU).
- **WebGPU backend:** only WebGL2 was exercised; WebGPU is used automatically on supported browsers and is UNTESTED.
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
- Google Fonts "Rajdhani" or "Oxanium" (OFL) to embed as the HUD face (currently system fallback).
Drop files into `assets/` and log them in CREDITS.md; the material and audio modules are the integration points.

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
- GitHub push from the build environment returned 403 (the Claude GitHub App lacks access to `Prabbie9/Game1`); all work is committed locally on branch `claude/stoic-clarke-cvo2qy`. Install the app / reconnect GitHub and push from a new session to publish the history.
- Tooling: `npm run smoke` (headless smoke test of every shot), `npx tsx tools/fungate.ts [preset]` (bot proxies), `node tools/stability.mjs` (frame-time drive), `node tools/jobtest.mjs`, `node tools/foottest.mjs`, `npx tsx tools/fairness.ts`, `node tools/shots.mjs dist <prefix> shot=1 …`.
