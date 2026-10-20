// Arcade hover-bike simulation. Pure + deterministic: fixed timestep, all collision via PhysQuery.
// Heading yaw=0 faces -Z. Forward f = (-sin yaw, 0, -cos yaw), right r = (cos yaw, 0, -sin yaw).
import type { PhysQuery } from '../physics/query';
import type { Surface } from '../world/defs';
import type { Tuning } from './tuning';

export const SIM_DT = 1 / 120;

export interface VehicleInput {
  throttle: number;  // -1..1 (negative = brake / reverse)
  steer: number;     // -1..1 (positive = right)
  boost: boolean;
  drift: boolean;
  hopLeft: boolean;  // edge-triggered by the caller
  hopRight: boolean;
}

export const NO_INPUT: VehicleInput = { throttle: 0, steer: 0, boost: false, drift: false, hopLeft: false, hopRight: false };

export interface VehicleState {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  yaw: number; yawRate: number;
  boost: number;          // meter 0..1
  boosting: boolean;
  drifting: boolean;
  driftDir: number;       // -1 / 1
  driftCharge: number;    // 0..1 accumulated in current drift
  grounded: boolean;
  groundDist: number;
  nx: number; ny: number; nz: number; // smoothed ground normal
  surface: Surface;
  airTime: number;
  hopCd: number;
  speed: number;          // planar speed m/s
  fwdSpeed: number;
  slip: number;           // lateral speed m/s (signed)
  // events this step (consumed by audio / fx / tests)
  impact: number;         // m/s of velocity removed by walls this step
  landed: number;         // impact speed on landing
  hopped: boolean;
  driftReleased: number;  // kick applied
  boostStarted: boolean;
  safeX: number; safeY: number; safeZ: number; safeYaw: number; safeT: number;
  t: number; kickT: number;
}

