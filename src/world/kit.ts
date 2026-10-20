// Render-only set dressing kit: storefront glass, shutters, awnings, AC units, pipes, lanterns, catenary
// cables with laundry, blade signs, steam vents and holograms. Merged per material to keep draw calls low.
import * as THREE from 'three/webgpu';
import {
  float, vec2, vec3, color, uniform, mix, smoothstep, step, fract, floor, abs, sin, clamp, length, positionWorld, positionLocal, normalWorld,
  time, attribute, mx_noise_float, mx_fractal_noise_float, uv, dot, normalize, cameraPosition, exp,
} from 'three/tsl';
import { mergeGeoms } from './build';
import { U, distFade } from '../materials/materials';

export type PropKind = 'shopwin' | 'shutter' | 'awning' | 'ac' | 'pipe' | 'lantern' | 'vent' | 'rail' | 'crate' | 'balcony' | 'warmwin';
export interface PropDef { kind: PropKind; pos: [number, number, number]; yaw: number; size: [number, number, number]; color?: string; seed?: number }
export interface CableDef { a: [number, number, number]; b: [number, number, number]; sag: number; laundry?: boolean; r?: number }
export interface SteamDef { pos: [number, number, number]; radius: number; height: number; tint?: string }
export interface HoloDef { pos: [number, number, number]; yaw: number; size: [number, number]; color: string; kind: 'koi' | 'face' | 'ad' }

function boxAt(p: PropDef, sx: number, sy: number, sz: number, ox = 0, oy = 0, oz = 0, pitch = 0) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  if (pitch) g.rotateX(pitch);
  g.translate(ox, oy, oz); g.rotateY(p.yaw); g.translate(p.pos[0], p.pos[1], p.pos[2]);
  return g;
}
const withAttrs = (g: THREE.BufferGeometry, seed = 0) => {
  const n = g.attributes.position.count;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  g.setAttribute('pseed', new THREE.BufferAttribute(new Float32Array(n).fill(seed), 1));
  if (g.index === null) { const idx: number[] = []; for (let i = 0; i < n; i++) idx.push(i); g.setIndex(idx); }
  return g;
};

