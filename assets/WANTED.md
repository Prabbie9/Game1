# Assets wanted (drop-in)

The build sandbox could not reach the CC0 asset hosts (Poly Haven, ambientCG, Kenney, Quaternius' own site,
OpenGameArt, Sketchfab and itch.io were all blocked; only GitHub and npm were reachable). Every model and
texture in this build is therefore procedural, except the Quaternius humans, which came from a CC0 GitHub mirror.

To upgrade a model, drop a `.glb` at the path below and rebuild (`npm run build:single`). The loader
(`src/assets/overrides.ts`) bundles every `assets/**/*.glb`, loads it asynchronously behind the progress bar,
and swaps it in for the procedural version. If a file is missing or fails to load, the procedural model stays.
Log every file you add in CREDITS.md (what, author, URL, licence, GREEN/AMBER/RED). CC0 only, please.

Conventions: metres, +Y up, **forward = -Z**, origin at the ground contact point (vehicles: the hull centre).
Keep each file under about 2 MB. Compress with Draco or meshopt and use 1K textures (`gltf-transform optimize in.glb out.glb --compress meshopt --texture-size 1024`).

| Path | Replaces | Suggested CC0 source |
|---|---|---|
| `assets/vehicles/bike.glb` | hero hover-bike hull (vanes, rider and lights stay procedural) | Quaternius "Sci-Fi Vehicles" / Kenney "Space Kit" |
| `assets/vehicles/drone.glb`, `patrol.glb`, `hound.glb`, `sweeper.glb` | pursuit craft | Quaternius "Ultimate Spaceships", Kenney "Space Kit" |
| `assets/vehicles/tram.glb` | the tram (one 11.6 m car; it is repeated ×3) | Kenney "Train Kit" |

## Textures wanted (not yet wired; procedural detail is used today)
| Use | Suggested CC0 source |
|---|---|
| Wet asphalt, concrete, brick, corrugated metal (1K albedo + normal + roughness, KTX2/basis) | ambientCG Asphalt0xx, Concrete0xx, Bricks0xx, CorrugatedSteel00x; Poly Haven "aerial_asphalt_01" |
| Poster / decal atlas | ambientCG "Decal" sets |
| HDRI for reflections (night city, 1K) | Poly Haven "shanghai_bund", "potsdamer_platz" |
