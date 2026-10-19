// Rapier-backed collision queries used by the vehicle sim and chase camera.
// Runs in the physics worker in the browser and directly in Node for bot tests.
import type RAPIER_NS from '@dimforge/rapier3d-compat';
import { BoxDef, G_GROUND, G_SOLID, G_WATER, groups, Surface } from '../world/defs';

type R = typeof RAPIER_NS;

export interface GroundHit { dist: number; nx: number; ny: number; nz: number; surface: Surface }
export interface SlideResult { x: number; y: number; z: number; hits: { nx: number; ny: number; nz: number }[] }

export interface PhysQuery {
  rayGround(x: number, y: number, z: number, maxDist: number): GroundHit | null;
  moveAndSlide(x: number, y: number, z: number, dx: number, dy: number, dz: number): SlideResult;
  /** Sphere cast; returns free distance along dir (<= len). */
  castSphere(x: number, y: number, z: number, dx: number, dy: number, dz: number, len: number, radius: number): number;
  insideSolid(x: number, y: number, z: number, margin: number): boolean;
}

export const BIKE_RADIUS = 0.5;

export function boxQuat(b: BoxDef) {
  const yaw = b.yaw ?? 0, pitch = b.pitch ?? 0;
  // q = qYaw * qPitch
  const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2), cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
  return { w: cy * cp, x: cy * sp, y: sy * cp, z: -sy * sp };
}

export class RapierWorld implements PhysQuery {
  world: RAPIER_NS.World;
  surfaces = new Map<number, Surface>();
  handles = new Map<string, number[]>();
  private ball: RAPIER_NS.Ball;
  private camBall: RAPIER_NS.Ball;
  private R: R;
  private ident = { w: 1, x: 0, y: 0, z: 0 };

  constructor(RAPIER: R) {
    this.R = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.ball = new RAPIER.Ball(BIKE_RADIUS);
    this.camBall = new RAPIER.Ball(0.3);
  }

  addBoxes(key: string, boxes: BoxDef[]) {
    const R = this.R; const list: number[] = [];
    for (const b of boxes) {
      const kind = b.collide ?? 'solid';
      if (kind === 'none') continue;
      const desc = R.ColliderDesc.cuboid(b.h[0], b.h[1], b.h[2])
        .setTranslation(b.c[0], b.c[1], b.c[2]).setRotation(boxQuat(b));
      const member = kind === 'water' ? G_WATER : kind === 'ground' ? G_GROUND : G_GROUND | G_SOLID;
      desc.setCollisionGroups(groups(member, 0xffff));
      const col = this.world.createCollider(desc);
      this.surfaces.set(col.handle, b.surface ?? (kind === 'water' ? 'water' : 'concrete'));
      list.push(col.handle);
    }
    this.handles.set(key, list);
    this.world.step();
  }

  removeKey(key: string) {
    const list = this.handles.get(key); if (!list) return;
    for (const h of list) { const c = this.world.getCollider(h); if (c) this.world.removeCollider(c, false); this.surfaces.delete(h); }
    this.handles.delete(key);
    this.world.step();
  }

  rayGround(x: number, y: number, z: number, maxDist: number): GroundHit | null {
    const ray = new this.R.Ray({ x, y, z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.castRayAndGetNormal(ray, maxDist, true, undefined, groups(0xffff, G_GROUND | G_WATER));
    if (!hit) return null;
    return { dist: hit.timeOfImpact, nx: hit.normal.x, ny: hit.normal.y, nz: hit.normal.z, surface: this.surfaces.get(hit.collider.handle) ?? 'concrete' };
  }

  moveAndSlide(x: number, y: number, z: number, dx: number, dy: number, dz: number): SlideResult {
    const hits: SlideResult['hits'] = [];
    const skin = 0.02;
    for (let iter = 0; iter < 4; iter++) {
      const len = Math.hypot(dx, dy, dz);
      if (len < 1e-6) break;
      const hit = this.world.castShape({ x, y, z }, this.ident, { x: dx / len, y: dy / len, z: dz / len }, this.ball, 0, len + skin, false, undefined, groups(0xffff, G_SOLID));
      if (!hit) { x += dx; y += dy; z += dz; break; }
      const t = Math.max(0, hit.time_of_impact - skin);
      x += dx / len * t; y += dy / len * t; z += dz / len * t;
      // world.castShape: normal1 is the hit surface's normal facing the moving ball (verified in tools test)
      let nx = hit.normal1.x, ny = hit.normal1.y, nz = hit.normal1.z;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      if (t <= 1e-5 && hit.time_of_impact <= 0) { // penetrating: push out a little
        x += nx * 0.03; y += ny * 0.03; z += nz * 0.03;
      }
      hits.push({ nx, ny, nz });
      const rem = len - t;
      // remaining motion projected onto the contact plane
      let rx = dx / len * rem, ry = dy / len * rem, rz = dz / len * rem;
      const d = rx * nx + ry * ny + rz * nz;
      if (d < 0) { rx -= nx * d; ry -= ny * d; rz -= nz * d; }
      dx = rx; dy = ry; dz = rz;
    }
    return { x, y, z, hits };
  }

  castSphere(x: number, y: number, z: number, dx: number, dy: number, dz: number, len: number, radius: number): number {
    const shape = radius === 0.3 ? this.camBall : new this.R.Ball(radius);
    const hit = this.world.castShape({ x, y, z }, this.ident, { x: dx, y: dy, z: dz }, shape, 0, len, true, undefined, groups(0xffff, G_SOLID));
    return hit ? Math.max(0, hit.time_of_impact) : len;
  }

  insideSolid(x: number, y: number, z: number, margin: number): boolean {
    const p = this.world.projectPoint({ x, y, z }, true, undefined, groups(0xffff, G_SOLID));
    if (!p) return false;
    if (p.isInside) return true;
    return Math.hypot(p.point.x - x, p.point.y - y, p.point.z - z) < margin;
  }
}