// ---- materials -------------------------------------------------------------------------
/** Shop glass: warm interior glow with shelves/silhouette bands and a little parallax-free depth fake. */
function shopGlassMat() {
  const m = new THREE.MeshStandardNodeMaterial();
  const s = attribute('pseed', 'float');
  const u = uv();
  const shelves = step(0.92, fract(u.y.mul(4.0))).mul(0.6);
  const people = smoothstep(0.35, 0.3, abs(fract(u.x.mul(3.0).add(s.mul(0.37))).sub(0.5))).mul(step(u.y, float(0.55))).mul(step(0.5, fract(s.mul(3.7))));
  const hue = fract(s.mul(0.618));
  const warm = mix(mix(vec3(0.25, 0.75, 0.7), vec3(0.35, 0.5, 1.0), step(0.4, hue)), vec3(0.85, 0.35, 0.9), step(0.75, hue)); // other shops stay cool/teal/violet so Hoshi is the warm focal point
  const glow = warm.mul(float(1).sub(shelves).sub(people.mul(0.85))).mul(smoothstep(0.0, 0.6, u.y).mul(0.5).add(0.7));
  m.colorNode = vec3(0.02, 0.02, 0.025);
  m.roughnessNode = float(0.06); m.metalnessNode = float(0.3);
  m.emissiveNode = glow.mul(fract(s.mul(1.37)).mul(0.3).add(0.12));
  m.metalnessNode = float(0.0); m.roughnessNode = float(0.12);
  return m;
}
/** The one warm window (Hoshi noodle bar): brighter, amber, with steam haze rising inside. */
function warmWinMat() {
  const m = new THREE.MeshStandardNodeMaterial();
  const u = uv();
  const haze = mx_noise_float(vec3(u.x.mul(5.0), u.y.mul(3.0).sub(time.mul(0.4)), 1.3)).mul(0.5).add(0.5);
  const counter = step(u.y, float(0.3));
  const silh = smoothstep(0.12, 0.08, abs(fract(u.x.mul(2.5)).sub(0.5))).mul(step(u.y, float(0.62))).mul(step(float(0.3), u.y));
  const glow = vec3(1.0, 0.32, 0.06).mul(float(0.8).add(haze.mul(0.5))).mul(float(1).sub(silh.mul(0.95))).mul(mix(float(1), float(0.55), counter));
  m.colorNode = vec3(0.02, 0.015, 0.01); m.roughnessNode = float(0.05); m.metalnessNode = float(0.2);
  m.emissiveNode = glow.mul(0.75);
  return m;
}
function corrugated(col: number) {
  const m = new THREE.MeshStandardNodeMaterial();
  const p = positionWorld;
  const rib = sin(p.y.mul(28.0)).mul(0.5).add(0.5);
  const rust = mx_fractal_noise_float(p.mul(0.8), 3, 2.0, 0.5, 1.0).mul(0.5).add(0.5);
  m.colorNode = mix(color(col), vec3(0.18, 0.08, 0.04), rust.mul(0.5)).mul(rib.mul(0.3).add(0.7));
  m.roughnessNode = clamp(float(0.5).add(rust.mul(0.3)).sub(U.wet.mul(0.2)), 0.15, 1); m.metalnessNode = float(0.7);
  return m;
}
function canvas() {
  const m = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide });
  const s = attribute('pseed', 'float');
  const pal = [vec3(0.5, 0.05, 0.12), vec3(0.05, 0.25, 0.3), vec3(0.45, 0.25, 0.05), vec3(0.15, 0.05, 0.3)];
  const k = fract(s.mul(0.31));
  const c = mix(mix(pal[0], pal[1], step(0.25, k)), mix(pal[2], pal[3], step(0.75, k)), step(0.5, k));
  const stripe = step(0.5, fract(dot(positionWorld.xz, vec2(1, 1)).mul(1.2)));
  m.colorNode = c.mul(stripe.mul(0.35).add(0.65));
  m.roughnessNode = float(0.45); // wet canvas
  return m;
}
function plainStd(col: number, rough: number, metal: number) { const m = new THREE.MeshStandardNodeMaterial(); m.color = new THREE.Color(col); m.roughness = rough; m.metalness = metal; return m; }
function lanternMat() {
  const m = new THREE.MeshStandardNodeMaterial();
  const ribs = step(0.85, fract(positionLocal.y.mul(7.0)));
  m.colorNode = vec3(0.3, 0.02, 0.02);
  m.emissiveNode = vec3(1.0, 0.18, 0.08).mul(float(1).sub(ribs.mul(0.8))).mul(3.5);
  return m;
}
function cableMat() { const m = new THREE.MeshStandardNodeMaterial(); m.color = new THREE.Color(0x050505); m.roughness = 0.4; m.metalness = 0.2; return m; }
function clothMat() {
  const m = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide });
  const s = attribute('pseed', 'float');
  const c = mix(mix(vec3(0.5, 0.48, 0.45), vec3(0.08, 0.15, 0.35), step(0.4, s)), vec3(0.45, 0.1, 0.15), step(0.75, s));
  m.colorNode = c; m.roughnessNode = float(0.85);
  // flutter in the wind
  m.positionNode = positionLocal.add(vec3(0, 0, sin(time.mul(3.0).add(positionLocal.x.mul(2.0)).add(s.mul(9.0))).mul(0.05).mul(uv().y.oneMinus())));
  return m;
}

// Materials are created once and shared by every chunk: a new material = a new shader compile (a hitch).
let _propMats: Record<string, THREE.Material> | null = null;
function propMats() {
  return _propMats ??= {
    shopwin: shopGlassMat(), warmwin: warmWinMat(), frame: plainStd(0x16171b, 0.4, 0.6), shutter: corrugated(0x4a4d52), awning: canvas(),
    metal: corrugated(0x5a5e66), dark: plainStd(0x0c0d10, 0.6, 0.3), lantern: lanternMat(), rail: plainStd(0x22252b, 0.3, 0.9),
  };
}
let _cableMat: THREE.Material | null = null, _clothMat: THREE.Material | null = null, _steamMat: THREE.Material | null = null;

