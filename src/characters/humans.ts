// @ts-nocheck -- TSL node typings are too narrow for uniform-array element maths; checked at runtime
// Human characters: loads the baked Quaternius UAL rig + clothing shells (tools/bake/humans.ts), builds skinned
// heroes (player, rider, fixers, cook) with cross-faded animations, and one shared character shader:
// per-layer palette, face features painted from rest-space position, fabric detail, wet sheen, neon rim.
// ONE node graph for every hero (palette = uniforms) keeps shader compiles to a single program.
import * as THREE from 'three/webgpu';
import {
  attribute, uniform, uniformArray, vec3, float, int, mix, smoothstep, step, abs, length, vec2, fract, sin, dot, normalize,
  positionLocal, normalView, positionView, max, clamp, select, floor, mod, pow,
} from 'three/tsl';
import humansUrl from '../assets/gen/humans.bin?url';
import { U } from '../materials/materials';

export const LAYER = { SKIN: 0, SUIT: 1, COAT: 2, JACKET: 3, HOOD: 4, HAIR: 5, HELMET: 6, VISOR: 7, TROUSERS: 8, BOOTS: 9, APRON: 10, BAG: 11 };
const NL = 12;

export interface ClipData { name: string; duration: number; fps: number; frames: number; loop: boolean; q: Int16Array; p: Float32Array }
export interface HumanData {
  bones: { name: string; parent: number; p: number[]; q: number[]; s: number[] }[];
  inverses: THREE.Matrix4[];
  lod0: THREE.BufferGeometry; lod1: THREE.BufferGeometry;
  clips: Map<string, THREE.AnimationClip>; raw: ClipData[]; posBones: number[];
}

let cache: Promise<HumanData> | null = null;
/** Fetch + decode the baked character data (async, ~0.8 MB; decoding is a few ms). */
export function loadHumans(): Promise<HumanData> {
  return cache ??= (async () => {
    const buf = await (await fetch(humansUrl)).arrayBuffer();
    const hl = new DataView(buf).getUint32(0, true);
    const H = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
    const base = 4 + hl;
    const view = <T>(C: any, [o, n]: number[]): T => new C(buf.slice(base + o, base + o + n));
    const mesh = (m: any) => {
      const g = new THREE.BufferGeometry();
      const pq = view<Uint16Array>(Uint16Array, m.pos), nq = view<Int8Array>(Int8Array, m.nrm);
      const pos = new Float32Array(m.count * 3), nrm = new Float32Array(m.count * 3);
      for (let i = 0; i < m.count; i++) for (let k = 0; k < 3; k++) { pos[i * 3 + k] = m.bbMin[k] + (pq[i * 3 + k] / 65535) * m.bbSize[k]; nrm[i * 3 + k] = nq[i * 4 + k] / 127; }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      g.setAttribute('rest', new THREE.BufferAttribute(pos.slice(), 3));
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Array.from(view<Uint8Array>(Uint8Array, m.si)), 4));
      const sw = view<Uint8Array>(Uint8Array, m.sw); g.setAttribute('skinWeight', new THREE.BufferAttribute(Float32Array.from(sw, (x) => x / 255), 4));
      g.setAttribute('layer', new THREE.BufferAttribute(Float32Array.from(view<Uint8Array>(Uint8Array, m.ly)), 1));
      g.setIndex(new THREE.BufferAttribute(m.idx32 ? view<Uint32Array>(Uint32Array, m.idx) : view<Uint16Array>(Uint16Array, m.idx), 1));
      g.computeBoundingSphere(); g.boundingSphere!.radius += 0.6;
      return g;
    };
    const invF = view<Float32Array>(Float32Array, H.inv);
    const inverses = H.bones.map((_: any, i: number) => new THREE.Matrix4().fromArray(invF, i * 16));
    const clips = new Map<string, THREE.AnimationClip>(); const raw: ClipData[] = [];
    for (const c of H.clips) {
      const q = view<Int16Array>(Int16Array, c.q), p = view<Float32Array>(Float32Array, c.p);
      raw.push({ ...c, q, p });
      const times = Float32Array.from({ length: c.frames }, (_, f) => f / c.fps);
      const tracks: THREE.KeyframeTrack[] = [];
      H.bones.forEach((b: any, k: number) => {
        if (/f_|thumb/.test(b.name)) return; // fingers stay in rest pose (saves tracks; invisible at game distance)
        const v = new Float32Array(c.frames * 4);
        for (let f = 0; f < c.frames; f++) for (let j = 0; j < 4; j++) v[f * 4 + j] = q[(f * H.bones.length + k) * 4 + j] / 32767;
        tracks.push(new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, v));
      });
      H.posBones.forEach((k: number, j: number) => {
        const v = new Float32Array(c.frames * 3); for (let f = 0; f < c.frames; f++) for (let a = 0; a < 3; a++) v[f * 3 + a] = p[(f * H.posBones.length + j) * 3 + a];
        tracks.push(new THREE.VectorKeyframeTrack(`${H.bones[k].name}.position`, times, v));
      });
      clips.set(c.name, new THREE.AnimationClip(c.name, c.loop ? c.frames / c.fps : c.duration, tracks));
    }
    return { bones: H.bones, inverses, lod0: mesh(H.lod0), lod1: mesh(H.lod1), clips, raw, posBones: H.posBones };
  })();
}

