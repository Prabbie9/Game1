// Test-route bot: pure-pursuit steering, corner-aware speed control, boosts on straights,
// drifts sharp corners and hops marked gaps. Used by Node fun-gate tests and in-browser motion shots.
import type { VehicleInput, VehicleState } from '../vehicle/sim';
import type { Tuning } from '../vehicle/tuning';

export interface BotRoute { pts: [number, number][]; hops?: [number, number][]; useDrift?: boolean; useBoost?: boolean }

export class Bot {
  seg = 0; done = false; lapDist = 0;
  private hopLatch = false;
  constructor(public route: BotRoute) {}

  private segLen(i: number) { const a = this.route.pts[i], b = this.route.pts[i + 1]; return Math.hypot(b[0] - a[0], b[1] - a[1]); }

  /** Point `d` metres ahead along the polyline from the projection of (x,z). */
  private ahead(x: number, z: number, d: number): [number, number, number, number] {
    const P = this.route.pts;
    // advance segment when past its end
    while (this.seg < P.length - 2) {
      const a = P[this.seg], b = P[this.seg + 1];
      const L = this.segLen(this.seg);
      const t = ((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / (L * L);
      if (t > 1 || Math.hypot(b[0] - x, b[1] - z) < 4) this.seg++; else break;
    }
    const a = P[this.seg], b = P[this.seg + 1];
    const L = this.segLen(this.seg);
    let t = Math.max(0, Math.min(1, ((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / (L * L)));
    let i = this.seg, rem = d + 0;
    let px = a[0] + (b[0] - a[0]) * t, pz = a[1] + (b[1] - a[1]) * t;
    let left = L * (1 - t);
    while (rem > left && i < P.length - 2) { rem -= left; i++; px = P[i][0]; pz = P[i][1]; left = this.segLen(i); t = 0; }
    const A = P[i], B = P[i + 1]; const l = this.segLen(i);
    const f = Math.min(1, (rem + (l - left)) / l);
    return [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, i, Math.hypot(B[0] - px, B[1] - pz)];
  }

  /** Turn angle (rad) at the next corner and the distance to it. */
  private nextCorner(x: number, z: number): [number, number] {
    const P = this.route.pts; const i = this.seg;
    if (i >= P.length - 2) return [0, 1e9];
    const a = P[i], b = P[i + 1], c = P[i + 2];
    const a1 = Math.atan2(b[0] - a[0], b[1] - a[1]), a2 = Math.atan2(c[0] - b[0], c[1] - b[1]);
    let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    return [Math.abs(d), Math.hypot(b[0] - x, b[1] - z)];
  }

  drive(s: VehicleState, T: Tuning): VehicleInput {
    const P = this.route.pts;
    const last = P[P.length - 1];
    if (this.seg >= P.length - 2 && Math.hypot(last[0] - s.x, last[1] - s.z) < 6) this.done = true;
    const look = 5 + s.speed * 0.45;
    const [tx, tz] = this.ahead(s.x, s.z, look);
    const want = Math.atan2(-(tx - s.x), -(tz - s.z));
    let err = want - s.yaw; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    const steer = Math.max(-1, Math.min(1, -err * 2.2));
    const [turn, dist] = this.nextCorner(s.x, s.z);
    const cornerSpeed = turn > 1.2 ? 15 : turn > 0.6 ? 19 : turn > 0.25 ? 23 : 99;
    const brakeDist = Math.max(0, (s.speed * s.speed - cornerSpeed * cornerSpeed) / (2 * T.brakeDecel * 0.7)) + 6;
    let throttle = 1;
    if (dist < brakeDist && s.speed > cornerSpeed + 1) throttle = -1;
    if (Math.abs(err) > 0.9 && s.speed > 12) throttle = -0.6;
    const longStraight = dist > 120 && Math.abs(err) < 0.15;
    const boost = (this.route.useBoost ?? true) && longStraight && s.boost > 0.35;
    const drift = (this.route.useDrift ?? true) && turn > 1.2 && dist < 26 && s.speed > 14 || (s.drifting && Math.abs(err) > 0.35);
    let hop = false;
    for (const h of this.route.hops ?? []) {
      const d = Math.hypot(h[0] - s.x, h[1] - s.z);
      if (d < 3 + s.speed * 0.12 && !this.hopLatch) { hop = true; this.hopLatch = true; }
      if (d > 20) this.hopLatch = false;
    }
    return { throttle, steer, boost, drift, hopLeft: hop, hopRight: hop };
  }
}
