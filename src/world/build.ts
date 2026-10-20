// Builds render meshes from a WorldDef: merges boxes per material (few draw calls), adds kerb light strips,
// neon signs (canvas textures), fake light shafts and a pooled set of real point lights.
import * as THREE from 'three/webgpu';
import { BoxDef, MatId, NeonDef, WorldDef, LightDef } from './defs';
import * as M from '../materials/materials';

export function makeMaterials(): Record<MatId, THREE.Material> {
  return {
    asphalt: M.wetGround({ base: 0.05, tint: [0.95, 0.97, 1.05], puddles: 0.52, grain: 0.18, rough: 0.9 }),
    sidewalk: M.wetGround({ base: 0.11, tint: [1, 0.98, 0.95], puddles: 0.4, grain: 0.1, rough: 0.85 }),
    deck: M.wetGround({ base: 0.08, tint: [0.95, 0.98, 1.05], puddles: 0.45, grain: 0.12, rough: 0.85 }),
    concrete: M.concrete(0x4d4f55), canalWall: M.concrete(0x34383c, 0.7), tunnel: M.concrete(0x3b3d42, 0.75),
    brick: M.facade('brick'), facade: M.facade('panel'), facadeB: M.facade('brick'), glass: M.metal(0x101418, 0.05),
    metal: M.metal(), roof: M.concrete(0x2a2b2e), grey: M.concrete(0x6a6c70), greyDark: M.concrete(0x1d1e22), hazard: M.hazard(),
    water: M.water(), neonEdge: M.emissive(0x2fdcff, 2.2), neonMag: M.emissive(0xff2aa8, 2.4),
  };
}

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(0, 0, 0, 'YXZ');

