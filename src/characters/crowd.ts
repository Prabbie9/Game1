// Crowds with real skinned humans and an LOD ladder:
//   NEAR  (< ~25 m, nearest N): pooled full skinned Heroes (LOD0 mesh, live skeleton, synced to the crowd clock)
//   MID   (< 80 m): one instanced mesh of the simplified LOD1 body, animated by a vertex-animation texture (VAT)
//                   baked at load from the same clips (walk / idle / talk / jog)
//   FAR   (< 300 m): instanced billboard silhouettes + glowing umbrella caps
// Positions are computed on the CPU each frame (cheap), so each tier only draws what is near and in view.
// @ts-nocheck -- TSL node typings are too narrow for instanced swizzles; checked at runtime
import * as THREE from 'three/webgpu';
import {
  attribute, instancedDynamicBufferAttribute, textureLoad, ivec2, int, float, vec3, vec4, vertexIndex, mix, uniform, uniformArray,
  varying, transformNormalToView, positionLocal, smoothstep, length, vec2, uv, step, abs, fract, cameraPosition, normalize, cross, atan, cos, sin,
} from 'three/tsl';
import { Hero, LAYER, OUTFITS, characterMaterial, makeBones, type HumanData, type Outfit } from './humans';
import { distFade } from '../materials/materials';
import type { WalkSeg } from '../crowds/crowds';

const CLIPS = [['Walk_Loop', 0], ['Idle_Loop', 1], ['Idle_Talking_Loop', 2], ['Jog_Fwd_Loop', 3]] as const;
const W = 1024;

// crowd outfits: layer masks + palettes (indexable from the shader)
const V = LAYER;
const MASKS = [
  [V.SKIN, V.SUIT, V.COAT, V.HOOD, V.TROUSERS, V.BOOTS],          // raincoat + hood
  [V.SKIN, V.SUIT, V.JACKET, V.HAIR, V.TROUSERS, V.BOOTS],        // techwear jacket
  [V.SKIN, V.SUIT, V.COAT, V.HAIR, V.BOOTS],                      // long coat
  [V.SKIN, V.SUIT, V.APRON, V.HAIR, V.TROUSERS, V.BOOTS],         // vendor / cook
  [V.SKIN, V.SUIT, V.JACKET, V.HELMET, V.VISOR, V.TROUSERS, V.BOOTS, V.BAG], // courier
  [V.SKIN, V.SUIT, V.HAIR, V.TROUSERS, V.BOOTS],                  // bodysuit
  [V.SKIN, V.SUIT, V.JACKET, V.HOOD, V.TROUSERS, V.BOOTS, V.BAG], // hooded runner
  [V.SKIN, V.SUIT, V.COAT, V.HELMET, V.VISOR, V.BOOTS],           // visor coat
].map((ls) => ls.reduce((m, l) => m | (1 << l), 0));
const PAL: number[][] = [ // per palette: coat/jacket, suit, trousers, hair, boots, apron, accent, skin
  [0x2a2f3a, 0x15171c, 0x1e2026, 0x1a1210, 0x0c0c0e, 0xcfc6b4, 0xff2aa8, 0xc9906c],
  [0x4a1424, 0x1a1418, 0x24202a, 0x0e0c0c, 0x111014, 0xd8cdb8, 0x19e6ff, 0x8a5a3c],
  [0x1f4a58, 0x101820, 0x1c2024, 0x5a3a20, 0x0e0e10, 0xbfb6a0, 0xffa142, 0xe0b394],
  [0x3a3a3c, 0x202022, 0x16161a, 0xb8b4ae, 0x0b0b0c, 0xdad2c0, 0x4dff9a, 0x6e4a36],
  [0x5a3a1a, 0x2a1e14, 0x241c16, 0x241612, 0x120e0c, 0xe0d4bc, 0xffd28a, 0xd8a88a],
  [0x16241e, 0x101410, 0x1a1e1a, 0x0a0a0a, 0x0a0c0a, 0xc8c0aa, 0xb84dff, 0xa87454],
  [0x6a6458, 0x2a2824, 0x303034, 0x302010, 0x141414, 0xd0c8b0, 0xff3b5c, 0xc49272],
  [0x101012, 0x0c0c0e, 0x141418, 0xff2aa8, 0x08080a, 0xd8d0c0, 0x19e6ff, 0xe8c0a0],
];
function layerColors(p: number[]) {
  const c = Array.from({ length: 12 }, () => p[1]);
  c[V.COAT] = p[0]; c[V.JACKET] = p[0]; c[V.HOOD] = p[0]; c[V.SUIT] = p[1]; c[V.TROUSERS] = p[2]; c[V.HAIR] = p[3]; c[V.BOOTS] = p[4]; c[V.APRON] = p[5];
  c[V.HELMET] = 0x0c0d12; c[V.BAG] = 0x5a2414; c[V.VISOR] = 0; c[V.SKIN] = p[7];
  return c;
}

