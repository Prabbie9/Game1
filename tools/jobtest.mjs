// Browser test of the job loop: start each job via NRC_DEBUG, teleport to its drop, check the result card.
import { serve, launch, openPage } from './browser.mjs';
const srv = await serve('dist', 8095); const b = await launch();
const { page, errors } = await openPage(b, 'http://localhost:8095/index.html?backend=webgl&w=640&h=360&quality=low&nosplash');
await page.waitForFunction(() => window.__NC_READY && window.NRC_DEBUG.game.frameCount() > 5, null, { timeout: 240000, polling: 500 });
const frames = (n) => page.evaluate((n) => new Promise((r) => { const f0 = window.NRC_DEBUG.game.frameCount(); const t = () => window.NRC_DEBUG.game.frameCount() - f0 >= n ? r() : requestAnimationFrame(t); t(); }), n);
const press = async (code) => { await page.keyboard.down(code); await frames(2); await page.keyboard.up(code); await frames(2); };
const results = {};
for (const [id, drop] of [['kiso_tram', [-210, 1, 236]], ['kiso_ring', [200, 13, -230]], ['dex_hound', [0, 1, 104]], ['volt_dark', [-300, 1, 236]]]) {
  console.log(id, await page.evaluate((id) => window.NRC_DEBUG.startJob(id), id));
  await frames(4);
  const before = await page.evaluate(() => document.querySelector('.jobp')?.textContent);
  if (id === 'dex_hound') { await page.evaluate(() => { const h = window.NRC_DEBUG.game; }); }
  await page.evaluate((d) => window.NRC_DEBUG.teleport(d[0], d[1], d[2], 0, 0), drop);
  // chase: the Hound must be shaken first; wait in place under no sight is unreliable, so report state instead
  await frames(id === 'dex_hound' ? 30 : 12);
  const card = await page.evaluate(() => { const c = document.querySelector('.card'); return c && getComputedStyle(c).display !== 'none' ? c.textContent.slice(0, 120) : null; });
  results[id] = { panel: before?.slice(0, 80), card, heat: await page.evaluate(() => window.NRC_DEBUG.heat()) };
  if (card) await press('Escape');
  await frames(4);
}
// time trial: teleport through each lantern gate in order
console.log('ume_lanterns', await page.evaluate(() => window.NRC_DEBUG.startJob('ume_lanterns')));
await frames(4);
const gates = await page.evaluate(() => window.NRC_DEBUG.game.world.marketRun);
for (const g of gates) { await page.evaluate((g) => window.NRC_DEBUG.teleport(g[0], g[1] + 1, g[2], 0, 0), g); await frames(6); }
results.ume_lanterns = { gates: gates.length, card: await page.evaluate(() => { const c = document.querySelector('.card'); return c && getComputedStyle(c).display !== 'none' ? c.textContent.slice(0, 90) : null; }),
  ghostSaved: await page.evaluate(() => !!localStorage.getItem('nc.ghost.ume_lanterns')), save: await page.evaluate(() => localStorage.getItem('nc.save')) };
// photo mode toggles without errors
await press('Escape'); await frames(3); await press('KeyP'); await frames(4); await page.screenshot({ path: 'shots/m5_photomode.png' }); await press('KeyP'); await frames(3);
console.log(JSON.stringify(results, null, 1));
console.log('errors:', errors.length ? errors.slice(0, 5) : 'none');
await page.screenshot({ path: 'shots/m4_jobtest.png' });
await b.close(); srv.close();