// ---- builders ---------------------------------------------------------------------------
export function buildProps(props: PropDef[]) {
  const buckets: Record<string, THREE.BufferGeometry[]> = {};
  const put = (k: string, g: THREE.BufferGeometry, seed = 0) => { (buckets[k] ??= []).push(withAttrs(g, seed)); };
  for (const p of props) {
    const [sx, sy, sz] = p.size, seed = p.seed ?? 0;
    switch (p.kind) {
      case 'shopwin': {
        const g = new THREE.PlaneGeometry(sx, sy); g.rotateY(p.yaw); g.translate(...p.pos); put('shopwin', g, seed);
        put('frame', boxAt(p, sx + 0.3, 0.25, 0.3, 0, sy / 2 + 0.1, -0.05)); put('frame', boxAt(p, 0.15, sy, 0.25, -sx / 2, 0, -0.05)); put('frame', boxAt(p, 0.15, sy, 0.25, sx / 2, 0, -0.05));
        break;
      }
      case 'warmwin': { const g = new THREE.PlaneGeometry(sx, sy); g.rotateY(p.yaw); g.translate(...p.pos); put('warmwin', g); put('frame', boxAt(p, sx + 0.4, 0.3, 0.35, 0, sy / 2 + 0.15, -0.05)); break; }
      case 'shutter': put('shutter', boxAt(p, sx, sy, 0.08)); break;
      case 'awning': put('awning', boxAt(p, sx, 0.06, sz, 0, 0, sz / 2, 0.28), seed); put('frame', boxAt(p, sx, 0.08, 0.08, 0, -0.15, sz)); break;
      case 'ac': put('metal', boxAt(p, sx, sy, sz, 0, 0, sz / 2)); put('dark', boxAt(p, sx * 0.7, sy * 0.7, 0.02, 0, 0, sz + 0.01)); break;
      case 'pipe': { const g = new THREE.CylinderGeometry(sx, sx, sy, 8); g.translate(0, 0, 0.2); g.rotateY(p.yaw); g.translate(...p.pos); put('metal', g); break; }
      case 'lantern': { const g = new THREE.SphereGeometry(sx, 12, 10); g.scale(1, 1.3, 1); g.translate(...p.pos); put('lantern', g); break; }
      case 'vent': put('metal', boxAt(p, sx, sy, sz)); break;
      case 'rail': put('rail', boxAt(p, sx, sy, sz)); break;
      case 'crate': put('dark', boxAt(p, sx, sy, sz)); break;
      case 'balcony': put('metal', boxAt(p, sx, 0.12, sz, 0, 0, sz / 2)); put('rail', boxAt(p, sx, 0.9, 0.05, 0, 0.45, sz)); break;
    }
  }
  const mats = propMats();
  const g = new THREE.Group();
  for (const [k, gs] of Object.entries(buckets)) {
    const mesh = new THREE.Mesh(mergeProps(gs), mats[k]); mesh.castShadow = k !== 'shopwin' && k !== 'warmwin'; mesh.receiveShadow = true; g.add(mesh);
  }
  return g;
}

function mergeProps(gs: THREE.BufferGeometry[]) {
  for (const g of gs) for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'pseed'].includes(n)) g.deleteAttribute(n);
  return mergeGeoms(gs);
}

/** Catenary cables (thin boxes along the curve) + optional laundry hanging from them. */
export function buildCables(cables: CableDef[]) {
  const cg: THREE.BufferGeometry[] = [], lg: THREE.BufferGeometry[] = [];
  let k = 0;
  for (const c of cables) {
    const a = new THREE.Vector3(...c.a), b = new THREE.Vector3(...c.b);
    const N = 16, pts: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) { const t = i / N; const p = a.clone().lerp(b, t); p.y -= c.sag * 4 * t * (1 - t); pts.push(p); }
    const r = c.r ?? 0.025;
    for (let i = 0; i < N; i++) {
      const p0 = pts[i], p1 = pts[i + 1], len = p0.distanceTo(p1);
      const g = new THREE.BoxGeometry(r * 2, r * 2, len);
      const m = new THREE.Matrix4().lookAt(p0, p1, new THREE.Vector3(0, 1, 0)); m.setPosition(p0.clone().add(p1).multiplyScalar(0.5));
      g.applyMatrix4(m); cg.push(withAttrs(g));
    }
    if (c.laundry) {
      const span = a.distanceTo(b);
      for (let d = 0.8; d < span - 0.8; d += 0.9 + ((k * 0.37) % 0.6)) {
        const t = d / span; const p = a.clone().lerp(b, t); p.y -= c.sag * 4 * t * (1 - t);
        const w = 0.5 + ((k * 0.61) % 0.5), h = 0.6 + ((k * 0.43) % 0.6);
        const g = new THREE.PlaneGeometry(w, h); g.translate(0, -h / 2, 0);
        g.rotateY(Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2); g.translate(p.x, p.y, p.z);
        lg.push(withAttrs(g, ((k * 0.29) % 1))); k++;
      }
    }
  }
  const grp = new THREE.Group();
  if (cg.length) grp.add(new THREE.Mesh(mergeProps(cg), _cableMat ??= cableMat()));
  if (lg.length) { const m = new THREE.Mesh(mergeProps(lg), _clothMat ??= clothMat()); m.castShadow = true; grp.add(m); }
  return grp;
}

