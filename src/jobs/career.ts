// Career loop: fixer markers + prompts, dialogue → job offer, job progress (delivery / chase / dark run),
// failure + retry, ratings, credits, upgrades (applied to tuning / stealth) and save. Ambient sweeper drones
// patrol the district in free roam so heat can happen outside jobs too.
import * as THREE from 'three/webgpu';
import { float, uv, time, sin, abs, vec3, smoothstep } from 'three/tsl';
import { FIXERS, JOBS, JobRunner, UPGRADES, loadSave, rate, writeSave, type Fixer, type JobDef, type SaveData } from './jobs';
import type { NavUI } from '../ui/nav';
import type { UI } from '../ui/ui';
import type { HeatSystem, PlayerView } from '../heat/heat';
import type { ActionState } from '../input/actions';
import { glyph } from '../input/actions';
import type { VehicleState } from '../vehicle/sim';
import type { SimEvents } from '../physics/client';
import type { GameAudio } from '../audio/audio';
import type { Tuning } from '../vehicle/tuning';
import { distFade } from '../materials/materials';
import type { WorldDef } from '../world/defs';

function beam(color: string, radius: number, height: number, strength: number) {
  const g = new THREE.CylinderGeometry(radius, radius, height, 20, 1, true); g.translate(0, height / 2, 0);
  const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const c = new THREE.Color(color), v = uv().y;
  const pulse = sin(time.mul(3.0).sub(v.mul(40.0))).mul(0.25).add(0.75);
  m.colorNode = vec3(c.r, c.g, c.b).mul(float(1).sub(v).pow(1.5).mul(pulse).mul(strength)).mul(distFade().mul(0.7).add(0.3));
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 2.2, radius * 2.6, 40), new THREE.MeshBasicNodeMaterial({ color: c.clone().multiplyScalar(4), side: THREE.DoubleSide, fog: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.25;
  const grp = new THREE.Group(); grp.add(new THREE.Mesh(g, m), ring);
  return grp;
}

export class Career {
  save: SaveData = loadSave();
  run = new JobRunner();
  fixers: Fixer[];
  private markers: THREE.Group[] = [];
  private objBeam: THREE.Group;
  private talking: Fixer | null = null;
  private offered: JobDef | null = null;
  private airT = 0;
  private resultOpen = false;
  private lastJob: JobDef | null = null;
  stealthMul = 1;
  onTuning: (t: Tuning) => void = () => {};
  constructor(private scene: THREE.Scene, world: WorldDef, private nav: NavUI, private ui: UI, private heat: HeatSystem, private audio: GameAudio, private baseTuning: Tuning) {
    const h = world.anchors.hoshi;
    this.fixers = FIXERS.map((f) => f.id === 'kiso' && h ? { ...f, pos: [h.pos[0] + Math.sin(h.yaw) * 4.5, 0, h.pos[2] + Math.cos(h.yaw) * 4.5] as [number, number, number] } : f);
    for (const f of this.fixers) { const b = beam(f.color, 0.6, 26, 0.6); b.position.set(...f.pos); scene.add(b); this.markers.push(b); }
    this.objBeam = beam('#ffa142', 1.4, 160, 1.6); this.objBeam.visible = false; scene.add(this.objBeam);
    nav.blip = (p) => audio.blip(p);
    this.applyUpgrades();
    // ambient sweepers: free-roam searchlights so heat can happen anywhere
    const sweeps: [number, number][][] = [[[-130, -300], [-130, 300]], [[190, -300], [190, 300]], [[-300, -230], [270, -230]], [[-300, 60], [-140, 60]]];
    for (const p of sweeps) heat.add('sweeper', new THREE.Vector3(p[0][0], 18, p[0][1]), [...p, p[0]].map(([x, z]) => new THREE.Vector3(x, 18, z)));
  }

  applyUpgrades() {
    const u = this.save.upgrades, t = { ...this.baseTuning };
    if (u.thrusters) { t.maxSpeed += 2; t.boostSpeed += 2; t.accel += 2; }
    if (u.tank) t.boostDrain *= 0.7;
    this.stealthMul = u.coils ? 1.5 : 1;
    this.onTuning(t);
  }

  garageMenu() {
    return UPGRADES.map((g) => ({
      label: `${g.name} — ${this.save.upgrades[g.id] ? 'INSTALLED' : '¤ ' + g.cost}`, kind: 'button' as const,
      on: () => {
        if (this.save.upgrades[g.id]) { this.ui.toast('ALREADY INSTALLED'); return; }
        if (this.save.credits < g.cost) { this.ui.toast('NOT ENOUGH CREDITS'); return; }
        this.save.credits -= g.cost; this.save.upgrades[g.id] = 1; writeSave(this.save); this.applyUpgrades(); this.ui.toast(g.name.toUpperCase() + ' INSTALLED', 2);
      },
    }));
  }

  private nextJobFor(f: Fixer) {
    const list = JOBS.filter((j) => j.fixer === f.id);
    return list.find((j) => !this.save.done[j.id]) ?? list[Math.floor(Math.random() * list.length)];
  }

  startJob(job: JobDef) {
    this.run.start(job); this.lastJob = job;
    this.heat.clear('hound'); this.heat.clear('drone'); this.heat.clear('patrol');
    if (job.type === 'chase') {
      const h = this.heat.add('hound', new THREE.Vector3(...this.fixers.find((f) => f.id === job.fixer)!.pos).add(new THREE.Vector3(30, 25, 30)));
      h.tracking = true; h.lastSeen.set(...this.fixers.find((f) => f.id === job.fixer)!.pos);
      this.heat.setHeat(2);
    }
    if (job.type === 'dark') for (const p of job.sweepers ?? []) this.heat.add('sweeper', new THREE.Vector3(...p[0]), p.map((q) => new THREE.Vector3(...q)));
    this.ui.toast(job.title.toUpperCase(), 2.5);
  }

  /** Returns true while the career UI owns input (dialogue / cards). */
  update(dt: number, s: VehicleState, a: ActionState, ev: SimEvents, camYaw: number, lightsOn: boolean): boolean {
    const P: PlayerView = { x: s.x, y: s.y, z: s.z, vx: s.vx, vz: s.vz, speed: s.speed, lightsOn, stealthMul: this.stealthMul };
    this.heat.update(dt, P);
    const run = this.run;
    let owns = false;
    // dialogue / result cards
    if (this.nav.dialogOpen) {
      owns = true;
      if (a.pressed.pause || a.pressed.menuBack) { this.nav.closeDialog(); this.talking = null; this.offered = null; }
      else this.nav.dialogTick(dt, a.pressed.interact);
    } else if (this.resultOpen) {
      owns = true;
      if (a.pressed.interact || a.pressed.menuConfirm) {
        this.resultOpen = false; this.nav.showCard(null);
        if (run.phase === 'failed' && this.lastJob) { run.phase = 'idle'; this.startJob(this.lastJob); }
        else run.phase = 'idle';
        this.heat.clear('hound'); this.heat.clear('sweeper'); this.restoreAmbient();
      } else if (a.pressed.pause || a.pressed.menuBack) { this.resultOpen = false; this.nav.showCard(null); run.phase = 'idle'; this.heat.clear('hound'); this.heat.clear('sweeper'); this.restoreAmbient(); }
    }
    // fixer proximity
    let prompt: string | null = null;
    if (run.phase === 'idle' && !owns) {
      for (const f of this.fixers) {
        const d = Math.hypot(f.pos[0] - s.x, f.pos[2] - s.z);
        if (d < 9 && Math.abs(f.pos[1] - s.y) < 4) {
          prompt = s.speed < 7 ? `<b>${glyph('interact')}</b>Talk to ${f.name}` : `Slow down to talk to ${f.name}`;
          if (s.speed < 7 && a.pressed.interact) {
            const job = this.nextJobFor(f); this.talking = f; this.offered = job;
            this.nav.dlgPitch = f.pitch;
            this.nav.dialog(f.name, f.color, [...f.greet, ...job.brief, `${job.title} — pays ¤ ${job.reward}. ${job.type === 'delivery' ? `You have ${job.time} seconds.` : ''}`],
              `${glyph('interact')} next / accept · ${glyph('pause')} not now`, () => { if (this.offered) this.startJob(this.offered); this.talking = null; this.offered = null; });
            owns = true; prompt = null;
          }
        }
      }
    }
    this.nav.showPrompt(owns ? null : prompt);
    // job progress
    if (run.phase === 'active' && run.job) {
      const job = run.job;
      run.t += dt; run.maxHeat = Math.max(run.maxHeat, this.heat.heat);
      // style: drift releases, air time, high-speed boosting
      if (ev.driftReleased > 0) run.style += 25 + ev.driftReleased * 8;
      if (!s.grounded) this.airT += dt; else { if (this.airT > 0.5) run.style += this.airT * 90; this.airT = 0; }
      if (s.boosting && s.speed > 30) run.style += 18 * dt;
      let objText = `Deliver: ${job.dropName}`;
      if (job.type === 'chase' && !run.shaken) {
        const hound = this.heat.pursuers.find((p) => p.kind === 'hound');
        const seen = this.heat.seen;
        run.shakeT = seen ? 0 : run.shakeT + dt;
        objText = `Shake the Hound ${seen ? '— it sees you' : `— hidden ${run.shakeT.toFixed(1)} / 6 s`}`;
        if (run.shakeT >= 6 || !hound) { run.shaken = true; if (hound) hound.leaving = true; this.ui.toast('HOUND SHAKEN', 2); this.audio.blip(1.6); }
      }
      if (job.type === 'dark') objText = `Stay dark → ${job.dropName}`;
      this.nav.jobPanel(job, job.time - run.t, objText);
      const d = Math.hypot(job.drop[0] - s.x, job.drop[2] - s.z);
      if (run.shaken && d < 8 && Math.abs(job.drop[1] - s.y) < 4 && s.speed < 16) this.finish(true);
      else if (run.t > job.time) this.finish(false);
      else if (job.type === 'dark' && this.heat.spotted) this.finish(false);
    } else this.nav.jobPanel(null, 0, '');
    const obj = run.phase === 'active' && run.job && run.shaken ? run.job.drop : null;
    this.objBeam.visible = !!obj; if (obj) this.objBeam.position.set(...obj);
    for (const m of this.markers) m.visible = run.phase === 'idle';
    return owns;
  }

  private restoreAmbient() { /* ambient sweepers are permanent; job sweepers are cleared and re-added below */
    if (!this.heat.pursuers.some((p) => p.kind === 'sweeper')) {
      const sweeps: [number, number][][] = [[[-130, -300], [-130, 300]], [[190, -300], [190, 300]], [[-300, -230], [270, -230]], [[-300, 60], [-140, 60]]];
      for (const p of sweeps) this.heat.add('sweeper', new THREE.Vector3(p[0][0], 18, p[0][1]), [...p, p[0]].map(([x, z]) => new THREE.Vector3(x, 18, z)));
    }
  }

  private finish(ok: boolean) {
    const run = this.run, job = run.job!;
    this.resultOpen = true;
    if (ok) {
      const r = rate(job, run.t, run.style, run.maxHeat);
      this.save.credits += r.reward;
      const prev = this.save.done[job.id];
      if (!prev || r.stars > prev.stars || (r.stars === prev.stars && r.time < prev.best)) this.save.done[job.id] = { stars: Math.max(prev?.stars ?? 0, r.stars), best: Math.min(prev?.best ?? 1e9, r.time) };
      writeSave(this.save);
      run.phase = 'done';
      this.nav.ratingCard(job, r, job.success);
      this.audio.blip(1.2); this.audio.blip(1.5);
    } else {
      run.phase = 'failed';
      this.nav.showCard(`<h2>JOB FAILED</h2><p>${job.title}</p><p>“${job.fail}”</p><p>${glyph('interact')} retry · ${glyph('pause')} give up</p>`);
      this.audio.blip(0.6);
    }
  }

  markers2D() { return this.fixers.map((f) => ({ x: f.pos[0], z: f.pos[2], color: f.color })); }
  get objective() { const o = this.run.phase === 'active' && this.run.job && this.run.shaken ? this.run.job.drop : null; return o ? { x: o[0], z: o[2] } : null; }
}
export const _cr = { abs, smoothstep };
