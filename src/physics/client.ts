// Main-thread side of the physics worker: sends input, receives sim states, interpolates for rendering.
import PhysicsWorker from './worker.ts?worker&inline';
import type { VehicleInput, VehicleState } from '../vehicle/sim';
import type { Tuning } from '../vehicle/tuning';
import type { BoxDef } from '../world/defs';

export interface SimEvents { impact: number; landed: number; hopped: boolean; driftReleased: number; boostStarted: boolean }

export class PhysicsClient {
  worker: Worker;
  prev!: VehicleState; cur!: VehicleState; alpha = 0;
  ev: SimEvents = { impact: 0, landed: 0, hopped: false, driftReleased: 0, boostStarted: false };
  camFree = 6;
  ready = false;
  rapierVersion = '';
  private inflight = 0;
  private evAcc: SimEvents = { impact: 0, landed: 0, hopped: false, driftReleased: 0, boostStarted: false };
  onError: (msg: string) => void = (m) => console.error(m);

  constructor() {
    this.worker = new PhysicsWorker();
    this.worker.onmessage = (e) => this.onMsg(e.data);
    this.worker.onerror = (e) => this.onError('physics worker: ' + e.message);
  }

  init(chunks: Record<string, BoxDef[]>, spawn: [number, number, number], yaw: number, tuning: Tuning) {
    return new Promise<void>((res) => {
      this.readyCb = res;
      this.worker.postMessage({ type: 'init', chunks, spawn, yaw, tuning });
    });
  }
  private readyCb: (() => void) | null = null;

  private onMsg(m: any) {
    if (m.type === 'ready') { this.prev = m.state; this.cur = m.state; this.ready = true; this.rapierVersion = m.version; this.readyCb?.(); }
    else if (m.type === 'state') {
      this.inflight = Math.max(0, this.inflight - 1);
      this.prev = m.prev; this.cur = m.cur; this.alpha = m.alpha; this.camFree = m.camFree;
      const a = this.evAcc, b = m.ev as SimEvents;
      a.impact = Math.max(a.impact, b.impact); a.landed = Math.max(a.landed, b.landed); a.hopped ||= b.hopped;
      a.driftReleased = Math.max(a.driftReleased, b.driftReleased); a.boostStarted ||= b.boostStarted;
    } else if (m.type === 'error') this.onError(m.message);
  }

  /** Send this frame's input; at most 2 frames in flight so a slow worker never builds a queue. */
  frame(dt: number, input: VehicleInput, cam: { pivot: number[]; dir: number[]; len: number; bike: number[] }) {
    if (!this.ready || this.inflight > 2) return;
    this.inflight++;
    this.worker.postMessage({ type: 'frame', dt, input, cam });
  }

  /** Events since the last call (consumed by audio / fx). */
  takeEvents(): SimEvents {
    const e = this.evAcc;
    this.evAcc = { impact: 0, landed: 0, hopped: false, driftReleased: 0, boostStarted: false };
    return e;
  }

  setTuning(t: Tuning) { this.worker.postMessage({ type: 'tuning', tuning: t }); }
  teleport(x: number, y: number, z: number, yaw: number, speed = 0) { this.worker.postMessage({ type: 'teleport', x, y, z, yaw, speed }); }
  freeze(on: boolean) { this.worker.postMessage({ type: 'freeze', on }); }
  addChunk(key: string, boxes: BoxDef[]) { this.worker.postMessage({ type: 'addChunk', key, boxes }); }
  removeChunk(key: string) { this.worker.postMessage({ type: 'removeChunk', key }); }

  /** Interpolated render pose. */
  pose() {
    const a = this.prev, b = this.cur, t = Math.min(1, this.alpha);
    let dy = b.yaw - a.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, yaw: a.yaw + dy * t };
  }
}
