// Frame-time stability check (M3): bot drives a route through the streamed Stacks; samples draw calls,
// triangles, memory, streaming activity and frame times; reports hitches (> 2.5x median frame time).
// Usage: node tools/stability.mjs [route=cross] [seconds=90] [dir=dist]
import { serve, launch, openPage } from './browser.mjs';
import { chromium } from 'playwright-core';
const [route = 'cross', secs = '90', dir = 'dist'] = process.argv.slice(2);
const srv = await serve(dir, 8094);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--enable-precise-memory-info'] });
const { page, errors } = await openPage(b, `http://localhost:8094/index.html?backend=webgl&w=640&h=360&quality=${process.env.Q || 'high'}&bot=${route}`);
await page.waitForFunction(() => window.__NC_READY, null, { timeout: 240000 });
await page.evaluate(() => { window.__ft = []; let last = performance.now(); const f = () => { const n = performance.now(); window.__ft.push(n - last); last = n; requestAnimationFrame(f); }; requestAnimationFrame(f); });
const samples = [];
const t0 = Date.now();
while ((Date.now() - t0) / 1000 < +secs) {
  await page.waitForTimeout(3000);
  const s = await page.evaluate(() => window.NRC_DEBUG.stats());
  samples.push({ t: Math.round((Date.now() - t0) / 1000), calls: s.drawCalls, tris: s.triangles, geos: s.geometries, tex: s.textures, heapMB: s.heapMB, ...s.streaming, speed: +s.speed.toFixed(1), pos: s.pos.map((v) => Math.round(v)) });
}
const ft = await page.evaluate(() => window.__ft.slice(5));
const sorted = [...ft].sort((a, c) => a - c), med = sorted[Math.floor(sorted.length / 2)];
const p99 = sorted[Math.floor(sorted.length * 0.99)], hitches = ft.filter((x) => x > 2.5 * med).length;
const max = (k) => Math.max(...samples.map((s) => s[k] ?? 0));
console.log(JSON.stringify({ route, frames: ft.length, medianMs: +med.toFixed(1), p99Ms: +p99.toFixed(1), maxMs: +sorted[sorted.length - 1].toFixed(1), hitches, hitchPct: +(100 * hitches / ft.length).toFixed(2),
  maxCalls: max('calls'), maxTris: max('tris'), maxGeos: max('geos'), maxTex: max('tex'), heapStartMB: samples[0]?.heapMB, heapEndMB: samples.at(-1)?.heapMB, builds: samples.at(-1)?.builds, errors: errors.length }, null, 1));
console.log(samples.map((s) => `${s.t}s pos=${s.pos} v=${s.speed} calls=${s.calls} tris=${s.tris} near=${s.near} far=${s.far} phys=${s.phys} heap=${s.heapMB}`).join('\n'));
if (errors.length) console.log('errors:', errors.slice(0, 5));
await b.close(); srv.close();
