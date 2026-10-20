# Visual audit: before the graphics upgrade (commit 1ec342c, High, shots 1–10)

Contact sheet: `before_sheet.png`. These are the ten worst weaknesses, ranked by impact; humans and models come first.

1. **No people that read as people.**
   - The crowd is coloured blobs that are barely visible at street level (none show in shots 1–9).
   - Mama Kiso and the fixers are box-and-capsule stand-ins; the Hoshi bar (shot 10) looks empty.
2. **The rider is a capsule with a sphere head.**
   - From the chase camera (shots 6 and 7) the bike plus rider reads as a pair of glowing dots with no silhouette.
3. **The hover bike is a few boxes.**
   - No fairing, intake, thrusters, vanes or handlebars.
   - Nothing moves when steering or boosting except the trails.
4. **The facades are flat boxes tiled with square emissive windows.**
   - The windows read as "giant pixels", with no ledges, pipes, fire escapes or depth.
   - They dominate shots 1, 2, 5, 8 and 9.
5. **The sidewalks are bare.** There are no vending machines, bins, benches, stalls, barriers or tram stops; streets look unpopulated (shots 1, 7, 8).
6. **Traffic is one box car** (the pink car in shot 5), with the same silhouette everywhere.
7. **The pursuit craft (drones, patrol, hound) are cylinders and boxes,** with no recognisable shape at chase distance.
8. **The tram is three boxes with plane windows.** The Wan Tower and Skyway are generic extruded boxes on the skyline (shot 1).
9. **The ground has no surface detail.** Asphalt and sidewalk are uniform, with no lane markings, cracks, grime or posters, and the kerb neon is the only road marking.
10. **The Hoshi interior (shot 10) is over-bloomed.** Lanterns wash the room orange, the stools are boxes and the walls are flat; the focal character is missing.

Numbers at High (NRC_DEBUG.stats via tools/shots.mjs), SwiftShader, so timings are not meaningful:

| shot | draw calls | triangles |
|---|---|---|
| 1 | 348 | 217,422 |
| 2 | 348 | 217,422 |
| 3 | 363 | 222,130 |
| 4 | 379 | 225,832 |
| 5 | 372 | 225,350 |
| 6 | 370 | 218,760 |
| 7 | 299 | 214,226 |
| 8 | 408 | 241,668 |
| 9 | 344 | 338,110 |
| 10 | 294 | 211,534 |

## After (G1–G5)
Sheets: `before_after_sheet.png` (shots 1–10, left = before, right = after), `after_sheet.png`, and `after_extras_sheet.png` (rider, Dex, bike side, street furniture and crowd, junction, on foot, noodle bar, tram, drone).

| # | Weakness | Status |
|---|---|---|
| 1 | No real people | Fixed: skinned Quaternius humans with clothing; crowd LOD ladder; animated Kiso and fixers |
| 2 | Capsule rider | Fixed: skinned rider seated with lean and tuck; helmet comes off on foot |
| 3 | Box bike | Fixed: modelled hull with animated vanes, flaps and thrusters |
| 4 | Flat facades | Improved: interior-mapped windows, mullions, relief, cornices, fire escapes and drains. Still boxes underneath |
| 5 | Bare sidewalks | Fixed: furniture on every street-facing wall, colliders in sync |
| 6 | One box car | Fixed: three silhouettes |
| 7 | Pursuit craft | Fixed: modelled cruiser, drone, hound and sweeper |
| 8 | Tram, tower, Skyway | Improved: modelled tram, Wan crown and spire, Skyway girders and gantries |
| 9 | No ground detail | Improved: decals (lane paint, zebras, dry patches, cracks, manholes, posters). No downloaded PBR textures (hosts blocked) |
| 10 | Over-bloomed Hoshi | Improved: toned lanterns, lathed stools, bowls and jars, Kiso present |
