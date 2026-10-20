// Offline character bake (run with: npx tsx tools/bake/humans.ts <path-to-UAL-gltf-dir>)
// Source: Quaternius "Universal Animation Library" (Standard, CC0) mannequin + rig + animations.
// Output: src/assets/gen/humans.bin — one binary the game loads asynchronously:
//   [u32 headerBytes][JSON header][binary blobs...]
// Contents: LOD0 + LOD1 meshes (body + procedural clothing shells skinned to the same bones, per-vertex
// layer id), skeleton (rest pose + inverse binds) and resampled animation clips (30 fps, int16 quaternions).
(globalThis as any).ProgressEvent = class { constructor(public type: string, o: any = {}) { Object.assign(this, o); } };
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptSimplifier } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2] ?? '/home/user/ext/ual/glTF';
const OUT = path.resolve('src/assets/gen/humans.bin');
const CLIPS = ['Idle_Loop', 'Idle_Talking_Loop', 'Walk_Loop', 'Walk_Formal_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Driving_Loop',
  'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Sitting_Idle_Loop', 'Interact', 'Crouch_Idle_Loop'];

// Layer ids (the runtime material + variant masks use the same numbering)
export const L = { SKIN: 0, SUIT: 1, COAT: 2, JACKET: 3, HOOD: 4, HAIR: 5, HELMET: 6, VISOR: 7, TROUSERS: 8, BOOTS: 9, APRON: 10, BAG: 11 };

function loadGltf(): Promise<any> {
  const j = JSON.parse(fs.readFileSync(path.join(SRC, 'AnimationLibrary_Godot_Standard.gltf'), 'utf8'));
  j.buffers[0].uri = 'data:application/octet-stream;base64,' + fs.readFileSync(path.join(SRC, 'AnimationLibrary_Godot_Standard.bin')).toString('base64');
  return new Promise((res, rej) => new GLTFLoader().parse(JSON.stringify(j), '', res, rej));
}

interface V { p: THREE.Vector3; n: THREE.Vector3; si: number[]; sw: number[]; layer: number }