export function createState(x: number, y: number, z: number, yaw: number): VehicleState {
  return {
    x, y, z, vx: 0, vy: 0, vz: 0, yaw, yawRate: 0, boost: 1, boosting: false, drifting: false, driftDir: 0, driftCharge: 0,
    grounded: false, groundDist: 99, nx: 0, ny: 1, nz: 0, surface: 'asphalt', airTime: 0, hopCd: 0,
    speed: 0, fwdSpeed: 0, slip: 0, impact: 0, landed: 0, hopped: false, driftReleased: 0, boostStarted: false,
    safeX: x, safeY: y, safeZ: z, safeYaw: yaw, safeT: 0, t: 0, kickT: -9,
  };
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const decay = (rate: number, dt: number) => Math.exp(-rate * dt);

export function teleport(s: VehicleState, x: number, y: number, z: number, yaw: number) {
  s.x = x; s.y = y; s.z = z; s.yaw = yaw; s.vx = s.vy = s.vz = 0; s.yawRate = 0; s.drifting = false; s.driftCharge = 0;
  s.safeX = x; s.safeY = y; s.safeZ = z; s.safeYaw = yaw;
}

export function stepVehicle(s: VehicleState, inp: VehicleInput, T: Tuning, q: PhysQuery, dt = SIM_DT) {
  s.t += dt;
  s.impact = 0; s.landed = 0; s.hopped = false; s.driftReleased = 0; s.boostStarted = false;
  s.hopCd = Math.max(0, s.hopCd - dt);

  // ---- ground probe (centre + front/back for slope) ----
  const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);
  const rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
  const probe = T.hoverHeight * 2.6;
  const g = q.rayGround(s.x, s.y, s.z, probe);
  const gf = q.rayGround(s.x + fx * 0.9, s.y, s.z + fz * 0.9, probe);
  const gb = q.rayGround(s.x - fx * 0.9, s.y, s.z - fz * 0.9, probe);
  const wasGrounded = s.grounded;
  s.grounded = !!g && g.dist < T.hoverHeight * 1.7;
  s.groundDist = g ? g.dist : 99;

  if (g) {
    let nx = g.nx, ny = g.ny, nz = g.nz;
    if (gf && gb) { // slope along heading from front/back heights
      const dh = (gb.dist - gf.dist) / 1.8; // rise per metre forward
      const len = Math.hypot(dh, 1);
      // tilt normal toward -forward by slope
      nx = (nx + -fx * dh / len) * 0.5; nz = (nz + -fz * dh / len) * 0.5; ny = (ny + 1 / len) * 0.5;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    }
    const k = 1 - decay(14, dt);
    s.nx += (nx - s.nx) * k; s.ny += (ny - s.ny) * k; s.nz += (nz - s.nz) * k;
  } else {
    const k = 1 - decay(3, dt);
    s.nx += (0 - s.nx) * k; s.ny += (1 - s.ny) * k; s.nz += (0 - s.nz) * k;
  }
  if (g) s.surface = g.surface;
  const onWater = s.grounded && s.surface === 'water';

  // ---- vertical: hover spring or gravity ----
  const hopFree = s.hopCd > 0.3; // just hopped: let the impulse carry before the spring re-engages
  if (s.grounded && g && !hopFree) {
    const hh = onWater ? T.hoverHeight * 0.8 : T.hoverHeight;
    const err = hh - g.dist;
    const c = 2 * Math.sqrt(T.hoverStiffness) * T.hoverDamping;
    s.vy += (T.hoverStiffness * err - c * s.vy - T.gravity * 0.15) * dt;
    if (!wasGrounded) { s.landed = Math.max(0, -s.vy); }
    s.airTime = 0;
    // remember a safe spot on solid ground
    if (!onWater && s.t - s.safeT > 0.5 && Math.abs(s.yawRate) < 1.5) { s.safeX = s.x; s.safeY = s.y; s.safeZ = s.z; s.safeYaw = s.yaw; s.safeT = s.t; }
  } else {
    const fall = s.vy < 0 ? 1.25 : 1; // snappier arcs
    s.vy -= T.gravity * fall * dt;
    s.airTime += dt;
  }

  // ---- planar velocity in heading frame ----
  let vf = s.vx * fx + s.vz * fz;
  let vl = s.vx * rx + s.vz * rz;
  const ctrl = s.grounded ? 1 : T.airSteer;

  // boost
  const wantBoost = inp.boost && (s.boosting ? s.boost > 0.01 : s.boost > 0.12);
  if (wantBoost && !s.boosting) {
    s.boostStarted = true;
    // surge kick: once per 1.5 s and never past boost speed (tapping Shift must not pump speed)
    if (s.t - s.kickT > 1.5) { vf = Math.min(vf + T.boostKick, Math.max(vf, T.boostSpeed)); s.kickT = s.t; }
  }
  s.boosting = wantBoost;
  if (s.boosting) s.boost = Math.max(0, s.boost - T.boostDrain * dt);
  else s.boost = Math.min(1, s.boost + T.boostRegen * dt);

  // throttle / brake
  const th = clamp(inp.throttle, -1, 1);
  if (s.boosting) {
    vf += T.boostAccel * Math.max(0, 1 - vf / T.boostSpeed) * dt * (s.grounded ? 1 : 0.4);
  } else if (th > 0) {
    if (vf < T.maxSpeed) vf += T.accel * th * Math.max(0, 1 - vf / T.maxSpeed) * dt * (s.grounded ? 1 : 0.3);
  } else if (th < 0) {
    if (vf > 0.5) vf -= T.brakeDecel * -th * dt;
    else if (vf > -T.reverseMax) vf -= T.accel * 0.5 * -th * dt;
  }
  if (th <= 0 && !s.boosting) vf *= decay(T.coastDrag, dt);
  if (!s.boosting && vf > T.maxSpeed) vf = T.maxSpeed + (vf - T.maxSpeed) * decay(T.overspeedDrag, dt);
  if (onWater) vf *= decay(0.12, dt);

  // drift state
  const st = clamp(inp.steer, -1, 1);
  if (inp.drift && s.grounded && vf > T.driftMinSpeed && (s.drifting || Math.abs(st) > 0.3)) {
    if (!s.drifting) { s.drifting = true; s.driftDir = st >= 0 ? 1 : -1; s.driftCharge = 0; }
  } else if (s.drifting && (!inp.drift || vf < T.driftMinSpeed * 0.6)) {
    // release: mini-turbo scaled by charge
    if (s.driftCharge > 0.25) { const kick = T.driftKick * Math.min(1, s.driftCharge); vf += kick; s.driftReleased = kick; }
    s.drifting = false; s.driftCharge = 0;
  }

  // yaw
  const spd01 = clamp(Math.abs(vf) / T.maxSpeed, 0, 1);
  let target: number;
  if (s.drifting) {
    // steer modulates drift tightness; always turning into driftDir
    target = s.driftDir * T.driftSteer * (0.65 + 0.45 * st * s.driftDir);
  } else {
    const rate = T.steerLow + (T.steerHigh - T.steerLow) * Math.pow(spd01, 0.7);
    target = st * rate * (vf < -0.5 ? -1 : 1);
  }
  target *= ctrl;
  s.yawRate += (target - s.yawRate) * (1 - decay(T.steerResponse, dt));
  s.yaw -= s.yawRate * dt; // positive steer = turn right = yaw decreases

  // lateral grip (recompute frame after rotation so the bike carries momentum)
  const nfx = -Math.sin(s.yaw), nfz = -Math.cos(s.yaw), nrx = Math.cos(s.yaw), nrz = -Math.sin(s.yaw);
  const pvx = fx * vf + rx * vl, pvz = fz * vf + rz * vl;
  vf = pvx * nfx + pvz * nfz; vl = pvx * nrx + pvz * nrz;
  const grip = (s.drifting ? T.driftGrip : T.grip) * (onWater ? 0.7 : 1) * (s.grounded ? 1 : 0.15);
  // grip kills sideways speed; gripTransfer of it is redirected forward. Never adds energy.
  const spBefore = Math.hypot(vf, vl);
  const vl2 = vl * decay(grip, dt);
  const lost = Math.abs(vl) - Math.abs(vl2);
  const spAfter = Math.max(0, spBefore - lost * (1 - T.gripTransfer));
  vf = (vf >= 0 ? 1 : -1) * Math.sqrt(Math.max(0, spAfter * spAfter - vl2 * vl2));
  vl = vl2;
  if (s.drifting && vf > 0) {
    // carve: cap the slip angle so a held drift sweeps round the corner instead of spinning out
    const ang = Math.atan2(Math.abs(vl), vf);
    if (ang > T.driftMaxAngle) {
      const sp = Math.hypot(vf, vl) * (1 - 0.25 * dt);
      vf = sp * Math.cos(T.driftMaxAngle); vl = Math.sign(vl) * sp * Math.sin(T.driftMaxAngle);
    }
  }
  if (s.drifting) {
    s.driftCharge = Math.min(1.5, s.driftCharge + dt * (0.6 + Math.min(1, Math.abs(vl) / 6)) * 0.55);
    s.boost = Math.min(1, s.boost + T.driftCharge * dt * Math.min(1, Math.abs(vl) / 4 + 0.3));
  }

  // hop
  if ((inp.hopLeft || inp.hopRight) && s.grounded && s.hopCd <= 0) {
    s.vy = Math.max(s.vy, 0) + T.hopImpulse;
    vl += (inp.hopRight ? 1 : 0) * T.hopSide - (inp.hopLeft ? 1 : 0) * T.hopSide;
    s.hopCd = 0.55; s.hopped = true;
  }

  s.vx = nfx * vf + nrx * vl; s.vz = nfz * vf + nrz * vl;

  // ---- move with collide-and-slide ----
  const sp0 = Math.hypot(s.vx, s.vz);
  const res = q.moveAndSlide(s.x, s.y, s.z, s.vx * dt, s.vy * dt, s.vz * dt);
  s.x = res.x; s.y = res.y; s.z = res.z;
  for (const h of res.hits) {
    const vn = s.vx * h.nx + s.vy * h.ny + s.vz * h.nz;
    if (vn >= 0) continue;
    if (h.ny > 0.55) { s.vy -= h.ny * vn; s.vx -= h.nx * vn; s.vz -= h.nz * vn; continue; } // floor-like: just stop sinking
    if (h.ny < -0.55) { s.vy = Math.min(s.vy, 0); continue; }                               // ceiling
    // wall: remove into-wall component, redirect along the wall, small penalty
    const hl = Math.hypot(h.nx, h.nz) || 1; const wx = h.nx / hl, wz = h.nz / hl;
    const vin = s.vx * wx + s.vz * wz;
    if (vin >= 0) continue;
    let tx = s.vx - wx * vin, tz = s.vz - wz * vin;
    const head = sp0 > 0.1 ? -vin / sp0 : 0; // 1 = head-on
    let tl = Math.hypot(tx, tz);
    const keep = Math.max(T.headOnKeep * sp0, tl * (1 - T.wallPenalty * head));
    if (tl < 0.05) { // perfectly head-on: pick tangent nearest heading's right side
      tx = -wz; tz = wx; if (tx * nrx + tz * nrz < 0) { tx = -tx; tz = -tz; } tl = 1;
    }
    const push = head > 0.3 ? 0.8 : 0; // slight push-off on real impacts only (scraping must not add energy)
    const kept = Math.min(keep, sp0);
    s.vx = tx / tl * kept + wx * push; s.vz = tz / tl * kept + wz * push;
    s.impact = Math.max(s.impact, -vin);
    // turn the nose toward the slide direction so the player keeps flowing
    const ty = Math.atan2(-s.vx, -s.vz);
    let dy = ty - s.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    s.yaw += dy * Math.min(1, 0.35 * head + 0.1);
    s.yawRate *= 0.5;
    if (s.drifting && head > 0.5) { s.drifting = false; s.driftCharge = 0; }
  }

  // ---- fell out of the world → respawn at last safe spot ----
  if (s.y < -40) teleport(s, s.safeX, s.safeY + 1, s.safeZ, s.safeYaw);

  const ffx = -Math.sin(s.yaw), ffz = -Math.cos(s.yaw);
  s.speed = Math.hypot(s.vx, s.vz);
  s.fwdSpeed = s.vx * ffx + s.vz * ffz;
  s.slip = s.vx * Math.cos(s.yaw) + s.vz * -Math.sin(s.yaw);
}