/** Build a fresh bone hierarchy in rest pose. */
export function makeBones(d: HumanData) {
  const bones = d.bones.map((b) => { const B = new THREE.Bone(); B.name = b.name; B.position.fromArray(b.p); B.quaternion.fromArray(b.q); B.scale.fromArray(b.s); return B; });
  d.bones.forEach((b, i) => { if (b.parent >= 0) bones[b.parent].add(bones[i]); });
  return bones;
}

// ---- outfits ---------------------------------------------------------------------------------------
export interface Outfit { name: string; layers: number[]; colors: Partial<Record<number, number>>; accent: number; skin?: number }
const bit = (ls: number[]) => ls.reduce((m, l) => m | (1 << l), 0);
export const OUTFITS: Record<string, Outfit> = {
  courier: { name: 'Courier', layers: [LAYER.SKIN, LAYER.SUIT, LAYER.JACKET, LAYER.HELMET, LAYER.VISOR, LAYER.TROUSERS, LAYER.BOOTS, LAYER.BAG],
    colors: { [LAYER.SUIT]: 0x14151b, [LAYER.JACKET]: 0x1b1d26, [LAYER.HELMET]: 0x0c0d12, [LAYER.TROUSERS]: 0x17181f, [LAYER.BOOTS]: 0x0b0b0e, [LAYER.BAG]: 0x8a2a14 }, accent: 0xff2aa8, skin: 0xb07a5c },
  kiso: { name: 'Mama Kiso', layers: [LAYER.SKIN, LAYER.SUIT, LAYER.HAIR, LAYER.APRON, LAYER.TROUSERS, LAYER.BOOTS],
    colors: { [LAYER.SUIT]: 0x5a1f2a, [LAYER.HAIR]: 0xb8b4ae, [LAYER.APRON]: 0xd8cdb8, [LAYER.TROUSERS]: 0x2a2420, [LAYER.BOOTS]: 0x141210 }, accent: 0xffa142, skin: 0xc9906c },
  dex: { name: 'Dex', layers: [LAYER.SKIN, LAYER.SUIT, LAYER.COAT, LAYER.HOOD, LAYER.TROUSERS, LAYER.BOOTS],
    colors: { [LAYER.SUIT]: 0x1c2630, [LAYER.COAT]: 0x1f4a58, [LAYER.HOOD]: 0x1f4a58, [LAYER.TROUSERS]: 0x262a30, [LAYER.BOOTS]: 0x141416 }, accent: 0x19e6ff, skin: 0x7a523c },
  volt: { name: 'Volt', layers: [LAYER.SKIN, LAYER.SUIT, LAYER.JACKET, LAYER.HAIR, LAYER.TROUSERS, LAYER.BOOTS],
    colors: { [LAYER.SUIT]: 0x111111, [LAYER.JACKET]: 0x2a0a22, [LAYER.HAIR]: 0xff2aa8, [LAYER.TROUSERS]: 0x0d0d10, [LAYER.BOOTS]: 0x09090a }, accent: 0xff2aa8, skin: 0xe0b394 },
  ume: { name: 'Granny Ume', layers: [LAYER.SKIN, LAYER.SUIT, LAYER.COAT, LAYER.HAIR, LAYER.BOOTS],
    colors: { [LAYER.SUIT]: 0x3a2a1a, [LAYER.COAT]: 0x6a3a1a, [LAYER.HAIR]: 0xe8e4de, [LAYER.BOOTS]: 0x1a1410 }, accent: 0xffd28a, skin: 0xd8a88a },
};

/** Shared character shader. `inst` = per-instance palette (crowds); otherwise per-material uniforms (heroes). */
/** Low tier: a lighter character shader (no face details, fabric patterns, rain sparkles, rim or per-layer
 *  roughness) — about half the shader, which matters most on software / weak GPUs. Set before any material is built. */
