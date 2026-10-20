# PROGRESS
NEXT STEP: M2: build dist, capture slice shots 1-7 (node tools/shots.mjs dist shots/m2r1_ shot=1 ... shot=7), list defects, fix (round 1 of 3).

PLAYABLE BUILD: M1 checkpoint — hosted https://claude.ai/artifact/57iTMnatcL6jW9GvczB5VV ; offline single file builds/play/NightCourier.html (double-click). Known-good: builds/known-good/.

## Done
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

## In progress
- M2 look slice (src/world/slice.ts, src/world/kit.ts written, not wired yet)

## Decisions
- three r186 (WebGPURenderer + RenderPipeline), Rapier compat 0.21 in a worker, Vite 7, TS 5.9.
- Vehicle sim runs entirely inside the physics worker (fixed 120 Hz); main thread renders interpolated state. The same sim module runs in Node for bot fun-gate tests.
- Route B primary, Route A mirror (see DESIGN.md).
- Asset sites blocked → procedural textures/geometry/audio; Google Fonts reachable (fonts embedded at build time if used).
- GitHub push returns 403 (Claude GitHub App has no access to Prabbie9/Game1) → commits stay local; delivery via Artifact. Retry push at milestone ends.
- ACES filmic tone mapping (AgX looked washed out against the deep blue-black palette).
- SSR reflectivity = max(metalness, smoothness × grazing fresnel) written into the MRT (three's SSR otherwise only reflects metals).
- Headless captures: 960×540, SwiftShader ≈ 10 fps; motion shots therefore show more temporal ghosting than a real GPU.

## Assets
- none yet (see CREDITS.md)

## Known bugs
- none
