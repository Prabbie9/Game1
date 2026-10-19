# RULES (condensed working copy of SPEC.md — SPEC.md wins on conflict)

**Goals:** FUN and HIGH-END GRAPHICS weigh equally. Never drop one; make conflicting effects adaptive/toggleable. Readability at speed (road edges, obstacles, turns, pursuers) is part of the look. Frame-time stability counts for both. Cut scope, never quality or feel.

**Autonomous:** M0→M5 in order, no questions. Decide, log under DECISIONS in PROGRESS.md, continue. End of each milestone: run FUN + LOOK gates (self-check), short report in PROGRESS.md, copy build to `builds/M<n>-checkpoint`, refresh playable build + `builds/known-good`, start next milestone.
Stop only for: true blocker, step budget, usage-limit pause, user message.
**Budget:** ~900 tool calls. At 750: no new features; polish, ensure build runs, write FINAL REPORT.md. Milestone caps (M0 30, M1 150, M2 200, M3 120, M4 250, M5 150); at 1.5× cap move on and log why. Max 3 critique-and-fix rounds per milestone. Small targeted edits over rewrites.
**Limits:** after each meaningful step update NEXT STEP (top of PROGRESS.md) with one precise action. Commit often. If a limit gives a reset time, `send_later` the message "Read RULES.md, DESIGN.md and PROGRESS.md, then continue from NEXT STEP in autonomous mode." On resume: read RULES/DESIGN/PROGRESS, run `npm run smoke`, continue from NEXT STEP. Never redo working work.

**Build hygiene:** never leave the build broken across more than one step; latest checkpoint always playable with zero console errors. Hide unfinished features; no visible placeholders/TODOs. Modules: renderer, materials, world, streaming, vehicle, camera, audio, input, jobs, heat, crowds, hud, ui. NRC_DEBUG hooks (teleport, setTime, setRain, startJob, setHeat, stats) + `?shot=N` URL params. Smoke test visits every shot, fails on console errors; run before every checkpoint.

**Vehicle:** raycast hover, fixed timestep, Rapier (in a worker) for queries only. 0→cruise(20 m/s) 1.8–2.2 s; boost ~35 m/s; drift (Space+steer) builds boost; walls slide, never dead-stop; generous low-speed steering. Chase cam: spring arm, look-ahead, speed FOV/pull-back, never clips. ALL tuning in `src/vehicle/tuning.ts`; live panel, presets Grippy/Balanced(default)/Drifty, "copy my settings".

**Input:** game code sees actions only (INPUT.md). Analog −1..1. One look interface. Menus via focus system. Glyphs from lookup table.

**Jobs/heat:** delivery, chase, dark run. Fixers via text + synth blips. Rating: time, style, heat. Heat → drones → patrols → roadblocks. No guns. Visible warning, ~2 s grace, always an escape route. Visibility computed analytically, never from rendered pixels.

**Assets:** legal only. Log every asset in CREDITS.md (what/author/URL/licence, GREEN/AMBER/RED). Avoid RED. In-game Credits screen. Blocked sites → procedural, note it, list wanted assets in FINAL REPORT.md. Everything in assets/.

**Tech:** TS + Vite + three.js WebGPURenderer (auto WebGL2 fallback); test on WebGL2 headless. WebGPU-only features behind flag, reported untested. Every expensive effect has a quality toggle; tiers scale resolution/steps/shadows, never lower High. fps numbers unverified until user reports.

**Gates:** FUN (bot proxies in PLAYTEST.md + 5 human questions, mark "UNPLAYED: needs human"; never claim fun). LOOK (7 reference shots, ≥3 concrete defects per round, fix, recapture, contact sheet in shots/; mark too-slow effects UNVERIFIED). Pause-menu "Save reference shots" button.

**Honesty:** can't feel handling, can't measure real fps, can't test real WebGPU. Say so in FINAL REPORT.md.
