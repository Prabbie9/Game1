// FUN GATE (bot-measured proxies) — runs the real vehicle sim + Rapier in Node, no browser.
// Usage: npx tsx tools/fungate.ts [preset]   → prints JSON + human summary
import RAPIER from '@dimforge/rapier3d-compat';
import { RapierWorld } from '../src/physics/query';
import { buildTestArea } from '../src/world/testarea';
import { buildSlice } from '../src/world/slice';
import { createState, stepVehicle, SIM_DT, NO_INPUT, VehicleInput, VehicleState, teleport } from '../src/vehicle/sim';
import { PRESETS } from '../src/vehicle/tuning';
import { Bot } from '../src/bot/bot';
import { createChase, updateChase } from '../src/camera/chase';

await RAPIER.init();
const presetName = process.argv[2] ?? 'Balanced';
const T = PRESETS[presetName];
const W = buildTestArea();
const q = new RapierWorld(RAPIER);
q.addBoxes('test', W.boxes);
const out: Record<string, any> = { preset: presetName };

function settle(s: VehicleState) { for (let i = 0; i < 120; i++) stepVehicle(s, NO_INPUT, T, q); }
function spawn(x: number, z: number, yaw: number, y = 1) { const s = createState(x, y, z, yaw); settle(s); return s; }

// 1. standstill → cruise (20 m/s)
{
  const s = spawn(-150, 180, -Math.PI / 2);
  let t = 0, tCruise = -1, t24 = -1;
  while (t < 8) { stepVehicle(s, { ...NO_INPUT, throttle: 1 }, T, q); t += SIM_DT; if (tCruise < 0 && s.speed >= 20) tCruise = t; if (t24 < 0 && s.speed >= T.maxSpeed * 0.97) t24 = t; }
  out.accel = { tToCruise: +tCruise.toFixed(2), tTo97pctTop: +t24.toFixed(2), pass: tCruise >= 1.8 && tCruise <= 2.2 };
  // 2. boost from top speed
  let tb = 0, maxV = 0, tTarget = -1;
  while (tb < 4) { stepVehicle(s, { ...NO_INPUT, throttle: 1, boost: true }, T, q); tb += SIM_DT; maxV = Math.max(maxV, s.speed); if (tTarget < 0 && s.speed >= T.boostSpeed * 0.95) tTarget = tb; }
  out.boost = { maxSpeed: +maxV.toFixed(1), target: T.boostSpeed, tTo95pct: +tTarget.toFixed(2), meterLeft: +s.boost.toFixed(2), pass: maxV >= T.boostSpeed * 0.95 };
}

// 3. wall hits at several angles (no dead-stops: speed must stay >= 20% within 0.5 s)
{
  const res: any[] = [];
  // building face north of street z = 180 is at z ≈ 170; approach heading north-ish
  for (const ang of [90, 60, 45, 30, 10]) {
    const s = spawn(-60, 182, 0);
    const a = (90 - ang) * Math.PI / 180; // ang = angle between velocity and wall plane
    s.yaw = -a; const v = 20; s.vx = -Math.sin(s.yaw) * v; s.vz = -Math.cos(s.yaw) * v;
    let hitT = -1, minRatio = 1, t = 0;
    while (t < 3) {
      stepVehicle(s, { ...NO_INPUT, throttle: 1 }, T, q); t += SIM_DT;
      if (hitT < 0 && s.impact > 0.5) hitT = t;
      if (hitT >= 0 && t - hitT <= 0.5) minRatio = Math.min(minRatio, s.speed / v);
      if (hitT >= 0 && t - hitT > 0.5) break;
    }
    res.push({ angleDeg: ang, hit: hitT >= 0, minSpeedRatio: +minRatio.toFixed(2), pass: hitT < 0 || minRatio >= 0.2 });
  }
  out.walls = { cases: res, pass: res.every(r => r.pass) };
}

