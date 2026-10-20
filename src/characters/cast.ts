// The named cast: the courier (seated on the bike with steering lean, or on foot with idle/walk/jog/sprint/jump
// blends), the four fixers at their posts (talking idles) and Mama Kiso behind the Hoshi counter.
import * as THREE from 'three/webgpu';
import { Hero, OUTFITS, type HumanData } from './humans';
import type { VehicleState } from '../vehicle/sim';

export class Cast {
  courier: Hero;
  fixers = new Map<string, Hero>();
  kiso: Hero | null = null;
  private seat = new THREE.Group();
  onFoot = false;
  private lean = 0; private steer = 0; private airT = 0;
  constructor(private scene: THREE.Scene, private data: HumanData, bikeBody: THREE.Object3D) {
    this.courier = new Hero(data, OUTFITS.courier);
    // seat anchor: the rig faces +z, the bike's forward is -z → turn it round; hips sit on the saddle
    this.seat.position.set(0, -0.32, 0.36); this.seat.rotation.y = Math.PI;
    bikeBody.add(this.seat);
    this.seat.add(this.courier.root);
    this.courier.play('Driving_Loop', 0);
  }

  /** Where the rider's hands are, in bike-body space (the hull builds its handlebars there). */
  grips(body: THREE.Object3D): [THREE.Vector3, THREE.Vector3] {
    this.courier.update(0); body.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(body.matrixWorld).invert();
    const p = (n: string) => this.courier.bone(n).getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    return [p('DEF-handL'), p('DEF-handR')];
  }

  addFixer(id: string, pos: [number, number, number], faceYaw: number) {
    const of = OUTFITS[id]; if (!of) return;
    const h = new Hero(this.data, of, this.scene);
    h.root.position.set(pos[0], pos[1], pos[2]); h.root.rotation.y = faceYaw;
    h.play(id === 'ume' ? 'Idle_Loop' : 'Idle_Talking_Loop', 0, 0.8 + Math.random() * 0.3);
    h.mixer.setTime(Math.random() * 3);
    this.fixers.set(id, h);
  }
  addKiso(pos: [number, number, number], yaw: number) {
    this.kiso = new Hero(this.data, OUTFITS.kiso, this.scene);
    this.kiso.root.position.set(...pos); this.kiso.root.rotation.y = yaw;
    this.kiso.play('Idle_Loop', 0);
  }

  setOnFoot(on: boolean) {
    if (on === this.onFoot) return;
    this.onFoot = on;
    if (on) { this.scene.add(this.courier.root); this.courier.root.rotation.set(0, 0, 0); this.courier.play('Idle_Loop', 0.15); }
    else { this.seat.add(this.courier.root); this.courier.root.position.set(0, 0, 0); this.courier.root.rotation.set(0, 0, 0); this.courier.play('Driving_Loop', 0.2); }
  }

  /** Rider: driving pose + additive lean into turns and a tuck when boosting. */
  updateRider(dt: number, s: VehicleState) {
    this.courier.update(dt);
    const k = 1 - Math.exp(-8 * dt);
    this.lean += (Math.max(-0.5, Math.min(0.5, -s.yawRate * 0.12)) - this.lean) * k;
    this.steer += ((s.boosting ? 0.25 : 0) - this.steer) * k;
    const sp = this.courier.bone('DEF-spine002'), head = this.courier.bone('DEF-head');
    if (sp) { sp.rotation.z += this.lean * 0.6; sp.rotation.x += this.steer; }
    if (head) head.rotation.z -= this.lean * 0.4; // keep the eyes level-ish
  }

  /** On foot: blend idle → walk → jog → sprint by speed; jump clips when airborne. */
  updateWalker(dt: number, x: number, y: number, z: number, yaw: number, speed: number, grounded: boolean) {
    const r = this.courier.root;
    r.position.set(x, y - 0.9, z); r.rotation.y = yaw + Math.PI;
    if (!grounded) { this.airT += dt; this.courier.play(this.airT < 0.25 ? 'Jump_Start' : 'Jump_Loop', 0.12, 1.2); }
    else {
      if (this.airT > 0.3) this.courier.play('Jump_Land', 0.08, 1.4, true);
      this.airT = 0;
      const landing = this.courier.currentName === 'Jump_Land' && this.courier.current && this.courier.current.time < this.courier.current.getClip().duration * 0.5;
      if (!landing) {
        if (speed < 0.3) this.courier.play('Idle_Loop', 0.3);
        else if (speed < 3.2) this.courier.play('Walk_Loop', 0.25, Math.max(0.6, speed / 1.6));
        else if (speed < 5.2) this.courier.play('Jog_Fwd_Loop', 0.25, speed / 3.6);
        else this.courier.play('Sprint_Loop', 0.25, speed / 6.2);
      }
    }
    this.courier.update(dt);
  }

  updateNPCs(dt: number, cam: THREE.Vector3) {
    for (const h of this.fixers.values()) if (h.root.position.distanceToSquared(cam) < 90 * 90) { h.root.visible = true; h.update(dt); } else h.root.visible = false;
    if (this.kiso) { const near = this.kiso.root.position.distanceToSquared(cam) < 40 * 40; this.kiso.root.visible = near; if (near) this.kiso.update(dt); }
  }
}
