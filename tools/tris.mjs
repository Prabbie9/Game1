// Triangle / draw budget breakdown by scene category at a shot position: node tools/tris.mjs [dist] [query]
import { serve, launch, openPage } from './browser.mjs';
const dir = process.argv[2] || 'dist', q = process.argv[3] || 'quality=high&shot=2';
const PORT = +(process.env.PORT || 8093);
const srv = await serve(dir, PORT); const b = await launch();
const { page, errors } = await openPage(b, `http://localhost:${PORT}/index.html?backend=webgl&w=640&h=360&${q}`);
await page.waitForFunction(() => window.__NC_READY, null, { timeout: 300000 });
if (q.includes('shot=')) await page.waitForFunction(() => window.__SHOT_READY, null, { timeout: 900000, polling: 1000 });
const out = await page.evaluate(() => {
  const g = window.NRC_DEBUG.game, cam = g.camera, acc = {};
  const fr = new (g.camera.constructor.prototype.constructor === undefined ? Object : Object)();
  g.scene.updateMatrixWorld(true);
  g.scene.traverseVisible((o) => {
    if (!o.isMesh || !o.geometry) return;
    const geo = o.geometry, tri = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    const n = o.isInstancedMesh ? o.count : 1;
    const mt = o.material, key = (o.isSkinnedMesh ? 'skinned' : o.isInstancedMesh ? 'instanced:' : 'mesh:') + (o.isSkinnedMesh ? '' : (mt.name || mt.type) + (geo.attributes.glow ? ':traffic' : geo.attributes.pseed ? ':props' : geo.attributes.bseed ? ':boxes' : ''));
    acc[key] ??= { objs: 0, tris: 0 }; acc[key].objs++; acc[key].tris += tri * n;
  });
  return { acc, stats: { calls: window.NRC_DEBUG.stats().calls, tris: window.NRC_DEBUG.stats().tris, crowd: window.NRC_DEBUG.stats().crowd, streaming: window.NRC_DEBUG.stats().streaming } };
});
const rows = Object.entries(out.acc).sort((a, b) => b[1].tris - a[1].tris);
for (const [k, v] of rows.slice(0, 18)) console.log(String(v.tris | 0).padStart(9), String(v.objs).padStart(5), k);
console.log(JSON.stringify(out.stats)); console.log('errors:', errors.length ? errors.slice(0, 3) : 'none');
await b.close(); srv.close();
