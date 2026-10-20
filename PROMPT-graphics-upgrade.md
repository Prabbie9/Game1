# Prompt: Night Courier graphics upgrade (models, assets, humans first)

Paste everything below the line into a new Opus session on this repo (branch `claude/loving-cerf-mml2vq`).

---

You are upgrading the visuals of **Night Courier**, a rain-soaked cyberpunk hover-bike courier game (TypeScript + Vite + three.js r186 `three/webgpu` with the WebGL2 backend, Rapier physics in a worker). It runs and the player can drive it. The goal now is a **major, visible graphics upgrade**, with the most weight on **3D models, real assets, and human characters**. Right now everything is procedural: facades are shader boxes with painted ledges, characters are box figures, crowds are simple vertex-animated blobs with umbrellas, props are primitives, and the bike is hand-built geometry. Read `FINAL REPORT.md` ("What is rough", "Assets worth attaching"), `RULES.md`, `DESIGN.md`, `SPEC.md` and `PROGRESS.md` first. `RULES.md` rules on legal assets, quality toggles and honesty still apply, except where this prompt overrides them.

## Priorities, in order

### 1. Humans (biggest gap)
- Replace the box-figure `Person` (`src/vehicle/person.ts`) and the crowd blobs (`src/crowds/crowds.ts`) with real **skinned, animated humanoid models**: idle, walk and run clips, with a sprint or turn blend for the player.
- Aim for visible variety: 6–10 body/outfit variants (raincoats, hoods, techwear, vendors, cooks), skin and clothing colour variation per instance, and emissive accents (neon trim, visor glows, umbrellas that actually hold a shape).
- Crowds must stay cheap: use **instanced** skinned meshes or a baked **vertex-animation texture (VAT)** approach, a small LOD ladder (full mesh < 25 m, simplified < 80 m, impostor or billboard beyond), and the existing density tiers (low/mid/high).
- The player courier (on foot and seated on the bike with a visible rider, helmet and jacket that move with steering and lean) and the named characters (Mama Kiso in Hoshi Noodle Bar and the four fixers) should be higher-detail hero characters with at least a simple face, hair or hood and a clothing-material pass. Add idle gestures (stirring, typing, leaning).
- Wet look: characters pick up the wet-material treatment (specular sheen, darkened wet cloth, rain splashes) and rim-lit neon.

### 2. Models and props
- Replace the primitive **bike** with a proper hero hover-bike model: fairings, intake, glowing underbody emitters, rider pose, damage-free but with moving parts (steering vanes, thruster bells).
- Replace procedural traffic, patrol craft, drones, the tram, and Pursuer craft with believable modelled vehicles (several silhouettes for traffic, distinct police/drone designs) with emissive lights.
- Street furniture and props: vending machines, bins, pipes, AC units, cables and wires, awnings, stalls and lanterns (Old Market), barriers, bollards, benches, signage rigs, rooftop clutter, tram stops. Scatter them with instancing so they populate every block.
- Buildings: give facades **real geometry depth**: modular facade kit (balconies, ledges, window frames, fire escapes, signage brackets, ducts, shutters) with **mesh instancing**, or a parallax or relief shader at minimum. Keep the Hoshi Street hand-authored slice as the quality benchmark and bring the procedural blocks and Old Market close to it.
- Hero landmark: improve Wan Tower and the Skyway silhouettes.

### 3. Assets, textures and materials
- Use **real, legally clean assets** wherever possible. Log every one in `CREDITS.md` (what, author, URL, licence, GREEN/AMBER/RED) and in the in-game Credits screen. Prefer **CC0**: Quaternius, Kenney, Poly Haven (models and PBR textures), ambientCG, Mixamo-free alternatives (do NOT use Mixamo or anything with a no-redistribution licence). Never use ripped or unlicensed assets.
- **First check network access** (`curl -I` to a few of those hosts through the proxy; see `/root/.ccr/README.md`). The previous session found them blocked. If they are blocked:
  1. Do not stall. Say so clearly.
  2. Build the best possible **procedural** models in code (proper subdivided, UV-mapped meshes, a generated humanoid rig with `SkinnedMesh`, parametric clothing layers), and
  3. Write `assets/WANTED.md` listing exact packs and file names, in a form I can download and drop into `assets/` myself, plus loader code that picks up `assets/**/*.glb` automatically when present and falls back to the procedural version when it isn't.
