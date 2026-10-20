// World streaming: 100 m chunks. Each chunk has three render states — unloaded, FAR (buildings + signs only)
// and NEAR (+ props, cables, steam, light shafts) — plus physics colliders loaded around the bike with
// hysteresis. At most one chunk mesh build per frame (time-boxed) so streaming never hitches; distance fog
// hides the far edge. Large/global pieces (ground, canals, decks) are always loaded.
import * as THREE from 'three/webgpu';
import type { BoxDef, LightDef, MatId, NeonDef, WorldDef } from '../world/defs';
import { boxGeomFor, kerbStripsFor, mergeGeoms, buildCones } from '../world/build';
import { buildNeonMesh } from '../world/neonAtlas';
import { buildProps, buildCables, buildSteam, type PropDef, type CableDef, type SteamDef } from '../world/kit';
import type { PhysicsClient } from '../physics/client';
import * as M from '../materials/materials';

interface Chunk {
  key: string; cx: number; cz: number;
  boxes: BoxDef[]; neons: NeonDef[]; props: PropDef[]; cables: CableDef[]; steam: SteamDef[]; lights: LightDef[];
  state: 0 | 1 | 2; group: THREE.Group | null; phys: boolean;
}

export interface StreamOpts { size: number; nearR: number; farR: number; physIn: number; physOut: number }

export class ChunkStreamer {
  chunks = new Map<string, Chunk>();
  global = new THREE.Group();
  globalBoxes: BoxDef[] = [];
  private backMat: THREE.Material;
  private kerbMat: THREE.Material;
  builds = 0; lastBuildMs = 0;
  constructor(private scene: THREE.Scene, world: WorldDef & { dressing?: any }, private mats: Record<MatId, THREE.Material>,
    private physics: PhysicsClient | null, public o: StreamOpts = { size: 100, nearR: 170, farR: 340, physIn: 170, physOut: 230 }) {
    this.backMat = M.metal(0x15161a, 0.5);
    this.kerbMat = M.emissive(0x2fdcff, 1.4);
    const key = (x: number, z: number) => `${Math.floor(x / o.size)},${Math.floor(z / o.size)}`;
    const get = (x: number, z: number) => {
      const k = key(x, z);
      let c = this.chunks.get(k);
      if (!c) { const [i, j] = k.split(',').map(Number); c = { key: k, cx: (i + 0.5) * o.size, cz: (j + 0.5) * o.size, boxes: [], neons: [], props: [], cables: [], steam: [], lights: [], state: 0, group: null, phys: false }; this.chunks.set(k, c); }
      return c;
    };
    for (const b of world.boxes) {
      if (Math.max(b.h[0], b.h[2]) > 45 || b.mat === 'water' || b.mat === 'deck') this.globalBoxes.push(b);
      else get(b.c[0], b.c[2]).boxes.push(b);
    }
    for (const n of world.neons) get(n.pos[0], n.pos[2]).neons.push(n);
    for (const l of world.lights) get(l.pos[0], l.pos[2]).lights.push(l);
    const d = world.dressing;
    if (d) {
      for (const p of d.props as PropDef[]) get(p.pos[0], p.pos[2]).props.push(p);
      for (const c of d.cables as CableDef[]) get((c.a[0] + c.b[0]) / 2, (c.a[2] + c.b[2]) / 2).cables.push(c);
      for (const s of d.steam as SteamDef[]) get(s.pos[0], s.pos[2]).steam.push(s);
    }
    this.global.add(this.boxMeshes(this.globalBoxes));
    scene.add(this.global);
  }

  /** Physics payload for init: global boxes + chunks around the spawn point. */
  initialPhysics(x: number, z: number): Record<string, BoxDef[]> {
    const out: Record<string, BoxDef[]> = { global: this.globalBoxes };
    for (const c of this.chunks.values()) if (Math.hypot(c.cx - x, c.cz - z) < this.o.physIn) { out[c.key] = c.boxes; c.phys = true; }
    return out;
  }

