// Reference shots for the LOOK GATE. URL `?shot=<id>` frames a shot; the pause-menu button renders all seven
// on the player's own GPU and downloads them as a zip of PNGs.
import type { Game } from '../main';
import { Bot } from '../bot/bot';

export interface ShotDef {
  title: string; time: number; rain?: number;
  cam?: { pos: [number, number, number]; look: [number, number, number]; fov?: number };
  bike?: { pos: [number, number, number]; yaw: number; speed?: number };
  bot?: { pts: [number, number][]; hops?: [number, number][] };
  warm: number; // frames to settle (TRAA history)
  warmSec?: number; // motion shots: seconds of driving before capture
}

// Grey-box (M1) framings, used with ?world=test.
export const TEST_SHOTS: Record<string, ShotDef> = {
  '1': { title: 'Wide street, dusk', time: 19.7, cam: { pos: [-150, 9, 176], look: [-60, 4, 181], fov: 55 }, bike: { pos: [-128, 1, 181], yaw: -Math.PI / 2 }, warm: 30 },
  '2': { title: 'Wide street, deep night', time: 23.6, cam: { pos: [-150, 9, 176], look: [-60, 4, 181], fov: 55 }, bike: { pos: [-128, 1, 181], yaw: -Math.PI / 2 }, warm: 30 },
  '3': { title: 'Steamy alley', time: 23.6, cam: { pos: [-74, 1.8, 96], look: [-40, 2.5, 90], fov: 52 }, bike: { pos: [-64, 1, 91], yaw: -Math.PI / 2 }, warm: 30 },
  '4': { title: 'Wet-road neon reflection', time: 23.6, cam: { pos: [-40, 0.55, 180], look: [-20, 0.9, 176], fov: 50 }, bike: { pos: [-30, 1, 183], yaw: -Math.PI / 2 }, warm: 30 },
  '5': { title: 'Storefront window glow', time: 23.6, cam: { pos: [12, 2.2, 182], look: [22, 5, 192], fov: 50 }, bike: { pos: [16, 1, 182], yaw: -Math.PI / 2 }, warm: 30 },
  '6': { title: 'Elevated lane at speed', time: 23.6, bike: { pos: [-60, 11, -90], yaw: -Math.PI / 2, speed: 30 }, bot: { pts: [[-60, -90], [100, -90], [180, -90]], hops: [[17, -90]] }, warm: 70 },
  '7': { title: 'Underpass at speed', time: 23.6, bike: { pos: [-110, 1, 90], yaw: -Math.PI / 2, speed: 28 }, bot: { pts: [[-110, 90], [80, 90], [180, 90]] }, warm: 90 },
};

