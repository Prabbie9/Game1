// Heat + pursuit. Heat 0..5: 1-2 drones, 3-4 + low patrol flyers, 5 + roadblocks. Pursuers fly (no ground
// collision needed) and carry searchlight cones. Detection is analytic: cone test × range scaled by light
// exposure (darkness, bike lights) × line of sight × cover. Seeing the player fills a warning meter over
// ~2 s (the grace period) before it counts; breaking sight for long enough loses them and heat cools.
import * as THREE from 'three/webgpu';
import { vec3, float, uv, abs, smoothstep, uniform, normalize, dot, positionView, normalView, time, sin } from 'three/tsl';
import type { Occlusion } from './occlusion';
import { buildCraft } from './craft';

export type PursuerKind = 'drone' | 'patrol' | 'hound' | 'sweeper';
const SPEC: Record<PursuerKind, { speed: number; alt: number; range: number; cone: number; color: number }> = {
  drone: { speed: 24, alt: 15, range: 46, cone: 0.42, color: 0xbfe6ff },
  patrol: { speed: 30, alt: 7, range: 52, cone: 0.5, color: 0xff3048 },
  hound: { speed: 37, alt: 9, range: 60, cone: 0.55, color: 0xff2aa8 },
  sweeper: { speed: 9, alt: 16, range: 40, cone: 0.38, color: 0xfff2c0 },
};

export interface PlayerView { x: number; y: number; z: number; vx: number; vz: number; speed: number; lightsOn: boolean; stealthMul: number }

