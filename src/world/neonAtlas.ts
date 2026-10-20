// Neon sign atlas: every sign word is drawn once into one canvas (R = tube core, G = glow halo); signs in a
// chunk merge into one mesh with per-vertex colour + flicker → one draw call and one shader for all signs.
import * as THREE from 'three/webgpu';
import { attribute, texture, uv, vec3, float, step, clamp, mx_noise_float, DoubleSide } from './tslShim';
import { U, distFade } from '../materials/materials';
import type { NeonDef } from './defs';
import { mergeGeoms } from './build';

const AW = 2048, AH = 2048;
let canvas: HTMLCanvasElement | null = null, tex: THREE.CanvasTexture | null = null;
const slots = new Map<string, [number, number, number, number]>(); // key → u0 v0 u1 v1
let nextH = 0, nextV = 0;

function draw(ctx: CanvasRenderingContext2D, x: number, y: number, W: number, H: number, text: string, vertical: boolean) {
  const pass = (blur: number, lw: number) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.strokeStyle = '#fff'; g.lineWidth = lw; g.shadowColor = '#fff'; g.shadowBlur = blur; g.lineJoin = 'round';
    if (!text) { g.beginPath(); g.moveTo(10, H / 2); g.lineTo(W - 10, H / 2); g.stroke(); return g.getImageData(0, 0, W, H); }
    g.strokeRect(8, 8, W - 16, H - 16);
    g.font = `bold ${vertical ? 78 : 86}px "Arial Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (vertical) { const ch = text.slice(0, 6).split(''); ch.forEach((cc, i) => g.strokeText(cc, W / 2, 62 + i * ((H - 104) / Math.max(1, ch.length - 1)))); }
    else g.strokeText(text, W / 2, H / 2 + 4, W - 40);
    return g.getImageData(0, 0, W, H);
  };
  const a = pass(0, 4), b = pass(22, 10);
  for (let i = 0; i < a.data.length; i += 4) { a.data[i + 1] = Math.min(255, b.data[i] * 0.85); a.data[i + 2] = 0; a.data[i + 3] = 255; }
  ctx.putImageData(a, x, y);
}

function slot(text: string, vertical: boolean): [number, number, number, number] {
  const key = (vertical ? 'v:' : 'h:') + text;
  const hit = slots.get(key); if (hit) return hit;
  if (!canvas) { canvas = document.createElement('canvas'); canvas.width = AW; canvas.height = AH; const c = canvas.getContext('2d')!; c.fillStyle = '#000'; c.fillRect(0, 0, AW, AH); }
  const ctx = canvas.getContext('2d')!;
  let r: [number, number, number, number];
  if (!vertical && nextH < 32) { const i = nextH++, x = (i % 4) * 512, y = Math.floor(i / 4) * 128; draw(ctx, x, y, 512, 128, text, false); r = [x / AW, 1 - (y + 128) / AH, (x + 512) / AW, 1 - y / AH]; }
  else if (vertical && nextV < 32) { const i = nextV++, x = (i % 16) * 128, y = 1024 + Math.floor(i / 16) * 512; draw(ctx, x, y, 128, 512, text, true); r = [x / AW, 1 - (y + 512) / AH, (x + 128) / AW, 1 - y / AH]; }
  else r = slots.values().next().value!; // atlas full: reuse the first sign (never happens with the authored word list)
  slots.set(key, r);
  if (tex) tex.needsUpdate = true;
  return r;
}

let material: THREE.Material | null = null;
function neonMaterial() {
  if (material) return material;
  tex = new THREE.CanvasTexture(canvas!); tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 4;
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, fog: false, blending: THREE.AdditiveBlending });
  const s = texture(tex, uv());
  const col = attribute('ncol', 'vec3'), fl = attribute('nflick', 'float');
  const flick = float(1).sub(step(0.82, mx_noise_float(vec3(U.time.mul(9.0), fl.mul(37.0), 0))).mul(step(0.01, fl)).mul(U.flicker).mul(0.85));
  m.colorNode = col.mul(s.r.mul(7.0).add(s.g.mul(0.9))).mul(flick).mul(U.neonGain).mul(distFade());
  m.opacityNode = clamp(s.r.add(s.g), 0, 1);
  material = m;
  return m;
}

/** Merged sign faces + one merged backing-panel geometry for a set of neon defs. */
export function buildNeonMesh(neons: NeonDef[], backMat: THREE.Material) {
  const faces: THREE.BufferGeometry[] = [], backs: THREE.BufferGeometry[] = [];
  neons.forEach((n, i) => {
    const [u0, v0, u1, v1] = slot(n.text, !!n.vertical);
    const g = new THREE.PlaneGeometry(n.size[0], n.size[1]);
    const uvA = g.attributes.uv; for (let k = 0; k < uvA.count; k++) uvA.setXY(k, uvA.getX(k) ? u1 : u0, uvA.getY(k) ? v1 : v0);
    g.translate(0, 0, 0.07); g.rotateY(n.yaw); g.translate(...n.pos);
    const c = new THREE.Color(n.color), cnt = g.attributes.position.count;
    const ca = new Float32Array(cnt * 3); for (let k = 0; k < cnt; k++) ca.set([c.r, c.g, c.b], k * 3);
    g.setAttribute('ncol', new THREE.BufferAttribute(ca, 3));
    g.setAttribute('nflick', new THREE.BufferAttribute(new Float32Array(cnt).fill(n.flicker ? (i % 7 + 1) / 8 : 0), 1));
    faces.push(g);
    if (n.text) {
      const b = new THREE.BoxGeometry(n.size[0] + 0.3, n.size[1] + 0.3, 0.12); b.rotateY(n.yaw); b.translate(...n.pos); b.deleteAttribute('uv');
      const bc = b.attributes.position.count;
      b.setAttribute('bseed', new THREE.BufferAttribute(new Float32Array(bc), 1)); b.setAttribute('blit', new THREE.BufferAttribute(new Float32Array(bc), 1));
      backs.push(b);
    }
  });
  const grp = new THREE.Group();
  if (faces.length) { const m = new THREE.Mesh(mergeGeoms(faces), neonMaterial()); m.renderOrder = 2; grp.add(m); }
  if (backs.length) grp.add(new THREE.Mesh(mergeGeoms(backs), backMat));
  return grp;
}