  private boxMeshes(boxes: BoxDef[], farOnly = false) {
    const g = new THREE.Group();
    const byMat = new Map<MatId, THREE.BufferGeometry[]>();
    for (const b of boxes) {
      if (b.render === false) continue;
      if (farOnly && b.h[1] < 2 && b.mat !== 'sidewalk') continue; // far LOD: skip small clutter
      if (!byMat.has(b.mat)) byMat.set(b.mat, []);
      byMat.get(b.mat)!.push(boxGeomFor(b));
    }
    for (const [mat, gs] of byMat) {
      const mesh = new THREE.Mesh(mergeGeoms(gs), this.mats[mat]);
      mesh.receiveShadow = true; mesh.castShadow = !farOnly && !['asphalt', 'water', 'sidewalk', 'neonEdge', 'neonMag'].includes(mat);
      g.add(mesh);
    }
    const kerb = kerbStripsFor(boxes);
    if (kerb) g.add(new THREE.Mesh(kerb, this.kerbMat));
    return g;
  }

  private build(c: Chunk, state: 1 | 2) {
    const t0 = performance.now();
    this.drop(c, false);
    const g = this.boxMeshes(c.boxes, state === 1);
    if (c.neons.length) g.add(buildNeonMesh(c.neons, this.backMat));
    if (state === 2) {
      if (c.props.length) g.add(buildProps(c.props));
      if (c.cables.length) g.add(buildCables(c.cables));
      if (c.steam.length) g.add(buildSteam(c.steam));
      const cones = c.lights.filter((l) => l.cone);
      if (cones.length) g.add(buildCones(cones));
    }
    this.scene.add(g); c.group = g; c.state = state;
    this.builds++; this.lastBuildMs = performance.now() - t0;
  }

  private drop(c: Chunk, resetState = true) {
    if (c.group) {
      this.scene.remove(c.group);
      c.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
      c.group = null;
    }
    if (resetState) c.state = 0;
  }

  /** Call every frame. Returns true if a chunk was (re)built this frame. */
  update(cam: THREE.Vector3, bike: THREE.Vector3, force = false) {
    let best: { c: Chunk; s: 1 | 2; d: number } | null = null;
    for (const c of this.chunks.values()) {
      const d = Math.hypot(c.cx - cam.x, c.cz - cam.z);
      const want: 0 | 1 | 2 = d < this.o.nearR ? 2 : d < this.o.farR ? 1 : 0;
      // hysteresis: keep NEAR until 20 m past the radius, keep FAR until 30 m past
      const keep = (c.state === 2 && d < this.o.nearR + 20) ? 2 : (c.state >= 1 && want === 0 && d < this.o.farR + 30) ? 1 : want;
      if (keep === 0 && c.state !== 0) this.drop(c);
      else if (keep !== c.state && keep !== 0 && (!best || d < best.d)) best = { c, s: keep as 1 | 2, d };
      // physics around the bike
      if (this.physics) {
        const db = Math.hypot(c.cx - bike.x, c.cz - bike.z);
        if (!c.phys && db < this.o.physIn) { this.physics.addChunk(c.key, c.boxes); c.phys = true; }
        else if (c.phys && db > this.o.physOut) { this.physics.removeChunk(c.key); c.phys = false; }
      }
    }
    if (force) { // initial load: build everything wanted, nearest first
      const list = [...this.chunks.values()].map((c) => ({ c, d: Math.hypot(c.cx - cam.x, c.cz - cam.z) })).filter((e) => e.d < this.o.farR).sort((a, b) => a.d - b.d);
      for (const e of list) this.build(e.c, e.d < this.o.nearR ? 2 : 1);
      return true;
    }
    if (best) { this.build(best.c, best.s); return true; }
    return false;
  }

  stats() {
    let near = 0, far = 0, phys = 0;
    for (const c of this.chunks.values()) { if (c.state === 2) near++; else if (c.state === 1) far++; if (c.phys) phys++; }
    return { chunks: this.chunks.size, near, far, phys, builds: this.builds, lastBuildMs: +this.lastBuildMs.toFixed(1) };
  }
}
