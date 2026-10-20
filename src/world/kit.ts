// Render-only set dressing kit: storefront glass, shutters, awnings, AC units, pipes, lanterns, catenary
// cables with laundry, blade signs, steam vents and holograms. Merged per material to keep draw calls low.
import * as THREE from 'three/webgpu';
import {
  float, vec2, vec3, color, uniform, mix, smoothstep, step, fract, floor, abs, sin, clamp, length, positionWorld, positionLocal, normalWorld,
  time, attribute, mx_noise_float, mx_fractal_noise_float, uv, dot, normalize, cameraPosition, exp,
} from 'three/tsl';
import { mergeGeoms } from './build';
import { U, distFade } from '../materials/materials';

export type PropKind = 'shopwin' | 'shutter' | 'awning' | 'ac' | 'pipe' | 'lantern' | 'vent' | 'rail' | 'crate' | 'balcony' | 'warmwin'
  | 'vending' | 'bin' | 'bench' | 'bollard' | 'barrier' | 'stall' | 'tramstop' | 'drain' | 'tank' | 'antenna' | 'dish' | 'signrig' | 'fireesc'
  | 'decal' | 'stool' | 'bowl' | 'jar';
/** Decal types (PropDef.seed integer part; fract = per-decal random). Ground decals lie flat; posters stand on a wall. */
export const DECAL = { dash: 0, dashY: 1, zebra: 2, grime: 4, crack: 5, poster: 6, manhole: 7 } as const;
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
  g.setAttribute('pbase', new THREE.BufferAttribute(new Float32Array(n).fill(_base), 1));
  if (g.index === null) { const idx: number[] = []; for (let i = 0; i < n; i++) idx.push(i); g.setIndex(idx); }
  return g;
};
let _base = 0;
/** Any geometry placed in a prop's local frame (x right, y up, z out of the wall / toward the street). */
function geoAt(p: PropDef, g: THREE.BufferGeometry, ox = 0, oy = 0, oz = 0, rx = 0, ry = 0, rz = 0) {
  g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(ox, oy, oz); g.rotateY(p.yaw); g.translate(p.pos[0], p.pos[1], p.pos[2]);
  return g;
}
const cyl = (r: number, h: number, seg = 8, r2 = r) => new THREE.CylinderGeometry(r2, r, h, seg);

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
  m.emissiveNode = glow.mul(0.5);
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
  m.emissiveNode = vec3(1.0, 0.18, 0.08).mul(float(1).sub(ribs.mul(0.8))).mul(2.6);
  return m;
}
/** Vending-machine / kiosk screen: bright product rows in one of four brand colours (a street light source). */
function vendMat() {
  const m = new THREE.MeshStandardNodeMaterial();
  const s = attribute('pseed', 'float'), u = uv(), k = fract(s.mul(0.618));
  const brand = mix(mix(vec3(0.3, 0.85, 1.0), vec3(1.0, 0.3, 0.7), step(0.3, k)), mix(vec3(1.0, 0.75, 0.3), vec3(0.5, 1.0, 0.6), step(0.85, k)), step(0.6, k));
  const rows = step(0.18, fract(u.y.mul(4.0))).mul(step(0.12, fract(u.x.mul(5.0))));          // product slots
  const can = smoothstep(0.5, 0.2, abs(fract(u.x.mul(5.0)).sub(0.56))).mul(step(0.3, fract(u.y.mul(4.0))));
  m.colorNode = vec3(0.02);
  m.roughnessNode = float(0.1); m.metalnessNode = float(0.0);
  m.emissiveNode = mix(vec3(0.85, 0.9, 1.0), brand, can.mul(0.85)).mul(rows.mul(0.8).add(0.2)).mul(1.6);
  return m;
}
/** All decals in one alpha-tested material (no sorting, no extra passes): worn road paint, dry patches that break
 *  up the wet reflections, cracks, manhole covers and torn wall posters. Type = floor(pseed), random = fract. */
