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

> **Correction found in M3:** tapping boost re-applied the surge kick every few frames (the bot's on/off boost pattern pumped speed up to 80 m/s on long straights). Fixed with a 1.5 s kick cooldown capped at boost speed. Re-measured M1 loop: Balanced 82.8 s, Grippy 81.2 s, Drifty 83.9 s (band 59–111 s) — still PASS; the 68 s figures above were inflated by the exploit. Wall scraping could also add speed (push-off applied every step); now push-off only on real impacts and speed after a hit never exceeds speed before it.

## M3 — Streaming + The Stacks
**Status: bot proxies PASS. UNPLAYED: needs human.**
Stacks routes (Balanced): cross-district loop 63.7 s (band 48–103 s), Ring elevated lane 24.7 s (band 19–40 s); 0 dead-stops, 0 camera clips (Grippy/Drifty within 1 s). Stability drive: see PROGRESS.md (no leaks, no shader-compile hitches after fix, frame-time p99 ≈ 4× median on software rendering).

Questions for a human (M3):
1. Does the district feel big enough to roam, or do you run out of road? Does it feel like the same block repeated?
2. Did you notice anything popping in or out as you drove (buildings, signs, people, lights)? Where?
3. Were the Ring, the tram line and the canal easy to find and fun to use as alternative routes?
4. Do the crowds and hover traffic make the city feel alive, or do they look fake up close?
5. Any stutters while driving fast across the district? (Note your GPU and the Quality setting.)

## M4 — Core loop (fixers, jobs, heat, HUD, map, upgrades, save)
**Status: bot/system proxies PASS. UNPLAYED: needs human.**
Job routes driven by the bot in Node (Balanced, expert line with boost): Two Bowls for the Tram Crew 16.1 s / 34 s limit; Soup on the Ring 33.7 s / 60 s; Shake the Hound drive 28.5 s (+ shaking) / 170 s; Lights Out drive 22.7 s (+ sneaking) / 150 s. A human on a first run should land around 60–90 % of each limit.
Heat fairness (`tools/fairness.ts`): warning meter before detection = 2.0 s (3.0 s with Stealth coils); darkness (exposure ≈ 0) and cover (under the Ring) → never detected; after detection, out of sight → lost after 7.0 s, heat back to 0 and all pursuers gone within 40 s. Roadblocks leave gaps between barriers (always an escape route).
Browser job test (`tools/jobtest.mjs`): every job starts from NRC_DEBUG, deliveries complete with a rating card (time / style / heat → stars → credits), the dark run fails when a sweeper locks on, the chase spawns the Hound + heat drones, the Lantern Run counts all 7 gates and saves a ghost, credits/progress persist in localStorage, no console errors.
HUD readability: dark plates behind compass, heat, timer, minimap; road contrast in gameplay captures 0.17 (higher than the cinematic shots because the HUD adds hard edges).

Questions for a human (M4):
1. Were the fixers easy to find from the map and the coloured rings? Was it clear what each job wanted?
2. Did the timed delivery feel tight-but-fair, or did it feel impossible / trivially easy?
3. Shaking the Hound: did breaking line of sight feel like a skill, and did the "hidden x / 6 s" counter help?
4. In Lights Out, could you tell when a searchlight was about to catch you (warning bar, cone colour)? Did the 2 s grace feel fair?
5. Are the rewards and the three upgrades worth chasing? Would you do another job right away?