export class Pursuer {
  pos = new THREE.Vector3(); vel = new THREE.Vector3(); aim = new THREE.Vector3(0, -1, 0);
  tracking = false; lastSeen = new THREE.Vector3(); lostT = 0; leaving = false; t = Math.random() * 10;
  mesh: THREE.Group; cone: THREE.Mesh; coneCol: any;
  hull: THREE.Group; strobes: THREE.Object3D[] = []; rotors: THREE.Object3D[] = []; private yaw = 0;
  path: THREE.Vector3[] | null = null; pathI = 0;
  constructor(public kind: PursuerKind, scene: THREE.Scene, at: THREE.Vector3) {
    const S = SPEC[kind];
    this.pos.copy(at);
    this.mesh = new THREE.Group();
    this.hull = buildCraft(kind); this.mesh.add(this.hull);
    this.hull.traverse((o) => { if (o.name === 'strobe') this.strobes.push(o); else if (o.name === 'rotor') this.rotors.push(o); });
    // searchlight cone (fake volumetric): apex at the pursuer, opening toward `aim`
    const len = S.range, r = Math.tan(S.cone) * len;
    const g = new THREE.ConeGeometry(r, len, 24, 1, true); g.translate(0, -len / 2, 0);
    const uvA = g.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setY(i, 1 - uvA.getY(i));
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, forceSinglePass: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false });
    this.coneCol = uniform(new THREE.Color(S.color));
    const v = uv().y;
    const fres = abs(dot(normalize(positionView).negate(), normalView));
    m.colorNode = this.coneCol.mul(float(1).sub(v).pow(1.3).mul(fres.pow(2.5)).mul(0.16).mul(sin(time.mul(3.0)).mul(0.08).add(0.92)));
    this.cone = new THREE.Mesh(g, m);
    this.mesh.add(this.cone);
    scene.add(this.mesh);
  }
  dispose(scene: THREE.Scene) { scene.remove(this.mesh); this.cone.geometry.dispose(); } // craft geometry is shared

  /** Can this pursuer see the player right now? (analytic) */
  sees(p: PlayerView, occ: Occlusion, exposure: number, covered: boolean) {
    const S = SPEC[this.kind];
    const to = new THREE.Vector3(p.x - this.pos.x, p.y + 0.6 - this.pos.y, p.z - this.pos.z);
    const d = to.length();
    // darkness shrinks the effective range; bike lights + speed make you easier to spot
    const vis = Math.min(1.4, 0.35 + exposure * 0.8 + (p.lightsOn ? 0.45 : 0) + Math.min(0.2, p.speed / 150));
    if (d > S.range * vis) return false;
    if (to.normalize().dot(this.aim) < Math.cos(S.cone)) return false;
    if (covered && this.pos.y > p.y + 4) return false;
    return occ.los(this.pos.x, this.pos.y - 0.5, this.pos.z, p.x, p.y + 0.6, p.z);
  }

  static steadyStrobes = false; // comfort: reduce flashing
  update(dt: number, p: PlayerView, seen: boolean) {
    const S = SPEC[this.kind];
    this.t += dt;
    let target: THREE.Vector3;
    if (this.leaving) target = new THREE.Vector3(this.pos.x, 80, this.pos.z);
    else if (this.path && !this.tracking) {
      target = this.path[this.pathI];
      if (Math.hypot(target.x - this.pos.x, target.z - this.pos.z) < 3) this.pathI = (this.pathI + 1) % this.path.length;
    } else {
      if (seen) { this.lastSeen.set(p.x + p.vx * 0.6, p.y, p.z + p.vz * 0.6); }
      // hover behind/above the last known position; search pattern once lost
      const search = this.tracking && this.lostT > 1 ? new THREE.Vector3(Math.cos(this.t * 0.7) * 18, 0, Math.sin(this.t * 0.7) * 18) : new THREE.Vector3();
      target = this.lastSeen.clone().add(search);
      target.y = this.lastSeen.y + S.alt;
    }
    const want = target.clone().sub(this.pos);
    const dist = want.length();
    const sp = Math.min(S.speed, dist * 1.5);
    want.normalize().multiplyScalar(sp);
    this.vel.lerp(want, 1 - Math.exp(-2.5 * dt));
    this.pos.addScaledVector(this.vel, dt);
    if (!this.leaving) this.pos.y = Math.max(this.pos.y, (this.path ? target.y : this.lastSeen.y + S.alt * 0.6));
    // aim the searchlight: at the player when tracking, otherwise sweep the ground
    const aimTo = this.tracking && !this.path ? this.lastSeen.clone().add(new THREE.Vector3(0, 0.5, 0)) :
      this.pos.clone().add(new THREE.Vector3(Math.cos(this.t * 0.9) * 10, -S.alt - 2, Math.sin(this.t * 1.3) * 10));
    const a = aimTo.sub(this.pos).normalize();
    this.aim.lerp(a, 1 - Math.exp(-(this.tracking ? 6 : 2) * dt)).normalize();
    this.mesh.position.copy(this.pos);
    this.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), this.aim);
    for (const o of this.strobes) o.visible = Pursuer.steadyStrobes || Math.sin(this.t * 14 + (o.position.x > 0 ? Math.PI : 0)) > 0;
    for (const o of this.rotors) o.rotation.y += dt * 40;
    // hull faces its velocity and banks into turns (the cone keeps its own world aim)
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 0.5) { const want = Math.atan2(-this.vel.x, -this.vel.z); let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * (1 - Math.exp(-3 * dt)); this.hull.rotation.set(-Math.min(0.25, hs * 0.008), this.yaw, Math.max(-0.5, Math.min(0.5, -d * 0.6)), 'YXZ'); }
  }
}

export class HeatSystem {
  heat = 0;            // 0..5
  meter = 0;           // 0..1 warning before detection
  seen = false;        // someone sees the player this frame (pre-grace)
  spotted = false;     // detection confirmed (meter full) and not yet lost
  unseenT = 99;
  exposure = 0; covered = false;
  pursuers: Pursuer[] = [];
  roadblocks: THREE.Group | null = null;
  onSpotted: () => void = () => {};
  onRoadblocks: (boxes: { x: number; z: number; yaw: number }[] | null) => void = () => {};
  private spawnCd = 0;
  constructor(private scene: THREE.Scene, private occ: Occlusion) {}

  setHeat(h: number) { this.heat = Math.max(0, Math.min(5, h)); if (h >= 1) { this.spotted = true; this.unseenT = 0; } }
  add(kind: PursuerKind, at: THREE.Vector3, path?: THREE.Vector3[]) { const p = new Pursuer(kind, this.scene, at); if (path) p.path = path; this.pursuers.push(p); return p; }
  clear(kind?: PursuerKind) { this.pursuers = this.pursuers.filter((p) => { if (!kind || p.kind === kind) { p.dispose(this.scene); return false; } return true; }); }

