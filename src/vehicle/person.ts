// On-foot courier (and the noodle-bar cook): low-poly figure with a CPU walk cycle driven by speed.
import * as THREE from 'three/webgpu';

export class Person {
  root = new THREE.Group();
  private legs: THREE.Object3D[] = []; private arms: THREE.Object3D[] = [];
  private phase = 0;
  constructor(scene: THREE.Scene, coat = 0x1a1b22, accent = 0xff2aa8) {
    const m = new THREE.MeshStandardNodeMaterial(); m.color = new THREE.Color(coat); m.roughness = 0.6;
    const g = new THREE.MeshBasicNodeMaterial(); g.color = new THREE.Color(accent).multiplyScalar(4);
    const part = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; return o; };
    this.root.add(part(new THREE.BoxGeometry(0.44, 0.64, 0.26), m, 0, 1.24, 0));
    this.root.add(part(new THREE.SphereGeometry(0.15, 12, 10), m, 0, 1.72, 0));
    this.root.add(part(new THREE.BoxGeometry(0.24, 0.05, 0.08), g, 0, 1.73, -0.12)); // visor
    this.root.add(part(new THREE.BoxGeometry(0.46, 0.04, 0.28), g, 0, 1.0, 0));      // belt light
    for (const sx of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(sx * 0.11, 0.92, 0); leg.add(part(new THREE.BoxGeometry(0.17, 0.88, 0.17), m, 0, -0.44, 0)); this.root.add(leg); this.legs.push(leg);
      const arm = new THREE.Group(); arm.position.set(sx * 0.29, 1.5, 0); arm.add(part(new THREE.BoxGeometry(0.11, 0.62, 0.11), m, 0, -0.31, 0)); this.root.add(arm); this.arms.push(arm);
    }
    scene.add(this.root);
  }
  update(x: number, y: number, z: number, yaw: number, speed: number, grounded: boolean, dt: number) {
    this.root.position.set(x, y - 0.9, z); this.root.rotation.y = yaw;
    this.phase += dt * (2 + speed * 2.1);
    const sw = Math.min(0.9, speed * 0.16) * (grounded ? 1 : 0.3);
    this.legs[0].rotation.x = Math.sin(this.phase) * sw; this.legs[1].rotation.x = -Math.sin(this.phase) * sw;
    this.arms[0].rotation.x = -Math.sin(this.phase) * sw * 0.8; this.arms[1].rotation.x = Math.sin(this.phase) * sw * 0.8;
    if (!grounded) { this.legs[0].rotation.x = 0.5; this.legs[1].rotation.x = -0.3; }
  }
}
