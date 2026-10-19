// ALL vehicle + chase-camera tuning lives in this one file.
// The in-game tuning panel (ui/tuningPanel.ts) edits a live copy; "Copy my settings" exports JSON in this shape.

export interface Tuning {
  // speed
  maxSpeed: number;        // m/s, top speed without boost
  accel: number;           // m/s^2 at standstill; falls off linearly toward maxSpeed
  brakeDecel: number;      // m/s^2 when braking while moving forward
  reverseMax: number;      // m/s
  coastDrag: number;       // 1/s exponential decay with no throttle
  overspeedDrag: number;   // 1/s decay when above maxSpeed and not boosting
  // boost
  boostSpeed: number;      // m/s target while boosting
  boostAccel: number;      // m/s^2 surge
  boostDrain: number;      // meter / s
  boostRegen: number;      // meter / s passive
  boostKick: number;       // m/s instant on boost press (the "surge")
  // steering
  steerLow: number;        // rad/s yaw rate at low speed (generous)
  steerHigh: number;       // rad/s yaw rate at max speed
  steerResponse: number;   // 1/s how fast yaw rate follows input
  grip: number;            // 1/s lateral velocity decay (higher = grippier)
  gripTransfer: number;    // 0..1 fraction of lost lateral speed returned to forward speed
  airSteer: number;        // 0..1 steer multiplier while airborne
  // drift
  driftMinSpeed: number;   // m/s
  driftGrip: number;       // 1/s lateral decay while drifting
  driftSteer: number;      // rad/s yaw rate while drifting
  driftCharge: number;     // boost meter gained per second of full drift
  driftKick: number;       // m/s burst on drift release (scaled by charge)
  // hover + hop
  hoverHeight: number;     // m
  hoverStiffness: number;  // spring k
  hoverDamping: number;    // damping ratio 0..1
  gravity: number;         // m/s^2
  hopImpulse: number;      // m/s up
  hopSide: number;         // m/s sideways for Q/E
  // collisions
  wallPenalty: number;     // 0..1 speed lost per glancing hit (scaled by impact angle)
  headOnKeep: number;      // 0..1 speed kept and redirected along wall on a head-on hit
  // camera
  camDistance: number;     // m behind at rest
  camHeight: number;       // m above at rest
  camPullBack: number;     // extra m at boost speed
  camLookAhead: number;    // 0..1 look into turns
  camStiffness: number;    // spring 1/s
  fovBase: number;         // deg
  fovBoost: number;        // extra deg at boost speed
}

export const BALANCED: Tuning = {
  maxSpeed: 24, accel: 21.5, brakeDecel: 34, reverseMax: 7, coastDrag: 0.35, overspeedDrag: 0.9,
  boostSpeed: 35, boostAccel: 26, boostDrain: 0.32, boostRegen: 0.04, boostKick: 3.5,
  steerLow: 2.7, steerHigh: 1.55, steerResponse: 9, grip: 7.5, gripTransfer: 0.85, airSteer: 0.45,
  driftMinSpeed: 9, driftGrip: 2.2, driftSteer: 1.9, driftMaxAngle: 0.62, driftCharge: 0.45, driftKick: 6,
  hoverHeight: 0.9, hoverStiffness: 140, hoverDamping: 0.75, gravity: 24, hopImpulse: 7.5, hopSide: 4,
  wallPenalty: 0.12, headOnKeep: 0.6,
  camDistance: 5.6, camHeight: 2.0, camPullBack: 2.4, camLookAhead: 0.55, camStiffness: 9, fovBase: 68, fovBoost: 16,
};

export const GRIPPY: Tuning = {
  ...BALANCED,
  grip: 12, gripTransfer: 0.92, steerLow: 2.9, steerHigh: 1.75, steerResponse: 12,
  driftGrip: 3.2, driftSteer: 1.8, driftMaxAngle: 0.5, driftCharge: 0.35, wallPenalty: 0.1, camLookAhead: 0.4,
};

export const DRIFTY: Tuning = {
  ...BALANCED,
  grip: 4.6, gripTransfer: 0.8, steerLow: 2.6, steerHigh: 1.45, steerResponse: 7,
  driftGrip: 1.4, driftSteer: 2.1, driftMaxAngle: 0.8, driftCharge: 0.6, driftKick: 8, camLookAhead: 0.7,
};

export const PRESETS: Record<string, Tuning> = { Grippy: GRIPPY, Balanced: BALANCED, Drifty: DRIFTY };

/** Slider ranges for the tuning panel: [min, max, step]. */
export const RANGES: Record<keyof Tuning, [number, number, number]> = {
  maxSpeed: [12, 40, 0.5], accel: [6, 40, 0.5], brakeDecel: [10, 60, 1], reverseMax: [2, 15, 0.5],
  coastDrag: [0, 2, 0.05], overspeedDrag: [0, 3, 0.05],
  boostSpeed: [20, 60, 0.5], boostAccel: [5, 60, 1], boostDrain: [0.05, 1, 0.01], boostRegen: [0, 0.3, 0.01], boostKick: [0, 10, 0.25],
  steerLow: [0.5, 5, 0.05], steerHigh: [0.3, 4, 0.05], steerResponse: [1, 25, 0.5], grip: [1, 25, 0.25],
  gripTransfer: [0, 1, 0.01], airSteer: [0, 1, 0.05],
  driftMinSpeed: [0, 20, 0.5], driftGrip: [0.1, 6, 0.1], driftSteer: [0.5, 5, 0.05], driftMaxAngle: [0.2, 1.2, 0.02], driftCharge: [0, 2, 0.05], driftKick: [0, 15, 0.25],
  hoverHeight: [0.4, 2, 0.05], hoverStiffness: [20, 400, 5], hoverDamping: [0.1, 1.5, 0.05], gravity: [5, 40, 0.5],
  hopImpulse: [0, 15, 0.25], hopSide: [0, 10, 0.25],
  wallPenalty: [0, 0.6, 0.01], headOnKeep: [0.2, 1, 0.01],
  camDistance: [2, 12, 0.1], camHeight: [0.5, 6, 0.1], camPullBack: [0, 6, 0.1], camLookAhead: [0, 1.5, 0.05],
  camStiffness: [1, 30, 0.5], fovBase: [45, 100, 1], fovBoost: [0, 35, 1],
};

export function cloneTuning(t: Tuning): Tuning { return { ...t }; }