interface Person { seg: WalkSeg; len: number; phase: number; speed: number; lat: number; mode: number; variant: number; pal: number; umb: number; yaw0: number;
  x: number; y: number; z: number; yaw: number; d: number; clipT: number }

export class HumanCrowd {
  group = new THREE.Group();
  people: Person[] = [];
  private mid!: THREE.InstancedMesh; private far!: THREE.InstancedMesh; private umbs!: THREE.InstancedMesh;
  private midA!: THREE.InstancedBufferAttribute; private midB!: THREE.InstancedBufferAttribute;
  private farA!: THREE.InstancedBufferAttribute; private umbA!: THREE.InstancedBufferAttribute;
  private pool: { hero: Hero; person: Person | null; u: any }[] = [];
  private clipInfo: { start: number; len: number; dur: number }[] = [];
  private rows = 1;
  midR = 80; farR = 300; nearR = 25;
  /** false (Low tier): no VAT band at all — pooled heroes up close, silhouettes beyond (its first draw is very slow on weak GPUs) */
  vat = true;
  stats = { near: 0, mid: 0, far: 0 };
  /** VAT position / normal textures (uploaded one per task before the first frame, see main.ts) */
  vatTex: THREE.DataTexture[] = [];

  constructor(private data: HumanData, segs: WalkSeg[], density: number, poolSize: number, private vatFps = 15, seed = 7, heroLod: 0 | 1 = 0) {
    let s = seed; const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (const g of segs) {
      const len = Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]);
      const n = Math.floor(len * density * (0.6 + R() * 0.8));
      for (let i = 0; i < n; i++) {
        const standing = R() < 0.18;
        this.people.push({ seg: g, len: Math.max(0.01, len), phase: R(), speed: 1.0 + R() * 0.6, lat: (R() - 0.5) * 1.6, mode: standing ? (R() < 0.5 ? 1 : 2) : (R() < 0.08 ? 3 : 0),
          variant: Math.floor(R() * MASKS.length), pal: Math.floor(R() * PAL.length), umb: R() < 0.35 ? 1 : 0, yaw0: R() * Math.PI * 2, x: 0, y: 0, z: 0, yaw: 0, d: 1e9, clipT: R() * 10 });
      }
    }
    for (let i = 0; i < poolSize; i++) {
      const hero = new Hero(data, OUTFITS.courier, undefined, heroLod); hero.root.visible = false; this.group.add(hero.root);
      this.pool.push({ hero, person: null, u: hero.mesh.userData.hu });
    }
  }

  /** Bake the vertex-animation textures (CPU skinning of the LOD1 mesh), yielding between clips. */
  async bake(yieldFn: () => Promise<void>) {
    const d = this.data, geo = d.lod1, N = geo.attributes.position.count;
    this.rows = Math.ceil(N / W);
    const frames: { clip: string; f: number }[] = [];
    for (const [name] of CLIPS) {
      const c = d.raw.find((r) => r.name === name)!;
      const n = Math.max(2, Math.round(c.frames / c.fps * this.vatFps));
      this.clipInfo.push({ start: frames.length, len: n, dur: c.frames / c.fps });
      for (let f = 0; f < n; f++) frames.push({ clip: name, f: Math.floor((f / n) * c.frames) });
    }
    if (!this.vat) { const z = new Uint16Array(4); const mk1 = () => new THREE.DataTexture(z, 1, 1, THREE.RGBAFormat, THREE.HalfFloatType); this.buildMeshes(mk1(), mk1(), frames.length); return; }
    const H = frames.length * this.rows;
    const pos = new Uint16Array(W * H * 4), nrm = new Uint16Array(W * H * 4);
    const bones = makeBones(d); const holder = new THREE.Object3D(); holder.add(bones[0]);
    const P = geo.attributes.position, Nn = geo.attributes.normal, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
    const mats = bones.map(() => new THREE.Matrix4()), v = new THREE.Vector3(), nv = new THREE.Vector3(), acc = new THREE.Vector3(), accN = new THREE.Vector3();
    const toH = THREE.DataUtils.toHalfFloat;
    let lastClip = '';
    for (let fi = 0; fi < frames.length; fi++) {
      const { clip, f } = frames[fi];
      if (clip !== lastClip) { await yieldFn(); lastClip = clip; }
      const c = d.raw.find((r) => r.name === clip)!;
      bones.forEach((b, k) => { const o = (f * bones.length + k) * 4; b.quaternion.set(c.q[o] / 32767, c.q[o + 1] / 32767, c.q[o + 2] / 32767, c.q[o + 3] / 32767); });
      d.posBones.forEach((k, j) => { const o = (f * d.posBones.length + j) * 3; bones[k].position.set(c.p[o], c.p[o + 1], c.p[o + 2]); });
      holder.updateMatrixWorld(true);
      bones.forEach((b, k) => mats[k].multiplyMatrices(b.matrixWorld, d.inverses[k]));
      for (let i = 0; i < N; i++) {
        v.fromBufferAttribute(P, i); nv.fromBufferAttribute(Nn, i); acc.set(0, 0, 0); accN.set(0, 0, 0);
        for (let j = 0; j < 4; j++) {
          const w = SW.getComponent(i, j); if (w <= 0) continue;
          const m = mats[SI.getComponent(i, j)];
          acc.addScaledVector(v.clone().applyMatrix4(m), w); accN.addScaledVector(nv.clone().transformDirection(m), w);
        }
        accN.normalize();
        const t = ((fi * this.rows + Math.floor(i / W)) * W + (i % W)) * 4;
        pos[t] = toH(acc.x); pos[t + 1] = toH(acc.y); pos[t + 2] = toH(acc.z); pos[t + 3] = toH(1);
        nrm[t] = toH(accN.x); nrm[t + 1] = toH(accN.y); nrm[t + 2] = toH(accN.z); nrm[t + 3] = toH(0);
      }
    }
    const mk = (a: Uint16Array) => { const t = new THREE.DataTexture(a, W, H, THREE.RGBAFormat, THREE.HalfFloatType); t.needsUpdate = true; t.magFilter = t.minFilter = THREE.NearestFilter; return t; };
    this.vatTex = [mk(pos), mk(nrm)];
    this.buildMeshes(this.vatTex[0], this.vatTex[1], frames.length);
  }

  private buildMeshes(posTex: THREE.DataTexture, nrmTex: THREE.DataTexture, totalFrames: number) {
    const max = Math.min(this.people.length, 900);
    // ---- MID: VAT instanced bodies ----
    this.midA = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); this.midA.setUsage(THREE.DynamicDrawUsage);
    this.midB = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); this.midB.setUsage(THREE.DynamicDrawUsage);
    const iA = instancedDynamicBufferAttribute(this.midA), iB = instancedDynamicBufferAttribute(this.midB);
    const vid = int(vertexIndex), col = vid.mod(W), rowIn = vid.div(W);
    const f0 = int(iB.x), f1 = int(iB.y), fr = fract(iB.x.add(0.0)).add(iB.z.mul(0)); // iB.z = blend
    const fetch = (tex: any, f: any) => textureLoad(tex, ivec2(col, f.mul(this.rows).add(rowIn))).xyz;
    const lp = mix(fetch(posTex, f0), fetch(posTex, f1), iB.z), ln = mix(fetch(nrmTex, f0), fetch(nrmTex, f1), iB.z);
    const cy = iA.w.cos(), sy = iA.w.sin();
    const rot = (p: any) => vec3(p.x.mul(cy).add(p.z.mul(sy)), p.y, p.z.mul(cy).sub(p.x.mul(sy)));
    const worldPos = rot(lp).add(iA.xyz);
    const vN = varying(rot(ln));
    const palIdx = int(iB.w.mod(16.0)), varIdx = int(iB.w.div(16.0));
    const colors = uniformArray(PAL.flatMap((p) => layerColors(p).map((c) => new THREE.Color(c))), 'color');
    const masks = uniformArray(MASKS.map((m) => m), 'float');
    const accents = uniformArray(PAL.map((p) => new THREE.Color(p[6])), 'color');
    const skins = uniformArray(PAL.map((p) => new THREE.Color(p[7])), 'color');
    const layerI = int(attribute('layer', 'float').add(0.5));
    const midMat = characterMaterial({ mask: masks.element(varIdx), colors: { element: (li: any) => colors.element(palIdx.mul(12).add(li)) }, accent: accents.element(palIdx), skin: skins.element(palIdx),
      positionNode: worldPos, normalNode: transformNormalToView(vN) });
    void layerI; void fr; void totalFrames;
    this.mid = new THREE.InstancedMesh(this.data.lod1, midMat, max); this.mid.frustumCulled = false; this.mid.count = 0; this.mid.castShadow = false;
    if (this.vat) this.group.add(this.mid);

    // ---- FAR: billboard silhouettes (head + shoulders + legs shape) ----
    this.farA = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); this.farA.setUsage(THREE.DynamicDrawUsage);
    const fA = instancedDynamicBufferAttribute(this.farA);
    const bq = new THREE.PlaneGeometry(0.62, 1.8); bq.translate(0, 0.9, 0);
    const fm = new THREE.MeshBasicNodeMaterial({ alphaTest: 0.5 }); // alpha-tested silhouettes: opaque pass, no sorting
    // facing: the CPU writes the camera-facing yaw into w (keeps camera uniforms out of this vertex shader)
    const right = vec3(cos(fA.w), 0, sin(fA.w).negate());
    fm.positionNode = fA.xyz.add(right.mul(positionLocal.x)).add(vec3(0, positionLocal.y, 0));
    const u2 = uv(), px = u2.x.sub(0.5), py = u2.y;
    const head = smoothstep(0.1, 0.07, length(vec2(px, py.sub(0.9).mul(1.4))));
    const body = step(abs(px), float(0.22).sub(py.sub(0.75).max(0).mul(1.4))).mul(step(0.42, py)).mul(step(py, float(0.82)));
    const legs = step(abs(abs(px).sub(0.07)), float(0.055)).mul(step(py, float(0.45)));
    const a = head.add(body).add(legs).clamp(0, 1);
    fm.colorNode = vec3(0.012, 0.012, 0.016); fm.opacityNode = a;
    this.far = new THREE.InstancedMesh(bq, fm, max); this.far.frustumCulled = false; this.far.count = 0; this.group.add(this.far);

    // ---- umbrellas (mid + far): ribbed canopy with a glowing rim, held above the head ----
    this.umbA = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); this.umbA.setUsage(THREE.DynamicDrawUsage);
    const uA = instancedDynamicBufferAttribute(this.umbA);
    const ug = new THREE.ConeGeometry(0.62, 0.26, 8, 1, true); ug.translate(0, 2.14, 0);
    const um = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, fog: false });
    const ul = positionLocal;
    const ucy = uA.w.cos(), usy = uA.w.sin();
    um.positionNode = vec3(ul.x.mul(ucy).add(ul.z.mul(usy)), ul.y, ul.z.mul(ucy).sub(ul.x.mul(usy))).add(uA.xyz).add(vec3(usy.mul(0.12), 0, ucy.mul(0.12)));
    const rr = length(ul.xz), rib = smoothstep(0.92, 1.0, abs(fract(atan(ul.x, ul.z).mul(8.0 / 6.2832)).sub(0.5)).mul(2.0));
    const pick = fract(uA.w.mul(3.7));
    const ucol = mix(mix(vec3(0.1, 0.9, 1.0), vec3(1.0, 0.2, 0.7), step(0.33, pick)), vec3(1.0, 0.6, 0.15), step(0.75, pick));
    um.colorNode = ucol.mul(smoothstep(0.5, 0.61, rr).mul(2.2).add(0.12).add(rib.mul(0.25))).mul(distFade());
    this.umbs = new THREE.InstancedMesh(ug, um, max); this.umbs.frustumCulled = false; this.umbs.count = 0; this.group.add(this.umbs);
  }

  private frustum = new THREE.Frustum(); private pm = new THREE.Matrix4(); private sph = new THREE.Sphere();
  update(t: number, dt: number, cam: THREE.PerspectiveCamera) {
    if (!this.mid) return;
    this.pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); this.frustum.setFromProjectionMatrix(this.pm);
    const cx = cam.position.x, cz = cam.position.z;
    const near: Person[] = [];
    let mi = 0, fi = 0, ui = 0;
    const mA = this.midA.array as Float32Array, mB = this.midB.array as Float32Array, fA = this.farA.array as Float32Array, uA = this.umbA.array as Float32Array;
    const max = this.mid.instanceMatrix.count;
    for (const p of this.people) {
      const g = p.seg, walking = p.mode === 0 || p.mode === 3, spd = p.mode === 3 ? p.speed * 2.6 : p.speed;
      const dx = g.b[0] - g.a[0], dz = g.b[1] - g.a[1], ux = dx / p.len, uz = dz / p.len;
      let s = walking ? ((t * spd) / (p.len * 2) + p.phase) % 1 : p.phase;
      const back = s >= 0.5; const dd = (back ? 2 - s * 2 : s * 2) * p.len;
      const fx = back ? -ux : ux, fz = back ? -uz : uz;
      p.x = g.a[0] + ux * dd - fz * p.lat; p.z = g.a[1] + uz * dd + fx * p.lat; p.y = g.y;
      p.yaw = walking ? Math.atan2(fx, fz) : p.yaw0;
      p.d = Math.hypot(p.x - cx, p.z - cz);
      if (p.d > this.farR) continue;
      this.sph.center.set(p.x, p.y + 1, p.z); this.sph.radius = 1.4;
      if (!this.frustum.intersectsSphere(this.sph)) continue;
      // animation time (shared by VAT and pooled heroes so the LOD switch is seamless)
      const ci = this.clipInfo[p.mode], rate = p.mode === 0 ? spd / 1.25 : p.mode === 3 ? spd / 3.4 : 0.9;
      p.clipT = (t * rate + p.phase * 7) % ci.dur;
      if (p.d < this.nearR) near.push(p);
      else if (p.d < this.midR && mi < max) {
        const ff = (p.clipT / ci.dur) * ci.len, f0 = Math.floor(ff) % ci.len, f1 = (f0 + 1) % ci.len;
        mA.set([p.x, p.y, p.z, p.yaw], mi * 4); mB.set([ci.start + f0, ci.start + f1, ff - Math.floor(ff), p.variant * 16 + p.pal], mi * 4); mi++;
      } else if (fi < max) { fA.set([p.x, p.y, p.z, Math.atan2(cx - p.x, cz - p.z)], fi * 4); fi++; }
      if (p.umb && ui < max && p.d > 4) { /* no umbrella domes filling the lens */ uA.set([p.x, p.y, p.z, p.yaw], ui * 4); ui++; }
    }
    // nearest N become full heroes; overflow drops to the VAT tier
    near.sort((a, b) => a.d - b.d);
    this.pool.forEach((slot, k) => {
      const p = near[k];
      if (!p) { slot.hero.root.visible = false; slot.person = null; return; }
      if (slot.person !== p) { slot.person = p; this.dress(slot, p); }
      const ci = this.clipInfo[p.mode];
      slot.hero.play(CLIPS[p.mode][0], 0);
      if (slot.hero.current) slot.hero.current.time = p.clipT;
      slot.hero.mixer.update(0);
      slot.hero.root.visible = true; slot.hero.root.position.set(p.x, p.y, p.z); slot.hero.root.rotation.y = p.yaw;
      void ci;
    });
    if (!this.vat) for (let k = this.pool.length; k < near.length && fi < max; k++) { const p = near[k]; fA.set([p.x, p.y, p.z, Math.atan2(cx - p.x, cz - p.z)], fi * 4); fi++; }
    else for (let k = this.pool.length; k < near.length && mi < max; k++) {
      const p = near[k], ci = this.clipInfo[p.mode], ff = (p.clipT / ci.dur) * ci.len, f0 = Math.floor(ff) % ci.len;
      mA.set([p.x, p.y, p.z, p.yaw], mi * 4); mB.set([ci.start + f0, ci.start + (f0 + 1) % ci.len, ff - Math.floor(ff), p.variant * 16 + p.pal], mi * 4); mi++;
    }
    this.mid.count = mi; this.far.count = fi; this.umbs.count = ui;
    this.midA.needsUpdate = this.midB.needsUpdate = this.farA.needsUpdate = this.umbA.needsUpdate = true;
    this.midA.addUpdateRange(0, mi * 4); this.midB.addUpdateRange(0, mi * 4); this.farA.addUpdateRange(0, fi * 4); this.umbA.addUpdateRange(0, ui * 4);
    this.stats = { near: Math.min(near.length, this.pool.length), mid: mi, far: fi };
    void dt;
  }

  private dress(slot: { hero: Hero; u: any }, p: Person) {
    const u = slot.u; if (!u) return;
    u.mask = MASKS[p.variant];
    const cols = layerColors(PAL[p.pal]);
    u.colors.forEach((c: THREE.Color, i: number) => c.setHex(cols[i]));
    u.accent.setHex(PAL[p.pal][6]); u.skin.setHex(PAL[p.pal][7]);
  }
}
export const _cw = { vec4, uniform, Outfit: null as unknown as Outfit };