// 4. drift: hold drift + steer for 1.6 s at speed, then release
{
  const s = spawn(-150, 180, -Math.PI / 2);
  for (let i = 0; i < 300; i++) stepVehicle(s, { ...NO_INPUT, throttle: 1 }, T, q);
  s.boost = 0.2; const b0 = s.boost; let maxSlip = 0; let kick = 0;
  for (let i = 0; i < 192; i++) { stepVehicle(s, { ...NO_INPUT, throttle: 1, steer: 1, drift: true }, T, q); maxSlip = Math.max(maxSlip, Math.abs(s.slip)); }
  const vBefore = s.speed;
  for (let i = 0; i < 6; i++) { stepVehicle(s, { ...NO_INPUT, throttle: 1 }, T, q); kick = Math.max(kick, s.driftReleased); }
  out.drift = { boostGained: +(s.boost - b0).toFixed(2), maxSlip: +maxSlip.toFixed(1), releaseKick: +kick.toFixed(1), speedAtRelease: +vBefore.toFixed(1), speedKeptPct: +(100 * vBefore / 24).toFixed(0), pass: s.boost - b0 > 0.15 && kick > 0 && vBefore > 14 };
}

// 5. gap analysis on the deck (x 20..26, top y = 10)
{
  const trial = (speed: number, hop: boolean, boost: boolean) => {
    const s = spawn(-10, -90, -Math.PI / 2, 11.5);
    s.vx = speed; // heading east
    for (let i = 0; i < 360; i++) {
      const inp: VehicleInput = { ...NO_INPUT, throttle: 1, boost, hopLeft: hop && s.x > 16 && s.x < 19, hopRight: hop && s.x > 16 && s.x < 19 };
      stepVehicle(s, inp, T, q);
      if (s.x > 32) return s.y > 9.5 ? 'cleared' : 'fell';
      if (s.y < 8) return 'fell';
    }
    return 'stuck';
  };
  const g = { cruiseNoHop: trial(20, false, false), cruiseHop: trial(20, true, false), slowHop: trial(12, true, false), boostNoHop: trial(33, false, true), boostHop: trial(33, true, true) };
  const trivial = g.cruiseNoHop === 'cleared' && g.slowHop === 'cleared';
  const impossible = g.boostHop !== 'cleared' && g.cruiseHop !== 'cleared';
  out.gaps = { deckGap6m: g, flag: trivial ? 'TRIVIAL' : impossible ? 'IMPOSSIBLE' : 'OK', pass: !impossible };
}