export const CHAR = { lite: false };
export function characterMaterial(o: { mask: any; colors: any; accent: any; skin: any; positionNode?: any; normalNode?: any }) {
  if (CHAR.lite) return characterMaterialLite(o);
  const m = new THREE.MeshStandardNodeMaterial();
  const layer = attribute('layer', 'float');
  const rest = attribute('rest', 'vec3');
  const li = int(layer.add(0.5));
  // layer visibility (outfit variant)
  const visible = mod(floor(o.mask.div(pow(float(2), layer.add(0.01).floor()))), 2);
  m.positionNode = (o.positionNode ?? positionLocal).mul(visible); // hidden layers collapse to degenerate triangles
  if (o.normalNode) m.normalNode = o.normalNode;
  const base = o.colors.element(li);
  // ---- face (skin layer, front of the head): eyes, brows, mouth from rest-space position ----
  const fr = step(0.07, rest.z).mul(step(1.55, rest.y)).mul(step(rest.y, float(1.72)));
  const ex = abs(rest.x).sub(0.034), ey = rest.y.sub(1.645);
  const eye = smoothstep(0.013, 0.009, length(vec2(ex, ey.mul(1.6)))).mul(fr);
  const brow = smoothstep(0.006, 0.002, abs(rest.y.sub(1.665).add(abs(rest.x).mul(0.15)))).mul(step(abs(rest.x), float(0.05))).mul(step(0.012, abs(rest.x))).mul(fr);
  const mouth = smoothstep(0.004, 0.0015, abs(rest.y.sub(1.597))).mul(step(abs(rest.x), float(0.02))).mul(fr);
  const isSkin = step(abs(layer.sub(LAYER.SKIN)), float(0.5));
  let col: any = mix(base, o.skin, isSkin);
  col = mix(col, vec3(0.02, 0.018, 0.02), eye.mul(isSkin));
  col = mix(col, o.skin.mul(0.35), brow.add(mouth.mul(0.6)).clamp(0, 1).mul(isSkin));
  // ---- fabric detail: quilting on jackets, seams on coats, tread bands on boots ----
  const isJacket = step(abs(layer.sub(LAYER.JACKET)), float(0.5)), isCoat = step(abs(layer.sub(LAYER.COAT)), float(0.5));
  const quilt = smoothstep(0.08, 0.0, abs(fract(rest.y.mul(14.0)).sub(0.5)).sub(0.42)).mul(isJacket);
  const seam = smoothstep(0.004, 0.0, abs(abs(rest.x).sub(0.09))).mul(isCoat);
  col = col.mul(float(1).sub(quilt.mul(0.35)).sub(seam.mul(0.4)));
  // ---- wet: cloth darkens, upward-facing surfaces get a glossy film ----
  const isCloth = float(1).sub(isSkin).mul(float(1).sub(step(abs(layer.sub(LAYER.VISOR)), float(0.5))));
  m.colorNode = col.mul(mix(float(1), float(0.72), U.wet.mul(isCloth)));
  const R = [0.55, 0.6, 0.22, 0.38, 0.45, 0.7, 0.14, 0.05, 0.65, 0.3, 0.55, 0.45];
  const rough = uniformArray(R.map((r) => r), 'float').element(li);
  m.roughnessNode = clamp(rough.sub(U.wet.mul(0.18).mul(isCloth)), 0.05, 1);
  const metal = select(li.equal(LAYER.HELMET), float(0.6), select(li.equal(LAYER.BAG), float(0.2), float(0.0)));
  m.metalnessNode = metal;
  // ---- emissive: visor glow, coat zip/hem trim, neon rim light from the street ----
  const isVisor = step(abs(layer.sub(LAYER.VISOR)), float(0.5));
  const zip = smoothstep(0.006, 0.002, abs(rest.x)).mul(step(0.02, rest.z)).mul(isCoat.add(isJacket));
  const hem = smoothstep(0.012, 0.0, abs(rest.y.sub(0.515))).mul(isCoat).add(smoothstep(0.01, 0.0, abs(rest.y.sub(0.9))).mul(isJacket));
  const ndv = abs(dot(normalize(positionView).negate(), normalView));
  const rim = pow(float(1).sub(ndv), 3.0).mul(0.06).mul(isCloth);
  // rain: tiny impact sparkles flicking over heads and shoulders (cells in rest space, re-rolled 7× a second)
  const cell = floor(rest.mul(28.0)), tick = floor(U.time.mul(7.0));
  const rnd = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719)).add(tick.mul(17.13))).mul(43758.5453));
  const top = smoothstep(1.3, 1.5, rest.y).mul(step(0.0, rest.y.sub(1.3)));
  const splash = step(0.975, rnd).mul(top).mul(U.rain).mul(isCloth.add(isSkin).clamp(0, 1));
  m.emissiveNode = o.accent.mul(isVisor.mul(3.0).add(zip.add(hem).clamp(0, 1).mul(1.6)).add(rim)).add(vec3(0.6, 0.7, 0.8).mul(splash))
    .add(col.mul(0.05)); // faint albedo fill: people stay readable in the darkest alleys
  return m;
}

