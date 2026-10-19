Build "Night Courier": a compact open-district, GTA-lite cyberpunk driving game for desktop browsers. The player installs nothing. It is a personal portfolio piece and will not be published. No runtime AI: all jobs and dialogue are authored in advance.

EQUAL GOALS: FUN AND HIGH-END GRAPHICS
Both carry equal weight. Neither may be sacrificed for the other.
- Every milestone ends with a FUN GATE and a LOOK GATE (M0 excepted). Both must pass.
- When they conflict, make the effect adaptive or toggleable (motion blur and depth of field scale with speed; bloom is capped around road edges, obstacles and pursuers). Never drop a goal.
- Gameplay must stay readable at speed: road edges, obstacles, turns and pursuers must be visible through fog, rain and bloom. A beautiful frame you can't drive through fails the look gate too.
- Frame-time stability counts for both goals. Hitches ruin feel and look equally.
- Cut scope, never quality or feel.

AUTONOMOUS MODE
The user wants this built start to finish with no approval stops, and may be away from their computer for the whole run. Work through M0-M5 in order, continuously.
- At the end of each milestone: run its gates in self-check form, write a short report into PROGRESS.md, copy the build to builds/M<n>-checkpoint, refresh the playable build, then start the next milestone immediately.
- Stop only for: (a) a blocker you truly cannot work around, (b) the step budget below, (c) a usage-limit pause (see USAGE LIMITS), or (d) a message from the user.
- Never ask questions mid-run. Choose the most reasonable option, log it under DECISIONS in PROGRESS.md, and continue. If the user sends a message, follow it.
- Step budget: about 900 tool calls in total (the milestone caps are guides). At 750, stop starting features: finish the current one, polish what exists, make sure the latest build runs, and write FINAL REPORT.md (what is complete, what is rough, what needs human testing).
- Work economically. You can't see spend. Prefer small targeted edits to rewrites, keep PROGRESS.md short, and cap critique-and-fix rounds at 3 per milestone. Use medium effort by default and high effort only for rendering, vehicle feel and architecture.
- Never leave the build broken across more than one step. The latest checkpoint must always be a playable, error-free build.

USAGE LIMITS AND INTERRUPTIONS
This run may be cut off at any moment by usage limits, credit limits, timeouts or dropped sessions. Limits reset after a while, and the work should continue afterwards. Treat every limit as a pause, never as the end.
- After every meaningful step, update the NEXT STEP line at the top of PROGRESS.md: one precise action, such as "M3: tune chunk fade distance in streaming/chunks.ts, then re-run shot 4". A fresh session must be able to resume from that line alone.
- Save files after every chunk of work. Commit to git if available. Keep builds/known-good current.
- If a limit message tells you when it resets, and a scheduling tool is available (a scheduled task, send-later or wake-up tool), schedule a continuation for just after the reset time with this message: "Read RULES.md, DESIGN.md and PROGRESS.md, then continue from NEXT STEP in autonomous mode." If no scheduling tool is available, stop cleanly. The user will send that message.
- Do not try to get around limits, retry in a loop, or lower quality to save budget. Pause and let the limit reset.
- On every resume: read RULES.md, DESIGN.md and PROGRESS.md (SPEC.md when detail is needed), run the smoke test to confirm the build still works, then continue from NEXT STEP. Never redo or rewrite work that already works.

THE GAME
You are a freelance courier in a rain-soaked neon city, taking jobs from fixers. Main verb: drive a hover bike with arcade handling (drift, boost, hop, skim over water). Third-person chase camera. Roam freely; jobs are scattered around the district. On-foot movement is a late, light add-on (M5).

VEHICLE FEEL (the heart of the fun)
- Hover controller using raycasts to the ground, fixed-timestep simulation. Rapier is for collision queries, not a wheeled-car sim.
- Targets: about 2s from standstill to cruise, a clear boost surge, drift on handbrake plus steer that builds boost, forgiving collisions (slide along walls, never dead-stop, small speed penalty), generous steering at low speed.
- Chase camera: spring arm, look-ahead into turns, speed-based FOV and pull-back, never clips through geometry.
- Speed feel serves both goals: rain streaking past, light trails, FOV and blur ramps, optional camera shake, wind and engine audio.
- All tuning values live in ONE data file. Build an in-game live tuning panel with sliders, three switchable presets (Grippy, Balanced, Drifty) and a "copy my settings" button, so the user can tune by playing and send back numbers. Default preset: Balanced.

