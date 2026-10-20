// @ts-nocheck -- TSL node typings are too narrow for swizzled instanced attributes; checked at runtime
// Crowds: instanced low-poly pedestrians walking sidewalk segments back and forth, with a vertex-animated
// walk cycle and glowing umbrellas. All motion is computed in the vertex shader (zero CPU per frame).
// Mid crowd = full figures within ~110 m; far crowd = the same instances reduced to silhouettes by fog.
import * as THREE from 'three/webgpu';
import { instancedBufferAttribute, attribute, vec3, vec4, float, sin, cos, fract, abs, mix, step, time, length, positionLocal, cameraPosition, smoothstep, select } from 'three/tsl';
import { distFade } from '../materials/materials';

export interface WalkSeg { a: [number, number]; b: [number, number]; y: number }

function figureGeometry() {
  // parts: 0 torso/head, 1 left leg, 2 right leg, 3 left arm, 4 right arm, 5 glow strip
  const parts: [THREE.BufferGeometry, number][] = [];
  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, part: number) => { g.translate(x, y, z); parts.push([g, part]); };
  add(new THREE.BoxGeometry(0.42, 0.62, 0.24), 0, 1.22, 0, 0);
  add(new THREE.BoxGeometry(0.22, 0.24, 0.22), 0, 1.68, 0, 0);
  add(new THREE.BoxGeometry(0.16, 0.86, 0.16), -0.11, 0.48, 0, 1);
  add(new THREE.BoxGeometry(0.16, 0.86, 0.16), 0.11, 0.48, 0, 2);
  add(new THREE.BoxGeometry(0.11, 0.6, 0.11), -0.28, 1.2, 0, 3);
  add(new THREE.BoxGeometry(0.11, 0.6, 0.11), 0.28, 1.2, 0, 4);
  add(new THREE.BoxGeometry(0.44, 0.04, 0.26), 0, 1.0, 0, 5);
  const pos: number[] = [], nrm: number[] = [], prt: number[] = [], idx: number[] = [];
  let off = 0;
  for (const [g, p] of parts) {
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nrm.push(N.getX(i), N.getY(i), N.getZ(i)); prt.push(p); }
    const I = g.index!; for (let i = 0; i < I.count; i++) idx.push(I.getX(i) + off);
    off += P.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  out.setAttribute('part', new THREE.Float32BufferAttribute(prt, 1)); out.setIndex(idx);
  return out;
}

export class Crowds {
  group = new THREE.Group();
  constructor(segs: WalkSeg[], density: number, seed = 1) {
    let s = seed; const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const A: number[] = [], B: number[] = [], C: number[] = [];
    for (const g of segs) {
      const len = Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]);
      const n = Math.floor(len * density * (0.6 + R() * 0.8));
      for (let i = 0; i < n; i++) {
        A.push(g.a[0], g.a[1], g.b[0], g.b[1]);
        B.push(R(), 0.9 + R() * 0.7, R(), R() < 0.4 ? 1 : 0); // phase, speed m/s, hue, umbrella
        C.push(g.y, (R() - 0.5) * 1.6, 0, 0);                    // ground y, lateral offset
      }
    }
    const count = A.length / 4;
    if (!count) return;
    const iA = instancedBufferAttribute(new THREE.InstancedBufferAttribute(new Float32Array(A), 4));
    const iB = instancedBufferAttribute(new THREE.InstancedBufferAttribute(new Float32Array(B), 4));
    const iC = instancedBufferAttribute(new THREE.InstancedBufferAttribute(new Float32Array(C), 4));
    // shared walk maths
    const a = iA.xy, b = iA.zw;
    const seg = b.sub(a); const len = length(seg); const dir = seg.div(len.max(0.01));
    const cyc = fract(time.mul(iB.y).div(len.mul(2.0)).add(iB.x));
    const back = step(0.5, cyc);
    const d = mix(cyc.mul(2.0), float(2.0).sub(cyc.mul(2.0)), back).mul(len);
    const fwd = mix(dir, dir.negate(), back);
    const side = vec3(fwd.y.negate(), 0, fwd.x).mul(iC.y);
    const base = vec3(a.x.add(dir.x.mul(d)), iC.x, a.y.add(dir.y.mul(d))).add(side);
    const yawS = fwd.x, yawC = fwd.y; // facing direction in xz
    const toWorld = (p: any) => vec3(p.x.mul(yawC).add(p.z.mul(yawS)), p.y, p.z.mul(yawC).sub(p.x.mul(yawS))).add(base);
    const near = smoothstep(150.0, 110.0, length(base.sub(cameraPosition)));

    // figures
    const fm = new THREE.MeshStandardNodeMaterial();
    const part = attribute('part', 'float');
    const ph = time.mul(iB.y).mul(5.5).add(iB.x.mul(40.0));
    const swingL = sin(ph).mul(0.55), swingR = swingL.negate();
    const ang = select(part.equal(1), swingL, select(part.equal(2), swingR, select(part.equal(3), swingR.mul(0.7), select(part.equal(4), swingL.mul(0.7), float(0)))));
    const pivotY = select(part.lessThan(2.5), float(0.92), float(1.48));
    const lp = positionLocal;
    const py = lp.y.sub(pivotY);
    const rot = vec3(lp.x, py.mul(cos(ang)).sub(lp.z.mul(sin(ang))).add(pivotY), py.mul(sin(ang)).add(lp.z.mul(cos(ang))));
    const bob = abs(sin(ph)).mul(0.04);
    fm.positionNode = toWorld(rot.add(vec3(0, bob, 0))).mul(near).add(base.mul(float(1).sub(near))); // collapse when far
    const coat = mix(vec3(0.05, 0.05, 0.06), vec3(0.12, 0.06, 0.1), iB.z);
    fm.colorNode = coat;
    fm.roughnessNode = float(0.55);
    const glowCol = mix(vec3(0.1, 0.9, 1.0), vec3(1.0, 0.2, 0.7), step(0.5, iB.z));
    fm.emissiveNode = glowCol.mul(step(4.5, part)).mul(step(0.7, fract(iB.z.mul(7.0)))).mul(3.0);
    const figs = new THREE.InstancedMesh(figureGeometry(), fm, count);
    figs.frustumCulled = false; this.group.add(figs);

    // glowing umbrellas (canopy cone with emissive rim) + far silhouettes stay readable as glows in fog
    const ug = new THREE.ConeGeometry(0.62, 0.32, 10, 1, true); ug.translate(0, 2.12, 0);
    const um = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, fog: false });
    const ul = positionLocal;
    const rim = smoothstep(0.45, 0.6, length(ul.xz));
    const ucol = mix(mix(vec3(0.1, 0.9, 1.0), vec3(1.0, 0.2, 0.7), step(0.33, iB.z)), vec3(1.0, 0.6, 0.15), step(0.75, iB.z));
    um.positionNode = toWorld(ul.add(vec3(0, abs(sin(ph)).mul(0.04), 0))).mul(iB.w).add(base.mul(float(1).sub(iB.w)));
    um.colorNode = ucol.mul(rim.mul(2.5).add(0.25)).mul(distFade());
    const umbs = new THREE.InstancedMesh(ug, um, count);
    umbs.frustumCulled = false; this.group.add(umbs);
  }
}
export const _c = { vec4 };
