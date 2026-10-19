// Worker: initialise Rapier (WASM) and run a tiny raycast to prove it works off the main thread.
import RAPIER from '@dimforge/rapier3d-compat';
(async () => {
  try {
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.createCollider(RAPIER.ColliderDesc.cuboid(10, 0.5, 10));
    world.step();
    const hit = world.castRay(new RAPIER.Ray({ x: 0, y: 5, z: 0 }, { x: 0, y: -1, z: 0 }), 100, true);
    postMessage({ ok: !!hit && Math.abs(hit.timeOfImpact - 4.5) < 0.01, detail: `rapier ${RAPIER.version()} raycast toi=${hit?.timeOfImpact.toFixed(3)}` });
  } catch (e) { postMessage({ ok: false, detail: String(e) }); }
})();
