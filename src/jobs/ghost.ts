// Ghost replays: record the bike pose at 10 Hz during a job; the best run per job is kept in localStorage and
// replayed as a translucent cyan bike the next time you take that job.
import * as THREE from 'three/webgpu';

const HZ = 10;
export class GhostRecorder {
  data: number[] = []; private acc = 0;
  reset() { this.data = []; this.acc = 0; }
  tick(dt: number, x: number, y: number, z: number, yaw: number) { this.acc += dt; while (this.acc >= 1 / HZ) { this.acc -= 1 / HZ; this.data.push(x, y, z, yaw); } }
}

export function saveGhost(jobId: string, data: number[]) {
  try {
    const f = new Float32Array(data); let s = ''; const u = new Uint8Array(f.buffer);
    for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    localStorage.setItem('nc.ghost.' + jobId, btoa(s));
  } catch { /* storage full or blocked: ghosts are a nicety */ }
}
export function loadGhost(jobId: string): Float32Array | null {
  try {
    const s = localStorage.getItem('nc.ghost.' + jobId); if (!s) return null;
    const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return new Float32Array(u.buffer);
  } catch { return null; }
}

export class GhostPlayer {
  mesh: THREE.Group;
  constructor(scene: THREE.Scene, private data: Float32Array) {
    const m = new THREE.MeshBasicNodeMaterial({ color: new THREE.Color(0x30e0ff).multiplyScalar(0.9), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.mesh = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.5, 4, 10), m); hull.rotation.x = Math.PI / 2; this.mesh.add(hull);
    const rider = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.45, 4, 8), m); rider.position.set(0, 0.72, 0.25); rider.rotation.x = -0.75; this.mesh.add(rider);
    scene.add(this.mesh);
  }
  update(t: number) {
    const n = this.data.length / 4, f = Math.min(n - 1.001, t * HZ), i = Math.floor(f), k = f - i, d = this.data;
    if (n < 2) return;
    const a = i * 4, b = (i + 1) * 4;
    this.mesh.position.set(d[a] + (d[b] - d[a]) * k, d[a + 1] + (d[b + 1] - d[a + 1]) * k, d[a + 2] + (d[b + 2] - d[a + 2]) * k);
    let dy = d[b + 3] - d[a + 3]; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    this.mesh.rotation.y = d[a + 3] + dy * k;
    this.mesh.visible = t * HZ < n;
  }
  dispose(scene: THREE.Scene) { scene.remove(this.mesh); }
}
