// Smoke test: loads the build, visits the free-drive view and every reference shot, fails on any console error.
// Usage: node tools/smoke.mjs [dir=dist] [--single path/to/NightCourier.html]
import { serve, launch, openPage } from './browser.mjs';
import fs from 'node:fs';
const args = process.argv.slice(2);
const single = args.includes('--single') ? args[args.indexOf('--single') + 1] : null;
const dir = single ? null : (args[0] ?? 'dist');
const srv = dir ? await serve(dir, 8092) : null;
const base = single ? 'file://' + fs.realpathSync(single) : 'http://localhost:8092/index.html';
const b = await launch();
const views = ['nosplash', 'bot=loop', 'nosplash&job=dex_hound', ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map((s) => 'shot=' + s)];
let failed = 0;
for (const v of views) {
  const t0 = Date.now();
  const { page, errors } = await openPage(b, `${base}?backend=webgl&w=640&h=360&quality=low&${v}`);
  let ok = true, note = '';
  try {
    await page.waitForFunction(() => window.__NC_READY, null, { timeout: 240000 });
    if (v.startsWith('shot=')) await page.waitForFunction(() => window.__SHOT_READY, null, { timeout: 600000, polling: 1000 });
    const f0 = await page.evaluate(() => window.NRC_DEBUG.game.frameCount());
    await page.waitForFunction((n) => window.NRC_DEBUG.game.frameCount() >= n, f0 + 5, { timeout: 300000, polling: 500 });
    const st = await page.evaluate(() => window.NRC_DEBUG.stats());
    note = `${st.backend} calls=${st.drawCalls} speed=${st.speed.toFixed(1)}`;
  } catch (e) { ok = false; note = e.message.split('\n')[0]; }
  if (errors.length) { ok = false; note += ' errors: ' + errors.slice(0, 5).join(' | '); }
  console.log(`${ok ? 'PASS' : 'FAIL'} ${v} (${((Date.now() - t0) / 1000).toFixed(0)}s) ${note}`);
  if (!ok) failed++;
  await page.close();
}
await b.close(); srv?.close();
console.log(failed ? `SMOKE FAILED (${failed})` : 'SMOKE OK');
process.exit(failed ? 1 : 0);
