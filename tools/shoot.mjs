// Usage: node tools/shoot.mjs <dir> "<query>" <out.png> [extraFramesWait]
import { serve, launch, openPage } from './browser.mjs';
const [dir, query, out, extra = '20'] = process.argv.slice(2);
const srv = await serve(dir, 8090);
const b = await launch();
const t0 = Date.now();
const { page, errors } = await openPage(b, `http://localhost:8090/index.html?backend=webgl&w=960&h=540&${query}`);
try {
  await page.waitForFunction(() => window.__NC_READY, null, { timeout: 240000 });
  if (query.includes('shot=')) await page.waitForFunction(() => window.__SHOT_READY, null, { timeout: 600000, polling: 1000 });
  const f0 = await page.evaluate(() => window.NRC_DEBUG.game.frameCount());
  await page.waitForFunction((n) => window.NRC_DEBUG.game.frameCount() >= n, f0 + +extra, { timeout: 600000, polling: 500 });
  await page.screenshot({ path: out });
  const st = await page.evaluate(() => window.NRC_DEBUG.stats());
  console.log(JSON.stringify({ secs: (Date.now() - t0) / 1000, ...st }));
} catch (e) { console.log('ERR', e.message); }
console.log('console errors:', errors.length ? errors.slice(0, 10) : 'none');
await b.close(); srv.close();