function decalMat() {
  const m = new THREE.MeshStandardNodeMaterial({ alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const s = attribute('pseed', 'float'), t = floor(s), r = fract(s), u = uv(), pw = positionWorld;
  const is = (k: number) => step(abs(t.sub(k)), float(0.5));
  const n1 = mx_noise_float(pw.mul(vec3(2.5, 2.5, 2.5)).add(r.mul(50.0)));
  const fbm = mx_fractal_noise_float(pw.mul(0.35).add(r.mul(31.0)), 3, 2.0, 0.5, 1.0);
  // road paint: worn (noise holes), white or yellow
  const paintMask = step(-0.35, n1);
  const paintCol = mix(vec3(0.62, 0.62, 0.6), vec3(0.7, 0.48, 0.06), is(1));
  // dry / grime patch: soft blob from the uv centre, broken up by fbm
  const blob = smoothstep(0.5, 0.15, length(u.sub(0.5))).add(fbm.mul(0.6)).sub(0.25);
  // crack: thin meandering line along v
  const crack = smoothstep(0.035, 0.0, abs(u.x.sub(0.5).add(mx_noise_float(vec3(u.y.mul(6.0), r.mul(9.0), 0)).mul(0.3)))).mul(smoothstep(0.0, 0.1, u.y)).mul(smoothstep(1.0, 0.9, u.y));
  // poster: two-tone print with a big glyph block and text bars, torn bottom edge
  const pk = fract(r.mul(7.31));
  const pbg = mix(mix(vec3(0.75, 0.12, 0.2), vec3(0.08, 0.5, 0.65), step(0.33, pk)), vec3(0.85, 0.7, 0.2), step(0.7, pk));
  const glyph = step(abs(u.x.sub(0.5)), float(0.3)).mul(step(abs(u.y.sub(0.62)), float(0.22))).mul(step(0.45, fract(u.x.mul(3.0).add(u.y.mul(2.0)).add(r))));
  const bars = step(0.5, fract(u.y.mul(14.0))).mul(step(u.y, float(0.33))).mul(step(0.12, u.x)).mul(step(u.x, float(0.88))).mul(step(0.1, u.y));
  const posterCol = mix(mix(pbg, vec3(0.05, 0.04, 0.05), glyph), vec3(0.9, 0.9, 0.85), bars.mul(0.8));
  const torn = step(mx_noise_float(vec3(u.x.mul(14.0), r.mul(20.0), 0)).mul(0.08).add(0.06), u.y);
  // manhole: disc with concentric ribs
  const d = length(u.sub(0.5)), disc = step(d, float(0.48)), ribs = step(0.5, fract(d.mul(18.0)));
  const mask = paintMask.mul(is(0).add(is(1)).add(is(2))).add(step(0.0, blob).mul(is(4))).add(step(0.5, crack).mul(is(5))).add(torn.mul(is(6))).add(disc.mul(is(7)));
  m.opacityNode = clamp(mask, 0, 1);
  const col = paintCol.mul(is(0).add(is(1)).add(is(2)))
    .add(vec3(0.035, 0.034, 0.033).mul(is(4))).add(vec3(0.008).mul(is(5)))
    .add(posterCol.mul(float(1).sub(fbm.mul(0.3))).mul(is(6))).add(vec3(0.1, 0.1, 0.11).mul(ribs.mul(0.4).add(0.6)).mul(is(7)));
  m.colorNode = col.mul(mix(float(1), float(0.75), U.wet));
  // dry patches and cracks stay rough (no reflections), paint and posters get a wet sheen, metal covers glint
  m.roughnessNode = clamp(float(0.4).sub(U.wet.mul(0.25)).add(is(4).mul(0.6)).add(is(5).mul(0.5)).add(is(7).mul(-0.1)), 0.06, 1);
  m.metalnessNode = is(7).mul(0.7);
  // road paint is retroreflective: a faint glow keeps lane dashes readable at speed in the dark
  m.emissiveNode = paintCol.mul(is(0).add(is(1)).add(is(2))).mul(0.06);
  return m;
}
/** Yellow/black chevrons (barriers, bollard bands). */
function hazardMat() {
  const m = new THREE.MeshStandardNodeMaterial();
  const k = step(0.5, fract(positionWorld.x.add(positionWorld.z).add(positionWorld.y).mul(1.6)));
  m.colorNode = mix(vec3(0.02, 0.02, 0.02), vec3(0.75, 0.5, 0.04), k);
  m.roughnessNode = clamp(float(0.55).sub(U.wet.mul(0.35)), 0.12, 1); m.metalnessNode = float(0.1);
  return m;
}
/** Painted street furniture: per-prop colour from pseed (vending bodies, bins, stall frames), wet sheen, a little grime low down. */
function paintMat() {
  const m = new THREE.MeshStandardNodeMaterial();
  const s = attribute('pseed', 'float'), k = fract(s.mul(0.618));
  const c = mix(mix(vec3(0.55, 0.06, 0.12), vec3(0.06, 0.28, 0.42), step(0.3, k)), mix(vec3(0.6, 0.45, 0.08), vec3(0.12, 0.13, 0.15), step(0.8, k)), step(0.55, k));
  const grime = smoothstep(0.9, 0.0, positionWorld.y.sub(attribute('pbase', 'float'))).mul(0.5);
  m.colorNode = c.mul(float(1).sub(grime)).mul(float(1).sub(U.wet.mul(0.25)));
  m.roughnessNode = clamp(float(0.45).add(grime.mul(0.4)).sub(U.wet.mul(0.3)), 0.1, 1); m.metalnessNode = float(0.35);
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
    hazard: hazardMat(), paint: paintMat(), vend: vendMat(), decal: decalMat(),
  };
}
let _cableMat: THREE.Material | null = null, _clothMat: THREE.Material | null = null, _steamMat: THREE.Material | null = null;

// ---- builders ---------------------------------------------------------------------------
/** One tiny mesh per prop material, so compileAsync builds their shaders before play (chunks stream in later). */
export function propWarmGroup() {
  const g = new THREE.Group(), geo = new THREE.BoxGeometry(0.1, 0.1, 0.1); withAttrs(geo);
  for (const m of [...Object.values(propMats()), _cableMat ??= cableMat(), _clothMat ??= clothMat()]) g.add(new THREE.Mesh(geo, m));
  return g;
}
export function buildProps(props: PropDef[]) {
  const buckets: Record<string, THREE.BufferGeometry[]> = {};
  const put = (k: string, g: THREE.BufferGeometry, seed = 0) => { (buckets[k] ??= []).push(withAttrs(g, seed)); };
  for (const p of props) {
    const [sx, sy, sz] = p.size, seed = p.seed ?? 0;
    _base = p.pos[1];
    switch (p.kind) {
      // ---- street furniture (local frame: +z points away from the wall, toward the street) ----
      case 'vending': {
        put('paint', boxAt(p, 0.92, 1.9, 0.75, 0, 0.95, 0.375), seed);
        { const g = new THREE.PlaneGeometry(0.62, 1.1); put('vend', geoAt(p, g, -0.08, 1.2, 0.765), seed); } // lit display
        put('vend', boxAt(p, 0.04, 1.7, 0.04, 0.44, 0.95, 0.74), seed);                     // side light strip
        put('dark', boxAt(p, 0.2, 0.5, 0.03, 0.33, 1.05, 0.76)); put('dark', boxAt(p, 0.7, 0.22, 0.05, 0, 0.32, 0.76)); // coin panel, tray
        put('lantern', boxAt(p, 0.92, 0.06, 0.04, 0, 1.86, 0.76));
        break;
      }
      case 'bin': {
        put('paint', geoAt(p, cyl(0.28, 0.85, 10, 0.3), 0, 0.425, 0.35), seed); put('dark', geoAt(p, cyl(0.31, 0.06, 10), 0, 0.88, 0.35));
        break;
      }
      case 'bench': {
        for (const x of [-0.75, 0.75]) put('frame', boxAt(p, 0.06, 0.45, 0.45, x, 0.225, 0.55));
        put('dark', boxAt(p, 1.8, 0.05, 0.45, 0, 0.45, 0.55)); put('dark', boxAt(p, 1.8, 0.4, 0.05, 0, 0.7, 0.32, -0.15));
        break;
      }
      case 'bollard': { put('rail', geoAt(p, cyl(0.1, 0.9, 10), 0, 0.45, 0)); put('hazard', geoAt(p, cyl(0.105, 0.14, 10), 0, 0.72, 0)); break; }
      case 'barrier': {
        put('hazard', boxAt(p, sx, 0.32, 0.06, 0, 0.75, 0.3)); for (const x of [-sx / 2 + 0.1, sx / 2 - 0.1]) { put('rail', boxAt(p, 0.05, 0.9, 0.05, x, 0.45, 0.3)); put('rail', boxAt(p, 0.05, 0.05, 0.6, x, 0.03, 0.3)); }
        put('lantern', geoAt(p, new THREE.SphereGeometry(0.06, 8, 6), sx / 2 - 0.1, 0.97, 0.3));
        break;
      }
      case 'stall': {
        const w = sx;
        put('paint', boxAt(p, w, 0.95, 0.9, 0, 0.475, 0.75), seed); put('dark', boxAt(p, w + 0.1, 0.06, 1.0, 0, 0.98, 0.75));   // counter
        for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) put('rail', boxAt(p, 0.05, 2.4, 0.05, x, 1.2, 1.25));
        put('awning', boxAt(p, w + 0.4, 0.05, 1.7, 0, 2.45, 0.75, 0.18), seed); put('frame', boxAt(p, w + 0.4, 0.12, 0.05, 0, 2.3, 1.6));
        for (let i = 0; i < 3; i++) put('dark', boxAt(p, 0.35, 0.18, 0.28, -w / 2 + 0.4 + i * (w - 0.8) / 2, 1.1, 0.75));
        put('lantern', geoAt(p, new THREE.SphereGeometry(0.16, 10, 8).scale(1, 1.3, 1), w / 2 - 0.3, 2.05, 1.45));
        put('lantern', geoAt(p, new THREE.SphereGeometry(0.16, 10, 8).scale(1, 1.3, 1), -w / 2 + 0.3, 2.05, 1.45));
        break;
      }
      case 'tramstop': {
        const w = sx;
        for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) put('frame', boxAt(p, 0.1, 2.6, 0.1, x, 1.3, 0.2));
        put('frame', boxAt(p, w, 0.08, 1.7, 0, 2.62, 0.75, -0.08)); put('shopwin', boxAt(p, w - 0.3, 0.02, 1.5, 0, 2.58, 0.75, -0.08), seed);
        put('shopwin', boxAt(p, 1.2, 1.8, 0.04, -w / 2 + 0.9, 1.3, 0.12), seed + 0.3);           // lit ad panel
        put('dark', boxAt(p, w - 1.8, 0.05, 0.4, 0.6, 0.45, 0.4)); put('frame', boxAt(p, 0.06, 0.45, 0.4, 0.6 - (w - 1.8) / 2, 0.225, 0.4)); put('frame', boxAt(p, 0.06, 0.45, 0.4, 0.6 + (w - 1.8) / 2, 0.225, 0.4));
        put('lantern', boxAt(p, w * 0.6, 0.18, 0.06, 0, 2.85, 1.55));
        break;
      }
      case 'drain': { put('rail', geoAt(p, cyl(0.07, sy, 8), 0, sy / 2, 0.12)); for (let y = 2; y < sy; y += 3) put('rail', boxAt(p, 0.2, 0.06, 0.16, 0, y, 0.06)); break; }
      case 'tank': {
        put('metal', geoAt(p, cyl(sx, sx * 1.4, 14), 0, 1.2 + sx * 0.7, 0)); put('frame', geoAt(p, new THREE.ConeGeometry(sx * 1.05, 0.5, 14), 0, 1.45 + sx * 1.4, 0));
        for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put('rail', boxAt(p, 0.1, 1.2, 0.1, x * sx * 0.6, 0.6, z * sx * 0.6));
        break;
      }
      case 'antenna': {
        put('rail', geoAt(p, cyl(0.04, sy, 6, 0.02), 0, sy / 2, 0)); for (let y = sy * 0.5; y < sy; y += sy * 0.18) put('rail', boxAt(p, 1.2 * (1 - y / sy) + 0.2, 0.03, 0.03, 0, y, 0));
        put('lantern', geoAt(p, new THREE.SphereGeometry(0.09, 6, 5), 0, sy + 0.05, 0));                 // aircraft warning light
        break;
      }
      case 'dish': {
        const g = new THREE.SphereGeometry(sx, 14, 6, 0, Math.PI * 2, 0, 0.9); put('frame', geoAt(p, g, 0, sx * 1.3, 0, -1.0)); put('rail', geoAt(p, cyl(0.06, sx * 1.3, 6), 0, sx * 0.65, 0));
        break;
      }
      case 'signrig': { // scaffold frame on a roof edge carrying a big lit panel
        for (const x of [-sx / 2, sx / 2]) put('rail', boxAt(p, 0.12, sy + 1.5, 0.12, x, (sy + 1.5) / 2, -0.4));
        for (let y = 0.6; y < sy + 1.5; y += 1.4) put('rail', boxAt(p, sx, 0.06, 0.06, 0, y, -0.4));
        put('shopwin', boxAt(p, sx - 0.2, sy, 0.05, 0, 1.5 + sy / 2 - 0.2, 0.0), seed); put('frame', boxAt(p, sx, 0.15, 0.25, 0, 1.4, 0.0));
        break;
      }
      case 'stool': { put('rail', geoAt(p, cyl(0.03, 0.7, 8), 0, 0.35, 0)); put('rail', geoAt(p, cyl(0.16, 0.02, 12), 0, 0.02, 0)); put('paint', geoAt(p, cyl(0.19, 0.07, 14, 0.2), 0, 0.73, 0), seed); break; }
      case 'bowl': { const g = new THREE.LatheGeometry([new THREE.Vector2(0.04, 0), new THREE.Vector2(0.09, 0.02), new THREE.Vector2(0.12, 0.08), new THREE.Vector2(0.115, 0.085), new THREE.Vector2(0.0, 0.07)], 14); put('paint', geoAt(p, g, 0, 0, 0), seed); break; }
      case 'jar': { put('paint', geoAt(p, cyl(sx, sy, 10), 0, sy / 2, 0), seed); put('dark', geoAt(p, cyl(sx * 0.7, 0.03, 10), 0, sy + 0.015, 0)); break; }
      case 'decal': { // size: [width, length, vertical?]; flat decals are lifted 1 cm, posters 3 cm off the wall
        const g = new THREE.PlaneGeometry(sx, sy);
        if (sz) put('decal', geoAt(p, g, 0, 0, 0.03), seed); else put('decal', geoAt(p, g, 0, 0.012, 0, -Math.PI / 2), seed);
        break;
      }
      case 'fireesc': { // zig-zag fire escape: landings + rails + diagonal stairs, sx wide, sy tall, sz deep
        for (let y = 3; y < sy; y += 3) {
          put('metal', boxAt(p, sx, 0.06, sz, 0, y, sz / 2)); put('rail', boxAt(p, sx, 0.05, 0.04, 0, y + 0.95, sz)); put('rail', boxAt(p, 0.04, 0.95, 0.04, -sx / 2, y + 0.47, sz)); put('rail', boxAt(p, 0.04, 0.95, 0.04, sx / 2, y + 0.47, sz));
          if (y + 3 < sy) { const L = Math.hypot(sx * 0.7, 3); const g = new THREE.BoxGeometry(L, 0.05, sz * 0.5); g.rotateZ(((y / 3) % 2 ? 1 : -1) * Math.atan2(3, sx * 0.7)); put('rail', geoAt(p, g, 0, y + 1.5, sz * 0.35)); }
        }
        break;
      }
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
    const mesh = new THREE.Mesh(mergeProps(gs), mats[k]); mesh.castShadow = k !== 'shopwin' && k !== 'warmwin' && k !== 'decal'; mesh.receiveShadow = true; g.add(mesh);
  }
  return g;
}