const A = -35 * Math.PI / 180;
// Look-slice framings (Hoshi Street).
export const SLICE_SHOTS: Record<string, ShotDef> = {
  '1': { title: 'Wide street, dusk', time: 19.8, cam: { pos: [3, 6.5, 122], look: [-2, 6, 45], fov: 58 }, bike: { pos: [1.5, 1, 99], yaw: 0 }, warm: 30 },
  '2': { title: 'Wide street, deep night', time: 23.6, cam: { pos: [3, 6.5, 122], look: [-2, 6, 45], fov: 58 }, bike: { pos: [1.5, 1, 99], yaw: 0 }, warm: 30 },
  '3': { title: 'Steamy alley', time: 23.6, cam: { pos: [-13, 1.8, 41.5], look: [-60, 4.5, 39.5], fov: 55 }, bike: { pos: [-25, 1, 40], yaw: Math.PI / 2 }, warm: 30 },
  '4': { title: 'Wet-road neon reflection', time: 23.6, cam: { pos: [-3.5, 0.45, 76], look: [-1, 1.6, 52], fov: 50 }, bike: { pos: [2.5, 1, 66], yaw: 0.15 }, warm: 30 },
  '5': { title: 'Storefront window glow', time: 23.6, cam: { pos: [3.5, 1.9, 67], look: [-10, 2.6, 58.5], fov: 50 }, bike: { pos: [-3.2, 1, 61.5], yaw: 0.5 }, warm: 30 },
  '6': { title: 'Elevated lane at speed', time: 23.6, bike: { pos: [35, 11, 50], yaw: 0, speed: 30 }, bot: { pts: [[35, 50], [35, -96], [35, -140]] }, warm: 12, warmSec: 1.6 },
  '7': { title: 'Underpass at speed', time: 23.6, bike: { pos: [12.5, 1, -33], yaw: A, speed: 26 }, bot: { pts: [[12.5, -33], [60.7, -102.4], [70, -115]] }, warm: 12, warmSec: 1.45 },
  '8': { title: 'Stacks street life (extra)', time: 23.6, cam: { pos: [-121, 2.2, 228], look: [-60, 6, 214], fov: 55 }, bike: { pos: [-112, 1, 222], yaw: -Math.PI / 2 }, warm: 30 },
};
export const SHOTS = new Proxy({} as Record<string, ShotDef>, {
  get: (_t, k: string) => ((window as any).__NC_WORLD === 'test' ? TEST_SHOTS : SLICE_SHOTS)[k],
  ownKeys: () => Object.keys(SLICE_SHOTS), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

const wait = (n: number, g: Game) => new Promise<void>((res) => { const f0 = g.frameCount(); const tick = () => (g.frameCount() - f0 >= n ? res() : requestAnimationFrame(tick)); tick(); });

export async function setupShot(g: Game, id: string) {
  const s = SHOTS[id]; if (!s) return;
  (window as any).__SHOT_READY = false;
  g.setTime(s.time); g.setRain(new URLSearchParams(location.search).has('rain') ? +new URLSearchParams(location.search).get('rain')! : s.rain ?? 1); g.hud(false);
  g.setBot(null); g.releaseCam();
  if (s.bike) g.physics.teleport(s.bike.pos[0], s.bike.pos[1], s.bike.pos[2], s.bike.yaw, s.bike.speed ?? 0);
  let cam = s.cam;
  const h = g.world.anchors.hoshi;
  if (id === '5' && h && (window as any).__NC_WORLD !== 'test') { // frame the noodle bar wherever the layout put it
    const nx = Math.sin(h.yaw), nz = Math.cos(h.yaw);
    cam = { pos: [h.pos[0] + nx * 12 + nz * 7, 1.9, h.pos[2] + nz * 12 - nx * 7], look: [h.pos[0], 2.6, h.pos[2]], fov: 50 };
    g.physics.teleport(h.pos[0] + nx * 6.5, 1, h.pos[2] + nz * 6.5 + 3, 0.5);
  }
  if (cam) g.freezeCam(cam.pos, cam.look, cam.fov);
  if (s.bot) g.setBot(new Bot({ pts: s.bot.pts, hops: s.bot.hops, useDrift: false }));
  const t0 = performance.now();
  await wait(s.warm, g);
  while (s.warmSec && performance.now() - t0 < s.warmSec * 1000) await wait(1, g);
  (window as any).__SHOT_READY = true;
}

// ---- tiny store-only zip writer ------------------------------------------------------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (d: Uint8Array) => { let c = 0xffffffff; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function zip(files: { name: string; data: Uint8Array }[]) {
  const parts: Uint8Array[] = [], central: Uint8Array[] = []; let off = 0;
  for (const f of files) {
    const nm = new TextEncoder().encode(f.name), crc = crc32(f.data);
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint32(14, crc, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, f.data);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + f.data.length;
  }
  const csize = central.reduce((a, b) => a + b.length, 0);
  const e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)] as BlobPart[], { type: 'application/zip' });
}

export async function captureCanvas(g: Game): Promise<Uint8Array> {
  g.renderFrame();
  const blob: Blob = await new Promise((res) => g.renderer.domElement.toBlob((b) => res(b!), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

export async function saveReferenceShots(g: Game) {
  const files: { name: string; data: Uint8Array }[] = [];
  const st = g.state();
  for (const id of Object.keys(SHOTS)) {
    await setupShot(g, id);
    files.push({ name: `shot${id}-${SHOTS[id].title.replace(/\W+/g, '_')}.png`, data: await captureCanvas(g) });
  }
  files.push({ name: 'stats.json', data: new TextEncoder().encode(JSON.stringify({ ...g.stats(), ua: navigator.userAgent, when: new Date().toISOString() }, null, 1)) });
  g.setBot(null); g.releaseCam(); g.hud(true); g.setTime(23.5);
  g.physics.teleport(st.x, st.y, st.z, st.yaw);
  const blob = zip(files), filename = 'night-courier-reference-shots.zip';
  // hosted (claude.ai artifact): the viewer's downloads capability; offline file: a plain download link
  const dl = await (window as any).claude?.use?.('downloads').catch(() => null);
  if (dl) { try { await dl.save({ filename, data: blob }); } catch (e) { console.warn('save declined', e); } return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
