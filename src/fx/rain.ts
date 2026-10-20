// Layered rain: GPU-animated streaks in a box that wraps around the camera (streaks stretch with relative
// velocity so speed reads as rain rushing past) + ground splash rings. One draw call each.
import * as THREE from 'three/webgpu';
import { attribute, uniform, vec3, float, mod, mix, normalize, cross, length, smoothstep, time, fract, hash, abs, clamp, vec4, sin } from 'three/tsl';
import { U } from '../materials/materials';

export class Rain {
  mesh: THREE.Mesh; splash: THREE.Mesh;
  cam = uniform(new THREE.Vector3());
  rel = uniform(new THREE.Vector3(0, -14, 0));
  groundY = uniform(0);
  intensity = uniform(1);
  constructor(scene: THREE.Scene, count: number) {
    const box = vec3(46, 26, 46);
    const fall = vec3(1.2, -13.5, 0.6);
    // streaks
    const g = new THREE.BufferGeometry();
    const seed = new Float32Array(count * 4 * 3), corner = new Float32Array(count * 4 * 2), idx = new Uint32Array(count * 6);
    for (let i = 0; i < count; i++) {
      const sx = Math.random(), sy = Math.random(), sz = Math.random();
      for (let k = 0; k < 4; k++) { seed.set([sx, sy, sz], (i * 4 + k) * 3); corner.set([k & 1 ? 1 : -1, k >> 1], (i * 4 + k) * 2); }
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2], i * 6);
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 12), 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
    g.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const sd = attribute('seed', 'vec3'), cn = attribute('corner', 'vec2');
    const p0 = sd.mul(box).add(fall.mul(time.mul(sd.y.mul(0.3).add(0.85))));
    const local = mod(p0.sub(this.cam).add(box.mul(0.5)), box).sub(box.mul(0.5));
    const p = this.cam.add(local);
    const relLen = length(this.rel);
    const dir = normalize(this.rel);
    const streak = dir.mul(relLen.mul(0.028).add(0.25));
    const toCam = normalize(p.sub(this.cam));
    const side = normalize(cross(dir, toCam)).mul(0.012);
    m.positionNode = p.add(streak.mul(cn.y)).add(side.mul(cn.x));
    const d = length(local);
    const fade = smoothstep(1.2, 4.0, d).mul(smoothstep(23.0, 12.0, d));
    const head = mix(float(1), float(0.25), cn.y);
    m.colorNode = vec3(0.55, 0.62, 0.8).mul(fade.mul(head).mul(this.intensity).mul(0.55));
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 10;
    scene.add(this.mesh);

    // splashes: rings on the ground within ~22 m
    const sc = Math.floor(count / 6);
    const sg = new THREE.BufferGeometry();
    const sseed = new Float32Array(sc * 4 * 3), scorner = new Float32Array(sc * 4 * 2), sidx = new Uint32Array(sc * 6);
    for (let i = 0; i < sc; i++) {
      const a = Math.random(), b = Math.random(), c = Math.random();
      for (let k = 0; k < 4; k++) { sseed.set([a, b, c], (i * 4 + k) * 3); scorner.set([k & 1 ? 1 : -1, k >> 1 ? 1 : -1], (i * 4 + k) * 2); }
      sidx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2], i * 6);
    }
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sc * 12), 3));
    sg.setAttribute('seed', new THREE.BufferAttribute(sseed, 3));
    sg.setAttribute('corner', new THREE.BufferAttribute(scorner, 2));
    sg.setIndex(new THREE.BufferAttribute(sidx, 1));
    const sm = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const ss = attribute('seed', 'vec3'), sco = attribute('corner', 'vec2');
    const cycle = time.mul(ss.z.mul(0.8).add(1.6)).add(ss.x.mul(13.0));
    const ph = fract(cycle);
    const gen = cycle.sub(ph); // re-randomise position every cycle
    const rx = hash(gen.add(ss.x.mul(911.0))).sub(0.5).mul(44.0), rz = hash(gen.add(ss.y.mul(577.0))).sub(0.5).mul(44.0);
    const size = ph.mul(0.22).add(0.04);
    const spos = vec3(this.cam.x.add(rx), this.groundY.add(0.03), this.cam.z.add(rz));
    sm.positionNode = spos.add(vec3(sco.x.mul(size), 0, sco.y.mul(size)));
    const rr = length(sco);
    const ring = smoothstep(0.65, 0.85, rr).mul(smoothstep(1.0, 0.85, rr));
    const sfade = float(1).sub(ph).mul(smoothstep(24.0, 8.0, length(vec3(rx, 0, rz))));
    sm.colorNode = vec3(0.6, 0.68, 0.85).mul(ring.mul(sfade).mul(this.intensity).mul(U.wet).mul(0.6));
    this.splash = new THREE.Mesh(sg, sm); this.splash.frustumCulled = false; this.splash.renderOrder = 9;
    scene.add(this.splash);
  }
  update(camPos: THREE.Vector3, camVel: THREE.Vector3, groundY: number, intensity: number) {
    this.cam.value.copy(camPos);
    this.rel.value.set(1.2 - camVel.x, -13.5 - camVel.y, 0.6 - camVel.z);
    this.groundY.value = groundY;
    this.intensity.value = intensity;
    this.mesh.visible = this.splash.visible = intensity > 0.01;
  }
}
export const _r = { abs, clamp, vec4, sin };