export function boxGeomFor(b: BoxDef) {
  const g = new THREE.BoxGeometry(b.h[0] * 2, b.h[1] * 2, b.h[2] * 2);
  tmpE.set(b.pitch ?? 0, b.yaw ?? 0, 0, 'YXZ'); tmpQ.setFromEuler(tmpE);
  tmpM.compose(new THREE.Vector3(...b.c), tmpQ, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(tmpM);
  const n = g.attributes.position.count;
  g.setAttribute('bseed', new THREE.BufferAttribute(new Float32Array(n).fill((b.seed ?? 0) % 1000), 1));
  g.setAttribute('blit', new THREE.BufferAttribute(new Float32Array(n).fill(b.lit ?? 0), 1));
  g.deleteAttribute('uv');
  return g;
}

export function mergeGeoms(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // minimal merge (all inputs share attribute layout + are indexed)
  const names = Object.keys(gs[0].attributes);
  let vCount = 0, iCount = 0;
  for (const g of gs) { vCount += g.attributes.position.count; iCount += g.index!.count; }
  const out = new THREE.BufferGeometry();
  for (const name of names) {
    const size = gs[0].attributes[name].itemSize;
    const arr = new Float32Array(vCount * size); let o = 0;
    for (const g of gs) { const a = g.attributes[name].array as Float32Array; arr.set(a, o); o += a.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  const idx = new Uint32Array(iCount); let io = 0, vo = 0;
  for (const g of gs) { const a = g.index!.array; for (let i = 0; i < a.length; i++) idx[io++] = a[i] + vo; vo += g.attributes.position.count; }
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}

/** Thin emissive strips along sidewalk slab edges: road edges stay readable through fog, rain and bloom. */
export function kerbStripsFor(boxes: BoxDef[]) {
  const gs: THREE.BufferGeometry[] = [];
  for (const b of boxes) {
    if (b.mat !== 'sidewalk') continue;
    const [hx, hy, hz] = b.h;
    tmpE.set(b.pitch ?? 0, b.yaw ?? 0, 0, 'YXZ'); tmpQ.setFromEuler(tmpE);
    tmpM.compose(new THREE.Vector3(...b.c), tmpQ, new THREE.Vector3(1, 1, 1));
    const add = (x: number, z: number, sx: number, sz: number) => {
      const g = new THREE.BoxGeometry(sx, 0.02, sz); g.translate(x, hy + 0.005, z); g.applyMatrix4(tmpM); g.deleteAttribute('uv'); gs.push(g);
    };
    // long edges only (the ones facing the road); short ends would stripe across the pavement
    if (hz >= hx) { add(-hx + 0.06, 0, 0.08, hz * 2); add(hx - 0.06, 0, 0.08, hz * 2); }
    else { add(0, -hz + 0.06, hx * 2, 0.08); add(0, hz - 0.06, hx * 2, 0.08); }
  }
  return gs.length ? mergeGeoms(gs) : null;
}

// ---- neon signs -----------------------------------------------------------------
function neonTexture(text: string, vertical: boolean) {
  const W = vertical ? 128 : 512, H = vertical ? 512 : 128;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const draw = (ctx: CanvasRenderingContext2D, blur: number, lw: number) => {
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = lw; ctx.shadowColor = '#fff'; ctx.shadowBlur = blur;
    ctx.lineJoin = 'round';
    ctx.strokeRect(8, 8, W - 16, H - 16);
    ctx.font = `bold ${vertical ? 78 : 86}px "Arial Black", Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (vertical) { const ch = text.slice(0, 5).split(''); ch.forEach((c, i) => ctx.strokeText(c, W / 2, 60 + i * ((H - 100) / Math.max(1, ch.length - 1 || 1)))); }
    else ctx.strokeText(text, W / 2, H / 2 + 4, W - 40);
  };
  const a = mk(), b = mk(); const ca = a.getContext('2d')!, cb = b.getContext('2d')!;
  draw(ca, 0, 4); draw(cb, 22, 10);
  const da = ca.getImageData(0, 0, W, H), db = cb.getImageData(0, 0, W, H);
  for (let i = 0; i < da.data.length; i += 4) { da.data[i + 1] = Math.min(255, db.data[i] * 0.85); da.data[i + 2] = 0; da.data[i + 3] = 255; }
  ca.putImageData(da, 0, 0);
  const t = new THREE.CanvasTexture(a); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; t.generateMipmaps = true;
  return t;
}

export function buildNeons(neons: NeonDef[]) {
  const group = new THREE.Group();
  const backs: THREE.BufferGeometry[] = [];
  neons.forEach((n, i) => {
    const tex = neonTexture(n.text, !!n.vertical);
    const mat = M.neon(tex, new THREE.Color(n.color), 7, n.flicker ?? 0, i * 1.7);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(n.size[0], n.size[1]), mat);
    mesh.position.set(...n.pos); mesh.rotation.y = n.yaw;
    mesh.translateZ(0.06);
    mesh.renderOrder = 2;
    group.add(mesh);
    const bg = new THREE.BoxGeometry(n.size[0] + 0.3, n.size[1] + 0.3, 0.12);
    bg.rotateY(n.yaw); bg.translate(n.pos[0], n.pos[1], n.pos[2]); bg.deleteAttribute('uv');
    const cnt = bg.attributes.position.count;
    bg.setAttribute('bseed', new THREE.BufferAttribute(new Float32Array(cnt), 1)); bg.setAttribute('blit', new THREE.BufferAttribute(new Float32Array(cnt), 1));
    backs.push(bg);
  });
  if (backs.length) group.add(new THREE.Mesh(mergeGeoms(backs), M.metal(0x15161a, 0.5)));
  return group;
}

/** Fake volumetric shafts under lamps. */
const coneMats = new Map<string, THREE.Material>(); // shared across chunks (no recompiles)
export function buildCones(lights: LightDef[]) {
  const group = new THREE.Group();
  const mats = coneMats;
  for (const l of lights) {
    if (!l.cone) continue;
    const len = Math.min(l.pos[1] + 0.2, 9);
    const r = Math.tan(l.cone.angle) * len;
    const g = new THREE.ConeGeometry(r, len, 24, 1, true);
    g.translate(0, -len / 2, 0); // apex at origin, opening downward
    // uv.y: 0 at apex → 1 at base (ConeGeometry uv.y is 1 at top/apex)
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    let m = mats.get(l.color);
    if (!m) { m = M.lightCone(new THREE.Color(l.color), 0.07); mats.set(l.color, m); }
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(...l.pos); mesh.renderOrder = 3;
    group.add(mesh);
  }
  return group;
}

/** Fixed-size pool of real point lights reassigned to the nearest light anchors each frame (no shader recompiles). */
export class LightPool {
  lights: THREE.PointLight[] = [];
  anchors: { pos: THREE.Vector3; color: THREE.Color; intensity: number; range: number }[] = [];
  constructor(scene: THREE.Scene, size: number, defs: LightDef[], neons: NeonDef[]) {
    for (const d of defs) this.anchors.push({ pos: new THREE.Vector3(...d.pos), color: new THREE.Color(d.color), intensity: d.intensity, range: d.range });
    for (const n of neons) if (n.light) {
      const p = new THREE.Vector3(...n.pos); p.x += Math.sin(n.yaw) * 1.2; p.z += Math.cos(n.yaw) * 1.2;
      this.anchors.push({ pos: p, color: new THREE.Color(n.color), intensity: n.light, range: 16 });
    }
    for (let i = 0; i < size; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 2); this.lights.push(l); scene.add(l); }
  }
  update(cam: THREE.Vector3) {
    const scored = this.anchors.map((a) => ({ a, s: a.intensity / (1 + a.pos.distanceToSquared(cam) / 400) }));
    scored.sort((x, y) => y.s - x.s);
    for (let i = 0; i < this.lights.length; i++) {
      const L = this.lights[i], e = scored[i];
      if (!e) { L.intensity = 0; continue; }
      L.position.copy(e.a.pos); L.color.copy(e.a.color); L.intensity = e.a.intensity; L.distance = e.a.range;
    }
  }
}

export function buildWorld(W: WorldDef, mats: Record<MatId, THREE.Material>) {
  const group = new THREE.Group();
  const byMat = new Map<MatId, THREE.BufferGeometry[]>();
  for (const b of W.boxes) {
    if (!byMat.has(b.mat)) byMat.set(b.mat, []);
    byMat.get(b.mat)!.push(boxGeomFor(b));
  }
  for (const [mat, gs] of byMat) {
    const mesh = new THREE.Mesh(mergeGeoms(gs), mats[mat]);
    mesh.receiveShadow = true; mesh.castShadow = mat !== 'asphalt' && mat !== 'water' && mat !== 'sidewalk';
    mesh.name = 'w_' + mat;
    group.add(mesh);
  }
  const kerb = kerbStripsFor(W.boxes);
  if (kerb) group.add(new THREE.Mesh(kerb, M.emissive(0x2fdcff, 1.4)));
  // tunnel light strips
  group.add(buildNeons(W.neons));
  group.add(buildCones(W.lights));
  return group;
}