function characterMaterialLite(o: { mask: any; colors: any; accent: any; skin: any; positionNode?: any; normalNode?: any }) {
  const m = new THREE.MeshStandardNodeMaterial();
  const layer = attribute('layer', 'float'), li = int(layer.add(0.5));
  const visible = mod(floor(o.mask.div(pow(float(2), layer.add(0.01).floor()))), 2);
  m.positionNode = (o.positionNode ?? positionLocal).mul(visible);
  if (o.normalNode) m.normalNode = o.normalNode;
  const isSkin = step(abs(layer.sub(LAYER.SKIN)), float(0.5)), isVisor = step(abs(layer.sub(LAYER.VISOR)), float(0.5));
  const col = mix(o.colors.element(li), o.skin, isSkin);
  m.colorNode = col.mul(mix(float(1), float(0.75), U.wet.mul(float(1).sub(isSkin))));
  m.roughnessNode = float(0.5); m.metalnessNode = float(0.0);
  m.emissiveNode = o.accent.mul(isVisor.mul(3.0)).add(col.mul(0.05));
  return m;
}

const P = (n: number) => new THREE.Color(n);
/** Per-character uniforms for the shared shader. */
/** Per-hero look (plain values, read per object by the shared hero material). */
export interface HeroLook { mask: number; colors: THREE.Color[]; accent: THREE.Color; skin: THREE.Color }
export function heroLook(of: Outfit): HeroLook {
  const cols = Array.from({ length: NL }, (_, i) => P(of.colors[i] ?? 0x1a1b22));
  cols[LAYER.VISOR] = P(0x000000);
  return { mask: bit(of.layers), colors: cols, accent: P(of.accent), skin: P(of.skin ?? 0xb48466) };
}
/** ONE material for every skinned hero (courier, cast, pooled crowd heroes): the look comes from per-object
 *  uniforms (mesh.userData.hu), so all heroes share one GPU program instead of compiling one each. */
let _heroMat: THREE.Material | null = null;
export function heroMaterial() {
  if (_heroMat) return _heroMat;
  const hu = (f: any) => (f.object?.userData?.hu as HeroLook | undefined);
  const mask = uniform(0).onObjectUpdate((f: any) => hu(f)?.mask ?? 0);
  const cs = Array.from({ length: NL }, (_, i) => uniform(new THREE.Color()).onObjectUpdate((f: any) => hu(f)?.colors[i]));
  const colors = { element: (li: any) => { let c: any = cs[NL - 1]; for (let i = NL - 2; i >= 0; i--) c = select(li.equal(i), cs[i], c); return c; } };
  const accent = uniform(new THREE.Color()).onObjectUpdate((f: any) => hu(f)?.accent);
  const skin = uniform(new THREE.Color()).onObjectUpdate((f: any) => hu(f)?.skin);
  return (_heroMat = characterMaterial({ mask, colors, accent, skin }));
}

/** A skinned, animated character with cross-faded clips. */
export class Hero {
  root = new THREE.Group();
  mesh: THREE.SkinnedMesh;
  mixer: THREE.AnimationMixer;
  bones: THREE.Bone[];
  current: THREE.AnimationAction | null = null;
  currentName = '';
  constructor(public data: HumanData, outfit: Outfit, scene?: THREE.Object3D, lod: 0 | 1 = 0) {
    this.bones = makeBones(data);
    const skel = new THREE.Skeleton(this.bones, data.inverses.map((m) => m.clone()));
    this.mesh = new THREE.SkinnedMesh(lod ? data.lod1 : data.lod0, heroMaterial());
    this.mesh.userData.hu = heroLook(outfit);
    this.mesh.add(this.bones[0]);
    this.mesh.bind(skel, new THREE.Matrix4());
    // culling: a generous fixed sphere around the root (skinned bounds are costly to recompute every frame)
    this.mesh.castShadow = true; (this.mesh as any).boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2.6);
    this.root.add(this.mesh);
    this.mixer = new THREE.AnimationMixer(this.mesh);
    scene?.add(this.root);
  }
  bone(name: string) { return this.bones.find((b) => b.name === name)!; }
  /** Cross-fade to a clip. */
  play(name: string, fade = 0.25, timeScale = 1, once = false) {
    if (name === this.currentName) { if (this.current) this.current.timeScale = timeScale; return this.current; }
    const clip = this.data.clips.get(name); if (!clip) return null;
    const a = this.mixer.clipAction(clip);
    a.reset(); a.timeScale = timeScale; a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once;
    a.play();
    if (this.current) this.current.crossFadeTo(a, fade, false);
    this.current = a; this.currentName = name;
    return a;
  }
  update(dt: number) { this.mixer.update(dt); }
}
export const _hm = { vec3, sin, max };