DISTRICT
Size it from vehicle speed: cruise about 20 m/s, boost about 35 m/s. Each zone is roughly 600-800m across, crossable in 35-45s at cruising speed, with vertical layers (street, elevated lane, rooftops, canal edge, tram line) so routes wind and overlap. Two zones, built in order: The Stacks (tall, vertical, magenta and sodium orange, laundry lines, rooftop shanties), then Old Market (low, amber lanterns, steam, awnings, tangled cables). Modular kit plus procedural placement, with hand-authored landmarks and job locations. Streamed in chunks with LOD and heavy distance fog.

JOBS AND HEAT
- Core: (1) timed delivery, (2) chase (shake a faster pursuer), (3) dark run (reach the drop without entering patrol searchlights; hide in darkness).
- Stretch: tram-top escape, time trial, on-foot jobs.
- Jobs come from fixers via short text dialogue with synthesised blips (no voice acting). Each ends with a rating on time, style and heat.
- Heat: trouble raises heat, bringing drones, then patrols, then roadblocks. No gunplay. Shake pursuit by cutting lights, hiding in darkness, going under cover, ducking into alleys.
- Fairness: visible warning before detection, about 2s grace, always an escape route. Compute visibility analytically from light sources and detection cones, never by reading back the rendered image.

NAVIGATION AND HUD
Minimal, stylish HUD: speed, boost, heat. Waypoint beam and compass to the objective, simple minimap, full map on Tab. All readable against bright neon.

LIFE
Far crowds: instanced silhouettes and glowing umbrellas. Mid crowds: low-poly instanced figures with vertex-animated walk cycles. Hover traffic with light trails, trams, patrol drones, animated signs. Detailed rigged near characters from sourced packs are stretch.

GRAPHICS
HDR, linear lighting, filmic tone mapping. Full PBR with wet behaviour (darker albedo, lower roughness, puddles, oily sheen). Screen-space reflections on wet roads and glass with a probe fallback, so neon visibly streaks and ripples. Neon as emissive sources with area-light approximation and a few shadow-casting lights. Volumetric fog and light shafts, steam catching light. Layered rain with splashes, drips, droplets on glass and on the lens. Post: GTAO, bloom, depth of field, motion blur, grain, vignette, chromatic aberration, anamorphic flares, TAA. Palette: magenta, cyan and amber against deep blue-black, with one warm window as a focal point. Day/night and weather. Every expensive effect has a quality toggle. Use convincing fakes where cheaper than physical accuracy.
Comfort options: reduce flicker and flashing, motion blur toggle, camera shake toggle, FOV slider.

AUDIO
Web Audio synthesis plus sourced recordings where better: engine hum with pitch tied to speed, boost surge, drift hiss, wind, rain by surface, distant traffic, neon buzz, positional sound for drones and trams, an original synthwave bed or CC0/CC-BY music.

SOURCING: ANYTHING LEGALLY AVAILABLE IS FAIR GAME
You may use any existing work that is legally available: textures, HDRIs, models, rigged characters, animations, audio, fonts, shaders, code. Procedural generation is a tool, not a rule. Use whichever gives the best result.
- Not allowed: pirated or cracked material, assets ripped from games, films or TV, anything obtained by bypassing a paywall or login.
- Good sources: Poly Haven, ambientCG, Kenney, Quaternius, OpenGameArt, Freesound, Sketchfab (downloadable CC models), itch.io free packs, Google Fonts, three.js examples, permissive GitHub repos.
- Check each asset's licence page and log it in CREDITS.md (what, author, URL, licence) with a grade:
  GREEN = CC0, public domain, MIT, BSD, Apache, OFL, CC-BY (credited).
  AMBER = non-commercial or share-alike. Fine for a personal portfolio piece.
  RED = no-redistribution, no-derivatives or unclear. A web game sends every asset to each viewer, so avoid RED. If one is truly worth it, flag it in FINAL REPORT.md.