/** Steam: camera-facing soft puffs rising and dissipating; lit by a tint (fake light pickup). */
export function buildSteam(defs: SteamDef[]) {
  const per = 26, n = defs.length * per;
  const pos = new Float32Array(n * 4 * 3), corner = new Float32Array(n * 4 * 2), seed = new Float32Array(n * 4 * 4), tint = new Float32Array(n * 4 * 3);
  const idx: number[] = [];
  let q = 0;
  for (const d of defs) {
    const col = new THREE.Color(d.tint ?? '#9fb4d8');
    for (let i = 0; i < per; i++, q++) {
      const s = [Math.random(), Math.random(), Math.random(), i / per];
      for (let k = 0; k < 4; k++) {
        const v = q * 4 + k;
        pos.set(d.pos, v * 3); corner.set([k & 1 ? 1 : -1, k >> 1 ? 1 : -1], v * 2);
        seed.set([s[0], s[1], s[2], d.radius * 10 + d.height * 0.001], v * 4); tint.set([col.r, col.g, col.b], v * 3);
      }
      idx.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4 + 1, q * 4 + 3, q * 4 + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
  g.setAttribute('sd', new THREE.BufferAttribute(seed, 4)); g.setAttribute('tint', new THREE.BufferAttribute(tint, 3)); g.setIndex(idx);
  const mesh = new THREE.Mesh(g, _steamMat ??= steamMat()); mesh.frustumCulled = false; mesh.renderOrder = 7;
  return mesh;
}

function steamMat() {
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const sd = attribute('sd', 'vec4'), cn = attribute('corner', 'vec2'), base = attribute('position', 'vec3'), tn = attribute('tint', 'vec3');
  const radius = floor(sd.w).div(10.0);
  const life = fract(time.mul(0.18).add(sd.x));
  const rise = life.mul(5.0);
  const drift = vec3(sin(sd.y.mul(6.28).add(time.mul(0.3))).mul(radius).mul(life.add(0.3)), rise, sd.z.sub(0.5).mul(radius).mul(2.0));
  const size = life.mul(2.2).add(0.6);
  const center = base.add(drift);
  // billboard: offset along camera right/up approximated from view direction
  const view = normalize(cameraPosition.sub(center));
  const right = normalize(vec3(view.z, 0, view.x.negate()));
  const up = vec3(0, 1, 0);
  m.positionNode = center.add(right.mul(cn.x.mul(size))).add(up.mul(cn.y.mul(size)));
  const r = length(cn);
  const puff = smoothstep(1.0, 0.1, r).mul(mx_noise_float(vec3(cn.mul(1.5).add(sd.xy.mul(10.0)), time.mul(0.2))).mul(0.4).add(0.6));
  const alpha = puff.mul(smoothstep(0.0, 0.15, life)).mul(float(1).sub(life)).mul(0.06);
  m.colorNode = tn.mul(alpha).mul(distFade());
  return m;
}

/** Hologram billboards: scanline emissive patterns with flicker (honours reduce-flicker). */
export function buildHolos(defs: HoloDef[]) {
  const grp = new THREE.Group();
  for (const d of defs) {
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const u = uv(), c = new THREE.Color(d.color);
    let shape;
    if (d.kind === 'koi') {
      const t = time.mul(0.6);
      const p = u.sub(0.5).mul(vec2(1.6, 1.0));
      const body = smoothstep(0.08, 0.0, abs(p.y.sub(sin(p.x.mul(6.0).add(t.mul(3.0))).mul(0.08))).sub(float(0.12).mul(float(1).sub(abs(p.x).mul(1.6)))));
      shape = body.mul(step(abs(p.x), float(0.62)));
    } else if (d.kind === 'face') {
      const p = u.sub(0.5);
      const head = smoothstep(0.32, 0.3, length(p.mul(vec2(1.3, 1.0))));
      const eyes = smoothstep(0.05, 0.03, length(vec2(abs(p.x).sub(0.1), p.y.sub(0.05))));
      shape = head.mul(0.35).add(eyes).add(smoothstep(0.31, 0.3, length(p.mul(vec2(1.3, 1.0)))).sub(smoothstep(0.29, 0.28, length(p.mul(vec2(1.3, 1.0))))).mul(2.0));
    } else {
      const bars = step(0.5, fract(u.x.mul(8.0).add(time.mul(0.5)))).mul(step(0.2, u.y)).mul(step(u.y, float(0.8)));
      shape = bars.mul(0.6).add(step(0.94, fract(u.y.mul(5.0))));
    }
    const scan = sin(u.y.mul(220.0).sub(time.mul(8.0))).mul(0.25).add(0.75);
    const fl = float(1).sub(step(0.9, mx_noise_float(vec3(time.mul(4.0), d.pos[0], 0))).mul(0.5).mul(U.flicker));
    const edge = smoothstep(0.0, 0.08, u.x).mul(smoothstep(1.0, 0.92, u.x)).mul(smoothstep(0.0, 0.08, u.y)).mul(smoothstep(1.0, 0.92, u.y));
    m.colorNode = vec3(c.r, c.g, c.b).mul(clamp(shape, 0, 2)).mul(scan).mul(fl).mul(edge).mul(3.0).mul(distFade());
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(d.size[0], d.size[1]), m);
    mesh.position.set(...d.pos); mesh.rotation.y = d.yaw; mesh.renderOrder = 6;
    grp.add(mesh);
  }
  return grp;
}
export const _k = { uniform, normalWorld, exp };
