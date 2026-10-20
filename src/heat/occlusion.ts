// Analytic visibility helpers (never reads rendered pixels): line-of-sight against a spatial hash of world
// boxes (rotated boxes approximated by their world AABB), "under cover" test, and light exposure at a point
// from the authored light anchors.
import type { BoxDef, LightDef, NeonDef, WorldDef } from '../world/defs';

interface AABB { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }
const CELL = 50;

export class Occlusion {
  private grid = new Map<string, AABB[]>();
  private lights: { x: number; y: number; z: number; i: number; r: number }[] = [];
  constructor(world: WorldDef) {
    for (const b of world.boxes) {
      if ((b.collide ?? 'solid') === 'none' && b.h[1] < 2) continue;
      if (b.mat === 'water' || b.mat === 'asphalt') continue;
      const a = aabb(b);
      if (a.y1 - a.y0 < 0.5 && a.y1 < 1) continue; // kerbs/sidewalks don't block sight
      for (let gx = Math.floor(a.x0 / CELL); gx <= Math.floor(a.x1 / CELL); gx++)
        for (let gz = Math.floor(a.z0 / CELL); gz <= Math.floor(a.z1 / CELL); gz++) {
          const k = gx + ',' + gz; let l = this.grid.get(k); if (!l) this.grid.set(k, l = []); l.push(a);
        }
    }
    for (const l of world.lights as LightDef[]) if (l.intensity > 0) this.lights.push({ x: l.pos[0], y: l.pos[1], z: l.pos[2], i: l.intensity, r: l.range });
    for (const n of world.neons as NeonDef[]) if (n.light) this.lights.push({ x: n.pos[0], y: n.pos[1], z: n.pos[2], i: n.light, r: 16 });
  }

  /** True if the segment a→b is unobstructed. */
  los(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz);
    const seen = new Set<AABB>();
    const steps = Math.ceil(len / (CELL * 0.5));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, px = ax + dx * t, pz = az + dz * t;
      const l = this.grid.get(Math.floor(px / CELL) + ',' + Math.floor(pz / CELL)); if (!l) continue;
      for (const a of l) { if (seen.has(a)) continue; seen.add(a); if (segBox(ax, ay, az, dx, dy, dz, a)) return false; }
    }
    return true;
  }

  /** Something solid within `h` metres above the point (deck, tunnel, roof, awning-height overhang). */
  covered(x: number, y: number, z: number, h = 14) { return !this.los(x, y + 1.2, z, x, y + h, z); }

  /** 0 (pitch dark) .. ~1+ (brightly lit) from authored light anchors around the point. */
  exposure(x: number, y: number, z: number) {
    let e = 0;
    for (const L of this.lights) {
      const d2 = (L.x - x) ** 2 + (L.y - y) ** 2 + (L.z - z) ** 2;
      if (d2 > L.r * L.r * 2.2) continue;
      e += (L.i / 36) / (1 + d2 / (L.r * L.r * 0.18));
    }
    return e;
  }
}

function aabb(b: BoxDef): AABB {
  const yaw = b.yaw ?? 0, pitch = b.pitch ?? 0;
  const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw)), cp = Math.abs(Math.cos(pitch)), sp = Math.abs(Math.sin(pitch));
  const hy = b.h[1] * cp + b.h[2] * sp, hzl = b.h[2] * cp + b.h[1] * sp;
  const hx = b.h[0] * c + hzl * s, hz = b.h[0] * s + hzl * c;
  return { x0: b.c[0] - hx, x1: b.c[0] + hx, y0: b.c[1] - hy, y1: b.c[1] + hy, z0: b.c[2] - hz, z1: b.c[2] + hz };
}

function segBox(ax: number, ay: number, az: number, dx: number, dy: number, dz: number, b: AABB) {
  let t0 = 0, t1 = 1;
  const o = [ax, ay, az], d = [dx, dy, dz], lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < lo[i] || o[i] > hi[i]) return false; continue; }
    let ta = (lo[i] - o[i]) / d[i], tb = (hi[i] - o[i]) / d[i];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return t1 > 0.001 && t0 < 0.999;
}
