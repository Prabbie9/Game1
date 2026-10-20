// Physics worker: owns Rapier + the vehicle simulation at a fixed 120 Hz.
// Main thread sends input each frame; worker replies with the last two sim states for interpolation.
import RAPIER from '@dimforge/rapier3d-compat';
import { RapierWorld } from './query';
import { createState, stepVehicle, SIM_DT, teleport, VehicleInput, VehicleState, NO_INPUT } from '../vehicle/sim';
import { BALANCED, Tuning } from '../vehicle/tuning';
import type { BoxDef } from '../world/defs';

let world: RapierWorld | null = null;
let state: VehicleState;
let prev: VehicleState;
let T: Tuning = { ...BALANCED };
let acc = 0;
let pendingHopL = false, pendingHopR = false;
let frozen = false;

const post = (m: any) => (self as any).postMessage(m);

self.onmessage = async (e: MessageEvent) => {
  const m = e.data;
  try {
    switch (m.type) {
      case 'init': {
        await RAPIER.init();
        world = new RapierWorld(RAPIER);
        for (const k of Object.keys(m.chunks)) world.addBoxes(k, m.chunks[k] as BoxDef[]);
        if (m.tuning) T = m.tuning;
        state = createState(m.spawn[0], m.spawn[1], m.spawn[2], m.yaw);
        for (let i = 0; i < 90; i++) stepVehicle(state, NO_INPUT, T, world);
        prev = { ...state };
        post({ type: 'ready', state, version: RAPIER.version() });
        break;
      }
      case 'addChunk': world?.addBoxes(m.key, m.boxes); break;
      case 'removeChunk': world?.removeKey(m.key); break;
      case 'tuning': T = m.tuning; break;
      case 'freeze': frozen = m.on; break;
      case 'teleport': if (state && world) { teleport(state, m.x, m.y, m.z, m.yaw); if (m.speed) { state.vx = -Math.sin(m.yaw) * m.speed; state.vz = -Math.cos(m.yaw) * m.speed; } for (let i = 0; i < 30; i++) stepVehicle(state, NO_INPUT, T, world); prev = { ...state }; acc = 0; } break;
      case 'frame': {
        if (!world || !state) return;
        const inp = m.input as VehicleInput;
        pendingHopL ||= inp.hopLeft; pendingHopR ||= inp.hopRight;
        acc += Math.min(0.1, m.dt);
        let impact = 0, landed = 0, hopped = false, driftReleased = 0, boostStarted = false, steps = 0;
        while (acc >= SIM_DT && !frozen) {
          acc -= SIM_DT;
          prev = { ...state };
          stepVehicle(state, { ...inp, hopLeft: pendingHopL, hopRight: pendingHopR }, T, world);
          pendingHopL = pendingHopR = false;
          impact = Math.max(impact, state.impact); landed = Math.max(landed, state.landed);
          hopped ||= state.hopped; driftReleased = Math.max(driftReleased, state.driftReleased); boostStarted ||= state.boostStarted;
          steps++;
        }
        if (frozen) acc = 0;
        // camera arm collision for the arm the main thread asked about
        let camFree = m.cam ? m.cam.len : 0;
        if (m.cam) {
          const [px, py, pz] = m.cam.pivot; const [dx, dy, dz] = m.cam.dir;
          // re-anchor the pivot to the newest bike position (pivot = bike + 1 m up)
          const ox = state.x - m.cam.bike[0], oy = state.y - m.cam.bike[1], oz = state.z - m.cam.bike[2];
          camFree = Math.max(0.35, world.castSphere(px + ox, py + oy, pz + oz, dx, dy, dz, m.cam.len, 0.3) - 0.05);
        }
        post({ type: 'state', prev, cur: state, alpha: acc / SIM_DT, steps, ev: { impact, landed, hopped, driftReleased, boostStarted }, camFree });
        break;
      }
    }
  } catch (err) { post({ type: 'error', message: String((err as Error)?.stack ?? err) }); }
};
