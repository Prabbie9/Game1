// Delivery test: WebGPU / WebGL2 detection, worker + Rapier WASM, 10MB binary fetch, FPS counter.
import RapierWorker from './worker.ts?worker&inline';
const results: Record<string, string> = {};
const ul = document.getElementById('r')!;
function report(name: string, ok: boolean, detail: string) {
  results[name] = (ok ? 'OK ' : 'FAIL ') + detail;
  const li = document.createElement('li'); li.className = ok ? 'ok' : 'bad';
  li.textContent = `${ok ? 'PASS' : 'FAIL'}  ${name}: ${detail}`; ul.appendChild(li);
  (window as any).__DELIVERY = results;
}
async function run() {
  // WebGPU
  try {
    const gpu = (navigator as any).gpu;
    if (!gpu) report('webgpu', false, 'navigator.gpu missing');
    else { const a = await gpu.requestAdapter(); report('webgpu', !!a, a ? 'adapter available' : 'no adapter'); }
  } catch (e) { report('webgpu', false, String(e)); }
  // WebGL2
  const gl = (document.getElementById('c') as HTMLCanvasElement).getContext('webgl2');
  if (gl) {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    report('webgl2', true, dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'context ok');
    let t = 0; const loop = () => { t += 0.02; gl.clearColor(0.5 + 0.5 * Math.sin(t), 0.1, 0.4, 1); gl.clear(gl.COLOR_BUFFER_BIT); requestAnimationFrame(loop); }; loop();
  } else report('webgl2', false, 'no context');
  // Worker + Rapier WASM
  await new Promise<void>((res) => {
    const w = new RapierWorker();
    const to = setTimeout(() => { report('worker+rapier', false, 'timeout'); res(); }, 20000);
    w.onmessage = (e) => { clearTimeout(to); report('worker+rapier', e.data.ok, e.data.detail); res(); };
    w.onerror = (e) => { clearTimeout(to); report('worker+rapier', false, 'worker error ' + e.message); res(); };
  });
  // 10MB binary asset
  try {
    const t0 = performance.now();
    const r = await fetch('./blob10mb.wasm');
    const buf = await r.arrayBuffer(); const u8 = new Uint8Array(buf);
    let sum = 0; for (let i = 0; i < u8.length; i += 4096) sum = (sum + u8[i]) | 0;
    report('binary-10mb', buf.byteLength === 10 * 1024 * 1024, `${(buf.byteLength / 1048576).toFixed(1)}MB in ${(performance.now() - t0).toFixed(0)}ms checksum ${sum}`);
  } catch (e) { report('binary-10mb', false, String(e)); }
  report('done', true, 'all tests finished');
}
// FPS counter
let frames = 0, last = performance.now();
const fpsEl = document.getElementById('fps')!;
function tick() { frames++; const now = performance.now(); if (now - last > 1000) { fpsEl.textContent = `${Math.round(frames * 1000 / (now - last))} fps`; (window as any).__FPS = frames * 1000 / (now - last); frames = 0; last = now; } requestAnimationFrame(tick); }
tick(); run();
