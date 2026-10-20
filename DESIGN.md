# Night Courier — DESIGN

## Pitch
Freelance hover-bike courier in a rain-soaked neon district. Take jobs from fixers, drive fast, stay in the dark when the heat comes. Open district, GTA-lite, no guns.

## Scale and units
1 unit = 1 m. +Y up, -Z north. Bike ≈ 2.2 m long, hovers 0.9 m. Cruise 20 m/s, top (no boost) 24 m/s, boost 35 m/s.
Streets 14 m (2 lanes + 2 m sidewalks), alleys 5–7 m, elevated lanes 10 m wide at +12 m, tram deck +8 m, canal water −3 m.

## Map (The Stacks, zone 1 — 700 × 700 m, centred on origin; crossing at cruise ≈ 35 s)
```
        N (-Z)
   +-------------------------------------------+
   |  rooftop shanties   |   Wan Tower (holo)   |
   |  ==== tram line (+8 m, z = -140) ======== |
   |   |  blocks  | Neon Spine (x=0, bends) |   |~ Black
   |   |  ~90 m   |   Skyway ring (+12 m)   |   |~ Canal
   |   |          |   ramps at 4 corners    |   |~ (x=+320,
   |  The Drain underpass (z = +60)          |   |~  water -3 m,
   |  Hoshi noodle bar (warm window, focal)  |   |~  canal edge
   |  laundry alleys                          |   |~  roads)
   +-------------------------------------------+
        S (+Z)        Old Market (zone 2) lies west, x < -350 (M5)
```
Layers: street → canal edge → elevated Skyway → tram deck → rooftops (ramps/hops). Routes wind and overlap so the same block can be crossed 3 ways.
Landmarks: Wan Tower (giant hologram), Hoshi noodle bar (the one warm window), The Drain (underpass/tunnel), Pinwheel ramps, canal locks.
Old Market (zone 2): low roofs, amber lanterns, steam vents, awnings, tangled cables, narrow lanes.

## As built (M3–M5)
- The Stacks: x/z −350..350. Streets: N–S x = −300, −210, −130, 0 (south of plaza), 35 (north of Skyway end), 100 (north of the bend), 190, 270; E–W z = −300, −230, −110, 60, 220, 300 (+ −90, 70 east). The Ring elevated lane over z = −230 (+12 m) with ramps at x −345 (west) and 292 (east). Tram line over z = 220 (+8 m). East canal x 300–326 (bank ramps at z −50 and 150). Wan Tower at (−170, −170). Hoshi Street slice in the middle (x −95..135, z −195..155).
- Old Market: x −1000..−360, z −320..320, lanes continue the Stacks' E–W streets; z −230 leads straight onto the Ring's west ramp.
- Fixers: Mama Kiso (beside Hoshi), Dex (canal west bank, x 290 z −50), Volt (x −130 z −172, Wan Tower), Granny Ume (x −354 z 70, market gate).
- Hoshi Noodle Bar interior lives at y −60 under the plaza; the door fades + teleports.

## M2 look slice (lives inside The Stacks, near Hoshi)
~220 m street with a 35° bend, Skyway passing overhead, an alley branching off (steam, laundry lines), ending at the canal edge.

