(globalThis as any).ProgressEvent = class { constructor(public type: string, o: any = {}) { Object.assign(this, o); } };
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'node:fs';
const dir = '/home/user/ext/ual/glTF/';
const json = fs.readFileSync(dir + 'AnimationLibrary_Godot_Standard.gltf', 'utf8');
const bin = fs.readFileSync(dir + 'AnimationLibrary_Godot_Standard.bin');
const j = JSON.parse(json);
j.buffers[0].uri = 'data:application/octet-stream;base64,' + bin.toString('base64');
const loader = new GLTFLoader();
loader.parse(JSON.stringify(j), '', (g) => {
  const sk: THREE.SkinnedMesh[] = []; g.scene.traverse((o: any) => o.isSkinnedMesh && sk.push(o));
  console.log('skinned meshes', sk.map((m) => [m.name, m.geometry.attributes.position.count, (m.material as any).name]));
  const box = new THREE.Box3().setFromObject(g.scene); console.log('bbox', box.min, box.max);
  const clip = g.animations.find((a) => a.name === 'Walk_Loop')!; console.log('walk', clip.duration, clip.tracks.length, clip.tracks.slice(0, 3).map((t) => t.name));
  console.log('bones', sk[0].skeleton.bones.length, sk[0].skeleton.bones.slice(0, 5).map((b) => b.name));
}, (e) => console.error('ERR', e));
loader.parse(JSON.stringify(j), '', (g) => {
  g.scene.updateMatrixWorld(true);
  const sk: any[] = []; g.scene.traverse((o: any) => o.isSkinnedMesh && sk.push(o));
  const v = new THREE.Vector3();
  for (const b of sk[0].skeleton.bones) { b.getWorldPosition(v); if (!/f_|thumb/.test(b.name)) console.log(b.name.padEnd(20), v.x.toFixed(3), v.y.toFixed(3), v.z.toFixed(3)); }
  // head vertex z range (front?)
  const m = sk[0], P = m.geometry.attributes.position, I = m.geometry.attributes.skinIndex, Wt = m.geometry.attributes.skinWeight;
  const head = sk[0].skeleton.bones.findIndex((b: any) => b.name === 'DEF-head');
  let zmin = 9, zmax = -9; for (let i = 0; i < P.count; i++) if (I.getX(i) === head && Wt.getX(i) > 0.5) { zmin = Math.min(zmin, P.getZ(i)); zmax = Math.max(zmax, P.getZ(i)); }
  console.log('head z', zmin, zmax, 'uv attrs', Object.keys(m.geometry.attributes));
}, (e) => console.error(e));