  update(dt: number, P: PlayerView) {
    this.exposure = this.occ.exposure(P.x, P.y, P.z) + (P.lightsOn ? 0.25 : 0);
    this.covered = this.occ.covered(P.x, P.y, P.z);
    let anySee = false;
    for (const q of this.pursuers) {
      const s = !q.leaving && q.sees(P, this.occ, this.exposure, this.covered);
      if (s) { anySee = true; if (this.spotted) { q.tracking = true; q.lostT = 0; } }
      else if (q.tracking) q.lostT += dt;
      q.update(dt, P, s && this.spotted);
    }
    this.seen = anySee;
    // grace meter: ~2 s of continuous sight before detection (stealth upgrade stretches it)
    if (anySee) this.meter = Math.min(1, this.meter + dt / (2.0 * P.stealthMul));
    else this.meter = Math.max(0, this.meter - dt * 0.45);
    if (this.meter >= 1 && !this.spotted) {
      this.spotted = true; this.heat = Math.max(this.heat, 1) + (this.heat >= 1 ? 1 : 0); this.heat = Math.min(5, this.heat);
      for (const q of this.pursuers) if (!q.path) q.tracking = true;
      this.onSpotted();
    }
    if (anySee && this.spotted) this.unseenT = 0; else this.unseenT += dt;
    // losing them: 7 s out of sight → they search, then heat cools one level every 8 s
    if (this.spotted && this.unseenT > 7) { this.spotted = false; this.meter = 0; for (const q of this.pursuers) if (!q.path) q.tracking = q.lostT < 7; }
    if (!this.spotted && this.heat > 0 && this.unseenT > 7) { this.heat = Math.max(0, this.heat - dt / 8); }
    // escalation: keep the pursuer roster matched to the heat level
    this.spawnCd -= dt;
    const want = { drone: this.heat >= 1 ? (this.heat >= 2 ? 2 : 1) : 0, patrol: this.heat >= 3 ? (this.heat >= 4 ? 2 : 1) : 0 };
    for (const kind of ['drone', 'patrol'] as const) {
      const have = this.pursuers.filter((p) => p.kind === kind && !p.leaving);
      if (have.length < Math.floor(want[kind]) && this.spawnCd <= 0) {
        const a = Math.random() * Math.PI * 2;
        const q = this.add(kind, new THREE.Vector3(P.x + Math.cos(a) * 90, 40, P.z + Math.sin(a) * 90));
        q.lastSeen.set(P.x, P.y, P.z); q.tracking = this.spotted; this.spawnCd = 3;
      } else if (have.length > Math.ceil(want[kind])) { have[0].leaving = true; }
    }
    for (const q of [...this.pursuers]) if (q.leaving && q.pos.y > 70) { q.dispose(this.scene); this.pursuers.splice(this.pursuers.indexOf(q), 1); }
    // roadblocks at heat 5: barriers across the road ahead of the player
    if (this.heat >= 4.99 && !this.roadblocks) this.placeRoadblocks(P);
    else if (this.heat < 4 && this.roadblocks) { this.scene.remove(this.roadblocks); this.roadblocks = null; this.onRoadblocks(null); }
  }

  private placeRoadblocks(P: PlayerView) {
    const yaw = Math.atan2(-P.vx, -P.vz), fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const spots = [{ x: P.x + fx * 70, z: P.z + fz * 70, yaw }];
    const g = new THREE.Group();
    const bar = new THREE.MeshStandardNodeMaterial(); bar.color = new THREE.Color(0x111111); bar.emissive = new THREE.Color(0xff2030); bar.emissiveIntensity = 2;
    for (const s of spots) for (const off of [-4.5, 0, 4.5]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.1, 0.6), bar);
      m.position.set(s.x + Math.cos(s.yaw) * off, 0.55, s.z - Math.sin(s.yaw) * off); m.rotation.y = s.yaw; g.add(m);
    }
    this.scene.add(g); this.roadblocks = g;
    // gaps between barriers stay open (an escape route always exists)
    this.onRoadblocks(spots.flatMap((s) => [-4.5, 0, 4.5].map((off) => ({ x: s.x + Math.cos(s.yaw) * off, z: s.z - Math.sin(s.yaw) * off, yaw: s.yaw }))));
  }
}
export const _h = { vec3, smoothstep };
