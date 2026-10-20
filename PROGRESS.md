# PROGRESS
NEXT STEP: Graphics upgrade G1–G5 done (branch claude/loving-cerf-mml2vq, builds/G5-checkpoint). Await a real-hardware fps report at High (pause → Save reference shots → stats.json); then drop CC0 GLB/PBR files into assets/ (assets/WANTED.md).

PLAYABLE BUILD: M5 final — hosted https://claude.ai/artifact/57iTMnatcL6jW9GvczB5VV ; offline builds/play/NightCourier.html (double-click). Known-good: builds/known-good/ (= M5).

## Done
- Graphics upgrade (G1–G5 complete; checkpoints builds/G3-checkpoint, builds/G5-checkpoint): G1 skinned humans (Quaternius UAL, CC0) + cast + VAT crowd; G2 hero bike hull, 3 car silhouettes, tram, pursuit craft; G3 street furniture with collider sync, fire escapes, interior-mapped windows, cornices, Wan Tower crown, Skyway detail; G4 decals + Rajdhani font + GLB drop-in loader. Audit: shots/graphics-upgrade/AUDIT.md.
- M5: showpiece (photo mode, Old Market, ghosts, time trial, on-foot + noodle bar); checkpoint builds/M5-checkpoint; FINAL REPORT.md written.
- M4: core loop (jobs, heat, HUD, map, upgrades, save); checkpoint builds/M4-checkpoint.
- M3: Stacks zone + streaming, crowds, traffic, tram; checkpoint builds/M3-checkpoint.
- M2: look slice (Hoshi Street), 3 look rounds, checkpoint builds/M2-checkpoint (smoke OK on file://).
- M1: feel grey-box + mood test, gates self-checked, checkpoint builds/M1-checkpoint (smoke OK on file://).
- M0: environment tested, delivery test built (hosted + single-file), effect check (DESIGN.md), SPEC/RULES/DESIGN/PLAYTEST/CREDITS written.

## M0 report
- Node 22, npm OK; Playwright 1.56.1 + Chromium 1194 headless: WebGL2 = SwiftShader (ANGLE/Vulkan). `navigator.gpu` adapter also present (SwiftShader WebGPU) — not treated as real WebGPU testing.
- Network: npm registry, raw.githubusercontent.com, fonts.googleapis.com reachable. Blocked: polyhaven, ambientcg, kenney, quaternius, freesound, opengameart, jsdelivr, unpkg, cdnjs. → assets go procedural; wanted assets listed later in FINAL REPORT.md.
- Scheduling: `send_later` / `create_trigger` (claude-code-remote) available.
- Delivery test results:
  - Served (http, multi-file): webgpu adapter OK, webgl2 OK, worker+Rapier 0.21 WASM OK, 10 MB binary fetch OK (64 ms), FPS counter OK.
  - Route B single HTML via file://: webgl2 OK, worker (classic, blob URL) + Rapier WASM (base64) OK, FPS OK; separate 10 MB fetch blocked by file:// (expected → everything must be inlined).
  - Route A Artifact publish: OK after renaming the binary to a served extension (.wasm); `.bin` refused. Runtime inside claude.ai not verifiable headless → user to open link.
  - Gotcha: module workers fail on file://; workers are built as IIFE + inline blob.

## M1 report (feel grey-box + mood test)
- FUN GATE (bot proxies, Node, all presets): PASS — cruise in 2.00 s, boost 34.3 m/s, no wall dead-stops (worst 0.63 of speed kept, head-on), drift builds 0.75 meter + 6 m/s kick, deck gap needs hop/boost (not trivial/impossible), loop 68 s in band [59,111], camera 0 clip frames, 0 bike-off-view frames. UNPLAYED: needs human. Details in PLAYTEST.md.
- LOOK GATE (grey box, basic+full post): 3 rounds. Round defects fixed: (1) milky fog lifting blacks → darker fog/ambient, ACES; (2) light cones read as solid pyramids (scene fog added to additive) → fog off on additive + distance fade; (3) neon signs inside walls / facing away → fixed placement; (4) per-pixel window dropout (attribute interpolation × hash) → rounded seed + sin-hash; (5) SSR showed nothing (weights by metalness) → custom reflectivity channel (smoothness × grazing fresnel) → long neon streaks on wet road; (6) anamorphic blur ghosted lights into rows of discs → small tap step; (7) speed blur/DoF/CA smeared everything → capped, DoF only a hint at speed, blur normalised to 60 fps. Sheets: shots/r1_sheet.png (before) → shots/m1_after_sheet.png (after).
- Readability (tools/readability.py): crushed 0.0 %, clipped ≤ 0.02 % on all 7 shots; road local contrast 0.055–0.079.
- Frame time: SwiftShader headless ≈ 100 ms/frame flat (p99 = p50), ~150 draw calls, 35 k tris. Not real fps.
- Remaining rough: grey-box facades read as flat brown slabs; motion captures at 10 fps exaggerate TRAA/motion-blur ghosting (UNVERIFIED on real GPU).

## M2 report (look slice: Hoshi Street)
- Built: 220 m street with 35° bend, alley + steamy courtyard with laundry, Black Canal (drivable water, ramps), Skyway elevated lane with underpass, Hoshi noodle bar (warm focal window, lanterns, sign), blade/flat neon signs, shopfronts, shutters, awnings, AC units, cables, holograms, oily puddle iridescence, per-building facade tints, TV-flicker windows, city ambience audio.
- FUN GATE: PASS (bot proxies; see PLAYTEST.md). UNPLAYED: needs human.
- LOOK GATE: 3 rounds (cap). Round 1 defects: teleport stretched light trails into giant beams; storefront/sign planes faced into walls; blade signs edge-on; alley too dark + white steam blob; hologram out of frame; milky haze. Round 2: shop windows blown to white slabs, alley over-magenta, dusk haze. Round 3: shop glass dimmed + cool tints so Hoshi is the only warm window; shot 5 anchored to Hoshi. Sheets: shots/m2r1_sheet.png (before) → shots/m2r3_sheet.png + shots/m2r3b_sheet.png (after).
- Checklist honest read: long neon streak reflections YES; no crushed/clipped YES; bloom readable YES; distinct light shafts PARTIAL (lamp cones subtle; true volumetric UNVERIFIED/not enabled); materials distinct PARTIAL (asphalt/brick/metal differ, facades still simple); no visible tiling YES (all world-space procedural); flat-lit surfaces PARTIAL (block faces away from lights are flat); focal point YES (Hoshi); scale consistent YES; readable at speed YES. Target "prestige film still": not reached — reads as a stylised indie night city.
- Motion captures run at ~10 fps headless → TRAA/motion blur ghosting exaggerated; UNVERIFIED on real GPU.

## M3 report (streaming + The Stacks)
- Built: 700 × 700 m Stacks zone (default world): Hoshi Street slice embedded, ~25 procedural blocks with dressed facades on a street grid, the Ring elevated lane (z −230, +12 m, ramps both ends), tram line (z 220, +8 m deck, shuttling tram with positional hum), east Black Canal + canal-edge road, Wan Tower landmark (165 m, holograms), rooftop shanties. Streaming: 100 m chunks, NEAR (<170 m: full dressing) / FAR (<340 m: buildings + signs) / unloaded, physics colliders streamed around the bike with hysteresis, one chunk build per frame. Neon atlas: one draw call per chunk for all signs. Crowds: instanced vertex-animated walkers on every sidewalk + glowing umbrellas (zero CPU). Hover traffic: instanced cars + light trails on lanes over every street (zero CPU).
- FUN GATE: PASS — all slice routes + Stacks cross (63.7 s, band 48–103) and Ring (24.7 s, band 19–40), 0 dead-stops, 0 camera clips; all three presets. Bot found and fixed: boost-tap kick exploit (pumped to 80 m/s), wall-scrape energy gain, tram pillars standing mid-street.
- STABILITY (bot drive, low tier, 640×360 SwiftShader, full 1.7 km cross route, 240 s): 0 errors; draw calls ≤ 265, tris ≤ 82 k, geometries ≤ 488, heap 40–62 MB flat (no leak), 215 chunk builds; median frame 240 ms (software), p99 975 ms, 2.5 % frames over 2.5× median. First run showed 22 s hitches from per-chunk material creation → all chunk materials now shared singletons. High tier at 640×360: ≤ 397 calls, ≤ 163 k tris. Real-GPU frame times UNVERIFIED.
- LOOK GATE: round 1 captured (shots/m3r1_sheet.png, shot 8 = extra street-life view). Defects: hover-car underglow read as floating slabs (dimmed); Hoshi window desaturated to cream (more saturated amber, lower emissive); procedural side streets darker/sparser than Hoshi Street (accepted; fog + signs carry them). Crushed 0 %, clipped ≤ 0.02 %, road contrast 0.047–0.111.
- Cut/changed: rooftops are visual only (no ramps to drive roofs) — scope cut, logged.

## M4 report (core loop)
- Built: 4 fixers (Mama Kiso at Hoshi, Dex at the canal, Volt at Wan Tower, Granny Ume in Old Market) with typewriter dialogue + synth blips; jobs: 2 timed deliveries, 1 chase (shake the faster Hound), 1 dark run (sweeper searchlights), + stretch time trial (Lantern Run). Ratings on time/style/heat → stars → credits. Heat 0–5: drones → low patrol flyers → roadblocks (with gaps); ambient sweepers in free roam; analytic visibility (light exposure, cone, LOS spatial hash, cover); 2 s warning meter. HUD: speed/boost/drift, heat pips, detection bar, compass with objective marker + distance, waypoint beam, minimap, full map (Tab), job timer panel, credits. Garage (pause menu): thrusters, boost tank, stealth coils. Save: localStorage (credits, upgrades, best ratings, ghosts).
- FUN GATE: PASS (see PLAYTEST.md). UNPLAYED: needs human.
- LOOK GATE: gameplay captures (shots/m4_gameplay_sheet.png) + reference shots re-captured (shots/m4_shot_*). Defects fixed: fixer beams washed over reference shot 5 (now hidden in shots/photo mode, subtler in play); job toasts overlap the compass (accepted); warm window still a little bright (emissive lowered again).

## M5 report (showpiece)
- Built: photo mode, Old Market zone, ghost replays, Lantern Run time trial (stretch job), on-foot (walk/sprint/jump) with mount/dismount, Hoshi Noodle Bar interior (door fade/teleport), time-of-day + weather settings, steady strobes under reduce-flashing. Cut: near characters (no reachable asset source), tram-top escape job, rooftop driving.
- FUN GATE: PASS (bot + browser proxies, PLAYTEST.md). UNPLAYED: needs human.
- LOOK GATE: final set shots/m5_sheet.png (7 reference + 3 extras). Fixed this round: fixer beams hidden in shots, Hoshi frontage kept clean of random signs, warm window toned to amber. Crushed 0 %, clipped ≤ 0.02 %.
- Smoke: 13 views PASS on the single file via file://.

## In progress
- nothing blocking; see FINAL REPORT.md

## Decisions
- three r186 (WebGPURenderer + RenderPipeline), Rapier compat 0.21 in a worker, Vite 7, TS 5.9.
- Vehicle sim runs entirely inside the physics worker (fixed 120 Hz); main thread renders interpolated state. The same sim module runs in Node for bot fun-gate tests.
- Route B primary, Route A mirror (see DESIGN.md).
- Asset sites blocked → procedural textures/geometry/audio; Google Fonts reachable (fonts embedded at build time if used).
- GitHub push was refused (403) until access was connected; now pushed to origin/claude/stoic-clarke-cvo2qy.
- ACES filmic tone mapping (AgX looked washed out against the deep blue-black palette).
- SSR reflectivity = max(metalness, smoothness × grazing fresnel) written into the MRT (three's SSR otherwise only reflects metals).
- Renderer default = WebGL2 (tested); WebGPU opt-in via Settings/`?backend=webgpu` with fallback (headless WebGPU run crashed; untested).
- Headless captures: 960×540, SwiftShader ≈ 10 fps; motion shots therefore show more temporal ghosting than a real GPU.

## Assets
- none yet (see CREDITS.md)

## Known bugs
- none