## Art direction
Deep blue-black base (#05070d). Accents: magenta (#ff2aa8), cyan (#19e6ff), sodium amber (#ffa142). The Stacks lean magenta + sodium orange; Old Market leans amber. One warm window (Hoshi) is the focal point of key shots.
Everything wet: darker albedo, low roughness, puddles with ripples, oily sheen. Neon reflected as long vertical streaks. Heavy distance fog with distinct light shafts. Filmic (AgX) tone mapping, never crushed blacks or clipped highlights. Readability first: road edges carry cyan reflective kerb strips; obstacles carry amber hazard emissive; pursuers carry red/blue strobes (with a reduce-flashing option).
Procedural kit: facades with shader windows (world-space, no tiling), neon signs from canvas text, ramps, pillars, awnings, AC units, cables, laundry lines.

## Jobs
1. **Timed delivery** — pick up at A, drop at B before the clock runs out. Style from drifts, near misses, air.
2. **Chase** — a faster pursuer is on you; break line of sight / get distance for 8 s to shake it.
3. **Dark run** — reach the drop without being caught in patrol searchlights; warning ring fills before detection (≈2 s grace); darkness and cover hide you.
Rating per job: time, style, heat → 1–3 stars and credits. 3 upgrades (thrusters, boost tank, stealth coils).
Fixers: Mama Kiso (noodle bar), Dex (canal), Volt (tower). Text dialogue + synth blips.

## Heat
0–5. Raised by: entering searchlights, ramming traffic, job triggers. 1–2: drones scan; 3–4: patrol bikes; 5: roadblocks. Cool down by staying unseen: lights off (stealth), under cover, alleys, darkness. Visibility = analytic light exposure at bike position × detection cone tests with occlusion raycasts.

## Delivery route (decided from M0 test)
- **Primary: Route B** — one self-contained `builds/play/NightCourier.html` (inline JS, worker as blob URL, Rapier WASM base64). Works by double-click, offline. Verified headless on file://.
- **Also: Route A** — the same build published as a hosted Artifact (link in PROGRESS.md). Hosted multi-file publish works; runtime on claude.ai could not be verified headless (needs login) — user to confirm.
- Binary assets in Route A must use served extensions (.wasm/.png/.ogg/...). Route B inlines everything; assets stay procedural/small, so B is expected to carry all milestones. Route C (GitHub Pages / Netlify Drop) steps go in FINAL REPORT.md as backup.

## Rendering pipeline (three r186 WebGPURenderer, WebGL2 fallback)
Scene pass MRT (color, normal, metal/rough, velocity) → SSR (+vertical streak blur) → GTAO → TRAA → bloom + anamorphic streak → DoF (speed-scaled) → motion blur (speed-scaled) → lens rain droplets → chromatic aberration → grain + vignette → AgX tone map.

## Effect availability (three.js r186, checked in node_modules)
| Effect | Status | Notes |
|---|---|---|
| HDR, linear, filmic tone map | AVAILABLE | AgX / ACES / Neutral |
| PBR + wet behaviour | AVAILABLE | custom TSL node materials (puddle mask, ripples, sheen) |
| SSR | AVAILABLE | `SSRNode`; long streaks via custom vertical blur |
| Reflection probe fallback | AVAILABLE | PMREM of a procedural neon env scene |
| Neon emissive + area-light approx | AVAILABLE | emissive + pooled point lights; RectAreaLight for a few signs |
| Shadow-casting lights | AVAILABLE | 1 moon dir light + ≤2 spot shadows |
| Volumetric fog / light shafts | AVAILABLE (High) + REPLACED | `VolumeNodeMaterial` ray-march at High; fake additive light-cone meshes + height fog on all tiers |
| Steam catching light | REPLACED | soft lit sprite particles |
| Layered rain, splashes, drips | AVAILABLE (custom) | instanced streaks + splash sprites |
| Droplets on glass / lens | REPLACED | shader droplets on glass; screen-space lens droplet pass |
| GTAO | AVAILABLE | `GTAONode` |
| Bloom | AVAILABLE | `BloomNode` |
| Depth of field | AVAILABLE | `DepthOfFieldNode` |
| Motion blur | AVAILABLE | `MotionBlur` + velocity MRT |
| Grain | AVAILABLE | `FilmNode` |
| Vignette | AVAILABLE | trivial TSL |
| Chromatic aberration | AVAILABLE | `ChromaticAberrationNode` |
| Anamorphic flares | REPLACED | `AnamorphicNode` absent in r186 → custom horizontal streak of bloom bright-pass |
| Lens flare ghosts | AVAILABLE | `LensflareNode` (optional) |
| TAA | AVAILABLE | `TRAANode` |
| Day/night + weather | AVAILABLE (custom) | uniforms drive sky, fog, wetness, rain |
| Compute-shader crowds | CUT for now | WebGPU-only; would sit behind flag, untested |

## Quality tiers
Low / Medium / High (default High on desktop). Scale render resolution, SSR steps, GTAO, volumetrics, shadow size, rain count, light pool size. High is never lowered.