function mergeProps(gs: THREE.BufferGeometry[]) {
  for (const g of gs) for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'pseed', 'pbase'].includes(n)) g.deleteAttribute(n);
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
/** Holograms: one shared material per kind (colour + flicker seed are per-object uniforms), so every
 *  hologram of a kind reuses one GPU program. */
const _holoMats = new Map<string, THREE.Material>();
function holoMat(kind: HoloDef['kind']) {
  const hit = _holoMats.get(kind); if (hit) return hit;
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, forceSinglePass: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const col = uniform(new THREE.Color()).onObjectUpdate((f: any) => f.object.userData.holoCol);
  const seed = uniform(0).onObjectUpdate((f: any) => f.object.userData.holoSeed);
  const u = uv();
  let shape;
  if (kind === 'koi') {
    const t = time.mul(0.6);
    const p = u.sub(0.5).mul(vec2(1.6, 1.0));
    const body = smoothstep(0.08, 0.0, abs(p.y.sub(sin(p.x.mul(6.0).add(t.mul(3.0))).mul(0.08))).sub(float(0.12).mul(float(1).sub(abs(p.x).mul(1.6)))));
    shape = body.mul(step(abs(p.x), float(0.62)));
  } else if (kind === 'face') {
    const p = u.sub(0.5);
    const head = smoothstep(0.32, 0.3, length(p.mul(vec2(1.3, 1.0))));
    const eyes = smoothstep(0.05, 0.03, length(vec2(abs(p.x).sub(0.1), p.y.sub(0.05))));
    shape = head.mul(0.35).add(eyes).add(smoothstep(0.31, 0.3, length(p.mul(vec2(1.3, 1.0)))).sub(smoothstep(0.29, 0.28, length(p.mul(vec2(1.3, 1.0))))).mul(2.0));
  } else {
    const bars = step(0.5, fract(u.x.mul(8.0).add(time.mul(0.5)))).mul(step(0.2, u.y)).mul(step(u.y, float(0.8)));
    shape = bars.mul(0.6).add(step(0.94, fract(u.y.mul(5.0))));
  }
  const scan = sin(u.y.mul(220.0).sub(time.mul(8.0))).mul(0.25).add(0.75);
  const rnd = fract(sin(floor(time.mul(4.0)).add(seed).mul(12.9898)).mul(43758.5453)); // cheap per-holo flicker
  const fl = float(1).sub(step(0.9, rnd).mul(0.5).mul(U.flicker));
  const edge = smoothstep(0.0, 0.08, u.x).mul(smoothstep(1.0, 0.92, u.x)).mul(smoothstep(0.0, 0.08, u.y)).mul(smoothstep(1.0, 0.92, u.y));
  m.colorNode = col.mul(clamp(shape, 0, 2)).mul(scan).mul(fl).mul(edge).mul(3.0).mul(distFade());
  _holoMats.set(kind, m);
  return m;
}
export function buildHolos(defs: HoloDef[]) {
  const grp = new THREE.Group();
  for (const d of defs) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(d.size[0], d.size[1]), holoMat(d.kind));
    mesh.userData.holoCol = new THREE.Color(d.color); mesh.userData.holoSeed = d.pos[0] * 0.37 + d.pos[2] * 0.11;
    mesh.position.set(...d.pos); mesh.rotation.y = d.yaw; mesh.renderOrder = 6;
    grp.add(mesh);
  }
  return grp;
}
export const _k = { uniform, normalWorld, exp };
