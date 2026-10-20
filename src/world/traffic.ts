// @ts-nocheck -- TSL node typings are too narrow for swizzled instanced attributes; checked at runtime
// Hover traffic: instanced cars gliding along aerial lanes with head/tail lights and long light trails,
// animated entirely in the vertex shader; plus a tram shuttling along the elevated line.
import * as THREE from 'three/webgpu';
import { instancedBufferAttribute, attribute, vec3, float, fract, time, mix, positionLocal, smoothstep, abs, uv, step } from 'three/tsl';
import { distFade } from '../materials/materials';

export interface Lane { a: [number, number, number]; b: [number, number, number]; cars: number; speed: number }

export class Traffic {
  group = new THREE.Group();
  constructor(lanes: Lane[]) {
    const A: number[] = [], B: number[] = [], C: number[] = [];
    let k = 0;
    for (const l of lanes) for (let i = 0; i < l.cars; i++, k++) {
      A.push(...l.a, l.speed); B.push(...l.b, (i + ((k * 0.618) % 1) * 0.5) / l.cars); C.push((k * 0.37) % 1, 0, 0, 0);
    }
    const n = A.length / 4; if (!n) return;
    const iA = instancedBufferAttribute(new THREE.InstancedBufferAttribute(new Float32Array(A), 4));
    const iB = instancedBufferAttribute(new THREE.InstancedBufferAttribute(new Float32Array(B), 4));
    const iC = instancedBufferAttribute(new THREE.InstancedBufferAttribute(new Float32Array(C), 4));
    const a = iA.xyz, b = iB.xyz, seg = b.sub(a), len = seg.length(), dir = seg.div(len);
    const t = fract(time.mul(iA.w).div(len).add(iB.w));
    const p = a.add(seg.mul(t));
    // fade in/out at lane ends so cars don't pop
    const endFade = smoothstep(0.0, 0.04, t).mul(smoothstep(1.0, 0.96, t));
    const sideV = vec3(dir.z, 0, dir.x.negate());
    const toWorld = (l: any) => p.add(sideV.mul(l.x)).add(vec3(0, l.y, 0)).add(dir.mul(l.z.negate()));

    // bodies (local -z = forward): glow attribute 0 body, 1 tail, 2 head, 3 underglow
    const parts: [THREE.BufferGeometry, number][] = [];
    const bx = (sx: number, sy: number, sz: number, x: number, y: number, z: number, gl: number) => { const g = new THREE.BoxGeometry(sx, sy, sz); g.translate(x, y, z); parts.push([g, gl]); };
    bx(1.9, 0.7, 4.4, 0, 0, 0, 0); bx(1.5, 0.45, 2.0, 0, 0.55, 0.3, 0);
    bx(1.6, 0.12, 0.05, 0, 0.1, 2.21, 1); bx(1.5, 0.1, 0.05, 0, 0.05, -2.21, 2); bx(1.5, 0.04, 3.6, 0, -0.37, 0, 3);
    const pos: number[] = [], nrm: number[] = [], gla: number[] = [], idx: number[] = []; let off = 0;
    for (const [g, gl] of parts) { const P = g.attributes.position, N = g.attributes.normal; for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nrm.push(N.getX(i), N.getY(i), N.getZ(i)); gla.push(gl); } const I = g.index!; for (let i = 0; i < I.count; i++) idx.push(I.getX(i) + off); off += P.count; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); geo.setAttribute('glow', new THREE.Float32BufferAttribute(gla, 1)); geo.setIndex(idx);
    const m = new THREE.MeshStandardNodeMaterial();
    const gl = attribute('glow', 'float');
    m.positionNode = toWorld(positionLocal.mul(endFade));
    m.colorNode = mix(vec3(0.05, 0.055, 0.07), vec3(0.2, 0.05, 0.1), iC.x.mul(0.5));
    m.metalnessNode = float(0.7); m.roughnessNode = float(0.3);
    const em = mix(mix(vec3(0), vec3(1.0, 0.05, 0.08).mul(6.0), step(0.5, gl).mul(step(gl, float(1.5)))),
      mix(vec3(0.9, 0.95, 1.0).mul(8.0), mix(vec3(0.1, 0.9, 1.0), vec3(1.0, 0.2, 0.7), step(0.5, iC.x)).mul(0.6), step(2.5, gl)), step(1.5, gl));
    m.emissiveNode = em;
    const cars = new THREE.InstancedMesh(geo, m, n); cars.frustumCulled = false; this.group.add(cars);

    // light trails: a long quad behind each car, red tail streak fading out
    const tg = new THREE.PlaneGeometry(1.4, 1, 1, 1); tg.rotateX(-Math.PI / 2); tg.translate(0, 0.1, 0.5); // local z 0..1 behind the car
    const tm = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const L = float(14.0);
    const tl = positionLocal;
    tm.positionNode = toWorld(vec3(tl.x, tl.y, tl.z.mul(L).add(2.2)).mul(endFade));
    const v = uv().y; // 0..1 along the trail
    tm.colorNode = vec3(1.0, 0.08, 0.12).mul(float(1).sub(v).pow(2.0)).mul(smoothstep(0.7, 0.0, abs(uv().x.sub(0.5)).mul(2.0))).mul(1.6).mul(distFade());
    const trails = new THREE.InstancedMesh(tg, tm, n); trails.frustumCulled = false; trails.renderOrder = 5; this.group.add(trails);
  }
}

/** A tram on the elevated line: shuttles end to end, emissive windows; position exposed for positional audio. */
export class Tram {
  mesh: THREE.Group; pos = new THREE.Vector3();
  constructor(scene: THREE.Scene, private a: THREE.Vector3, private b: THREE.Vector3, private speed = 14) {
    this.mesh = new THREE.Group();
    const body = new THREE.MeshStandardNodeMaterial(); body.color = new THREE.Color(0x1a1d24); body.metalness = 0.6; body.roughness = 0.35;
    const win = new THREE.MeshBasicNodeMaterial(); win.color = new THREE.Color(0xffd29a).multiplyScalar(2.2);
    for (let c = 0; c < 3; c++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.0, 11), body); car.position.set(0, 1.6, c * 11.6); car.castShadow = true; this.mesh.add(car);
      for (const sx of [-1.41, 1.41]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 1.0), win); w.rotation.y = sx * Math.PI / 2; w.position.set(sx, 2.2, c * 11.6); this.mesh.add(w); }
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 0.05), new THREE.MeshBasicNodeMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(8) }));
    head.position.set(0, 1.4, -5.53); this.mesh.add(head);
    scene.add(this.mesh);
    this.mesh.lookAt(b.x - a.x + this.mesh.position.x, this.mesh.position.y, b.z - a.z + this.mesh.position.z);
  }
  update(t: number) {
    const len = this.a.distanceTo(this.b), cyc = (t * this.speed) / len % 2, f = cyc < 1 ? cyc : 2 - cyc;
    const e = f * f * (3 - 2 * f); // ease at the ends (stations)
    this.pos.copy(this.a).lerp(this.b, e);
    this.mesh.position.copy(this.pos);
    const dx = this.b.x - this.a.x, dz = this.b.z - this.a.z;
    this.mesh.rotation.y = Math.atan2(-dx, -dz) + (cyc < 1 ? 0 : Math.PI);
  }
}
