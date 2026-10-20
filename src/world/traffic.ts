// @ts-nocheck -- TSL node typings are too narrow for swizzled instanced attributes; checked at runtime
// Hover traffic: instanced cars gliding along aerial lanes with head/tail lights and long light trails,
// animated entirely in the vertex shader; plus a tram shuttling along the elevated line.
import * as THREE from 'three/webgpu';
import { instancedBufferAttribute, attribute, vec3, float, fract, time, mix, positionLocal, smoothstep, abs, uv, step, floor } from 'three/tsl';
import { distFade } from '../materials/materials';
import { profile } from '../vehicle/bikeHull';

export interface Lane { a: [number, number, number]; b: [number, number, number]; cars: number; speed: number }

export class Traffic {
  group = new THREE.Group();
  constructor(lanes: Lane[]) {
    const A: number[] = [], B: number[] = [], C: number[] = [];
    let k = 0;
    for (const l of lanes) for (let i = 0; i < l.cars; i++, k++) {
      A.push(...l.a, l.speed); B.push(...l.b, (i + ((k * 0.618) % 1) * 0.5) / l.cars); C.push((k * 0.37) % 1, k % 3, 0, 0);
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

    // bodies (local -z = forward): three silhouettes (sedan / van / sports wedge) in one geometry; each instance
    // keeps only its variant's vertices. glow: 0 body, 1 tail, 2 head, 3 underglow, 4 cabin glass
    const parts: [THREE.BufferGeometry, number, number][] = [];
    const put = (g: THREE.BufferGeometry, gl: number, v: number) => { if (g.index === null) { const ii: number[] = []; for (let q = 0; q < g.attributes.position.count; q++) ii.push(q); g.setIndex(ii); } parts.push([g, gl, v]); };
    const bx = (sx: number, sy: number, sz: number, x: number, y: number, z: number, gl: number, v: number) => { const g = new THREE.BoxGeometry(sx, sy, sz); g.translate(x, y, z); put(g, gl, v); };
    const BODY: [number, number][][] = [
      [[-2.2, -0.3], [-2.25, 0.02], [-1.9, 0.2], [-0.95, 0.3], [-0.45, 0.72], [0.8, 0.76], [1.45, 0.34], [2.2, 0.26], [2.25, -0.06], [2.0, -0.32]],
      [[-2.4, -0.32], [-2.45, 0.18], [-2.05, 0.95], [1.95, 1.04], [2.38, 0.88], [2.42, -0.32]],
      [[-2.3, -0.22], [-2.36, -0.02], [-1.6, 0.13], [-0.6, 0.28], [-0.05, 0.6], [0.9, 0.58], [1.65, 0.28], [2.3, 0.24], [2.32, -0.22]],
    ];
    const GLASS: [number, number][][] = [
      [[-0.4, 0.34], [-0.38, 0.66], [0.72, 0.7], [1.3, 0.36]],
      [[-1.95, 0.45], [-1.9, 0.88], [1.8, 0.94], [1.85, 0.5]],
      [[-0.55, 0.3], [-0.06, 0.55], [0.85, 0.54], [1.5, 0.3]],
    ];
    const W = [1.9, 2.0, 2.0];
    BODY.forEach((pts, v) => {
      put(profile(pts, W[v], 0.12), 0, v);
      put(profile(GLASS[v], W[v] + 0.04, 0.02), 4, v);
      const zr = Math.max(...pts.map((q) => q[0])) + 0.02, zf = Math.min(...pts.map((q) => q[0])) - 0.02;
      bx(W[v] * 0.86, 0.09, 0.05, 0, v === 1 ? 0.55 : 0.12, zr, 1, v); bx(W[v] * 0.8, 0.07, 0.05, 0, v === 1 ? 0.3 : 0.05, zf, 2, v);
      bx(W[v] * 0.78, 0.04, 3.6, 0, -0.36, 0, 3, v);
    });
    const pos: number[] = [], nrm: number[] = [], gla: number[] = [], vra: number[] = [], idx: number[] = []; let off = 0;
    for (const [g, gl, v] of parts) { const P = g.attributes.position, N = g.attributes.normal; for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nrm.push(N.getX(i), N.getY(i), N.getZ(i)); gla.push(gl); vra.push(v); } const I = g.index!; for (let i = 0; i < I.count; i++) idx.push(I.getX(i) + off); off += P.count; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); geo.setAttribute('glow', new THREE.Float32BufferAttribute(gla, 1)); geo.setAttribute('variant', new THREE.Float32BufferAttribute(vra, 1)); geo.setIndex(idx);
    const m = new THREE.MeshStandardNodeMaterial();
    const gl = attribute('glow', 'float');
    const keep = step(abs(attribute('variant', 'float').sub(floor(iC.y))), float(0.5));
    m.positionNode = toWorld(positionLocal.mul(endFade).mul(keep));
    m.colorNode = mix(mix(vec3(0.05, 0.055, 0.07), vec3(0.2, 0.05, 0.1), iC.x.mul(0.5)), vec3(0.01, 0.015, 0.02), step(3.5, gl));
    m.metalnessNode = float(0.7); m.roughnessNode = float(0.3);
    const em = mix(mix(vec3(0), vec3(1.0, 0.05, 0.08).mul(6.0), step(0.5, gl).mul(step(gl, float(1.5)))),
      mix(vec3(0.9, 0.95, 1.0).mul(8.0), mix(vec3(0.1, 0.9, 1.0), vec3(1.0, 0.2, 0.7), step(0.5, iC.x)).mul(0.6), step(2.5, gl)), step(1.5, gl));
    m.emissiveNode = em.add(vec3(1.0, 0.7, 0.45).mul(step(3.5, gl)).mul(0.25));
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
    const std = (c: number, r: number, m: number) => { const q = new THREE.MeshStandardNodeMaterial(); q.color = new THREE.Color(c); q.roughness = r; q.metalness = m; return q; };
    const body = std(0x1a1d24, 0.35, 0.6), skirt = std(0x0a0b0e, 0.6, 0.4), roof = std(0x3a3f4a, 0.45, 0.7);
    const win = new THREE.MeshBasicNodeMaterial(); win.color = new THREE.Color(0xffd29a).multiplyScalar(2.2);
    const stripe = new THREE.MeshBasicNodeMaterial(); stripe.color = new THREE.Color(0x30e8ff).multiplyScalar(4);
    const lamp = new THREE.MeshBasicNodeMaterial(); lamp.color = new THREE.Color(0xffffff).multiplyScalar(8);
    const sign = new THREE.MeshBasicNodeMaterial(); sign.color = new THREE.Color(0xffa020).multiplyScalar(5);
    const put = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.x = rx; o.castShadow = true; this.mesh.add(o); return o; };
    // cross-section: rounded shoulders, tumblehome, extruded along the car (local -z forward)
    const xs = new THREE.Shape(); const H = 3.0, Wd = 1.4;
    xs.moveTo(-Wd + 0.15, 0); xs.lineTo(Wd - 0.15, 0); xs.lineTo(Wd, 0.5); xs.lineTo(Wd, 2.2); xs.quadraticCurveTo(Wd, H, Wd - 0.6, H); xs.lineTo(-Wd + 0.6, H); xs.quadraticCurveTo(-Wd, H, -Wd, 2.2); xs.lineTo(-Wd, 0.5); xs.closePath();
    const carG = new THREE.ExtrudeGeometry(xs, { depth: 10.6, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.12, bevelSegments: 3, curveSegments: 6 }); carG.translate(0, 0, -5.3);
    const winG = new THREE.BoxGeometry(2.86, 0.95, 9.4), strG = new THREE.BoxGeometry(2.84, 0.06, 10.6), bogG = new THREE.BoxGeometry(2.2, 0.5, 2.4), wheelG = new THREE.CylinderGeometry(0.38, 0.38, 2.3, 12);
    for (let c = 0; c < 3; c++) {
      const z = c * 11.6;
      put(carG, body, 0, 0.4, z);
      put(winG, win, 0, 2.25, z);
      put(strG, stripe, 0, 1.25, z);
      put(new THREE.BoxGeometry(2.2, 0.25, 9.6), roof, 0, 3.55, z);                       // roof equipment pod
      for (const bz of [-3.6, 3.6]) { put(bogG, skirt, 0, 0.35, z + bz); for (const wz of [-0.7, 0.7]) put(wheelG, skirt, 0, 0.3, z + bz + wz, 0).rotation.z = Math.PI / 2; }
      if (c < 2) put(new THREE.BoxGeometry(2.3, 2.6, 1.2), skirt, 0, 1.75, z + 5.8);       // gangway bellows
    }
    // pantograph on the lead car
    const pa = new THREE.BoxGeometry(0.06, 1.3, 0.06);
    put(pa, roof, 0, 4.2, -1.5, 0.7); put(pa, roof, 0, 4.2, -0.5, -0.7); put(new THREE.BoxGeometry(1.8, 0.05, 0.1), roof, 0, 4.75, -1.0);
    // cab ends: sloped nose with twin lamps + destination sign (both ends; trams run back and forth)
    for (const [ez, dir] of [[-5.6, -1], [2 * 11.6 + 5.6, 1]] as [number, number][]) {
      const nose = put(new THREE.BoxGeometry(2.7, 1.6, 0.6), win, 0, 2.5, ez + dir * 0.05, dir * 0.25); nose.scale.set(1, 1, 0.4);
      put(new THREE.BoxGeometry(1.6, 0.25, 0.08), sign, 0, 3.15, ez + dir * 0.2);
      for (const sx of [-0.95, 0.95]) put(new THREE.BoxGeometry(0.4, 0.12, 0.06), dir < 0 ? lamp : stripe, sx, 1.05, ez + dir * 0.18);
    }
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