async function main() {
  const g = await loadGltf();
  g.scene.updateMatrixWorld(true);
  const parts: THREE.SkinnedMesh[] = []; g.scene.traverse((o: any) => o.isSkinnedMesh && parts.push(o));
  const skeleton = parts[0].skeleton;
  const boneName = skeleton.bones.map((b) => b.name);
  const bi = (n: string) => boneName.indexOf(n);
  // ---- body vertices (bind space) ----
  const verts: V[] = []; const tris: number[] = [];
  for (const m of parts) {
    const G = m.geometry, P = G.attributes.position, N = G.attributes.normal, SI = G.attributes.skinIndex, SW = G.attributes.skinWeight;
    const base = verts.length;
    for (let i = 0; i < P.count; i++) verts.push({ p: new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i)).applyMatrix4(m.bindMatrix), n: new THREE.Vector3(N.getX(i), N.getY(i), N.getZ(i)).normalize(),
      si: [SI.getX(i), SI.getY(i), SI.getZ(i), SI.getW(i)], sw: [SW.getX(i), SW.getY(i), SW.getZ(i), SW.getW(i)], layer: 0 });
    const I = G.index!; for (let i = 0; i < I.count; i++) tris.push(I.getX(i) + base);
  }
  const dom = (v: V) => { let k = 0; for (let j = 1; j < 4; j++) if (v.sw[j] > v.sw[k]) k = j; return boneName[v.si[k]] ?? ''; };
  const has = (v: V, re: RegExp) => re.test(dom(v));
  // body layering: exposed skin = head, neck, hands; rest = undersuit
  for (const v of verts) v.layer = has(v, /head|neck|hand|f_|thumb/) ? L.SKIN : L.SUIT;

  // ---- clothing shells: copy a region of the body, push along the normal, keep the skin weights ----
  const outV: V[] = [...verts]; const outT: number[] = [...tris];
  function shell(layer: number, pick: (v: V) => boolean, offset: (v: V) => THREE.Vector3) {
    const map = new Map<number, number>();
    for (let t = 0; t < tris.length; t += 3) {
      const a = tris[t], b = tris[t + 1], c = tris[t + 2];
      if (!(pick(verts[a]) && pick(verts[b]) && pick(verts[c]))) continue;
      for (const k of [a, b, c]) if (!map.has(k)) {
        const v = verts[k]; map.set(k, outV.length);
        outV.push({ p: v.p.clone().add(offset(v)), n: v.n.clone(), si: [...v.si], sw: [...v.sw], layer });
      }
      outT.push(map.get(a)!, map.get(b)!, map.get(c)!);
    }
  }
  const HIP_Y = 0.92;
  const torso = /hips|spine|shoulder|neck/, arm = /upper_arm|forearm/;
  const along = (v: V, d: number) => v.n.clone().multiplyScalar(d);
  // long raincoat: torso + sleeves + thighs, flaring outward below the hips (a skirt that swings with the legs)
  shell(L.COAT, (v) => (has(v, torso) && v.p.y < 1.5 && v.p.y > 0.86) || has(v, arm), (v) => along(v, 0.03));
  // coat skirt: an open-fronted elliptical tube from the hips to just above the knee, weighted hips → thighs
  {
    const hip = bi('DEF-hips'), tl = bi('DEF-thighL'), tr = bi('DEF-thighR');
    const RS = 24, HS = 7, y0 = 0.96, y1 = 0.5, base = outV.length;
    for (let j = 0; j <= HS; j++) {
      const t = j / HS, y = y0 + (y1 - y0) * t;
      const rx = 0.2 + t * 0.07, rz = 0.155 + t * 0.07;
      for (let i = 0; i <= RS; i++) {
        const a = -Math.PI / 2 + (i / RS) * Math.PI * 2 * 0.94 + Math.PI * 0.06; // gap at the front for the legs
        const x = Math.cos(a) * rx, z = Math.sin(a) * rz - 0.015;
        const side = x >= 0 ? tl : tr, mid = Math.max(0, 1 - Math.abs(x) / 0.06); // centre-line verts share both thighs
        const wt = Math.min(1, t * 1.25);
        const si = [hip, side, side === tl ? tr : tl, 0], sw = [1 - wt, wt * (1 - mid * 0.5), wt * mid * 0.5, 0];
        outV.push({ p: new THREE.Vector3(x, y, z), n: new THREE.Vector3(Math.cos(a) / rx, 0.15, Math.sin(a) / rz).normalize(), si, sw, layer: L.COAT });
      }
    }
    for (let j = 0; j < HS; j++) for (let i = 0; i < RS; i++) {
      const a = base + j * (RS + 1) + i, b = a + RS + 1;
      outT.push(a, b, a + 1, a + 1, b, b + 1, a, a + 1, b, a + 1, b + 1, b); // double-sided (inside visible through the slit)
    }
  }
  // short techwear jacket
  shell(L.JACKET, (v) => (has(v, torso) && v.p.y < 1.5 && v.p.y > 0.86) || has(v, arm), (v) => along(v, 0.024));
  // hood: back and top of the head + neck, face left open
  shell(L.HOOD, (v) => (has(v, /head/) && (v.p.z < 0.045 || v.p.y > 1.71)) || (has(v, /neck/)), (v) => along(v, 0.05).add(new THREE.Vector3(0, 0.008, -0.01)));
  // hair cap (short) — the variant mask picks hair OR hood OR helmet
  shell(L.HAIR, (v) => has(v, /head/) && (v.p.y > 1.665 || (v.p.z < -0.02 && v.p.y > 1.58)), (v) => along(v, 0.013 + Math.max(0, v.p.y - 1.68) * 0.12));
  // helmet: full head shell; visor: a band across the eyes, pushed further out
  shell(L.HELMET, (v) => has(v, /head/) && !(v.p.z > 0.05 && v.p.y > 1.6 && v.p.y < 1.69), (v) => along(v, 0.042));
  shell(L.VISOR, (v) => has(v, /head/) && v.p.z > 0.04 && v.p.y > 1.595 && v.p.y < 1.695, (v) => along(v, 0.05));
  // cargo trousers + boots
  shell(L.TROUSERS, (v) => has(v, /thigh|shin/) && v.p.y > 0.16, (v) => along(v, 0.012));
  shell(L.BOOTS, (v) => has(v, /foot|toe/) || (has(v, /shin/) && v.p.y < 0.32), (v) => along(v, 0.02));
  // apron (cooks, vendors): front panel from chest to knee
  shell(L.APRON, (v) => (has(v, /hips|spine|thigh/)) && v.p.z > 0.02 && v.p.y > 0.42 && v.p.y < 1.33, (v) => along(v, 0.05).add(new THREE.Vector3(0, 0, 0.012)));
  // courier bag: a rounded box on the back, bound to the upper spine
  {
    const box = new THREE.BoxGeometry(0.3, 0.36, 0.14, 2, 2, 2); box.translate(0, 1.25, -0.2);
    const sp = bi('DEF-spine003'), P = box.attributes.position, N = box.attributes.normal, base = outV.length;
    for (let i = 0; i < P.count; i++) outV.push({ p: new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i)), n: new THREE.Vector3(N.getX(i), N.getY(i), N.getZ(i)), si: [sp, 0, 0, 0], sw: [1, 0, 0, 0], layer: L.BAG });
    const I = box.index!; for (let i = 0; i < I.count; i++) outT.push(I.getX(i) + base);
  }

  // ---- LOD1: simplify each layer separately (keeps layers intact for the variant mask) ----
  await MeshoptSimplifier.ready;
  // weld UV-seam duplicates (same position + layer) so the simplifier can collapse across seams
  const weld = new Map<string, number>(); const wid = outV.map((v, i) => { const k = `${v.layer}:${v.p.x.toFixed(4)},${v.p.y.toFixed(4)},${v.p.z.toFixed(4)}`; if (!weld.has(k)) weld.set(k, i); return weld.get(k)!; });
  const outTW = outT.map((i) => wid[i]);
  const posArr = new Float32Array(outV.length * 3); outV.forEach((v, i) => posArr.set([v.p.x, v.p.y, v.p.z], i * 3));
  const lod1T: number[] = [];
  for (let layer = 0; layer <= L.BAG; layer++) {
    const idx: number[] = [];
    for (let t = 0; t < outTW.length; t += 3) if (outV[outTW[t]].layer === layer) idx.push(outTW[t], outTW[t + 1], outTW[t + 2]);
    if (!idx.length) continue;
    const target = Math.max(3, Math.floor(idx.length * (layer <= L.SUIT ? 0.16 : 0.2) / 3) * 3);
    const [res] = MeshoptSimplifier.simplify(new Uint32Array(idx), posArr, 3, target, 0.03, []);
    lod1T.push(...res);
  }
  // compact LOD1 vertex set
  const remap = new Map<number, number>(); const lod1V: V[] = [];
  const lod1I = lod1T.map((i) => { if (!remap.has(i)) { remap.set(i, lod1V.length); lod1V.push(outV[i]); } return remap.get(i)!; });

  // ---- skeleton rest pose ----
  const bones = skeleton.bones.map((b) => ({ name: b.name, parent: skeleton.bones.indexOf(b.parent as THREE.Bone),
    p: b.position.toArray(), q: b.quaternion.toArray(), s: b.scale.toArray() }));
  const inv = skeleton.boneInverses.flatMap((m) => m.toArray());

  // ---- clips: evaluate with a mixer at 30 fps and record every bone's local quaternion (+ hips/root position) ----
  const root = g.scene;
  const mixer = new THREE.AnimationMixer(root);
  const clips: any[] = [];
  const blobs: Buffer[] = [];
  let off = 0;
  const push = (arr: ArrayBufferView) => { const b = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength); const pad = (4 - (b.length % 4)) % 4; blobs.push(b, Buffer.alloc(pad)); const o = off; off += b.length + pad; return [o, b.length]; };
  const posBones = [bi('root'), bi('DEF-hips')];
  for (const name of CLIPS) {
    const clip = g.animations.find((a: THREE.AnimationClip) => a.name === name); if (!clip) { console.warn('missing clip', name); continue; }
    const fps = 30, frames = Math.max(2, Math.round(clip.duration * fps) + (name.endsWith('Loop') ? 0 : 1));
    mixer.stopAllAction(); const act = mixer.clipAction(clip); act.reset().play();
    const q = new Int16Array(frames * bones.length * 4), p = new Float32Array(frames * posBones.length * 3);
    for (let f = 0; f < frames; f++) {
      mixer.setTime(Math.min(clip.duration, f / fps));
      skeleton.bones.forEach((b, k) => { const Q = b.quaternion; q.set([Q.x, Q.y, Q.z, Q.w].map((x) => Math.round(x * 32767)), (f * bones.length + k) * 4); });
      posBones.forEach((k, j) => p.set(skeleton.bones[k].position.toArray(), (f * posBones.length + j) * 3));
    }
    act.stop();
    clips.push({ name, duration: clip.duration, fps, frames, loop: name.endsWith('Loop'), q: push(q), p: push(p) });
  }

  // ---- meshes, quantized: position int16 over the bbox, normal int8, skin u8, layer u8 ----
  const packMesh = (V: V[], I: number[]) => {
    const bb = new THREE.Box3(); V.forEach((v) => bb.expandByPoint(v.p));
    const mn = bb.min, sz = bb.getSize(new THREE.Vector3());
    const pos = new Uint16Array(V.length * 3), nrm = new Int8Array(V.length * 4), si = new Uint8Array(V.length * 4), sw = new Uint8Array(V.length * 4), ly = new Uint8Array(V.length);
    V.forEach((v, i) => {
      pos.set([0, 1, 2].map((k) => Math.round(((v.p.getComponent(k) - mn.getComponent(k)) / sz.getComponent(k)) * 65535)), i * 3);
      nrm.set([v.n.x, v.n.y, v.n.z, 0].map((x) => Math.round(x * 127)), i * 4);
      const tot = v.sw.reduce((a, b) => a + b, 0) || 1; const w = v.sw.map((x) => Math.round((x / tot) * 255)); w[0] += 255 - w.reduce((a, b) => a + b, 0);
      si.set(v.si, i * 4); sw.set(w, i * 4); ly[i] = v.layer;
    });
    const idx = V.length < 65536 ? new Uint16Array(I) : new Uint32Array(I);
    return { count: V.length, bbMin: mn.toArray(), bbSize: sz.toArray(), idx32: !(idx instanceof Uint16Array), pos: push(pos), nrm: push(nrm), si: push(si), sw: push(sw), ly: push(ly), idx: push(idx), tris: I.length / 3 };
  };
  const lod0 = packMesh(outV, outT), lod1 = packMesh(lod1V, lod1I);
  const invOff = push(new Float32Array(inv));
  const header = { version: 1, source: 'Quaternius Universal Animation Library (Standard), CC0 1.0 — https://quaternius.itch.io/universal-animation-library', layers: L, bones, inv: invOff, lod0, lod1, clips, posBones };
  const hb = Buffer.from(JSON.stringify(header)); const hpad = (4 - ((hb.length + 4) % 4)) % 4;
  const head = Buffer.alloc(4); head.writeUInt32LE(hb.length + hpad);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.concat([head, hb, Buffer.alloc(hpad, 32), ...blobs]));
  console.log(`humans.bin ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB · LOD0 ${lod0.count} verts / ${lod0.tris} tris · LOD1 ${lod1.count} verts / ${lod1.tris} tris · ${clips.length} clips · ${bones.length} bones`);
}
main().catch((e) => { console.error(e); process.exit(1); });
