// Procedural hover bike + rider, emissive accents, headlight, under-glow light and tail-light trails.
import * as THREE from 'three/webgpu';
import { attribute, vec3, float, uniform } from 'three/tsl';
import type { VehicleState } from './sim';
import { buildHull, type HullHandles } from './bikeHull';
import { override } from '../assets/overrides';

function std(col: number, rough: number, metal: number) { const m = new THREE.MeshStandardNodeMaterial(); m.color = new THREE.Color(col); m.roughness = rough; m.metalness = metal; return m; }
function glow(col: number, k: number) { const m = new THREE.MeshBasicNodeMaterial(); m.color = new THREE.Color(col).multiplyScalar(k); return m; }

export class BikeModel {
  root = new THREE.Group();
  body = new THREE.Group();
  head: THREE.SpotLight;
  under: THREE.PointLight;
  trails: Trail[] = [];
  private lean = 0; private pitch = 0; private bob = 0;
  lightsOn = true;
  hull!: HullHandles;
  constructor(scene: THREE.Scene, shadow: boolean, withRider = true) {
    const add = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
      const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; this.body.add(o); return o;
    };
    // hero hull (bikeHull.ts): fairings, pods, thruster bells, emitters, vanes, bars
    this.hull = buildHull(this.body);
    const ov = override('vehicles/bike'); // drop-in GLB (assets/WANTED.md) replaces the procedural hull
    if (ov) { for (const c of this.body.children) c.visible = false; this.body.add(ov); }
    add(new THREE.BoxGeometry(0.62, 0.02, 1.5), glow(0xff2aa8, 1.2), 0, -0.31, -0.05);     // faint under-glow sheet
    if (withRider) { // fallback box rider (the skinned courier from characters/ replaces it when loaded)
    const suit = std(0x1a1b22, 0.6, 0.1);
    add(new THREE.CapsuleGeometry(0.2, 0.45, 4, 10), suit, 0, 0.72, 0.25, -0.75);
    add(new THREE.SphereGeometry(0.17, 14, 10), std(0x0c0d10, 0.2, 0.6), 0, 1.0, -0.05);
    add(new THREE.BoxGeometry(0.26, 0.05, 0.1), glow(0xff2aa8, 6), 0, 1.0, -0.19);    // visor
    add(new THREE.CapsuleGeometry(0.07, 0.4, 4, 8), suit, -0.22, 0.6, -0.2, -1.1);
    add(new THREE.CapsuleGeometry(0.07, 0.4, 4, 8), suit, 0.22, 0.6, -0.2, -1.1);
    }
    this.root.add(this.body);