// 6. course run with camera checks
{
  const R = W.routes.loop;
  const bot = new Bot({ pts: R.pts, hops: [[17, -90]] });
  const s = spawn(R.pts[0][0], R.pts[0][1], -Math.PI / 2);
  const cam = createChase(s);
  const castArm = (p: [number, number, number], d: [number, number, number], len: number) => Math.max(0.3, q.castSphere(p[0], p[1], p[2], d[0], d[1], d[2], len, 0.3) - 0.05);
  let t = 0, stuck = 0, maxStuck = 0, clips = 0, offView = 0, frames = 0, impacts = 0, drifts = 0, boosts = 0, hops = 0;
  let wallFails = 0, lastImpactT = -9, impactV = 0, minAfter = 99, falls = 0;
  const camDt = 1 / 60; let camAcc = 0;
  let logT = 0;
  while (!bot.done && t < 300) {
    if (process.env.TRACE && t - logT > 2) { logT = t; console.error(t.toFixed(0), 'seg', bot.seg, s.x.toFixed(0), s.y.toFixed(1), s.z.toFixed(0), 'v', s.speed.toFixed(1)); }
    const inp = bot.drive(s, T);
    const wasDrift = s.drifting;
    stepVehicle(s, inp, T, q); t += SIM_DT;
    if (s.drifting && !wasDrift) drifts++;
    if (s.boostStarted) boosts++; if (s.hopped) hops++;
    if (s.impact > 1) { impacts++; if (t - lastImpactT > 0.6) { lastImpactT = t; impactV = s.speed + s.impact; minAfter = 99; } }
    if (t - lastImpactT <= 0.5) minAfter = Math.min(minAfter, s.speed);
    else if (minAfter < 99) { if (impactV > 5 && minAfter < 0.2 * impactV) wallFails++; minAfter = 99; }
    if (s.y < -3 && s.surface !== 'water') falls++;
    if (s.speed < 2) { stuck += SIM_DT; maxStuck = Math.max(maxStuck, stuck); } else stuck = 0;
    camAcc += SIM_DT;
    if (camAcc >= camDt) {
      camAcc -= camDt; frames++;
      updateChase(cam, s, T, camDt, { dx: 0, dy: 0 }, castArm);
      if (q.insideSolid(cam.x, cam.y, cam.z, 0.12)) clips++;
      // bike within the central part of the view
      const fx = cam.tx - cam.x, fy = cam.ty - cam.y, fz = cam.tz - cam.z, bx = s.x - cam.x, by = s.y - cam.y, bz = s.z - cam.z;
      const cos = (fx * bx + fy * by + fz * bz) / (Math.hypot(fx, fy, fz) * Math.hypot(bx, by, bz) + 1e-6);
      if (Math.acos(Math.min(1, cos)) > (cam.fov / 2) * Math.PI / 180 * 0.8) offView++;
    }
  }
  out.course = { finished: bot.done, time: +t.toFixed(1), band: R.targetTime, inBand: t >= R.targetTime[0] && t <= R.targetTime[1], impacts, wallDeadStops: wallFails, maxStuckSec: +maxStuck.toFixed(2), drifts, boosts, hops,
    cameraClipFrames: clips, bikeOffViewFrames: offView, camFrames: frames, pass: bot.done && t >= R.targetTime[0] && t <= R.targetTime[1] && wallFails === 0 && clips === 0 && offView === 0 };
}
// 7. every route in the look slice: completes, in band, no dead-stops, camera never clips
{
  const SW = buildSlice(); const qs = new RapierWorld(RAPIER); qs.addBoxes('slice', SW.boxes);
  const res: any = {};
  for (const [name, R] of Object.entries(SW.routes)) {
    const bot = new Bot({ pts: R.pts });
    const a = R.pts[0], b = R.pts[1];
    const s = createState(a[0], name === 'skyway' ? 1 : 1, a[1], Math.atan2(-(b[0] - a[0]), -(b[1] - a[1])));
    for (let i = 0; i < 120; i++) stepVehicle(s, NO_INPUT, T, qs);
    const cam = createChase(s);
    const castArm = (p: [number, number, number], d: [number, number, number], len: number) => Math.max(0.3, qs.castSphere(p[0], p[1], p[2], d[0], d[1], d[2], len, 0.3) - 0.05);
    let t = 0, clips = 0, deadStops = 0, lastImp = -9, impV = 0, minAfter = 99, maxStuck = 0, stuck = 0, acc = 0, water = 0, maxY = 0;
    while (!bot.done && t < 200) {
      stepVehicle(s, bot.drive(s, T), T, qs); t += SIM_DT;
      if (s.surface === 'water' && s.grounded) water += SIM_DT; maxY = Math.max(maxY, s.y);
      if (s.impact > 1 && t - lastImp > 0.6) { lastImp = t; impV = s.speed + s.impact; minAfter = 99; }
      if (t - lastImp <= 0.5) minAfter = Math.min(minAfter, s.speed); else if (minAfter < 99) { if (impV > 5 && minAfter < 0.2 * impV) deadStops++; minAfter = 99; }
      if (s.speed < 2) { stuck += SIM_DT; maxStuck = Math.max(maxStuck, stuck); } else stuck = 0;
      acc += SIM_DT; if (acc >= 1 / 60) { acc -= 1 / 60; updateChase(cam, s, T, 1 / 60, { dx: 0, dy: 0 }, castArm); if (qs.insideSolid(cam.x, cam.y, cam.z, 0.12)) clips++; }
    }
    res[name] = { finished: bot.done, time: +t.toFixed(1), band: R.targetTime, deadStops, camClips: clips, maxStuck: +maxStuck.toFixed(1), waterSec: +water.toFixed(1), maxY: +maxY.toFixed(1),
      pass: bot.done && t >= R.targetTime[0] && t <= R.targetTime[1] && deadStops === 0 && clips === 0 };
  }
  out.sliceRoutes = { ...res, pass: Object.values(res).every((r: any) => r.pass) };
}
out.pass = Object.values(out).every((v: any) => typeof v !== 'object' || v.pass !== false);
console.log(JSON.stringify(out, null, 1));
