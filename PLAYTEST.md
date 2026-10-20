# PLAYTEST
Bot-measured proxies per milestone, plus questions for a human. The game has never been played by a person: every gate is "UNPLAYED: needs human" until the user reports back.

## M1 — Feel grey-box + mood test
**Status: bot proxies PASS for all three presets. UNPLAYED: needs human.**
Measured by `npx tsx tools/fungate.ts <preset>` (real sim + Rapier in Node, 120 Hz, no rendering).

| Proxy | Target | Balanced | Grippy | Drifty |
|---|---|---|---|---|
| Standstill → cruise (20 m/s) | 1.8–2.2 s | 2 | 2 | 2 |
| Boost max speed | ≥ 33.3 m/s (95% of 35) | 34.3 | 34.3 | 34.3 |
| Boost: time to 95% | — | 1.96 | 1.96 | 1.96 |
| Drift: boost meter gained (1.6 s) | > 0.15 | 0.76 | 0.61 | 0.8 |
| Drift: release kick | > 0 m/s | 6 | 6 | 8 |
| Drift: speed kept | > 14 m/s | 18.8 | 19.5 | 19.2 |
| Course time (loop, ~2 km) | band [59, 111] s | 68.1 | 66.6 | 69.5 |
| Course: wall dead-stops | 0 | 0 | 0 | 0 |
| Course: camera clip frames | 0 | 0 | 0 | 0 |
| Course: bike off-view frames | 0 | 0 | 0 | 0 |
| Course: drifts / boosts / hops | — | 12/123/1 | 12/123/1 | 12/125/1 |

Wall hits at 20 m/s (min speed ratio within 0.5 s, fail < 0.20): 90° → 0.63, 60° → 0.65, 45° → 0.71, 30° → 0.9, 10° → 1 (Balanced). All presets ≥ 0.63.

Gap analysis, deck hop gap (6 m, same height): {'cruiseNoHop': 'fell', 'cruiseHop': 'cleared', 'slowHop': 'cleared', 'boostNoHop': 'cleared', 'boostHop': 'cleared'} → OK (needs a hop or boost; not trivial, not impossible).

Readability: kerb edges carry cyan emissive strips; contrast numbers per capture are in PROGRESS.md (tools/readability.py).
Frame time: headless SwiftShader runs at a fixed ~100 ms/frame (rAF throttled, software GL) — not real fps. p99 = p50 = 100 ms across shots, i.e. no hitches beyond the throttle; real-GPU fps UNVERIFIED.

Questions for a human (M1):
1. Does steering feel good at low speed (tight streets) and at top speed (does it feel twitchy or numb)? Which preset felt best?
2. Is 0 → cruise in ~2 s and the boost surge exciting enough, or do you want to go faster?
3. Do drifts (Space + steer) feel controllable, and is the boost you earn from them worth doing?
4. When you hit a wall, does sliding along it feel fair, or does it feel like the game is driving for you?
5. Can you read the road edges and the hazard bollards at speed in rain and fog? What annoyed you?

## M2 — Playable look slice (Hoshi Street)
**Status: bot proxies PASS. UNPLAYED: needs human.**
Vehicle proxies unchanged from M1 (same sim; all presets pass, see above). Slice routes (Balanced, `tools/fungate.ts` §7):

| Route | Time | Band | Wall dead-stops | Camera clips | Notes |
|---|---|---|---|---|---|
| loop (plaza → street → bend → NE) | 10.8 s | 7–15 s | 0 | 0 | |
| skyway (ramp up, deck, ramp down) | 7.6 s | 7–15 s | 0 | 0 | max height 10.9 m |
| canal (ramp in, skim, ramp out) | 8.3 s | 5–10 s | 0 | 0 | 3.6 s on water |

Bot-found and fixed in M2: buildings partly inside the Skyway corridor blocked the deck (now low roofs pass under); canal ramps had ledges above the water line that snagged and trapped the camera (ramps now start submerged; amber edge strips mark the exit ramp sides).
Readability (shots/m2r3_*): crushed 0 %, clipped ≤ 0.02 %, road local contrast 0.046–0.083; kerb strips + amber bollards visible in every shot.

Questions for a human (M2):
1. Driving down Hoshi Street at night: does it feel like a place? What's the first thing your eye goes to?
2. Can you read the road, the bend and the kerbs at full speed in the rain, or does the glow/blur get in the way?
3. Is skimming the canal fun, and was it obvious how to get in and out?
4. The Skyway ramp and underpass: did the jump between street level and the elevated lane feel good?
5. Do the engine, rain and city sounds match what you see? Anything grating?
