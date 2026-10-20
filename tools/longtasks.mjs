// Loading long-task timeline: which loading phase blocks the main thread. node tools/longtasks.mjs [dir] [query]
import { serve, launch } from './browser.mjs';
const dir = process.argv[2] || 'dist', q = process.argv[3] || 'nosplash';
const PORT = +(process.env.PORT || 8094);
const srv = await serve(dir, PORT); const b = await launch();
for (let rep = 0; rep < +(process.env.REPEAT || 1); rep++) {
console.log('--- load', rep + 1);
const page = await b.newPage({ viewport: { width: 640, height: 360 } });
await page.goto('about:blank');
await page.addInitScript(() => {
  window.__LT = []; window.__ST = []; const t0 = performance.now();
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!window.__NC_READY) window.__LT.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true });
  const mo = () => { const el = document.querySelector('.loading'); if (el) new MutationObserver(() => window.__ST.push([Math.round(performance.now()), el.textContent.trim().slice(0, 40)])).observe(el, { subtree: true, childList: true, characterData: true }); else setTimeout(mo, 5); };
  mo();
});
page.on('console', (m) => { if (m.text().startsWith('[trace]')) console.log('       ', m.text()); });
await page.goto(`http://localhost:${PORT}/index.html?backend=webgl&w=640&h=360&${q}`);
await page.waitForFunction(() => window.__NC_READY, null, { timeout: 300000 });
const r = await page.evaluate(() => ({ lt: window.__LT, st: window.__ST }));
const ev = [...r.lt.map(([t, d]) => [t, `LONGTASK ${d} ms (ends ${t + d})`]), ...r.st.map(([t, s]) => [t, `status: ${s}`])].sort((a, b) => a[0] - b[0]);
for (const [t, s] of ev) if (!/^status/.test(s) || true) console.log(String(t).padStart(7), s);
await page.close();
}
await b.close(); srv.close();