- Add an in-game Credits screen. CREDITS.md states that AMBER items need review and RED items must be replaced before any public link or sale.
- Anything needing an account or purchase you can't get yourself: list the specific items worth having (name and URL) in FINAL REPORT.md for the user to attach.
- If asset sites are blocked in the build environment, go procedural without stalling, note it in PROGRESS.md, and list what the user could attach.
- Cohesion beats quantity: unify colour grade, scale and wet treatment. Keep everything in assets/.

TECH
TypeScript, Vite, Three.js using the WebGPU renderer with its automatic WebGL2 backend. Develop and test on the WebGL2 backend, since headless browsers can't test real WebGPU. WebGPU-only features (e.g. compute-shader crowds) sit behind a flag and are reported as untested until the user confirms them. Rapier in a worker. KTX2 textures, meshopt or Draco models, OGG audio.
Before promising any effect in GRAPHICS, check it exists in the chosen Three.js version. In M0, list each effect as AVAILABLE, REPLACED (with the cheaper equivalent) or CUT.
Targets: High tier = 60fps on a Ryzen 7 7800X3D plus RX 7800 XT. Lower tiers scale resolution, march steps and shadows for laptops. Don't lower the top tier. All fps numbers are unverified until the user reports them.

DELIVERY (the user must be able to play each checkpoint within a minute, installing nothing)
- M0 delivery test: build a tiny test page that detects WebGPU and WebGL2, runs a Web Worker, loads and runs a small WASM (Rapier), loads a 10MB binary file as a separate asset, and shows an FPS counter. Publish it by each route below that is available, and report exactly which parts worked.
- Route A, hosted page via the Artifact tool (if available): limits are 16MB per text file and 15MB per binary file, at most 255 files and 64MB per publish call, up to 511 files and 256MB per version (repeat publishes to add more). External scripts load only from allowed CDNs, so inline libraries otherwise.
- Route B, for M1-M2 while assets are small: ONE self-contained HTML file (inline JS, workers as blob URLs, WASM as base64) that works by double-click, offline. A multi-file dist/ does NOT work by double-click (modules, workers and WASM are blocked on file://), so never offer it that way.
- Route C, for streamed milestones if Route A can't carry them: write click-by-click steps in FINAL REPORT.md for a free static host (GitHub Pages, Netlify Drop or itch.io). It needs an account but installs nothing.
- Choose the route from the test results and record it in DESIGN.md. Refresh the playable build at the end of every milestone and note where it lives at the top of PROGRESS.md.

INPUT (keyboard and mouse now, controller later)
W/S throttle and brake, A/D steer, Shift boost, Space handbrake/drift, Q/E hop, Tab map, Esc pause, P photo mode, mouse for free-look. Game code only knows actions, never keys. Steering and throttle take analog values from -1 to 1 (keyboard supplies full strength). Look input goes through one interface. Menus use a focus system. Prompt glyphs come from a lookup table. Write INPUT.md documenting the actions and extension points, so "add controller support following INPUT.md" is a short follow-up.

MILESTONES (soft step caps in brackets; at 1.5x a cap, move on and log why)
M0 Setup (30): test the environment (network, headless WebGL2, Node, scheduling tools). Run the delivery test and effect-availability check above. Save THIS ENTIRE PROMPT VERBATIM as SPEC.md. Write RULES.md (a one-page condensed working copy of the standing rules), DESIGN.md (map, art direction, jobs, scale 1 unit = 1m, delivery route, effect list), PROGRESS.md (with the NEXT STEP line) and PLAYTEST.md.
M1 Feel grey-box with mood test (150): blocked-out test area, hover bike, chase camera, tuning panel and presets, speed-feel effects and audio. Include a MOOD TEST: a stretch of wet dark road with a few emissive neon signs, rain, fog and bloom at basic quality, so readability at speed is judged from the start. A bot drives test routes and flags impossible or trivial gaps. Both gates.
M2 Playable look slice (200): one 150-250m stretch of street with a bend, an elevated lane, an alley and a canal, at full visual quality, drivable with the M1 vehicle, with engine, rain and ambient audio. Both gates, at most 3 critique-and-fix rounds.
M3 Streaming and The Stacks (120): chunked world, LOD, fog hiding pop-in, far and mid crowds, traffic, the full Stacks zone. Both gates, plus a frame-time stability check from a bot drive (draw calls, triangles, memory, hitches).
M4 Core loop (250): fixers and jobs (3 core types), heat and pursuit, HUD, waypoint, minimap, 3 simple upgrades, save (localStorage). Both gates.
M5 Showpiece pass (150): photo mode, Old Market zone, light on-foot movement (walk, sprint, jump, enter the noodle bar), ghost replays, near characters, stretch jobs.
Priority if budget runs short: protect, in order, vehicle feel (M1), the look slice (M2), streaming and The Stacks (M3), delivery and chase jobs (M4). Cut from the end: near characters, stretch jobs, on-foot, Old Market, ghost replays, photo mode extras, the dark-run job, upgrades.

GATES
FUN GATE (autonomous): nobody is playing, so never claim the game is fun. Pass these bot-measured proxies and log the numbers in PLAYTEST.md:
- Standstill to cruise in 1.8-2.2s; boost reaches its target speed; the bot completes the test course within the target time band.
- No dead-stops: wall hits that drop speed below 20% within 0.5s count as failures, so collisions must slide.
- The camera never clips through geometry and stays on the vehicle through drifts.
- Road edges and obstacles stay readable in captures (measure local contrast against fog and bloom).
- Frame-time p99 stays within budget on the software renderer relative to scene complexity (note it is not real fps).
Then write 5 specific human questions for the milestone into PLAYTEST.md (e.g. "Does turning feel good?", "Do you want to go faster?", "What annoyed you?", "Would you do it again?") and mark the gate "UNPLAYED: needs human".
LOOK GATE: seven fixed reference shots. Stills: (1) wide street dusk, (2) wide street deep night, (3) steamy alley, (4) wet-road neon reflection close-up, (5) storefront window glow. In motion: (6) bot driving at speed along an elevated lane, (7) bot driving through a tunnel or underpass. Each round: capture all, list at least 3 concrete defects, fix, re-capture, keep a before/after contact sheet in shots/. Checklist: reflections show as long neon streaks; blacks aren't crushed and highlights aren't clipped; bloom doesn't wash out detail; fog shows distinct light shafts; asphalt, brick and metal read as different materials; no visible texture tiling; no flat-lit surfaces; one clear focal point; consistent scale; road and obstacles stay readable at speed. Judge honestly against the target of a prestige sci-fi film still.
Capture rules: headless rendering is software-only and slow. Capture at about 960x540 with long timeouts. If an effect (SSR, volumetric fog) is too slow to capture in the cloud, say so and mark that part of the gate UNVERIFIED rather than skipping it. Add a pause-menu button "Save reference shots" that renders all seven shots on the user's own GPU and downloads them as a PNG pack, so the user can send them back for review.

WORKING RULES
- Always leave a working build with no console errors. Never leave it mid-edit.
- PROGRESS.md is short and current (NEXT STEP, done, in progress, decisions, assets, known bugs). SPEC.md, DESIGN.md and RULES.md are the source of truth.
- Hide unfinished features. No visible placeholders or TODOs.
- Organise code in modules (renderer, materials, world, streaming, vehicle, camera, audio, input, jobs, heat, crowds, HUD, UI) with brief comments.
- Expose NRC_DEBUG hooks (teleport, setTime, setRain, startJob, setHeat, stats) and URL params for named shots. Write a smoke-test script that visits every shot and fails on console errors, and run it before every checkpoint.
- Be honest about what you can't do: you can't feel the handling, can't measure real fps and can't test real WebGPU hardware. Say so in FINAL REPORT.md.

DELIVER
At the end (or at the step budget): the playable build by the chosen route, FINAL REPORT.md (controls, quality tiers, what is complete, what is rough, what needs real-hardware testing, assets worth attaching, and the human questions from PLAYTEST.md), and updated PROGRESS.md, PLAYTEST.md and CREDITS.md.