    this.head = new THREE.SpotLight(0xdff0ff, 60, 45, 0.42, 0.5, 1.6);
    this.head.position.set(0, 0.2, -1.3); this.head.target.position.set(0, -1.2, -12);
    this.head.castShadow = shadow; if (shadow) { this.head.shadow.mapSize.set(1024, 1024); this.head.shadow.bias = -0.0004; }
    this.body.add(this.head); this.body.add(this.head.target);
    this.under = new THREE.PointLight(0xff2aa8, 6, 7, 2);
    this.under.position.set(0, -0.6, 0); this.body.add(this.under);
    scene.add(this.root);
    for (const sx of [-0.25, 0.25]) this.trails.push(new Trail(scene, new THREE.Vector3(sx, 0.18, 1.1), new THREE.Color(0xff1030)));
  }

  update(pose: { x: number; y: number; z: number; yaw: number }, s: VehicleState, dt: number) {
    this.root.position.set(pose.x, pose.y, pose.z);
    this.root.rotation.set(0, pose.yaw, 0);
    const speed = s.speed;
    const targetLean = Math.max(-0.6, Math.min(0.6, -s.yawRate * 0.022 * speed - s.slip * 0.015));
    this.lean += (targetLean - this.lean) * (1 - Math.exp(-8 * dt));
    // pitch from ground normal along heading
    const fx = -Math.sin(pose.yaw), fz = -Math.cos(pose.yaw);
    const slope = s.grounded ? Math.asin(Math.max(-1, Math.min(1, -(s.nx * fx + s.nz * fz)))) : Math.max(-0.4, Math.min(0.4, s.vy * 0.03));
    this.pitch += (slope - this.pitch) * (1 - Math.exp(-6 * dt));
    this.bob += dt;
    this.body.rotation.set(this.pitch + (s.boosting ? -0.04 : 0), 0, this.lean, 'YXZ');
    this.body.position.y = Math.sin(this.bob * 2.3) * 0.03 * (s.grounded ? 1 : 0);
    this.head.intensity = this.lightsOn ? 60 : 0;
    // hull animation: vanes steer, flaps trim with pitch, thrusters/emitters glow with speed and boost
    if (this.hull) {
      const vane = Math.max(-0.5, Math.min(0.5, s.yawRate * 0.22));
      this.hull.vanes.forEach((v) => { v.rotation.y += (vane - v.rotation.y) * Math.min(1, 10 * dt); });
      const flap = Math.max(-0.4, Math.min(0.4, -s.vy * 0.05 + (s.boosting ? -0.25 : 0)));
      this.hull.flaps.forEach((f) => { f.rotation.x += (flap - f.rotation.x) * Math.min(1, 6 * dt); });
      const k = this.lightsOn ? 1 : 0.15;
      this.hull.thrusterGlow.color.setRGB(0.19, 0.91, 1).multiplyScalar(k * (2.5 + speed * 0.12 + (s.boosting ? 7 : 0)));
      this.hull.emitterGlow.color.setRGB(1, 0.16, 0.66).multiplyScalar(k * (2 + Math.sin(this.bob * 9) * 0.4 + (s.grounded ? 1 : 0)));
    }
    this.under.intensity = this.lightsOn ? 6 + (s.boosting ? 6 : 0) : 0;
    this.body.updateMatrixWorld(true);
    for (const t of this.trails) t.update(this.body, speed, dt, this.lightsOn);
  }
}

/** Light trail ribbon from a point on the bike (ring buffer, camera-facing width approximated as vertical). */
class Trail {
  pts: THREE.Vector3[] = []; N = 48;
  geo = new THREE.BufferGeometry(); mesh: THREE.Mesh;
  alpha = uniform(1);
  constructor(scene: THREE.Scene, private local: THREE.Vector3, col: THREE.Color) {
    const pos = new Float32Array(this.N * 2 * 3), age = new Float32Array(this.N * 2);
    const idx: number[] = [];
    for (let i = 0; i < this.N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    for (let i = 0; i < this.N; i++) { age[i * 2] = age[i * 2 + 1] = i / (this.N - 1); }
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('age', new THREE.BufferAttribute(age, 1));
    this.geo.setIndex(idx);
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const a = attribute('age', 'float');
    m.colorNode = vec3(col.r, col.g, col.b).mul(float(1).sub(a).pow(2.0).mul(3.0).mul(this.alpha));
    this.mesh = new THREE.Mesh(this.geo, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 8;
    scene.add(this.mesh);
  }
  update(parent: THREE.Object3D, speed: number, _dt: number, on: boolean) {
    const p = this.local.clone().applyMatrix4(parent.matrixWorld);
    if (this.pts.length && this.pts[0].distanceTo(p) > 4) this.pts.length = 0; // teleport / respawn: don't stretch a ribbon across the map
    this.pts.unshift(p); if (this.pts.length > this.N) this.pts.pop();
    const pos = this.geo.attributes.position as THREE.BufferAttribute;
    const w = 0.05;
    for (let i = 0; i < this.N; i++) {
      const q = this.pts[Math.min(i, this.pts.length - 1)];
      pos.setXYZ(i * 2, q.x, q.y + w, q.z); pos.setXYZ(i * 2 + 1, q.x, q.y - w, q.z);
    }
    pos.needsUpdate = true;
    this.alpha.value = on ? Math.min(1, Math.max(0, (speed - 6) / 14)) : 0;
  }
}
