// Vehicle reference captures that depend on moving things: the tram (parks the bike under the line, facing the
// tram) and pursuit craft (raises heat, waits for drones/patrols). node tools/vehshots.mjs [dist] [prefix] [quality]
import { serve, launch, openPage } from './browser.mjs';
const dir = process.argv[2] || 'dist', prefix = process.argv[3] || 'shots/veh_', q = process.argv[4] || 'low';
const PORT = +(process.env.PORT || 8096);
const srv = await serve(dir, PORT); const b = await launch();
const { page, errors } = await openPage(b, `http://localhost:${PORT}/index.html?backend=webgl&w=960&h=540&quality=${q}&nosplash`);
await page.waitForFunction(() => window.__NC_READY && window.NRC_DEBUG.game.frameCount() > 5, null, { timeout: 300000, polling: 500 });
const frames = (n) => page.evaluate((n) => new Promise((r) => { const f0 = window.NRC_DEBUG.game.frameCount(); const t = () => window.NRC_DEBUG.game.frameCount() - f0 >= n ? r() : requestAnimationFrame(t); t(); }), n);
// tram: frozen camera beside the elevated line, re-aimed at the moving tram for a few frames
const tp = await page.evaluate(() => window.NRC_DEBUG.tram());
console.log('tram at', tp);
if (tp) {
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => { const t = window.NRC_DEBUG.tram(); const s = t.x > 0 ? -1 : 1; window.NRC_DEBUG.game.freezeCam([t.x + s * 24, 15, t.z + 5], [t.x + s * 6, 9.5, t.z], 50); });
    await frames(2);
  }
  await page.screenshot({ path: prefix + 'tram.png' });
}
// pursuers: heat 5 near the Hoshi plaza, then frame each kind once
await page.evaluate(() => { window.NRC_DEBUG.game.releaseCam(); window.NRC_DEBUG.teleport(0, 1, 60, 0); window.NRC_DEBUG.setHeat(5); });
await frames(40);
const h = await page.evaluate(() => window.NRC_DEBUG.heat());
console.log('heat', h.heat, h.pursuers.join(','));
const done = new Set();
for (let i = 0; i < h.pursuers.length; i++) {
  const k = h.pursuers[i]; if (done.has(k)) continue; done.add(k);
  for (let j = 0; j < 3; j++) {
    await page.evaluate((i) => { const p = window.NRC_DEBUG.heat().at[i]; window.NRC_DEBUG.game.freezeCam([p[0] + 7, p[1] + 2.5, p[2] + 7], [p[0], p[1] - 0.3, p[2]], 45); }, i);
    await frames(2);
  }
  await page.screenshot({ path: prefix + 'craft_' + k + '.png' });
}
console.log('errors:', errors.length ? errors.slice(0, 5) : 'none');
await b.close(); srv.close();
