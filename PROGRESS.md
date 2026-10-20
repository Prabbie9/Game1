# PROGRESS
NEXT STEP: M1: verify full post chain renders headless (shots/r2_*), fix defects, run smoke, then M1 gates + checkpoint.

PLAYABLE BUILD: (none yet) — M0 delivery test hosted at https://claude.ai/artifact/TYkkpPLG9FAVQ7KoYsEeNp

## Done
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

## In progress
- M1

## Decisions
- three r186 (WebGPURenderer + RenderPipeline), Rapier compat 0.21 in a worker, Vite 7, TS 5.9.
- Vehicle sim runs entirely inside the physics worker (fixed 120 Hz); main thread renders interpolated state. The same sim module runs in Node for bot fun-gate tests.
- Route B primary, Route A mirror (see DESIGN.md).
- Asset sites blocked → procedural textures/geometry/audio; Google Fonts reachable (fonts embedded at build time if used).

## Assets
- none yet (see CREDITS.md)

## Known bugs
- none
