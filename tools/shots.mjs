// Capture several views in one browser session. Usage: node tools/shots.mjs <dir> <outPrefix> "<q1>" "<q2>" ...
// Each query gets ?backend=webgl&w=960&h=540 added; shot queries wait for __SHOT_READY.
import { serve, launch, openPage } from './browser.mjs';
const [dir, prefix, ...queries] = process.argv.slice(2);
const srv = await serve(dir, 8091);
const b = await launch();
let fail = 0;
for (const [i, q] of queries.entries()) {
  const t0 = Date.now();
  const { page, errors } = await openPage(b, `http://localhost:8091/index.html?backend=webgl&w=960&h=540&${q}`);
  try {
    await page.waitForFunction(() => window.__NC_READY, null, { timeout: 240000 });
    if (q.includes('shot=')) await page.waitForFunction(() => window.__SHOT_READY, null, { timeout: 900000, polling: 1000 });
    else { const f0 = await page.evaluate(() => window.NRC_DEBUG.game.frameCount()); await page.waitForFunction((n) => window.NRC_DEBUG.game.frameCount() >= n, f0 + 12, { timeout: 600000, polling: 500 }); }
    const name = `${prefix}${q.replace(/[^a-z0-9]+/gi, '_')}.png`;
    await page.screenshot({ path: name });
    const st = await page.evaluate(() => window.NRC_DEBUG.stats());
    console.log(name, JSON.stringify({ secs: (Date.now() - t0) / 1000, calls: st.drawCalls, tris: st.triangles, p50: st.frameMsP50, p99: st.frameMsP99, speed: +st.speed.toFixed(1) }));
  } catch (e) { console.log('ERR', q, e.message); fail++; }
  if (errors.length) { console.log('console errors:', errors.slice(0, 8)); fail++; }
  await page.close();
}
await b.close(); srv.close();
process.exit(fail ? 1 : 0);