- Textures: wet asphalt, concrete, brick, metal-plate, rust and painted-metal PBR sets (albedo/normal/roughness; ORM packed), compressed (KTX2/Basis if the toolchain allows, otherwise downsized JPG/WebP) and tiled with the existing world-space wet shader, not replacing it.
- Add an HUD font (Rajdhani or Oxanium, OFL) embedded as base64.
- Decals and detail: road markings, cracks, grime, puddle normal detail, neon spill, stickers and posters on walls.

### 4. Lighting and post (only after the above)
- Better local lighting (emissive signs lighting nearby walls, spill from windows), cleaner reflections, stronger volumetric feel, but **never at the cost of the stability fixes below**.

## Hard constraints (learned the hard way)

1. **It must still ship as ONE self-contained HTML file** that works from `file://` (`npm run build:single` → copy to `builds/play/NightCourier.html`, `builds/known-good/NightCourier.html` and `docs/index.html`). Embed models and textures as base64 or inline blobs. Budget: **≤ 40 MB total file**. Compress meshes with Draco or meshopt if you can, and downsize textures. If it can't fit, say so and propose a hosted multi-file build as an addition (keep the single file working at reduced detail).
2. **Do not freeze the page.** The first version of this game hard-froze Edge on a real GPU (black screen, then "page isn't responding") because shader compile and heavy boot work ran in one blocking step. I fixed the loader (`tick()` yields between boot steps, `Post.compile()` uses `compileAsync`, software-GPU detection falls back to Low). Keep these properties:
   - Never run more than ~1 s of synchronous work without yielding to a paint.
   - Load and parse models **asynchronously and progressively** with a visible progress bar, and decode off the main thread where possible (GLTFLoader async, `createImageBitmap`, or a worker).
   - Compile new materials through the existing `compileAsync` path before the "click to ride" prompt.
   - Prefer **few shared materials** (e.g. one skinned-character material with per-instance colour attributes) over many distinct node graphs. New node-material variants multiply shader compile time.
   - Add loading-time and first-frame budgets to the smoke test: fail if the main thread is blocked for > 3 s at any point in the loading sequence, measured with a `PerformanceObserver` `longtask` log.
3. **Frame rate matters as much as looks.** Target 60 fps at High on a Ryzen 7 7800X3D + RX 7800 XT, and a playable Low tier on weaker GPUs. All new detail goes through the quality tiers (`TIERS` in `src/renderer/renderer.ts`): character LOD distances, crowd density, prop density, texture resolution, shadow-casting limits. Use instancing, LOD, culling and the existing 100 m streaming chunks. Report triangle and draw-call counts from `NRC_DEBUG.stats()` before and after.
4. **Readability at speed is part of the look.** Road edges, obstacles, turns and pursuers must stay clear in rain and bloom at full speed. Don't bury the road in clutter.
5. **Do not regress gameplay.** Physics colliders are separate from visuals (Rapier worker); keep them in sync. Don't change vehicle tuning, jobs, heat or save data. The save format and `NRC_DEBUG` hooks must keep working.
6. **Honesty.** You can't see real-GPU frame rates or feel the game. The sandbox renders on SwiftShader (software), which is about 10 s per frame at High, so use `?quality=low`, small viewports (`?w=640&h=360`) and `?shot=N` captures for visual checks. Mark anything unverified on real hardware as UNVERIFIED in `FINAL REPORT.md`. Don't claim it looks or runs great without evidence.

## Method

- Work in milestones (e.g. G1 humans, G2 bike and vehicles, G3 props and facades, G4 materials/textures/decals, G5 lighting/post and polish). After each: run `npm run build`, `npm run smoke`, capture reference shots (`node tools/shots.mjs …`, `?shot=1..10`) to `shots/`, make a contact sheet, **critique your own screenshots with at least 3 concrete defects per round**, fix, recapture. Max 3 rounds per milestone.
- Keep `PROGRESS.md` updated with a one-line NEXT STEP. Commit often with clear messages and push to `claude/loving-cerf-mml2vq`. Rebuild and copy the single-file build into `builds/play/`, `builds/known-good/` and `docs/index.html` at each checkpoint, and keep a `builds/G<n>-checkpoint` copy.
- Keep a **before/after contact sheet** of the same camera positions (use the existing `?shot=` setups) in `shots/graphics-upgrade/`, so I can see the difference.
- Finish with an updated `FINAL REPORT.md` (what changed, what's procedural vs sourced, asset licences, perf numbers, UNVERIFIED items, assets I should download manually).

Start by auditing the current look (capture all reference shots), listing the 10 worst visual weaknesses ranked by impact, with humans and models at the top, then proceed with G1.
