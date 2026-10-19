// Chase camera: spring arm with look-ahead into turns, speed-based FOV + pull-back, sphere-cast so it never clips.
// Pure maths so it runs in the browser and in Node bot tests. `castArm` returns the free length of the arm.
import type { VehicleState } from '../vehicle/sim';
import type { Tuning } from '../vehicle/tuning';

export interface ChaseCam {
  x: number; y: number; z: number;
  tx: number; ty: number; tz: number; // look target
  yaw: number; pitch: number; dist: number; fov: number; roll: number;
  lookYaw: number; lookPitch: number; lookIdle: number; // free-look offsets
  armLen: number;
  // last requested arm (for async collision in the worker)
  pivot: [number, number, number]; dir: [number, number, number]; want: number;
}

export function createChase(s: VehicleState): ChaseCam {
  return { x: s.x, y: s.y + 2, z: s.z + 6, tx: s.x, ty: s.y, tz: s.z, yaw: s.yaw, pitch: -0.12, dist: 5.6, fov: 68, roll: 0,
    lookYaw: 0, lookPitch: 0, lookIdle: 9, armLen: 5.6, pivot: [s.x, s.y, s.z], dir: [0, 0, 1], want: 5.6 };
}

const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export function updateChase(c: ChaseCam, s: VehicleState, T: Tuning, dt: number, look: { dx: number; dy: number },
  castArm: (pivot: [number, number, number], dir: [number, number, number], len: number) => number) {
  // free look (mouse); recentres after a short idle
  if (Math.abs(look.dx) + Math.abs(look.dy) > 0) { c.lookYaw = clamp(c.lookYaw - look.dx, -2.6, 2.6); c.lookPitch = clamp(c.lookPitch - look.dy, -0.5, 0.9); c.lookIdle = 0; }
  else c.lookIdle += dt;
  if (c.lookIdle > 1.2) { const k = 1 - Math.exp(-3 * dt); c.lookYaw *= 1 - k; c.lookPitch *= 1 - k; }

  const spd = s.speed;
  const velYaw = spd > 3 ? Math.atan2(-s.vx, -s.vz) : s.yaw;
  const blend = s.drifting ? 0.55 : 0.25;
  const baseYaw = s.yaw + wrap(velYaw - s.yaw) * blend;
  // spring the camera yaw toward the bike, lagging so turns reveal the side of the bike
  const ks = 1 - Math.exp(-T.camStiffness * 0.55 * dt);
  c.yaw += wrap(baseYaw - c.yaw) * ks;
  const fast = clamp((spd - T.maxSpeed * 0.5) / Math.max(1, T.boostSpeed - T.maxSpeed * 0.5), 0, 1);
  const want = T.camDistance + T.camPullBack * fast;
  c.dist += (want - c.dist) * (1 - Math.exp(-3 * dt));
  const yaw = c.yaw + c.lookYaw;
  const pitch = -0.16 - 0.04 * fast + c.lookPitch * 0.6;
  // desired position on a sphere around the pivot
  const px = s.x, py = s.y + 1.0, pz = s.z;
  const cp = Math.cos(pitch);
  // camera sits behind: forward = (-sin yaw, -cos yaw) so behind = (+sin, +cos)
  let dx = Math.sin(yaw) * cp, dy = -Math.sin(pitch) + (T.camHeight - 1.0) / Math.max(1, c.dist), dz = Math.cos(yaw) * cp;
  const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
  c.pivot = [px, py, pz]; c.dir = [dx, dy, dz]; c.want = c.dist;
  const free = castArm(c.pivot, c.dir, c.dist);
  // snap in instantly, ease back out
  if (free < c.armLen) c.armLen = free; else c.armLen += (free - c.armLen) * (1 - Math.exp(-4 * dt));
  c.armLen = Math.min(c.armLen, free);
  c.x = px + dx * c.armLen; c.y = py + dy * c.armLen; c.z = pz + dz * c.armLen;
  // look target: ahead of the bike, shifted into the turn
  const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
  const ahead = 2 + spd * 0.12;
  const into = clamp(s.yawRate * T.camLookAhead * (0.5 + spd * 0.05), -4, 4);
  const tx = s.x + fx * ahead + rx * into, ty = s.y + 0.7, tz = s.z + fz * ahead + rz * into;
  const kt = 1 - Math.exp(-14 * dt);
  c.tx += (tx - c.tx) * kt; c.ty += (ty - c.ty) * kt; c.tz += (tz - c.tz) * kt;
  const wantFov = T.fovBase + T.fovBoost * fast + (s.boosting ? 4 : 0);
  c.fov += (wantFov - c.fov) * (1 - Math.exp(-4 * dt));
  c.roll += (clamp(-s.yawRate * 0.02 * (spd / 20), -0.06, 0.06) - c.roll) * (1 - Math.exp(-5 * dt));
}
